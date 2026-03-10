/**
 * Pipette Bridge Server (Node.js)
 * ================================
 *
 * TCP-to-Serial bridge with real-time web dashboard
 *
 * Features:
 * - TCP server for robot connections (port 5001)
 * - Multi-pipette auto-discovery and per-model routing
 * - HTTP + WebSocket server for web dashboard (port 3001)
 * - UR Dashboard Server TCP client
 * - QR code TCP receiver (port 5002)
 * - Real-time communication logs
 */

import net from "net";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";

// Configuration
const CONFIG = {
  serialBaudRate: 230400,
  tcpPort: 5001,
  qrPort: 5002,
  httpPort: 3001,
  handshakeTimeout: 5000, // 5 seconds
  discoveryTimeout: 5000, // 5 seconds per port during discovery
};

// State (robot / dashboard / qr fields only — pipette state lives in pipetteRegistry)
const state = {
  commandNumber: 0,
  robotConnected: false,
  robotClient: null,
  pendingRobotResponse: null,
  // Dashboard server state
  dashboardConnected: false,
  dashboardConnecting: false,
  dashboardSocket: null,
  dashboardIp: null,
  dashboardPendingCommand: null,
  pollingInterval: null,
  // QR code receiver state
  currentQrValue: null,
  qrConnected: false,
  qrClient: null,
};

// Pipette Registry for multi-pipette support
const pipetteRegistry = {
  discovered: [], // Array of {model, port, serialPort, parser, connected, currentHandshake, pendingResponse}
  activeModel: null, // Currently selected model for commands
};

// Express app for HTTP + WebSocket
const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Logging utility
function log(type, source, message, data = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type, // 'info', 'error', 'command', 'response', 'handshake'
    source, // 'robot', 'pipette', 'server'
    message,
    data,
  };

  console.log(
    `[${logEntry.timestamp}] [${type.toUpperCase()}] ${source}: ${message}`,
  );

  // Broadcast to all connected web clients
  io.emit("log", logEntry);

  return logEntry;
}

// Emit status update (includes all subsystems for backward compat)
function emitStatus() {
  const anyPipetteConnected = pipetteRegistry.discovered.some(
    (p) => p.connected,
  );
  const status = {
    robot: state.robotConnected ? "connected" : "disconnected",
    serial: anyPipetteConnected ? "connected" : "disconnected",
    server: "running",
    dashboard: state.dashboardConnected
      ? "connected"
      : state.dashboardConnecting
        ? "connecting"
        : "disconnected",
    qr: state.qrConnected ? "connected" : "disconnected",
  };

  io.emit("status", status);
  return status;
}

// ============================================================================
// MULTI-PIPETTE DISCOVERY & CONNECTION
// ============================================================================

// Discover and identify all connected pipettes
async function discoverPipettes() {
  log("info", "server", "Starting pipette discovery...");

  try {
    const ports = await SerialPort.list();
    log("info", "server", `Found ${ports.length} serial ports`);

    // Filter for likely pipette ports (macOS: tty.usbmodem*, Linux/Pi: ttyACM*)
    const candidatePorts = ports.filter((port) => {
      const path = port.path;
      return path.includes("tty.usbmodem") || path.includes("ttyACM");
    });

    log(
      "info",
      "server",
      `Candidate ports: ${candidatePorts.map((p) => p.path).join(", ")}`,
    );

    const discovered = [];

    for (const portInfo of candidatePorts) {
      const portPath = portInfo.path;
      log("info", "server", `Probing port: ${portPath}`);

      try {
        const model = await identifyPipette(portPath);

        if (model) {
          log("info", "server", `✓ Identified ${model} on ${portPath}`);
          discovered.push({
            model,
            port: portPath,
            serialPort: null,
            parser: null,
            connected: false,
            currentHandshake: null,
            pendingResponse: null,
          });
        } else {
          log("info", "server", `✗ No valid response from ${portPath}`);
        }
      } catch (err) {
        log("error", "server", `Failed to probe ${portPath}: ${err.message}`);
      }
    }

    log(
      "info",
      "server",
      `Discovery complete: Found ${discovered.length} pipette(s)`,
    );
    return discovered;
  } catch (err) {
    log("error", "server", `Port discovery failed: ${err.message}`);
    return [];
  }
}

