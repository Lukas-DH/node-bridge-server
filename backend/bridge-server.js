/**
 * Pipette Bridge Server (Node.js)
 * ================================
 *
 * TCP-to-Serial bridge with real-time web dashboard
 *
 * Features:
 * - TCP server for robot connections (port 5000)
 * - Serial connection to Picus 2 pipette
 * - HTTP + WebSocket server for web dashboard (port 3001)
 * - Real-time communication logs
 * - Connection status monitoring
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
  serialPort: process.env.SERIAL_PORT || "/dev/ttyACM0",
  //  serialPort: process.env.SERIAL_PORT || "/dev/tty.usbmodem438812441",
  serialBaudRate: 230400,
  tcpPort: 5001,
  qrPort: 5002,
  httpPort: 3001,
  handshakeTimeout: 5000, // 5 seconds
};

// State
const state = {
  commandNumber: 0,
  robotConnected: false,
  serialConnected: false,
  robotClient: null,
  serialPort: null,
  currentHandshake: null,
  pendingResponse: null,
  // Dashboard server state
  dashboardConnected: false,
  dashboardConnecting: false,
  dashboardSocket: null,
  dashboardIp: null,
  dashboardPendingCommand: null,
  // QR code receiver state
  currentQrValue: null,
  qrConnected: false,
  qrClient: null,
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

// Emit status update
function emitStatus() {
  const status = {
    robot: state.robotConnected ? "connected" : "disconnected",
    serial: state.serialConnected ? "connected" : "disconnected",
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
// SERIAL PORT SETUP
// ============================================================================

function setupSerialPort() {
  log(
    "info",
    "server",
    `Attempting to connect to serial port: ${CONFIG.serialPort}`,
  );

  const serialPort = new SerialPort({
    path: CONFIG.serialPort,
    baudRate: CONFIG.serialBaudRate,
  });

  const parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }));

  serialPort.on("open", () => {
    state.serialConnected = true;
    state.serialPort = serialPort;
    log("info", "pipette", "Serial port connected");
    emitStatus();
  });

  serialPort.on("error", (err) => {
    state.serialConnected = false;
    log("error", "pipette", `Serial port error: ${err.message}`);
    emitStatus();
  });

  serialPort.on("close", () => {
    state.serialConnected = false;
    log("info", "pipette", "Serial port disconnected");
    emitStatus();

    // Attempt reconnection after 3 seconds
    setTimeout(() => {
      log("info", "server", "Attempting serial port reconnection...");
      setupSerialPort();
    }, 3000);
  });

  // Handle incoming data from pipette
  parser.on("data", (line) => {
    const lineStr = line.trim();
    if (!lineStr) return;

    log("response", "pipette", lineStr);

    // Emit handshake step
    io.emit("handshake", {
      timestamp: new Date().toISOString(),
      line: lineStr,
      type: detectHandshakeType(lineStr),
    });

    // Process handshake
    if (state.currentHandshake) {
      state.currentHandshake.lines.push(lineStr);

      // Check if handshake is complete
      if (isHandshakeComplete(state.currentHandshake.lines)) {
        const response = parseHandshake(state.currentHandshake.lines);

        // Clear handshake state
        state.currentHandshake = null;

        // Send response to robot
        if (state.robotClient && state.pendingResponse) {
          const responseJson = JSON.stringify(response) + "\n";
          state.robotClient.write(responseJson);
          log("response", "server", `Sent to robot: ${responseJson.trim()}`);

          // Clear pending response
          clearTimeout(state.pendingResponse.timeout);
          state.pendingResponse = null;
        }
      }
    }
  });

  return serialPort;
}

// Detect handshake line type
function detectHandshakeType(line) {
  const upper = line.toUpperCase();
  if (upper.includes("ACK")) return "ACK";
  if (upper.includes("BEGIN")) return "BEGIN";
  if (upper.includes("END")) return "END";
  if (upper.includes("ERROR")) return "ERROR";
  if (upper.includes("OK")) return "OK";
  return "DATA";
}

// Check if handshake is complete
function isHandshakeComplete(lines) {
  const hasEnd = lines.some((l) => l.toUpperCase().includes("END"));
  const hasResult = lines.some(
    (l) => l.toUpperCase().includes("OK") || l.toUpperCase().includes("ERROR"),
  );

  // Complete if END found, or OK/ERROR found and no END after short wait
  return hasEnd || hasResult;
}

// Parse handshake lines into response object
function parseHandshake(lines) {
  const response = {
    status: "ERROR",
    data: null,
    message: null,
  };

  for (const line of lines) {
    const upper = line.toUpperCase();

    // Check for status
    if (upper.includes("OK") && !upper.includes("ERROR")) {
      response.status = "OK";
    } else if (upper.includes("ERROR")) {
      response.status = "ERROR";
      // Extract error message
      const parts = line.split(/ERROR/i);
      if (parts[1]) {
        response.message =
          parts[1].trim().split(/\s+/).slice(1).join(" ") || "Unknown error";
      }
    }

    // Check for data (not a handshake keyword)
    if (
      !["ACK", "BEGIN", "END", "OK", "ERROR"].some((kw) => upper.includes(kw))
    ) {
      // Try to parse as JSON
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

// Send command to pipette
function sendToPipette(commandStr) {
  if (!state.serialPort || !state.serialConnected) {
    const errorResponse = {
      status: "ERROR",
      message: "Serial port not connected",
      data: null,
    };
    return errorResponse;
  }

  state.commandNumber++;

  // Parse and add command number
  let cmd;
  try {
    cmd = JSON.parse(commandStr);
    if (!cmd.no) {
      cmd.no = state.commandNumber;
    }
  } catch {
    cmd = { no: state.commandNumber, data: commandStr };
  }

  const cmdJson = JSON.stringify(cmd) + "\n";

  // Initialize handshake tracking
  state.currentHandshake = {
    command: cmdJson.trim(),
    lines: [],
    startTime: Date.now(),
  };

  // Write to serial port
  state.serialPort.write(cmdJson, (err) => {
    if (err) {
      log("error", "server", `Failed to write to serial: ${err.message}`);
    } else {
      log("command", "server", `Sent to pipette: ${cmdJson.trim()}`);
    }
  });

  // Set timeout for response
  return new Promise((resolve) => {
    state.pendingResponse = {
      resolve,
      timeout: setTimeout(() => {
        if (state.currentHandshake) {
          const timeoutResponse = {
            status: "ERROR",
            message: "Pipette response timeout",
            data: null,
          };
          resolve(timeoutResponse);
          state.currentHandshake = null;
          state.pendingResponse = null;
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
    if (state.dashboardSocket) {
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
    });

    socket.on("data", (data) => {
      const response = data.toString().trim();
      log("response", "dashboard", `Dashboard response: ${response}`);

      // Emit response to all clients
      io.emit("dashboard-response", {
        timestamp: new Date().toISOString(),
        response,
        success: true,
      });

      // Resolve pending command if any
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
      log("info", "dashboard", "Dashboard connection closed");
      state.dashboardConnected = false;
      state.dashboardConnecting = false;
      state.dashboardSocket = null;
      emitStatus();
    });
  });
}

function disconnectFromDashboard() {
  if (state.dashboardSocket) {
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

    // Set up pending command with timeout
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

    // Forward to pipette and wait for response
    const response = await sendToPipette(command);

    // Send response back to robot
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

  socket.on("data", (data) => {
    const qrValue = data.toString("utf-8").trim();
    state.currentQrValue = qrValue;
    const timestamp = new Date().toISOString();

    log("info", "qr", `QR code received: ${qrValue}`);

    io.emit("qr-update", {
      value: qrValue,
      timestamp: timestamp,
    });

    socket.write("OK\n");
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

// REST API: Get current status
app.get("/api/status", (req, res) => {
  res.json(emitStatus());
});

// REST API: Send test command
app.post("/api/command", async (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: "Command required" });
  }

  log("command", "dashboard", `Test command: ${command}`);
  const response = await sendToPipette(command);
  res.json(response);
});

// WebSocket connection
io.on("connection", (socket) => {
  log("info", "dashboard", `Web client connected: ${socket.id}`);

  // Send initial status
  socket.emit("status", emitStatus());

  socket.on("disconnect", () => {
    log("info", "dashboard", `Web client disconnected: ${socket.id}`);
  });

  // Handle test command from dashboard
  socket.on("send-command", async (command) => {
    log("command", "dashboard", `Test command: ${command}`);
    const response = await sendToPipette(command);
    socket.emit("command-response", response);
  });

  // Handle dashboard server connection
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

  // Handle dashboard server disconnection
  socket.on("dashboard-disconnect", () => {
    disconnectFromDashboard();
    socket.emit("dashboard-command-response", {
      success: true,
      response: "Disconnected",
    });
  });

  // Handle dashboard commands
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

setupSerialPort();

log("info", "server", "=".repeat(60));
log("info", "server", "Pipette Bridge Server Started");
log("info", "server", "=".repeat(60));
log("info", "server", `Serial port: ${CONFIG.serialPort}`);
log("info", "server", `TCP port (robot): ${CONFIG.tcpPort}`);
log("info", "server", `QR port: ${CONFIG.qrPort}`);
log("info", "server", `HTTP port (dashboard): ${CONFIG.httpPort}`);
log("info", "server", "=".repeat(60));

// Graceful shutdown
process.on("SIGINT", () => {
  log("info", "server", "Shutting down...");
  if (state.serialPort) {
    state.serialPort.close();
  }
  tcpServer.close();
  qrServer.close();
  httpServer.close();
  process.exit(0);
});
