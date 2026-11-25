
import asyncio
import json
import subprocess
import urllib.error
import urllib.request

import modal


MODEL_ID = "Qwen/Qwen3.5-0.8B"
GPU = "A10G"
PORT = 8000

# Faster startup vs. maximum inference performance.
FAST_BOOT = True

app = modal.App("qwen-inference")


# Persistent caches across container launches.
hf_cache = modal.Volume.from_name(
    "qwen-hf-cache",
    create_if_missing=True,
)

vllm_cache = modal.Volume.from_name(
    "qwen-vllm-cache",
    create_if_missing=True,
)


# CUDA-enabled environment with nightly vLLM.
image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.9.0-devel-ubuntu22.04",
        add_python="3.12",
    )
    .entrypoint([])
    .uv_pip_install(
        "vllm",
        extra_index_url="https://wheels.vllm.ai/nightly",
        extra_options="--torch-backend=auto",
    )
    .env({
        "HF_XET_HIGH_PERFORMANCE": "1",
        "HF_HOME": "/root/.cache/huggingface",
        "VLLM_CACHE_ROOT": "/root/.cache/vllm",
    })
)


@app.server(
    image=image,
    gpu=GPU,
    scaledown_window=300,
    startup_timeout=900,
    port=PORT,
    volumes={
        "/root/.cache/huggingface": hf_cache,
        "/root/.cache/vllm": vllm_cache,
    },
    unauthenticated=True,
)
class Server:

    @modal.enter()
    def start(self):
        cmd = [
            "vllm",
            "serve",
            MODEL_ID,
            "--host", "0.0.0.0",
            "--port", str(PORT),
            "--served-model-name", MODEL_ID,
            "--max-model-len", "8192",
            "--gpu-memory-utilization", "0.90",
            "--tensor-parallel-size", "1",
        ]

        # FAST_BOOT disables CUDA graph capture and compilation.
        cmd.append(
            "--enforce-eager"
            if FAST_BOOT
            else "--no-enforce-eager"
        )

        print("Starting vLLM:")
        print(" ".join(cmd))

        self.process = subprocess.Popen(cmd)

    @modal.exit()
    def stop(self):
        self.process.terminate()


@app.local_entrypoint()
async def main(
    prompt: str = "Explain how a neural network works.",
):
    # Get the deployed server URL.
    url = await Server.get_url.aio()

    print(f"Waiting for server at {url}...")

    # Wait for model initialization.
    for attempt in range(450):
        try:
            with urllib.request.urlopen(
                f"{url}/health",
                timeout=5,
            ):
                break
        except (urllib.error.URLError, TimeoutError):
            await asyncio.sleep(2)
    else:
        raise RuntimeError("vLLM server failed to start")

    print("Server ready!")

    # OpenAI-compatible chat completion request.
    payload = {
        "model": MODEL_ID,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 256,
        "temperature": 0.7,
    }

    request = urllib.request.Request(
        f"{url}/v1/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=300) as response:
        result = json.loads(response.read())

    print("\nResponse:\n")
    print(result["choices"][0]["message"]["content"])
