# Getting Started with Pipette Bridge Server

## Quick Setup Guide

### Step 1: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 2: Configure Serial Port

Edit `backend/bridge-server.js` line 18:

```javascript
serialPort: '/dev/tty.usbmodem438812441',  // ← Change to your port
```

**Find your port:**

```bash
# macOS
ls /dev/tty.usbmodem*

# Linux
ls /dev/ttyACM* /dev/ttyUSB*
```

### Step 3: Start Backend

```bash
cd backend
npm start
```

You should see:

```
[INFO] server: ============================================================
[INFO] server: Pipette Bridge Server Started
[INFO] pipette: Serial port connected
[INFO] server: TCP server listening on port 5000
[INFO] server: HTTP + WebSocket server listening on port 3001
```

### Step 4: Start Frontend

In a new terminal:

```bash
cd frontend
npm run dev
```

You should see:

```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### Step 5: Open Dashboard

Open browser: http://localhost:3000

You should see:

- 🟢 **Server**: connected (green)
- 🔴 **Robot**: disconnected (red - until robot connects)
- 🟢 **Pipette**: connected (green - if USB connected)

## Testing Commands

### Option 1: Use Dashboard

1. Click "Get Version" button
2. Watch handshake unfold:
   - ACK 1
   - BEGIN 1
   - {"version": "2.0.1"}
   - OK 1
   - END 1
3. See logs update in real-time

### Option 2: Use Robot (URScript)

```python
socket_open("192.168.1.100", 5001, "pipette")
socket_send_string('{"data":"GET_VERSION"}', "pipette")
response = socket_read_string("pipette", timeout=5)
socket_close("pipette")
```

## Common Issues

### Backend: "Cannot find module 'serialport'"

```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Frontend: Dashboard shows "Server disconnected"

- Check backend is running
- Check backend URL in `frontend/src/App.jsx`
- Should be: `const BACKEND_URL = 'http://localhost:3001'`

### Serial port not found

```bash
# Check USB connection
ls /dev/tty.*

# Update backend/bridge-server.js with correct port
```

### Port already in use

```bash
# Find process using port
lsof -i :5001  # Backend TCP
lsof -i :3001  # Backend HTTP/WS
lsof -i :3000  # Frontend dev

# Kill process
kill -9 <PID>
```

## What's Next?

1. ✅ Test preset commands in dashboard
2. ✅ Try custom JSON commands
3. ✅ Watch real-time logs and handshakes
4. ✅ Connect robot and test full workflow
5. ✅ Monitor topology visualization

## File Structure

```
node-bridge-server/
├── backend/                    # Node.js server
│   ├── bridge-server.js       # Main server file
│   ├── package.json           # Dependencies
│   └── README.md              # Backend docs
├── frontend/                   # React dashboard
│   ├── src/
│   │   ├── App.jsx            # Main app
│   │   ├── App.css            # Styles
│   │   └── components/        # UI components
│   ├── package.json           # Dependencies
│   └── README.md              # Frontend docs
├── README.md                   # Main documentation
└── GETTING_STARTED.md         # This file
```

## Need Help?

- Backend docs: `backend/README.md`
- Frontend docs: `frontend/README.md`
- Full docs: `README.md`

## Moving to Separate Repo

To move this to a separate repository:

```bash
# Copy the entire node-bridge-server folder
cp -r node-bridge-server /path/to/new/location

# Initialize git
cd /path/to/new/location/node-bridge-server
git init
git add .
git commit -m "Initial commit: Pipette Bridge Server with React Dashboard"

# Push to GitHub
git remote add origin https://github.com/your-username/pipette-bridge-server.git
git push -u origin main
```

---

**Happy monitoring! 🚀**
