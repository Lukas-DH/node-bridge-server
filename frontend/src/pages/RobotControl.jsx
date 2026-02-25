import { useState, useEffect } from "react";
import DashboardControls from "../components/DashboardControls";

function RobotControl({ socket, dashboardStatus, qrValue, qrTimestamp }) {
  const [robotIp, setRobotIp] = useState(() => {
    return localStorage.getItem("robotIp") || "";
  });
  const [responseLog, setResponseLog] = useState([]);

  // Save robot IP to localStorage when it changes
  useEffect(() => {
    if (robotIp) {
      localStorage.setItem("robotIp", robotIp);
    }
  }, [robotIp]);

  // Listen for dashboard responses
  useEffect(() => {
    if (!socket) return;

    const handleResponse = (data) => {
      setResponseLog((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          ...data,
        },
      ].slice(-50)); // Keep last 50 entries
    };

    socket.on("dashboard-response", handleResponse);
    socket.on("dashboard-command-response", handleResponse);

    return () => {
      socket.off("dashboard-response", handleResponse);
      socket.off("dashboard-command-response", handleResponse);
    };
  }, [socket]);

  const handleConnect = () => {
    if (socket && robotIp.trim()) {
      socket.emit("dashboard-connect", robotIp.trim());
    }
  };

  const handleDisconnect = () => {
    if (socket) {
      socket.emit("dashboard-disconnect");
    }
  };

  const sendCommand = (command) => {
    if (socket) {
      socket.emit("dashboard-command", command);
    }
  };

  const clearLog = () => {
    setResponseLog([]);
  };

  const isConnected = dashboardStatus === "connected";
  const isConnecting = dashboardStatus === "connecting";

  const getStatusClass = () => {
    if (isConnected) return "status-connected";
    if (isConnecting) return "status-connecting";
    return "status-disconnected";
  };

  const getStatusText = () => {
    if (isConnected) return "Connected";
    if (isConnecting) return "Connecting...";
    return "Disconnected";
  };

  return (
    <div className="robot-control-page">
      <div className="left-panel">
        {/* Connection Card */}
        <div className="connection-card">
          <h2>Robot Connection</h2>
          <div className="connection-form">
            <div className="ip-input-row">
              <label htmlFor="robot-ip">Robot IP:</label>
              <input
                id="robot-ip"
                type="text"
                value={robotIp}
                onChange={(e) => setRobotIp(e.target.value)}
                placeholder="192.168.1.100"
                className="ip-input"
                disabled={isConnected || isConnecting}
              />
            </div>
            <div className="connection-buttons">
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={!robotIp.trim() || isConnecting}
                  className="connect-button"
                >
                  {isConnecting ? "Connecting..." : "Connect"}
                </button>
              ) : (
                <button onClick={handleDisconnect} className="disconnect-button">
                  Disconnect
                </button>
              )}
            </div>
          </div>
          <div className={`connection-status-indicator ${getStatusClass()}`}>
            <span className="status-dot"></span>
            <span className="status-text">{getStatusText()}</span>
          </div>
        </div>

        {/* Dashboard Controls */}
        <DashboardControls onSendCommand={sendCommand} disabled={!isConnected} />

        {/* QR Code Display */}
        <div className="qr-display">
          <h2>QR Code Scanner</h2>
          <div className="qr-content">
            {qrValue ? (
              <>
                <div className="qr-value">{qrValue}</div>
                <div className="qr-timestamp">
                  Last updated: {qrTimestamp ? new Date(qrTimestamp).toLocaleTimeString() : "N/A"}
                </div>
              </>
            ) : (
              <div className="qr-empty">No QR code scanned yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="right-panel">
        {/* Response Log */}
        <div className="response-display">
          <div className="response-header">
            <h2>Response Log</h2>
            <button onClick={clearLog} className="clear-button">
              Clear
            </button>
          </div>
          <div className="response-log">
            {responseLog.length === 0 ? (
              <div className="response-empty">
                No responses yet. Connect to robot and send commands.
              </div>
            ) : (
              responseLog.map((entry, index) => (
                <div
                  key={index}
                  className={`response-entry ${entry.success === false ? "response-error" : ""}`}
                >
                  <span className="response-time">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="response-content">
                    {entry.response || entry.error || JSON.stringify(entry)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RobotControl;
