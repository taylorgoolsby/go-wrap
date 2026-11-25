"""
Qwen/Qwen3-0.6B inference endpoint on Modal.

Setup:
    pip install modal
    modal setup

1) Prime the model cache (streams download progress to your terminal):
    modal run claude_inference.py::download

2) Deploy the endpoint:
    modal deploy claude_inference.py

3) Call the deployed endpoint:
    python claude_inference.py "Explain serverless GPUs in two sentences."
    python claude_inference.py "Solve 17*23" --thinking --temperature 0.6 --top-p 0.95

Smoke-test the GPU worker directly (no HTTP involved):
    modal run claude_inference.py::test --prompt "Hello!"

Or with curl (URL is printed by `modal deploy` and by the client):
    curl -X POST "$URL" -H "Content-Type: application/json" \
         -d '{"prompt": "Hello!"}'
"""

import argparse
import http.client
import json
import os
import sys
from urllib.parse import urljoin, urlparse

import modal

MODEL_ID = "Qwen/Qwen3-0.6B"
# MODEL_ID = "Qwen/Qwen3.5-0.8B"
MODEL_CACHE_DIR = "/model-cache"
APP_NAME = "claude-inference"
ENDPOINT_FUNCTION = "infer"

app = modal.App(APP_NAME)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch",
        "transformers>=4.51.0",  # first release with Qwen3 support
        "accelerate",
        "huggingface_hub",
        "fastapi[standard]",
    )
    .env({"HF_HOME": MODEL_CACHE_DIR})
)

# Persist downloaded weights so cold starts don't re-download the model.
model_cache = modal.Volume.from_name("qwen-model-cache", create_if_missing=True)


# --------------------------------------------------------------------------
# Cache priming: downloads the model into the Volume and logs percentages.
# --------------------------------------------------------------------------

@app.function(
    image=image,
    volumes={MODEL_CACHE_DIR: model_cache},
    timeout=1800,
)
def download_model():
    from huggingface_hub import snapshot_download
    from huggingface_hub.errors import LocalEntryNotFoundError
    from tqdm.auto import tqdm

    # Refresh the Volume before checking its contents.
    model_cache.reload()

    # Check whether the model is already cached.
    try:
        path = snapshot_download(
            MODEL_ID,
            local_files_only=True,
        )

        print(f"{MODEL_ID} is already cached.")
        print(f"Cache location: {path}")
        print("Skipping download.")
        return

    except LocalEntryNotFoundError:
        print(f"{MODEL_ID} not found in cache. Downloading...")

    class _Null:
        def write(self, _s):
            pass

        def flush(self):
            pass

    class PrintProgress(tqdm):
        """Log a plain line every 5% for readable Modal logs."""

        def __init__(self, *args, **kwargs):
            kwargs.pop("name", None)
            kwargs["disable"] = False
            kwargs["file"] = _Null()
            super().__init__(*args, **kwargs)

            self._last_pct = -1

            if self.total and self.unit == "B":
                print(
                    f"[{self.desc}] starting, "
                    f"{tqdm.format_sizeof(self.total, suffix='B', divisor=1000)} total",
                    flush=True,
                )

        def update(self, n=1):
            out = super().update(n)

            if self.total:
                pct = int(100 * self.n / self.total)

                if pct // 5 > self._last_pct // 5:
                    self._last_pct = pct

                    if self.unit == "B":
                        done = tqdm.format_sizeof(
                            self.n, suffix="B", divisor=1000
                        )
                        total = tqdm.format_sizeof(
                            self.total, suffix="B", divisor=1000
                        )

                        print(
                            f"[{self.desc}] {pct:3d}% {done} / {total}",
                            flush=True,
                        )
                    else:
                        print(
                            f"[{self.desc}] {pct:3d}% "
                            f"{int(self.n)} / {int(self.total)}",
                            flush=True,
                        )

            return out

    print(f"Downloading {MODEL_ID} into {MODEL_CACHE_DIR}...", flush=True)

    path = snapshot_download(
        MODEL_ID,
        tqdm_class=PrintProgress,
    )

    # Persist downloaded files to the Modal Volume.
    model_cache.commit()

    files = os.listdir(path)

    print(f"Done. Cached at {path}", flush=True)
    print(f"Files: {', '.join(sorted(files))}", flush=True)


@app.local_entrypoint()
def download():
    """modal run claude_inference.py::download"""
    download_model.remote()


