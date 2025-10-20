# Pipette Bridge Server - Backend

Node.js backend server that bridges TCP (robot) to Serial (pipette) communication with real-time web dashboard support.

## Features

- ✅ TCP server for robot connections (port 5000)
- ✅ Serial connection to Picus 2 pipette (USB)
- ✅ HTTP + WebSocket server for dashboard (port 3001)
- ✅ Real-time communication logs
- ✅ Connection status monitoring
- ✅ Handshake parsing and validation
- ✅ Automatic serial reconnection

## Installation

```bash
cd backend
npm install
```

## Configuration

Edit `bridge-server.js` or set environment variables:

```javascript
const CONFIG = {
  serialPort: process.env.SERIAL_PORT || '/dev/tty.usbmodem438812441',
  serialBaudRate: 230400,
  tcpPort: 5000,        // Robot connects here
  httpPort: 3001,       // Dashboard connects here
  handshakeTimeout: 5000,
};
```

## Usage

### Start Server

```bash
npm start
```

### Development Mode (Auto-restart)

```bash
npm run dev
```

You should see:

```
[INFO] server: ============================================================
[INFO] server: Pipette Bridge Server Started
[INFO] server: ============================================================
[INFO] pipette: Serial port connected
[INFO] server: TCP server listening on port 5000
[INFO] server: HTTP + WebSocket server listening on port 3001
[INFO] server: Dashboard available at: http://localhost:3001
```

## Architecture

```
┌─────────┐  TCP:5000   ┌──────────┐  USB/Serial  ┌─────────┐
│  Robot  │◄───────────►│  Bridge  │◄────────────►│ Pipette │
│ (UR)    │             │  Server  │              │(Picus 2)│
└─────────┘             └─────┬────┘              └─────────┘
                              │
                              │ WebSocket:3001
                              ▼
                       ┌──────────────┐
                       │  Dashboard   │
                       │   (React)    │
                       └──────────────┘
```

## API Endpoints

### REST API

#### GET `/api/status`
Get current connection status

**Response:**
```json
{
  "robot": "connected" | "disconnected",
  "serial": "connected" | "disconnected",
  "server": "running"
}
```

#### POST `/api/command`
Send test command to pipette

**Request:**
```json
{
  "command": "{\"data\":\"GET_VERSION\"}"
}
```

**Response:**
```json
{
  "status": "OK" | "ERROR",
  "data": { ... },
  "message": null | "error message"
}
```

### WebSocket Events

#### Client → Server

- `send-command` - Send test command
  ```javascript
  socket.emit('send-command', '{"data":"GET_VERSION"}');
  ```

#### Server → Client

- `status` - Connection status update
  ```javascript
  {
    robot: 'connected' | 'disconnected',
    serial: 'connected' | 'disconnected',
    server: 'running'
  }
  ```

- `log` - Communication log entry
  ```javascript
  {
    timestamp: '2025-10-19T12:34:56.789Z',
    type: 'info' | 'error' | 'command' | 'response' | 'handshake',
    source: 'robot' | 'pipette' | 'server' | 'dashboard',
    message: 'Human readable message',
    data: null | { ... }
  }
  ```

- `handshake` - Handshake step
  ```javascript
  {
    timestamp: '2025-10-19T12:34:56.789Z',
    line: 'ACK 1',
    type: 'ACK' | 'BEGIN' | 'DATA' | 'OK' | 'ERROR' | 'END'
  }
  ```

- `command-response` - Response to test command
  ```javascript
  {
    status: 'OK',
    data: { version: '2.0.1' },
    message: null
  }
  ```

## Robot Usage (URScript)

Same as Python version:

```python
# Connect to bridge
socket_open("192.168.1.100", 5000, "pipette")

# Send command
socket_send_string('{"data":"GET_VERSION"}', "pipette")

# Read response
response = socket_read_string("pipette", timeout=5)
# Response: {"status":"OK","data":{"version":"2.0.1"},"message":null}

# Close connection
socket_close("pipette")
```

## Error Handling

### Serial Disconnection
- Automatically attempts reconnection every 3 seconds
- Logs to console and dashboard
- Returns ERROR response to robot if serial not connected

### Robot Disconnection
- Gracefully handled
- Can reconnect at any time

### Handshake Timeout
- 5 second timeout per command
- Returns ERROR response: `{"status":"ERROR","message":"Pipette response timeout","data":null}`

## Troubleshooting

### "Cannot find module 'serialport'"

```bash
npm install
```

### "Error: Permission denied" (Linux)

```bash
sudo chmod 666 /dev/ttyACM0
# or
sudo usermod -a -G dialout $USER
# then logout and login
```

### "Port already in use"

Another process is using port 5000 or 3001:

```bash
# Find process
lsof -i :5000
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Serial port not found

List available ports:

```bash
# macOS
ls /dev/tty.*

# Linux
ls /dev/tty{ACM,USB}*

# Or use Node.js
node -e "const {SerialPort} = require('serialport'); SerialPort.list().then(ports => console.log(ports));"
```

## Development

### Project Structure

```
backend/
├── package.json           # Dependencies
├── bridge-server.js       # Main server
└── README.md             # This file
```

### Dependencies

- **express** - HTTP server
- **socket.io** - WebSocket for real-time updates
- **serialport** - Serial communication
- **cors** - Cross-origin support

### Adding Features

1. **New command types**: Extend `parseHandshake()` function
2. **Custom protocols**: Modify `isHandshakeComplete()` logic
3. **Authentication**: Add middleware to Express
4. **Logging to file**: Add `winston` or `bunyan` logger

## Performance

- **Latency**: ~50-200ms (serial bound)
- **Memory**: ~30-50MB
- **CPU**: <5% (I/O bound)
- **Concurrent connections**: 1 robot + unlimited dashboard clients

## Security Notes

⚠️ **This server has no authentication!**

For production:
- Add authentication (JWT, API keys)
- Use HTTPS/WSS
- Run behind firewall
- Limit to trusted network

## License

MIT
