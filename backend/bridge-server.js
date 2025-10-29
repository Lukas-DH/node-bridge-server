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
  // serialPort: process.env.SERIAL_PORT || "/dev/ttyACM0",
  serialPort: process.env.SERIAL_PORT || "/dev/tty.usbmodem469801641",
  serialBaudRate: 230400,
  tcpPort: 5001,
  httpPort: 3001,
  handshakeTimeout: 5000, // 5 seconds
  discoveryTimeout: 5000, // 5 seconds per port during discovery
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
};

// Pipette Registry for multi-pipette support
const pipetteRegistry = {
  discovered: [], // Array of {model, port, serialPort, parser, connected, currentHandshake}
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
    `[${logEntry.timestamp}] [${type.toUpperCase()}] ${source}: ${message}`
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
  };

  io.emit("status", status);
  return status;
}

// ============================================================================
// SERIAL PORT SETUP
// ============================================================================

// Discover and identify all connected pipettes
async function discoverPipettes() {
  log("info", "server", "Starting pipette discovery...");

  try {
    // Get all available serial ports
    const ports = await SerialPort.list();
    log("info", "server", `Found ${ports.length} serial ports`);

    // Filter for likely pipette ports (macOS: tty.usbmodem*, Linux/Pi: ttyACM*)
    const candidatePorts = ports.filter(port => {
      const path = port.path;
      return path.includes('tty.usbmodem') || path.includes('ttyACM');
    });

    log("info", "server", `Candidate ports: ${candidatePorts.map(p => p.path).join(', ')}`);

    const discovered = [];

    // Try to identify each candidate port
    for (const portInfo of candidatePorts) {
      const portPath = portInfo.path;
      log("info", "server", `Probing port: ${portPath}`);

      try {
        // Attempt to identify this port
        const model = await identifyPipette(portPath);

        if (model) {
          log("info", "server", `✓ Identified ${model} on ${portPath}`);
          discovered.push({
            model: model,
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

    log("info", "server", `Discovery complete: Found ${discovered.length} pipette(s)`);
    return discovered;

  } catch (err) {
    log("error", "server", `Port discovery failed: ${err.message}`);
    return [];
  }
}

// Identify a pipette by sending GET_MODEL command
function identifyPipette(portPath) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, CONFIG.discoveryTimeout);

    let testPort;
    let parser;
    const receivedLines = [];

    const cleanup = () => {
      clearTimeout(timeout);
      if (parser) {
        parser.removeAllListeners();
      }
      if (testPort && testPort.isOpen) {
        testPort.close();
      }
    };

    try {
      testPort = new SerialPort({
        path: portPath,
        baudRate: CONFIG.serialBaudRate,
      });

      parser = testPort.pipe(new ReadlineParser({ delimiter: '\n' }));

      testPort.on('open', () => {
        // Send GET_MODEL command
        const cmd = JSON.stringify({ no: 0, data: "GET_MODEL" }) + "\n";
        testPort.write(cmd);
      });

      testPort.on('error', (err) => {
        cleanup();
        resolve(null);
      });

      parser.on('data', (line) => {
        const lineStr = line.trim();
        if (!lineStr) return;

        log("info", "server", `[Discovery] ${portPath} <- ${lineStr}`);
        receivedLines.push(lineStr);

        // Check if we have a complete handshake
        const hasEnd = receivedLines.some(l => l.toUpperCase().includes('END'));
        const hasOK = receivedLines.some(l => l.toUpperCase().includes('OK'));

        if (hasEnd || hasOK) {
          // Parse the model from the response
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

    // Skip handshake keywords
    if (['ACK', 'BEGIN', 'END', 'OK', 'ERROR'].some(kw => upper.includes(kw))) {
      continue;
    }

    // Try to parse as JSON first
    if (line.startsWith('{') || line.startsWith('[')) {
      try {
        const data = JSON.parse(line);
        // Look for model field
        if (data.model) {
          return data.model;
        }
        // Sometimes it might be nested
        if (data.data && data.data.model) {
          return data.data.model;
        }
      } catch {
        // Not JSON, fall through to plain text
      }
    }

    // If not JSON or JSON parsing failed, treat as plain text model name
    // This handles responses like "SINGLE_CHANNEL_120UL" directly
    if (line.trim() && !line.startsWith('{') && !line.startsWith('[')) {
      return line.trim();
    }
  }

  return null;
}

// Connect to a specific pipette by model
function connectToPipette(pipetteInfo) {
  const { model, port } = pipetteInfo;

  log("info", "server", `Connecting to ${model} on ${port}`);

  const serialPort = new SerialPort({
    path: port,
    baudRate: CONFIG.serialBaudRate,
  });

  const parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }));

  // Store references
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

    // Attempt reconnection after 3 seconds
    setTimeout(() => {
      log("info", "server", `Attempting to reconnect ${model}...`);
      connectToPipette(pipetteInfo);
    }, 3000);
  });

  // Handle incoming data from this pipette
  parser.on("data", (line) => {
    const lineStr = line.trim();
    if (!lineStr) return;

    log("response", "pipette", `[${model}] ${lineStr}`);

    // Emit handshake step with pipette model
    io.emit("handshake", {
      timestamp: new Date().toISOString(),
      line: lineStr,
      type: detectHandshakeType(lineStr),
      pipette: model,
    });

    // Process handshake for this specific pipette
    if (pipetteInfo.currentHandshake) {
      pipetteInfo.currentHandshake.lines.push(lineStr);

      // Check if handshake is complete
      if (isHandshakeComplete(pipetteInfo.currentHandshake.lines)) {
        const response = parseHandshake(pipetteInfo.currentHandshake.lines);

        // Clear handshake state for this pipette
        pipetteInfo.currentHandshake = null;

        // Resolve pending response if exists
        if (pipetteInfo.pendingResponse) {
          clearTimeout(pipetteInfo.pendingResponse.timeout);
          pipetteInfo.pendingResponse.resolve(response);
          pipetteInfo.pendingResponse = null;
        }

        // Send response to robot if this was triggered by robot
        if (state.robotClient && state.pendingResponse) {
          const responseJson = JSON.stringify(response) + "\n";
          state.robotClient.write(responseJson);
          log("response", "server", `Sent to robot: ${responseJson.trim()}`);

          // Clear robot's pending response
          clearTimeout(state.pendingResponse.timeout);
          state.pendingResponse = null;
        }
      }
    }
  });

  return serialPort;
}

// Connect to all discovered pipettes
async function connectAllPipettes() {
  log("info", "server", `Connecting to ${pipetteRegistry.discovered.length} pipette(s)...`);

  for (const pipetteInfo of pipetteRegistry.discovered) {
    try {
      connectToPipette(pipetteInfo);
    } catch (err) {
      log("error", "server", `Failed to connect to ${pipetteInfo.model}: ${err.message}`);
    }
  }

  // Set first pipette as active by default
  if (pipetteRegistry.discovered.length > 0) {
    pipetteRegistry.activeModel = pipetteRegistry.discovered[0].model;
    log("info", "server", `Active pipette: ${pipetteRegistry.activeModel}`);
  }
}

// Emit pipette status to dashboard
function emitPipetteStatus() {
  const pipettesStatus = pipetteRegistry.discovered.map(p => ({
    model: p.model,
    port: p.port,
    connected: p.connected,
  }));

  io.emit("pipettes-list", pipettesStatus);
  io.emit("active-pipette", pipetteRegistry.activeModel);

  // Also emit old status format for backward compatibility
  const anyConnected = pipetteRegistry.discovered.some(p => p.connected);
  const status = {
    robot: state.robotConnected ? "connected" : "disconnected",
    serial: anyConnected ? "connected" : "disconnected",
    server: "running",
  };
  io.emit("status", status);
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
    (l) => l.toUpperCase().includes("OK") || l.toUpperCase().includes("ERROR")
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

// Send command to the currently selected pipette
function sendToPipette(commandStr) {
  // Find the active pipette
  const activePipette = pipetteRegistry.discovered.find(
    p => p.model === pipetteRegistry.activeModel
  );

  if (!activePipette) {
    const errorResponse = {
      status: "ERROR",
      message: "No pipette selected",
      data: null,
    };
    log("error", "server", "No pipette selected");
    return Promise.resolve(errorResponse);
  }

  if (!activePipette.serialPort || !activePipette.connected) {
    const errorResponse = {
      status: "ERROR",
      message: `Pipette ${activePipette.model} not connected`,
      data: null,
    };
    log("error", "server", `Pipette ${activePipette.model} not connected`);
    return Promise.resolve(errorResponse);
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

  // Initialize handshake tracking for this specific pipette
  activePipette.currentHandshake = {
    command: cmdJson.trim(),
    lines: [],
    startTime: Date.now(),
  };

  // Write to the active pipette's serial port
  activePipette.serialPort.write(cmdJson, (err) => {
    if (err) {
      log("error", "server", `Failed to write to ${activePipette.model}: ${err.message}`);
    } else {
      log("command", "server", `Sent to ${activePipette.model}: ${cmdJson.trim()}`);
    }
  });

  // Set timeout for response from this pipette
  return new Promise((resolve) => {
    activePipette.pendingResponse = {
      resolve,
      timeout: setTimeout(() => {
        if (activePipette.currentHandshake) {
          const timeoutResponse = {
            status: "ERROR",
            message: `Pipette ${activePipette.model} response timeout`,
            data: null,
          };
          resolve(timeoutResponse);
          activePipette.currentHandshake = null;
          activePipette.pendingResponse = null;
        }
      }, CONFIG.handshakeTimeout),
    };
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

  // Send initial status and pipette list
  socket.emit("status", emitStatus());

  const pipettesStatus = pipetteRegistry.discovered.map(p => ({
    model: p.model,
    port: p.port,
    connected: p.connected,
  }));
  socket.emit("pipettes-list", pipettesStatus);
  socket.emit("active-pipette", pipetteRegistry.activeModel);

  socket.on("disconnect", () => {
    log("info", "dashboard", `Web client disconnected: ${socket.id}`);
  });

  // Handle pipette selection from dashboard
  socket.on("select-pipette", (model) => {
    log("info", "dashboard", `Selecting pipette: ${model}`);

    const pipette = pipetteRegistry.discovered.find(p => p.model === model);
    if (pipette) {
      pipetteRegistry.activeModel = model;
      io.emit("active-pipette", model);
      log("info", "server", `Active pipette changed to: ${model}`);
    } else {
      log("error", "dashboard", `Pipette not found: ${model}`);
    }
  });

  // Handle test command from dashboard
  socket.on("send-command", async (command) => {
    log("command", "dashboard", `Test command: ${command}`);
    const response = await sendToPipette(command);
    socket.emit("command-response", response);
  });
});

httpServer.listen(CONFIG.httpPort, () => {
  log(
    "info",
    "server",
    `HTTP + WebSocket server listening on port ${CONFIG.httpPort}`
  );
  log(
    "info",
    "server",
    `Dashboard available at: http://localhost:${CONFIG.httpPort}`
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
  log("info", "server", `HTTP port (dashboard): ${CONFIG.httpPort}`);
  log("info", "server", "=".repeat(60));

  // Discover all connected pipettes
  const discovered = await discoverPipettes();
  pipetteRegistry.discovered = discovered;

  if (discovered.length === 0) {
    log("error", "server", "No pipettes discovered! Please check connections.");
    log("info", "server", "Server will continue running and wait for pipettes...");
  } else {
    // Connect to all discovered pipettes
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

// Start the server
startServer();

// Graceful shutdown
process.on("SIGINT", () => {
  log("info", "server", "Shutting down...");
  if (state.serialPort) {
    state.serialPort.close();
  }
  tcpServer.close();
  httpServer.close();
  process.exit(0);
});
