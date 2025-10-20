# Pipette Bridge Dashboard - Frontend

Real-time web dashboard for monitoring and testing the Pipette Bridge Server.

## Features

- ✅ **Network Topology Visualization** - See robot ↔ server ↔ pipette connections
- ✅ **Real-time Connection Status** - Color-coded indicators (🟢/🔴)
- ✅ **Animated Connections** - Visual feedback when data flows
- ✅ **Communication Logs** - Live stream of all messages
- ✅ **Handshake Monitor** - Step-by-step handshake visualization
- ✅ **Command Tester** - Send test commands to pipette
- ✅ **Preset Commands** - Quick access to common commands
- ✅ **Responsive Design** - Works on desktop and mobile

## Installation

```bash
cd frontend
npm install
```

## Development

```bash
npm run dev
```

Opens at: http://localhost:3000

## Build for Production

```bash
npm run build
```

Outputs to: `dist/`

## Preview Production Build

```bash
npm run preview
```

## Architecture

### Components

#### `App.jsx`
Main application component that:
- Connects to backend WebSocket
- Manages global state (status, logs, handshake)
- Coordinates child components

#### `Topology.jsx`
Visual network diagram showing:
- Robot, Server, Pipette nodes
- Connection status (connected/disconnected)
- Animated data flow when active

#### `ConnectionStatus.jsx`
Header status bar with:
- Server connection indicator
- Robot connection indicator
- Pipette connection indicator

#### `CommunicationLogs.jsx`
Log viewer with:
- Real-time message stream
- Filter by keyword
- Auto-scroll toggle
- Clear button
- Color-coded sources (robot, pipette, server, dashboard)

#### `HandshakeViewer.jsx`
Handshake monitor showing:
- Step-by-step handshake flow
- ACK → BEGIN → DATA → OK/ERROR → END
- Timing information
- Completion status

#### `CommandTester.jsx`
Command interface with:
- Preset commands (Get Version, Aspirate, etc.)
- Custom JSON command input
- Last sent command display
- Disabled state when server not connected

### State Management

Uses React hooks (useState, useEffect) for:
- WebSocket connection state
- Connection status (robot, serial, server)
- Communication logs (last 100 entries)
- Handshake steps (current handshake)

### WebSocket Events

**Listening:**
- `connect` - Backend connected
- `disconnect` - Backend disconnected
- `status` - Connection status update
- `log` - New log entry
- `handshake` - Handshake step

**Emitting:**
- `send-command` - Send test command

## Configuration

### Backend URL

Edit `App.jsx`:

```javascript
const BACKEND_URL = 'http://localhost:3001'
```

Change to your backend server address if different.

### Log Buffer Size

Edit `App.jsx`:

```javascript
setLogs((prev) => [...prev, logEntry].slice(-100))  // Keep last 100 logs
```

Increase/decrease number for more/fewer logs.

## Styling

### Theme

Dark theme with gradient header:
- Background: `#1a1a1a`
- Cards: `#2a2a2a`
- Text: `#e0e0e0`
- Accent: `#667eea` to `#764ba2`

### Colors

- **Server**: Green `#51cf66`
- **Robot**: Blue `#4a9eff`
- **Pipette**: Red `#ff6b6b`
- **Dashboard**: Yellow `#ffd43b`
- **Error**: Red `#ff6b6b`

### Responsive Breakpoints

- Desktop: > 1200px (2 column grid)
- Tablet: 768px - 1200px (1 column grid)
- Mobile: < 768px (stacked layout)

## Usage

### Starting the Dashboard

1. **Start Backend First:**
   ```bash
   cd backend
   npm start
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Open Browser:**
   Navigate to http://localhost:3000

### Testing Commands

1. Click preset buttons for common commands
2. Or enter custom JSON in text area
3. Watch handshake unfold in real-time
4. See full communication in logs

### Monitoring

- **Green indicators**: All systems operational
- **Red indicators**: Connection lost
- **Animated lines**: Data flowing between systems

## Troubleshooting

### "Cannot connect to backend"

Backend server not running:
```bash
cd backend
npm start
```

### "CORS errors in console"

Backend CORS is configured for `*`. If you need specific origins, edit `backend/bridge-server.js`:

```javascript
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: 'http://localhost:3000',  // Specific origin
    methods: ['GET', 'POST'],
  },
})
```

### Logs not updating

Check browser console for WebSocket errors. Ensure backend is running on port 3001.

### Build fails

Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Development Tips

### Hot Reload

Vite provides instant hot reload. Edit any file and see changes immediately.

### Component Development

Each component is self-contained. Edit in isolation:

```bash
# Example: Working on Topology
# Edit: src/components/Topology.jsx
# Save and see changes in browser
```

### Debugging WebSocket

Open browser DevTools → Network → WS to see WebSocket messages:

```
→ send-command: {"data":"GET_VERSION"}
← log: {timestamp: "...", type: "command", ...}
← handshake: {line: "ACK 1", type: "ACK"}
```

## Performance

- **WebSocket**: Real-time, low latency (~10ms)
- **React rendering**: Optimized with proper key props
- **Memory**: Logs capped at 100 entries
- **Bundle size**: ~150KB gzipped

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE11: ❌ Not supported (uses ES6+)

## Future Enhancements

- [ ] Export logs to CSV/JSON
- [ ] Command history with replay
- [ ] Dashboard presets/bookmarks
- [ ] Multi-language support
- [ ] Dark/light theme toggle
- [ ] Notification sounds for errors
- [ ] WebGL topology visualization
- [ ] Performance graphs

## License

MIT
