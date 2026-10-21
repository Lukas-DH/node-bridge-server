import { useState, useEffect, createContext } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import ConnectionStatus from "./components/ConnectionStatus";
import VersionInfo from "./components/VersionInfo";
import Home from "./pages/Home";
import RobotControl from "./pages/RobotControl";
import OperatorPanel from "./pages/OperatorPanel2";
import DishLog from "./pages/DishLog";

// const BACKEND_URL = "http://192.168.1.20:3001";
export const BACKEND_URL = `http://${window.location.hostname}:3001`;

export const SocketContext = createContext(null);

function App() {
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState({
    robot: "disconnected",
    serial: "disconnected",
    server: "disconnected",
    dashboard: "disconnected",
    qr: "disconnected",
    dish: "disconnected",
    qrValue: null,
  });
  const [logs, setLogs] = useState([]);
  const [dishEvents, setDishEvents] = useState([]);
  const [dishStats, setDishStats] = useState(null);
  const [handshakeSteps, setHandshakeSteps] = useState([]);
  const [connected, setConnected] = useState(false);
  const [activePipette, setActivePipette] = useState(null);
  const [serverVersion, setServerVersion] = useState(null);
  const location = useLocation();
  const isOperatorPage = location.pathname === "/operator";

  useEffect(() => {
    // Connect to backend WebSocket
    const newSocket = io(BACKEND_URL);

    newSocket.on("connect", () => {
      console.log("Connected to backend");
      setConnected(true);
      setStatus((prev) => ({ ...prev, server: "connected" }));
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from backend");
      setConnected(false);
      setStatus({
        robot: "disconnected",
        serial: "disconnected",
        server: "disconnected",
        dashboard: "disconnected",
        qr: "disconnected",
        dish: "disconnected",
        qrValue: null,
      });
    });

    // Sent on every (re)connect, so a service restart updates the footer
    newSocket.on("server-version", setServerVersion);

    // Listen for status updates
    newSocket.on("status", (newStatus) => {
      setStatus((prev) => ({
        ...newStatus,
        server: "connected",
        qrValue: prev.qrValue,
        qrTimestamp: prev.qrTimestamp,
      }));
    });

    // Listen for logs
    newSocket.on("log", (logEntry) => {
      setLogs((prev) => [...prev, logEntry].slice(-100)); // Keep last 100 logs
    });

    // Listen for handshake steps
    newSocket.on("handshake", (step) => {
      setHandshakeSteps((prev) => {
        // Start new handshake on ACK
        if (step.type === "ACK") {
          return [step];
        }
        // Continue current handshake
        return [...prev, step];
      });
    });

    // Listen for active pipette updates
    newSocket.on("active-pipette", (model) => {
      setActivePipette(model);
    });

    // Listen for QR code updates
    newSocket.on("qr-update", (data) => {
      setStatus((prev) => ({
        ...prev,
        qrValue: data.value,
        qrTimestamp: data.timestamp,
      }));
    });

    // Dish log. Subscribed here rather than in DishLog.jsx because
    // "dish-snapshot" fires exactly once on socket connect — a page mounting
    // later would never see it. It also means dishes completed while the user
    // is on another page are already present when they navigate here.
    newSocket.on("dish-snapshot", (snapshot) => {
      setDishEvents(snapshot?.events || []);
      setDishStats(snapshot?.stats || null);
    });

    newSocket.on("dish-event", (record) => {
      setDishEvents((prev) => [record, ...prev].slice(0, 300)); // newest-first
    });

    newSocket.on("dish-stats", (stats) => {
      setDishStats(stats);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const sendCommand = (command) => {
    if (socket) {
      socket.emit("send-command", command);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const clearHandshake = () => {
    setHandshakeSteps([]);
  };

  // Render operator panel without header/footer for kiosk mode
  if (isOperatorPage) {
    return (
      <SocketContext.Provider value={socket}>
        <Routes>
          <Route
            path="/operator"
            element={
              <OperatorPanel
                socket={socket}
                qrValue={status.qrValue}
                dashboardStatus={status.dashboard}
              />
            }
          />
        </Routes>
      </SocketContext.Provider>
    );
  }

  return (
    <SocketContext.Provider value={socket}>
      <div className="app">
        <header className="app-header">
          <div className="header-left">
            <h1>Pipette Bridge Dashboard</h1>
            <nav className="app-nav">
              <Link
                to="/"
                className={`nav-link ${location.pathname === "/" ? "active" : ""}`}
              >
                Home
              </Link>
              <Link
                to="/robot-control"
                className={`nav-link ${location.pathname === "/robot-control" ? "active" : ""}`}
              >
                Robot Control
              </Link>
              <Link
                to="/dishlog"
                className={`nav-link ${location.pathname === "/dishlog" ? "active" : ""}`}
              >
                Dish Log
              </Link>
            </nav>
          </div>
          <ConnectionStatus status={status} connected={connected} />
        </header>

        <Routes>
          <Route
            path="/"
            element={
              <Home
                status={status}
                connected={connected}
                logs={logs}
                handshakeSteps={handshakeSteps}
                sendCommand={sendCommand}
                clearLogs={clearLogs}
                clearHandshake={clearHandshake}
                socket={socket}
              />
            }
          />
          <Route
            path="/dishlog"
            element={
              <DishLog
                socket={socket}
                liveEvents={dishEvents}
                stats={dishStats}
              />
            }
          />
          <Route
            path="/robot-control"
            element={
              <RobotControl
                socket={socket}
                dashboardStatus={status.dashboard}
                qrValue={status.qrValue}
                qrTimestamp={status.qrTimestamp}
              />
            }
          />
        </Routes>

        <footer className="app-footer">
          <p>Pipette Bridge Server - Node.js + React - Real-time monitoring</p>
          <VersionInfo serverVersion={connected ? serverVersion : null} />
        </footer>
      </div>
    </SocketContext.Provider>
  );
}

export default App;
