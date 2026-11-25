
import { WebSocket, WebSocketServer } from "ws";
import { spawn, ChildProcess } from "child_process";
import path from "path";

const PORT = 3001;

const PYTHON_DIR = path.resolve(process.cwd(), "python");

const wss = new WebSocketServer({ port: PORT });

type DownloadStatus = "idle" | "running" | "completed" | "failed";

let status: DownloadStatus = "idle";
let processInstance: ChildProcess | null = null;

const recentLogs: string[] = [];
const MAX_LOGS = 100;

function broadcast(data: object) {
  const message = JSON.stringify(data);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function log(line: string, stream: string) {
  // Remove terminal ANSI escape sequences.
  const clean = line.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");

  if (!clean.trim()) return;

  recentLogs.push(clean);

  if (recentLogs.length > MAX_LOGS) {
    recentLogs.shift();
  }

  broadcast({
    type: "download:log",
    message: clean,
    stream,
  });

  // Extract percentages from the Modal progress output.
  const match = clean.match(/\b(\d{1,3})%/);

  if (match) {
    broadcast({
      type: "download:progress",
      percent: Math.min(100, Number(match[1])),
      message: clean,
    });
  }
}

function startDownload() {
  // Avoid launching multiple downloads simultaneously.
  if (status === "running") {
    broadcast({ type: "download:status", status });
    return;
  }
  if (status === "completed") {
    broadcast({ type: "download:status", status });
    return;
  }

  status = "running";
  recentLogs.length = 0;

  broadcast({
    type: "download:status",
    status: "running",
  });

  console.log("Starting Modal model download...");

  processInstance = spawn(
    "modal",
    ["run", "claude_inference.py::download"],
    {
      cwd: PYTHON_DIR,
      env: process.env,
      shell: false,
    }
  );

  let stdoutBuffer = "";
  let stderrBuffer = "";

  processInstance.stdout?.on("data", (data: Buffer) => {
    stdoutBuffer += data.toString();

    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      log(line, "stdout");
    }
  });

  processInstance.stderr?.on("data", (data: Buffer) => {
    stderrBuffer += data.toString();

    const lines = stderrBuffer.split(/\r?\n/);
    stderrBuffer = lines.pop() ?? "";

    for (const line of lines) {
      log(line, "stderr");
    }
  });

  processInstance.on("error", (error) => {
    log(error.message, "error");
    status = "failed";

    broadcast({
      type: "download:status",
      status: "failed",
      error: error.message,
    });

    processInstance = null;
  });

  processInstance.on("close", (code) => {
    if (stdoutBuffer.trim()) log(stdoutBuffer, "stdout");
    if (stderrBuffer.trim()) log(stderrBuffer, "stderr");

    status = code === 0 ? "completed" : "failed";

    broadcast({
      type: "download:status",
      status,
      exitCode: code,
    });

    processInstance = null;

    console.log(`Modal download finished with exit code ${code}`);
  });
}

wss.on("connection", (socket) => {
  console.log("WebSocket client connected.");

  // Give newly connected clients the current state.
  socket.send(
    JSON.stringify({
      type: "download:status",
      status,
    })
  );

  // Replay recent output if a download is running.
  for (const message of recentLogs) {
    socket.send(
      JSON.stringify({
        type: "download:log",
        message,
        stream: "history",
      })
    );
  }

  socket.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === "download:start") {
        startDownload();
      }
    } catch {
      socket.send(
        JSON.stringify({
          type: "error",
          message: "Invalid WebSocket message.",
        })
      );
    }
  });

  socket.on("close", () => {
    console.log("WebSocket client disconnected.");
  });
});

console.log(`WebSocket server listening on port ${PORT}`);
