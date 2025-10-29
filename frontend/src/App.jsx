import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Topology from "./components/Topology";
import ConnectionStatus from "./components/ConnectionStatus";
import CommunicationLogs from "./components/CommunicationLogs";
import HandshakeViewer from "./components/HandshakeViewer";
import CommandTester from "./components/CommandTester";
import PipetteSelector from "./components/PipetteSelector";

const BACKEND_URL = "http://localhost:3001";
// const BACKEND_URL = 'http://192.168.1.88:3001'

function App() {
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState({
    robot: "disconnected",
    serial: "disconnected",
    server: "disconnected",
  });
  const [logs, setLogs] = useState([]);
  const [handshakeSteps, setHandshakeSteps] = useState([]);
  const [connected, setConnected] = useState(false);
  const [activePipette, setActivePipette] = useState(null);

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

    // Listen for active pipette updates
    newSocket.on("active-pipette", (model) => {
      setActivePipette(model);
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
    <div className="app">
      <header className="app-header">
        <h1>🤖 Pipette Bridge Dashboard</h1>
        <ConnectionStatus status={status} connected={connected} />
      </header>

      <div className="app-content">
        <div className="left-panel">
          <Topology status={status} />
          <PipetteSelector socket={socket} />
          <CommandTester
            onSendCommand={sendCommand}
            disabled={!connected}
            activePipette={activePipette}
          />
        </div>

        <div className="right-panel">
          <HandshakeViewer steps={handshakeSteps} onClear={clearHandshake} />
          <CommunicationLogs logs={logs} onClear={clearLogs} />
        </div>
      </div>

      <footer className="app-footer">
        <p>Pipette Bridge Server • Node.js + React • Real-time monitoring</p>
      </footer>
    </div>
  );
}

export default App;
