"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import styles from "./infer.module.css";
import ZigzagBackground from "@/src/components/ZigzagBackground";
import Combobox from "@/src/components/Combobox";

type Message = {
  role: "user" | "assistant";
  content: string;
  model?: string;
};

const models = [
  "meta-llama/Llama-3.2-3B",
  "Qwen/Qwen3-4B",
  "mistralai/Ministral-8B-Instruct-2410",
];

export default function InferPage() {
  const [model, setModel] = useState(models[0]);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = prompt.trim();

    if (!value) return;

    const ws = wsRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not connected.");
      return;
    }

    setMessages((previous) => [
      ...previous,
      { role: "user", content: value },
    ]);

    setPrompt("");

    ws.send(
      JSON.stringify({
        type: "download:start",
      })
    );
  }

  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadLogs, setDownloadLogs] = useState<string[]>([]);
  useEffect(() => {
    const ws = new WebSocket(
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001"
    );

    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "download:status":
          setDownloadStatus(data.status);

          if (data.status === "completed") {
            setDownloadProgress(100);
          }

          break;

        case "download:progress":
          setDownloadProgress(data.percent);
          break;

        case "download:log":
          setDownloadLogs((previous) => [
            ...previous.slice(-99),
            data.message,
          ]);
          break;

        case "error":
          console.error(data.message);
          break;
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  return (
    <>
      <ZigzagBackground />

      <main className={styles.page}>
        <header className={styles.header}>
          <Link href="/" className={styles.logo}>
            GO-WRAP
          </Link>

          <span className={styles.headerLabel}>INFERENCE PLAYGROUND</span>
        </header>

        <section className={styles.content}>
          <div className={styles.heading}>
            <h1>Talk to a model.</h1>
            <p>Experiment with open models through a unified interface.</p>
          </div>

          <div className={styles.modelSelector}>
            <label htmlFor="model">MODEL</label>

            <Combobox
              options={models}
              value={model}
              onChange={setModel}
              placeholder="Select a model..."
            />
          </div>

          <div className={styles.chat}>
            {downloadStatus === "running" && (
              <div className={styles.downloadProgress}>
                <div>
                  <span>DOWNLOADING MODEL</span>
                  <span>{downloadProgress}%</span>
                </div>

                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressBar}
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>

                <pre>
                  {downloadLogs.slice(-5).join("\n")}
                </pre>
              </div>
            )}
            {downloadStatus === "completed" && (
              <p style={{marginLeft: 20}}>Model successfully cached.</p>
            )}
            {messages.length === 0 ? (
              <div className={styles.emptyState}>
                <span>↳</span>
                <p>Your conversation starts here.</p>
              </div>
            ) : (
              <div className={styles.messages}>
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`${styles.message} ${
                      message.role === "user"
                        ? styles.userMessage
                        : styles.assistantMessage
                    }`}
                  >
                    <span>{message.role === "user" ? "YOU" : message.model?.toUpperCase() || 'MODEL'}</span>
                    <p>{message.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form className={styles.promptForm} onSubmit={handleSubmit}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Send a message..."
              rows={3}
            />

            <div className={styles.formFooter}>
              <span>{model}</span>
              <button type="submit" disabled={!connected}>
                <span>SEND ↗</span>
              </button>
            </div>
          </form>

          <p className={styles.disclaimer}>
            Responses are not connected to an inference provider yet.
          </p>
        </section>
      </main>
    </>
  );
}