// Identify a pipette by sending GET_MODEL command
function identifyPipette(portPath) {
  return new Promise((resolve) => {
    let testPort;
    let parser;
    const receivedLines = [];

    const cleanup = () => {
      clearTimeout(timeoutHandle);
      if (parser) parser.removeAllListeners();
      if (testPort && testPort.isOpen) testPort.close();
    };

    const timeoutHandle = setTimeout(() => {
      cleanup();
      resolve(null);
    }, CONFIG.discoveryTimeout);

    try {
      testPort = new SerialPort({
        path: portPath,
        baudRate: CONFIG.serialBaudRate,
      });

      parser = testPort.pipe(new ReadlineParser({ delimiter: "\n" }));

      testPort.on("open", () => {
        const cmd = JSON.stringify({ no: 0, data: "GET_MODEL" }) + "\n";
        testPort.write(cmd);
      });

      testPort.on("error", () => {
        cleanup();
        resolve(null);
      });

      parser.on("data", (line) => {
        const lineStr = line.trim();
        if (!lineStr) return;

        log("info", "server", `[Discovery] ${portPath} <- ${lineStr}`);
        receivedLines.push(lineStr);

        const hasEnd = receivedLines.some((l) =>
          l.toUpperCase().includes("END"),
        );
        const hasOK = receivedLines.some((l) => l.toUpperCase().includes("OK"));

        if (hasEnd || hasOK) {
          const model = extractModelFromResponse(receivedLines);
          cleanup();
          resolve(model);
        }
      });
    } catch (err) {
      cleanup();
      resolve(null);
    }
  });
}

// Extract model name from handshake response lines
function extractModelFromResponse(lines) {
  for (const line of lines) {
    const upper = line.toUpperCase();

    if (["ACK", "BEGIN", "END", "OK", "ERROR"].some((kw) => upper.includes(kw)))
      continue;

    if (line.startsWith("{") || line.startsWith("[")) {
      try {
        const data = JSON.parse(line);
        if (data.model) return data.model;
        if (data.data && data.data.model) return data.data.model;
      } catch {
        // fall through
      }
    }

    if (line.trim()) return line.trim();
  }
  return null;
}

// Connect to a specific pipette
function connectToPipette(pipetteInfo) {
  const { model, port } = pipetteInfo;

  log("info", "server", `Connecting to ${model} on ${port}`);

  const serialPort = new SerialPort({
    path: port,
    baudRate: CONFIG.serialBaudRate,
  });

  const parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }));

  pipetteInfo.serialPort = serialPort;
  pipetteInfo.parser = parser;

  serialPort.on("open", () => {
    pipetteInfo.connected = true;
    log("info", "pipette", `${model} connected on ${port}`);
    emitPipetteStatus();
  });

  serialPort.on("error", (err) => {
    pipetteInfo.connected = false;
    log("error", "pipette", `${model} error: ${err.message}`);
    emitPipetteStatus();
  });

  serialPort.on("close", () => {
    pipetteInfo.connected = false;
    log("info", "pipette", `${model} disconnected`);
    emitPipetteStatus();

    setTimeout(() => {
      log("info", "server", `Attempting to reconnect ${model}...`);
      connectToPipette(pipetteInfo);
    }, 3000);
  });

  parser.on("data", (line) => {
    const lineStr = line.trim();
    if (!lineStr) return;

    log("response", "pipette", `[${model}] ${lineStr}`);

    io.emit("handshake", {
      timestamp: new Date().toISOString(),
      line: lineStr,
      type: detectHandshakeType(lineStr),
      pipette: model,
    });

    if (pipetteInfo.currentHandshake) {
      pipetteInfo.currentHandshake.lines.push(lineStr);

      if (isHandshakeComplete(pipetteInfo.currentHandshake.lines)) {
        const response = parseHandshake(pipetteInfo.currentHandshake.lines);
        pipetteInfo.currentHandshake = null;

        // Resolve dashboard/REST pending response
        if (pipetteInfo.pendingResponse) {
          clearTimeout(pipetteInfo.pendingResponse.timeout);
          pipetteInfo.pendingResponse.resolve(response);
          pipetteInfo.pendingResponse = null;
        }

        // Send response to robot if triggered by a robot command
        if (state.robotClient && state.pendingRobotResponse) {
          const responseJson = JSON.stringify(response) + "\n";
          state.robotClient.write(responseJson);
          log("response", "server", `Sent to robot: ${responseJson.trim()}`);
          clearTimeout(state.pendingRobotResponse.timeout);
          state.pendingRobotResponse = null;
        }
      }
    }
  });

  return serialPort;
}

