import { WebSocket, WebSocketServer } from "ws";
import { spawn, ChildProcess } from "child_process";
import path from "path";

const PORT = Number(process.env.PORT) || 3001;

const PYTHON_DIR = path.resolve(process.cwd(), "python");
const MODAL_BIN =
  process.env.MODAL_BIN ||
  path.join(PYTHON_DIR, ".venv", "bin", "modal");

type DownloadStatus = "idle" | "running" | "completed" | "failed";

type ClientSession = {
  status: DownloadStatus;
  process: ChildProcess | null;
  recentLogs: string[];
};

const MAX_LOGS = 100;

const wss = new WebSocketServer({ port: PORT });

function broadcast(socket: WebSocket, data: object) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function log(
  session: ClientSession,
  socket: WebSocket,
  line: string,
  stream: string,
) {
  const clean = line.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");

  if (!clean.trim()) return;

  session.recentLogs.push(clean);

  if (session.recentLogs.length > MAX_LOGS) {
    session.recentLogs.shift();
  }

  broadcast(socket, {
    type: "download:log",
    message: clean,
    stream,
  });

  const match = clean.match(/\b(\d{1,3})%/);

  if (match) {
    broadcast(socket, {
      type: "download:progress",
      percent: Math.min(100, Number(match[1])),
      message: clean,
    });
  }
}

function startDownload(session: ClientSession, socket: WebSocket) {
  if (session.status === "running") {
    broadcast(socket, {
      type: "download:status",
      status: session.status,
    });
    return;
  }

  if (session.status === "completed") {
    broadcast(socket, {
      type: "download:status",
      status: session.status,
    });
    return;
  }

  session.status = "running";
  session.recentLogs = [];

  broadcast(socket, {
    type: "download:status",
    status: "running",
  });

  console.log("Starting Modal model download...");

  const child = spawn(MODAL_BIN, ["run", "claude_inference.py::download"], {
    cwd: PYTHON_DIR,
    env: process.env,
    shell: false,
  });

  session.process = child;

  let stdoutBuffer = "";
  let stderrBuffer = "";

  child.stdout?.on("data", (data: Buffer) => {
    const output = data.toString();

    console.log(`[Modal stdout] ${output}`);

    stdoutBuffer += output;

    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      log(session, socket, line, "stdout");
    }
  });

  child.stderr?.on("data", (data: Buffer) => {
    const output = data.toString();

    console.error(`[Modal stderr] ${output}`);

    stderrBuffer += output;

    const lines = stderrBuffer.split(/\r?\n/);
    stderrBuffer = lines.pop() ?? "";

    for (const line of lines) {
      log(session, socket, line, "stderr");
    }
  });

  child.on("error", (error) => {
    console.error("[Modal spawn error]", error);

    log(session, socket, error.message, "error");

    session.status = "failed";
    session.process = null;

    broadcast(socket, {
      type: "download:status",
      status: "failed",
      error: error.message,
    });
  });

  child.on("close", (code, signal) => {
    if (stdoutBuffer.trim()) {
      log(session, socket, stdoutBuffer, "stdout");
    }

    if (stderrBuffer.trim()) {
      log(session, socket, stderrBuffer, "stderr");
    }

    console.log("[Modal process closed]", {
      code,
      signal,
    });

    session.status = code === 0 ? "completed" : "failed";
    session.process = null;

    broadcast(socket, {
      type: "download:status",
      status: session.status,
      exitCode: code,
      signal,
    });
  });
}

wss.on("connection", (socket) => {
  console.log("WebSocket client connected.");

  const session: ClientSession = {
    status: "idle",
    process: null,
    recentLogs: [],
  };

  broadcast(socket, {
    type: "download:status",
    status: session.status,
  });

  socket.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === "download:start") {
        startDownload(session, socket);
      }
    } catch {
      broadcast(socket, {
        type: "error",
        message: "Invalid WebSocket message.",
      });
    }
  });

  socket.on("close", () => {
    console.log("WebSocket client disconnected.");

    // Stop this user's download when they disconnect.
    if (session.process) {
      session.process.kill("SIGTERM");
      session.process = null;
      session.status = "idle";
    }
  });
});

console.log(`WebSocket server listening on port ${PORT}`);
