import { useState, useEffect, createContext } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import ConnectionStatus from "./components/ConnectionStatus";
import Home from "./pages/Home";
import RobotControl from "./pages/RobotControl";

const BACKEND_URL = "http://localhost:3001";
// const BACKEND_URL = "http://192.168.1.88:3001";

export const SocketContext = createContext(null);

function App() {
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState({
    robot: "disconnected",
    serial: "disconnected",
    server: "disconnected",
    dashboard: "disconnected",
  });
  const [logs, setLogs] = useState([]);
  const [handshakeSteps, setHandshakeSteps] = useState([]);
  const [connected, setConnected] = useState(false);
  const location = useLocation();

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
      });
    });

    // Listen for status updates
    newSocket.on("status", (newStatus) => {
      setStatus({
        ...newStatus,
        server: "connected",
      });
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
              />
            }
          />
          <Route
            path="/robot-control"
            element={
              <RobotControl
                socket={socket}
                dashboardStatus={status.dashboard}
              />
            }
          />
        </Routes>

        <footer className="app-footer">
          <p>Pipette Bridge Server - Node.js + React - Real-time monitoring</p>
        </footer>
      </div>
    </SocketContext.Provider>
  );
}

export default App;