// Connect to all discovered pipettes and set first as active
async function connectAllPipettes() {
  log(
    "info",
    "server",
    `Connecting to ${pipetteRegistry.discovered.length} pipette(s)...`,
  );

  for (const pipetteInfo of pipetteRegistry.discovered) {
    try {
      connectToPipette(pipetteInfo);
    } catch (err) {
      log(
        "error",
        "server",
        `Failed to connect to ${pipetteInfo.model}: ${err.message}`,
      );
    }
  }

  if (pipetteRegistry.discovered.length > 0) {
    pipetteRegistry.activeModel = pipetteRegistry.discovered[0].model;
    log("info", "server", `Active pipette: ${pipetteRegistry.activeModel}`);
  }
}

// Emit pipette + full system status to dashboard
function emitPipetteStatus() {
  const pipettesStatus = pipetteRegistry.discovered.map((p) => ({
    model: p.model,
    port: p.port,
    connected: p.connected,
  }));

  io.emit("pipettes-list", pipettesStatus);
  io.emit("active-pipette", pipetteRegistry.activeModel);

  // Also emit unified status so existing listeners stay in sync
  emitStatus();
}

// ============================================================================
// HANDSHAKE HELPERS
// ============================================================================

function detectHandshakeType(line) {
  const upper = line.toUpperCase();
  if (upper.includes("ACK")) return "ACK";
  if (upper.includes("BEGIN")) return "BEGIN";
  if (upper.includes("END")) return "END";
  if (upper.includes("ERROR")) return "ERROR";
  if (upper.includes("OK")) return "OK";
  return "DATA";
}

function isHandshakeComplete(lines) {
  const hasEnd = lines.some((l) => l.toUpperCase().includes("END"));
  const hasResult = lines.some(
    (l) => l.toUpperCase().includes("OK") || l.toUpperCase().includes("ERROR"),
  );
  return hasEnd || hasResult;
}

function parseHandshake(lines) {
  const response = { status: "ERROR", data: null, message: null };

  for (const line of lines) {
    const upper = line.toUpperCase();

    if (upper.includes("OK") && !upper.includes("ERROR")) {
      response.status = "OK";
    } else if (upper.includes("ERROR")) {
      response.status = "ERROR";
      const parts = line.split(/ERROR/i);
      if (parts[1]) {
        response.message =
          parts[1].trim().split(/\s+/).slice(1).join(" ") || "Unknown error";
      }
    }

    if (!["ACK", "BEGIN", "END", "OK", "ERROR"].some((kw) => upper.includes(kw))) {
      if (line.startsWith("{") || line.startsWith("[")) {
        try {
          response.data = JSON.parse(line);
        } catch {
          response.data = line;
        }
      } else {
        response.data = line;
      }
    }
  }

  return response;
}

// ============================================================================
// SEND TO PIPETTE (multi-registry, async)
// ============================================================================

function sendToPipette(commandStr) {
  const activePipette = pipetteRegistry.discovered.find(
    (p) => p.model === pipetteRegistry.activeModel,
  );

  if (!activePipette) {
    log("error", "server", "No pipette selected");
    return Promise.resolve({
      status: "ERROR",
      message: "No pipette selected",
      data: null,
    });
  }

  if (!activePipette.serialPort || !activePipette.connected) {
    log("error", "server", `Pipette ${activePipette.model} not connected`);
    return Promise.resolve({
      status: "ERROR",
      message: `Pipette ${activePipette.model} not connected`,
      data: null,
    });
  }

  state.commandNumber++;

  let cmd;
  try {
    cmd = JSON.parse(commandStr);
    if (!cmd.no) cmd.no = state.commandNumber;
  } catch {
    cmd = { no: state.commandNumber, data: commandStr };
  }

  const cmdJson = JSON.stringify(cmd) + "\n";

  activePipette.currentHandshake = {
    command: cmdJson.trim(),
    lines: [],
    startTime: Date.now(),
  };

  activePipette.serialPort.write(cmdJson, (err) => {
    if (err) {
      log(
        "error",
        "server",
        `Failed to write to ${activePipette.model}: ${err.message}`,
      );
    } else {
      log(
        "command",
        "server",
        `Sent to ${activePipette.model}: ${cmdJson.trim()}`,
      );
    }
  });

  return new Promise((resolve) => {
    activePipette.pendingResponse = {
      resolve,
      timeout: setTimeout(() => {
        if (activePipette.currentHandshake) {
          resolve({
            status: "ERROR",
            message: `Pipette ${activePipette.model} response timeout`,
            data: null,
          });
          activePipette.currentHandshake = null;
          activePipette.pendingResponse = null;
        }
      }, CONFIG.handshakeTimeout),
    };
  });
}

