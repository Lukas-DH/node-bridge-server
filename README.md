# Pipette Bridge Server with Web Dashboard

**Node.js + React** implementation of the TCP-to-Serial bridge server with a real-time web monitoring dashboard.

![Architecture](https://img.shields.io/badge/Backend-Node.js-green) ![Frontend](https://img.shields.io/badge/Frontend-React-blue) ![WebSocket](https://img.shields.io/badge/WebSocket-Socket.IO-orange)

## Overview

This is a **Node.js alternative** to the Python bridge server, featuring a modern React web dashboard for real-time monitoring and testing.

### Architecture

```
┌─────────┐  TCP:5000   ┌──────────┐  USB/Serial  ┌─────────┐
│  Robot  │◄───────────►│  Bridge  │◄────────────►│ Pipette │
│ (UR)    │             │  Server  │              │(Picus 2)│
└─────────┘             │ (Node.js)│              └─────────┘
                        └─────┬────┘
                              │
                              │ WebSocket:3001
                              ▼
                       ┌──────────────┐
                       │  Dashboard   │  ← http://localhost:3000
                       │   (React)    │
                       └──────────────┘
```

## Features

### Backend (Node.js)

- ✅ TCP server for robot connections (port 5000)
- ✅ Serial communication with Picus 2 pipette
- ✅ HTTP + WebSocket server (port 3001)
- ✅ Real-time event broadcasting
- ✅ Automatic serial reconnection
- ✅ Smart handshake parsing

### Frontend (React)

- ✅ **Network Topology** - Visual diagram with animated connections
- ✅ **Connection Status** - Real-time indicators for all connections
- ✅ **Communication Logs** - Live message stream with filtering
- ✅ **Handshake Monitor** - Step-by-step handshake visualization
- ✅ **Command Tester** - Send test commands with presets
- ✅ **Responsive Design** - Works on desktop and mobile

## Quick Start

### Prerequisites

- Node.js 16+ (get from https://nodejs.org)
- Picus 2 pipette connected via USB
- Universal Robot (optional, for production use)

### Installation

```bash
# Clone or copy this directory
cd node-bridge-server

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running

**Option 1: Backend + Frontend (Development)**

Terminal 1 - Backend:

```bash
cd backend
npm start
```

Terminal 2 - Frontend:

```bash
cd frontend
npm run dev
```

**Option 2: Backend Only (Production)**

```bash
cd backend
npm start
```

Dashboard available at: http://localhost:3001 (if built)

### Access Dashboard

Open browser: http://localhost:3000

You should see:

- 🟢 Server: connected
- 🔴 Robot: disconnected (until robot connects)
- 🟢/🔴 Pipette: depends on USB connection

## Configuration

### Serial Port

Edit `backend/bridge-server.js`:

```javascript
const CONFIG = {
  serialPort: "/dev/tty.usbmodem438812441", // ← Change this
  // serialPort: '/dev/ttyACM0',  // ← Change this
  serialBaudRate: 230400,
  tcpPort: 5000,
  httpPort: 3001,
  handshakeTimeout: 5000,
};
```

Or set environment variable:

```bash
SERIAL_PORT=/dev/ttyACM0 npm start
```

### Ports

| Port    | Direction    | Purpose                                                 |
| ------- | ------------ | ------------------------------------------------------- |
| `5001`  | inbound TCP  | Robot → bridge pipette commands (`CONFIG.tcpPort`)      |
| `5002`  | inbound TCP  | QR / Wenglor vision sensor jig IDs (`CONFIG.qrPort`)    |
| `5003`  | inbound TCP  | **Dish log** — one jig ID per completed dish (`CONFIG.dishPort`) |
| `3001`  | inbound HTTP | Dashboard + Socket.IO + static frontend (`CONFIG.httpPort`) |
| `3000`  | inbound HTTP | Frontend dev server (Vite, dev only)                    |
| `29999` | outbound TCP | UR Dashboard Server on the robot                        |

Change in `backend/bridge-server.js` if needed.

### Dish log

Every completed dish is appended to `backend/data/dishlog.jsonl` (one JSON object
per line, fsync'd on write so a power cut cannot lose the last record, rolled
over monthly into `dishlog-YYYY-MM.jsonl`). The directory is gitignored — these
are production records, not source.

From URScript, send one jig ID per dish:

```python
socket_open("192.168.1.20", 5003, "dishlog")   # once, at program start

# ...after each completed dish:
socket_send_line("J01", "dishlog")             # _line, NOT _string: only _line appends \n
ack = socket_read_string("dishlog", timeout=2) # "OK", or "IGN" for an ignored value

socket_close("dishlog")                        # at program end
```

`socket_send_string` also works (the server flushes an unterminated buffer after
`CONFIG.dishIdleFlushMs`), but `socket_send_line` is the deterministic path.
Holding the socket open for the whole program is preferred — a connect/disconnect
per dish floods the Communication Logs view, which only keeps the last 100 entries.

Optional extras travel on the same line and need no server change:
`socket_send_line("J01;prog=sperm_wash;op=anna", "dishlog")` — `op` populates the
operator field, anything else lands in `meta`.

View it at `/dishlog` on the dashboard: live event log, per-jig summary,
throughput chart, date-range filter and CSV export.

**Raspberry Pi clocks:** a Pi has no battery-backed RTC, so timestamps can be
wrong until NTP syncs after boot. Install `fake-hwclock` + `chrony` (or fit a
DS3231) — the dashboard shows a warning banner when it detects a skewed clock.

## Usage

### Robot Connection (URScript)

Same as Python version:

```python
# Connect to bridge
socket_open("192.168.1.100", 5000, "pipette")

# Send command
socket_send_string('{"data":"GET_VERSION"}', "pipette")

# Read response
response = socket_read_string("pipette", timeout=5)
# Response: {"status":"OK","data":{"version":"2.0.1"},"message":null}

# Close
socket_close("pipette")
```

### Dashboard Testing

1. Open dashboard: http://localhost:3000
2. Click preset commands (e.g., "Get Version")
3. Watch handshake unfold in real-time:
   - ACK 1
   - BEGIN 1
   - {"version": "2.0.1"}
   - OK 1
   - END 1
4. See full communication in logs

### Custom Commands

Use the "Custom Command" section:

```json
{ "data": "GET_VERSION" }
```

```json
{ "no": 2, "data": "RUN_ASPIRATE 100 7" }
```

## Project Structure

```
node-bridge-server/
├── backend/
│   ├── package.json           # Backend dependencies
│   ├── bridge-server.js       # Main server (Node.js)
│   └── README.md              # Backend documentation
├── frontend/
│   ├── package.json           # Frontend dependencies
│   ├── vite.config.js         # Vite configuration
│   ├── index.html             # HTML entry point
│   ├── src/
│   │   ├── main.jsx           # React entry point
│   │   ├── App.jsx            # Main app component
│   │   ├── App.css            # Global styles
│   │   └── components/
│   │       ├── Topology.jsx           # Network diagram
│   │       ├── ConnectionStatus.jsx   # Status indicators
│   │       ├── CommunicationLogs.jsx  # Log viewer
│   │       ├── HandshakeViewer.jsx    # Handshake monitor
│   │       └── CommandTester.jsx      # Command interface
│   └── README.md              # Frontend documentation
└── README.md                  # This file
```

## API Documentation

### WebSocket Events

**Server → Client:**

- `status` - Connection status update

  ```json
  {
    "robot": "connected" | "disconnected",
    "serial": "connected" | "disconnected",
    "server": "running"
  }
  ```

- `log` - New log entry

  ```json
  {
    "timestamp": "2025-10-19T12:34:56.789Z",
    "type": "info" | "error" | "command" | "response",
    "source": "robot" | "pipette" | "server" | "dashboard",
    "message": "Human readable message",
    "data": null | {...}
  }
  ```

- `handshake` - Handshake step
  ```json
  {
    "timestamp": "2025-10-19T12:34:56.789Z",
    "line": "ACK 1",
    "type": "ACK" | "BEGIN" | "DATA" | "OK" | "ERROR" | "END"
  }
  ```

**Client → Server:**

- `send-command` - Send test command
  ```javascript
  socket.emit("send-command", '{"data":"GET_VERSION"}');
  ```

### REST API

#### GET `/api/status`

Get current connection status

**Response:**

```json
{
  "robot": "connected",
  "serial": "connected",
  "server": "running"
}
```

#### POST `/api/command`

Send test command

**Request:**

```json
{
  "command": "{\"data\":\"GET_VERSION\"}"
}
```

**Response:**

```json
{
  "status": "OK",
  "data": { "version": "2.0.1" },
  "message": null
}
```

## Screenshots

### Dashboard Overview

- Network topology with real-time connection status
- Animated data flow visualization
- Color-coded status indicators

### Communication Logs

- Real-time message stream
- Filterable by keyword
- Auto-scroll option
- Color-coded by source

### Handshake Monitor

- Step-by-step handshake visualization
- Timing information
- Completion status

### Command Tester

- Preset commands for common operations
- Custom JSON command input
- Real-time feedback

## Comparison with Python Version

| Feature                  | Python + asyncio | Node.js + React      |
| ------------------------ | ---------------- | -------------------- |
| **Backend**              | Python (asyncio) | Node.js (event loop) |
| **Dashboard**            | ❌ None          | ✅ React web UI      |
| **Real-time monitoring** | ❌ CLI only      | ✅ WebSocket updates |
| **Topology view**        | ❌               | ✅ Visual diagram    |
| **Command testing**      | ❌ Manual        | ✅ Web interface     |
| **Log filtering**        | ❌               | ✅ Built-in          |
| **Handshake viz**        | ❌               | ✅ Step-by-step      |
| **Memory footprint**     | ~30MB            | ~50MB                |
| **Dev experience**       | Terminal         | Browser              |
| **Deployment**           | Python runtime   | Node.js runtime      |

**Recommendation:**

- **Python**: Simpler, lighter, headless deployment
- **Node.js**: Better for development, testing, and monitoring

## Troubleshooting

### Backend won't start

**"Cannot find module 'serialport'"**

```bash
cd backend
npm install
```

**"Port 5000 already in use"**

```bash
# Find and kill process
lsof -i :5000
kill -9 <PID>
```

**"Serial port not found"**

```bash
# List available ports
ls /dev/tty.*  # macOS
ls /dev/ttyACM* /dev/ttyUSB*  # Linux

# Update CONFIG.serialPort in bridge-server.js
```

### Frontend won't start

**"Cannot find module 'react'"**

```bash
cd frontend
npm install
```

**"Port 3000 already in use"**
Change port in `vite.config.js`:

```javascript
export default defineConfig({
  server: {
    port: 3001, // Change this
  },
});
```

### Dashboard shows "Server disconnected"

Backend not running or wrong URL:

```bash
# Start backend
cd backend
npm start

# Check frontend backend URL in src/App.jsx:
const BACKEND_URL = 'http://localhost:3001'  // Should match backend httpPort
```

### CORS errors

Backend CORS is configured for all origins (`*`). If you need restrictions, edit `backend/bridge-server.js`:

```javascript
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
```

## Performance

- **Latency**: ~50-200ms (serial bound)
- **Memory**: ~50MB (Node + React dev)
- **CPU**: <5% idle, <10% active
- **WebSocket**: <10ms update latency
- **Concurrent users**: 100+ dashboard clients

## Production Deployment

### Build Frontend

```bash
cd frontend
npm run build
# Outputs to: frontend/dist/
```

### Serve Frontend from Backend

Add to `backend/bridge-server.js`:

```javascript
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "../frontend/dist")));
```

Now frontend is served from backend port 3001.

### Run as Service

**systemd (Linux):**

Create `/etc/systemd/system/pipette-bridge.service`:

```ini
[Unit]
Description=Pipette Bridge Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/node-bridge-server/backend
ExecStart=/usr/bin/node bridge-server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable pipette-bridge
sudo systemctl start pipette-bridge
```

## Development

### Adding Features

**New handshake pattern:**
Edit `backend/bridge-server.js` → `parseHandshake()`

**New UI component:**

1. Create `frontend/src/components/NewComponent.jsx`
2. Import in `App.jsx`
3. Add to layout

**New WebSocket event:**

1. Backend: `io.emit('new-event', data)`
2. Frontend: `socket.on('new-event', (data) => {...})`

### Testing

**Backend:**

```bash
cd backend
# Use netcat to simulate robot
nc localhost 5000
{"data":"GET_VERSION"}
```

**Frontend:**

```bash
cd frontend
npm run dev
# Open http://localhost:3000 and test UI
```

## Security

⚠️ **This server has NO authentication!**

For production:

- Add authentication (JWT, API keys)
- Use HTTPS/WSS
- Restrict CORS origins
- Run behind firewall
- Limit to trusted network

## License

MIT

## Credits

Built as a Node.js + React alternative to the Python bridge server with enhanced monitoring capabilities.