# --------------------------------------------------------------------------
# GPU worker: loads the model once per container and serves generate calls.
# --------------------------------------------------------------------------
@app.cls(
    image=image,
    gpu="L4",
    volumes={MODEL_CACHE_DIR: model_cache},
    scaledown_window=300,  # keep the container warm for 5 min after last call
    timeout=600,
)
class Qwen:
    @modal.enter()
    def load(self):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        self.model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.bfloat16,
            device_map="cuda",
        )
        self.model.eval()

    @modal.method()
    def generate(
        self,
        prompt: str,
        system: str | None = None,
        max_new_tokens: int = 512,
        temperature: float = 0.7,
        top_p: float = 0.8,
        top_k: int = 20,
        enable_thinking: bool = False,
    ) -> str:
        import torch

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        text = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=enable_thinking,
        )
        inputs = self.tokenizer(text, return_tensors="pt").to(self.model.device)

        sample = temperature > 0
        with torch.inference_mode():
            output_ids = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=sample,
                temperature=temperature if sample else None,
                top_p=top_p if sample else None,
                top_k=top_k if sample else None,
            )

        new_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
        return self.tokenizer.decode(new_tokens, skip_special_tokens=True).strip()


@app.local_entrypoint()
def test(prompt: str = "Explain serverless GPUs in two sentences."):
    """modal run claude_inference.py::test --prompt "..."  (bypasses HTTP)"""
    print(Qwen().generate.remote(prompt))


# --------------------------------------------------------------------------
# HTTP endpoint: POST JSON {"prompt": "...", ...} -> {"text": "..."}
# --------------------------------------------------------------------------
@app.function(image=image, timeout=900)
@modal.fastapi_endpoint(method="POST")
def infer(body: dict) -> dict:
    from fastapi import HTTPException

    prompt = body.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise HTTPException(status_code=400, detail="'prompt' (string) is required")

    text = Qwen().generate.remote(
        prompt,
        system=body.get("system"),
        max_new_tokens=int(body.get("max_new_tokens", 512)),
        temperature=float(body.get("temperature", 0.7)),
        top_p=float(body.get("top_p", 0.8)),
        top_k=int(body.get("top_k", 20)),
        enable_thinking=bool(body.get("enable_thinking", False)),
    )
    return {"text": text}


# --------------------------------------------------------------------------
# Client: `python claude_inference.py "your prompt"` calls the deployed endpoint.
# --------------------------------------------------------------------------
def _resolve_url(explicit_url: str | None) -> str:
    if explicit_url:
        return explicit_url
    if os.environ.get("INFERENCE_URL"):
        return os.environ["INFERENCE_URL"]
    try:
        return modal.Function.from_name(APP_NAME, ENDPOINT_FUNCTION).get_web_url()
    except modal.exception.NotFoundError:
        raise SystemExit(
            f"App '{APP_NAME}' is not deployed. Run: modal deploy claude_inference.py"
        )


def _http(method: str, url: str, body: bytes | None = None, read_timeout: int = 600):
    """One HTTP request with a short connect timeout and a long read timeout."""
    u = urlparse(url)
    conn_cls = (
        http.client.HTTPSConnection if u.scheme == "https" else http.client.HTTPConnection
    )
    conn = conn_cls(u.netloc, timeout=15)
    try:
        conn.connect()
        conn.sock.settimeout(read_timeout)
        path = (u.path or "/") + (f"?{u.query}" if u.query else "")
        headers = {"Content-Type": "application/json"} if body else {}
        conn.request(method, path, body=body, headers=headers)
        resp = conn.getresponse()
        return resp.status, resp.getheader("Location"), resp.read()
    finally:
        conn.close()


def _main():
    parser = argparse.ArgumentParser(description="Query the deployed Qwen3-0.6B endpoint.")
    parser.add_argument("prompt", help="User prompt")
    parser.add_argument("--system", default=None, help="Optional system prompt")
    parser.add_argument("--max-new-tokens", type=int, default=512)
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--top-p", type=float, default=0.8)
    parser.add_argument("--top-k", type=int, default=20)
    parser.add_argument("--thinking", action="store_true", help="Enable Qwen3 thinking mode")
    parser.add_argument("--url", default=None, help="Endpoint URL (default: look up deployed app)")
    args = parser.parse_args()

    url = _resolve_url(args.url)
    print(f"Endpoint: {url}", file=sys.stderr)
    print("Waiting for response (a cold start can take a minute or two)...", file=sys.stderr)

    payload = json.dumps(
        {
            "prompt": args.prompt,
            "system": args.system,
            "max_new_tokens": args.max_new_tokens,
            "temperature": args.temperature,
            "top_p": args.top_p,
            "top_k": args.top_k,
            "enable_thinking": args.thinking,
        }
    ).encode()

    try:
        status, location, data = _http("POST", url, payload)
        # Modal answers long-running requests with 303 redirects; follow them with GET.
        hops = 0
        while status == 303 and location and hops < 30:
            url = urljoin(url, location)
            status, location, data = _http("GET", url)
            hops += 1
    except OSError as e:
        raise SystemExit(f"Could not reach {url}: {e!r}")

    if status != 200:
        raise SystemExit(f"HTTP {status}: {data.decode(errors='replace')}")
    print(json.loads(data)["text"])


if __name__ == "__main__":
    _main()