// ============================================================================
// UR DASHBOARD SERVER TCP CLIENT
// ============================================================================

const DASHBOARD_PORT = 29999;

function connectToDashboard(robotIp) {
  return new Promise((resolve, reject) => {
    if (state.dashboardSocket || state.dashboardConnecting) {
      disconnectFromDashboard();
    }

    state.dashboardConnecting = true;
    state.dashboardIp = robotIp;
    emitStatus();

    log(
      "info",
      "dashboard",
      `Connecting to UR Dashboard Server at ${robotIp}:${DASHBOARD_PORT}`,
    );

    const socket = new net.Socket();
    socket.setTimeout(5000);

    socket.connect(DASHBOARD_PORT, robotIp, () => {
      state.dashboardConnected = true;
      state.dashboardConnecting = false;
      state.dashboardSocket = socket;
      log(
        "info",
        "dashboard",
        `Connected to UR Dashboard Server at ${robotIp}`,
      );
      emitStatus();
      resolve(true);
      startDashboardPolling();
    });

    socket.on("data", (data) => {
      const response = data.toString().trim();
      log("response", "dashboard", `Dashboard response: ${response}`);

      io.emit("dashboard-response", {
        timestamp: new Date().toISOString(),
        response,
        success: true,
      });

      if (state.dashboardPendingCommand) {
        state.dashboardPendingCommand.resolve({ success: true, response });
        state.dashboardPendingCommand = null;
      }
    });

    socket.on("timeout", () => {
      log("error", "dashboard", "Connection timeout");
      state.dashboardConnecting = false;
      socket.destroy();
      emitStatus();
      reject(new Error("Connection timeout"));
    });

    socket.on("error", (err) => {
      log("error", "dashboard", `Dashboard socket error: ${err.message}`);
      state.dashboardConnected = false;
      state.dashboardConnecting = false;
      state.dashboardSocket = null;
      emitStatus();
      reject(err);
    });

    socket.on("close", () => {
      stopDashboardPolling();
      log("info", "dashboard", "Dashboard connection closed");
      state.dashboardConnected = false;
      state.dashboardConnecting = false;
      state.dashboardSocket = null;
      emitStatus();
    });
  });
}

function disconnectFromDashboard() {
  stopDashboardPolling();
  if (state.dashboardSocket) {
    state.dashboardSocket.removeAllListeners();
    state.dashboardSocket.destroy();
    state.dashboardSocket = null;
  }
  state.dashboardConnected = false;
  state.dashboardConnecting = false;
  state.dashboardIp = null;
  log("info", "dashboard", "Disconnected from Dashboard Server");
  emitStatus();
}

function sendDashboardCommand(command) {
  return new Promise((resolve, reject) => {
    if (!state.dashboardSocket || !state.dashboardConnected) {
      reject(new Error("Not connected to Dashboard Server"));
      return;
    }

    log("command", "dashboard", `Sending dashboard command: ${command}`);

    const timeout = setTimeout(() => {
      if (state.dashboardPendingCommand) {
        state.dashboardPendingCommand = null;
        reject(new Error("Command timeout"));
      }
    }, 5000);

    state.dashboardPendingCommand = {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    };

    state.dashboardSocket.write(command + "\n");
  });
}

const POLL_QUERIES = ["robotmode", "programstate"];
let pollIndex = 0;

function startDashboardPolling() {
  stopDashboardPolling();
  state.pollingInterval = setInterval(() => {
    if (!state.dashboardConnected || !state.dashboardSocket) {
      stopDashboardPolling();
      return;
    }
    if (state.dashboardPendingCommand) return;
    const query = POLL_QUERIES[pollIndex % 2];
    pollIndex++;
    state.dashboardSocket.write(query + "\n");
  }, 500);
}

function stopDashboardPolling() {
  if (state.pollingInterval) {
    clearInterval(state.pollingInterval);
    state.pollingInterval = null;
  }
}

// ============================================================================
// TCP SERVER FOR ROBOT
// ============================================================================

const tcpServer = net.createServer((socket) => {
  const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;

  log("info", "robot", `Robot connected: ${clientAddr}`);
  state.robotConnected = true;
  state.robotClient = socket;
  emitStatus();

  socket.on("data", async (data) => {
    const command = data.toString("utf-8").trim();
    log("command", "robot", `Received: ${command}`);

    // Check if first word is a known pipette model (for per-model routing)
    const parts = command.split(" ");
    const firstWord = parts[0];
    const pipette = pipetteRegistry.discovered.find(
      (p) => p.model === firstWord,
    );

    let actualCommand;
    if (pipette) {
      pipetteRegistry.activeModel = firstWord;
      actualCommand = parts.slice(1).join(" ");
      log("info", "robot", `Switched to pipette: ${firstWord}`);
      io.emit("active-pipette", firstWord);
    } else {
      actualCommand = command;
    }

    // Track pending robot response so connectToPipette's data handler can reply
    const response = await new Promise((resolve) => {
      state.pendingRobotResponse = {
        resolve,
        timeout: setTimeout(() => {
          state.pendingRobotResponse = null;
          resolve({
            status: "ERROR",
            message: "Robot response timeout",
            data: null,
          });
        }, CONFIG.handshakeTimeout + 1000),
      };
      sendToPipette(actualCommand).then((res) => {
        if (state.pendingRobotResponse) {
          clearTimeout(state.pendingRobotResponse.timeout);
          state.pendingRobotResponse = null;
          resolve(res);
        }
      });
    });

    const responseJson = JSON.stringify(response) + "\n";
    socket.write(responseJson);
    log("response", "server", `Sent to robot: ${responseJson.trim()}`);
  });

  socket.on("end", () => {
    log("info", "robot", `Robot disconnected: ${clientAddr}`);
    state.robotConnected = false;
    state.robotClient = null;
    emitStatus();
  });

  socket.on("error", (err) => {
    log("error", "robot", `Socket error: ${err.message}`);
    state.robotConnected = false;
    state.robotClient = null;
    emitStatus();
  });
});

tcpServer.listen(CONFIG.tcpPort, "0.0.0.0", () => {
  log("info", "server", `TCP server listening on port ${CONFIG.tcpPort}`);
});

// ============================================================================
// QR CODE TCP SERVER
// ============================================================================

const qrServer = net.createServer((socket) => {
  const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;

  log("info", "qr", `QR client connected: ${clientAddr}`);
  state.qrConnected = true;
  state.qrClient = socket;

  socket.on("data", async (data) => {
    const qrValue = data.toString("utf-8").trim();
    state.currentQrValue = qrValue;
    const timestamp = new Date().toISOString();

    log("info", "qr", `QR code received: ${qrValue}`);

    io.emit("qr-update", { value: qrValue, timestamp });

    socket.write("OK\n");

    // "finished" → load __ready.urp and play
    if (qrValue.toLowerCase() === "finished") {
      log("info", "server", "QR 'finished' received — loading __ready.urp");
      try {
        await sendDashboardCommand("load __ready.urp");
        await new Promise((r) => setTimeout(r, 500));
        await sendDashboardCommand("play");
        log("info", "server", "Loaded and started __ready.urp");
      } catch (err) {
        log("error", "server", `Failed to load __ready.urp: ${err.message}`);
      }
    }
  });

  socket.on("end", () => {
    log("info", "qr", `QR client disconnected: ${clientAddr}`);
    state.qrConnected = false;
    state.qrClient = null;
  });

  socket.on("error", (err) => {
    log("error", "qr", `QR socket error: ${err.message}`);
    state.qrConnected = false;
    state.qrClient = null;
  });
});

qrServer.listen(CONFIG.qrPort, "0.0.0.0", () => {
  log("info", "server", `QR server listening on port ${CONFIG.qrPort}`);
});

// ============================================================================
// HTTP + WEBSOCKET SERVER FOR WEB DASHBOARD
// ============================================================================

app.get("/api/status", (req, res) => {
  res.json(emitStatus());
});

app.post("/api/command", async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: "Command required" });

  log("command", "dashboard", `Test command: ${command}`);
  const response = await sendToPipette(command);
  res.json(response);
});

io.on("connection", (socket) => {
  log("info", "dashboard", `Web client connected: ${socket.id}`);

  // Send initial status and pipette list
  socket.emit("status", emitStatus());
  socket.emit(
    "pipettes-list",
    pipetteRegistry.discovered.map((p) => ({
      model: p.model,
      port: p.port,
      connected: p.connected,
    })),
  );
  socket.emit("active-pipette", pipetteRegistry.activeModel);

  socket.on("disconnect", () => {
    log("info", "dashboard", `Web client disconnected: ${socket.id}`);
  });

  // Pipette selection from dashboard
  socket.on("select-pipette", (model) => {
    log("info", "dashboard", `Selecting pipette: ${model}`);
    const pipette = pipetteRegistry.discovered.find((p) => p.model === model);
    if (pipette) {
      pipetteRegistry.activeModel = model;
      io.emit("active-pipette", model);
      log("info", "server", `Active pipette changed to: ${model}`);
    } else {
      log("error", "dashboard", `Pipette not found: ${model}`);
    }
  });

  // Test command from dashboard
  socket.on("send-command", async (command) => {
    log("command", "dashboard", `Test command: ${command}`);
    const response = await sendToPipette(command);
    socket.emit("command-response", response);
  });

  // Dashboard server connection
  socket.on("dashboard-connect", async (robotIp) => {
    try {
      await connectToDashboard(robotIp);
      socket.emit("dashboard-command-response", {
        success: true,
        response: `Connected to ${robotIp}`,
      });
    } catch (err) {
      socket.emit("dashboard-command-response", {
        success: false,
        error: err.message,
      });
    }
  });

  socket.on("dashboard-disconnect", () => {
    disconnectFromDashboard();
    socket.emit("dashboard-command-response", {
      success: true,
      response: "Disconnected",
    });
  });

  socket.on("dashboard-command", async (command) => {
    try {
      const result = await sendDashboardCommand(command);
      socket.emit("dashboard-command-response", result);
    } catch (err) {
      socket.emit("dashboard-command-response", {
        success: false,
        error: err.message,
      });
    }
  });
});

httpServer.listen(CONFIG.httpPort, () => {
  log(
    "info",
    "server",
    `HTTP + WebSocket server listening on port ${CONFIG.httpPort}`,
  );
  log(
    "info",
    "server",
    `Dashboard available at: http://localhost:${CONFIG.httpPort}`,
  );
});

// ============================================================================
// STARTUP
// ============================================================================

async function startServer() {
  log("info", "server", "=".repeat(60));
  log("info", "server", "Pipette Bridge Server Starting");
  log("info", "server", "=".repeat(60));
  log("info", "server", `TCP port (robot): ${CONFIG.tcpPort}`);
  log("info", "server", `QR port: ${CONFIG.qrPort}`);
  log("info", "server", `HTTP port (dashboard): ${CONFIG.httpPort}`);
  log("info", "server", "=".repeat(60));

  const discovered = await discoverPipettes();
  pipetteRegistry.discovered = discovered;

  if (discovered.length === 0) {
    log("error", "server", "No pipettes discovered! Please check connections.");
    log(
      "info",
      "server",
      "Server will continue running and wait for pipettes...",
    );
  } else {
    await connectAllPipettes();

    log("info", "server", "=".repeat(60));
    log("info", "server", "Pipette Summary:");
    for (const p of pipetteRegistry.discovered) {
      log("info", "server", `  - ${p.model} on ${p.port}`);
    }
    log("info", "server", `Active pipette: ${pipetteRegistry.activeModel}`);
    log("info", "server", "=".repeat(60));
  }
}

startServer();

// Graceful shutdown
process.on("SIGINT", () => {
  log("info", "server", "Shutting down...");
  for (const p of pipetteRegistry.discovered) {
    if (p.serialPort && p.serialPort.isOpen) {
      p.serialPort.close();
    }
  }
  tcpServer.close();
  qrServer.close();
  httpServer.close();
  process.exit(0);
});
