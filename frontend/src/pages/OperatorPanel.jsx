import { useState, useEffect, useRef } from "react";

const ROBOT_IP = "192.168.1.95";

function OperatorPanel({ socket, qrValue, dashboardStatus }) {
  const [activeButton, setActiveButton] = useState(null);
  const [status, setStatus] = useState("READY");
  const [pendingCommand, setPendingCommand] = useState(null);
  const statusRef = useRef(null);
  const statusContainerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [startMode, setStartMode] = useState(false);

  useEffect(() => {
    if (socket) {
      socket.on("dashboard-response", (data) => {
        const response = data.response || data.toString();
        setStatus(response);

        // If we just loaded a program via START, now play it
        if (startMode && data.success) {
          setStartMode(false);
          setStatus("STARTING PROGRAM...");
          socket.emit("dashboard-command", "play");
        }
      });

      return () => {
        socket.off("dashboard-response");
      };
    }
  }, [socket]);

  // Check if status text overflows and needs scrolling
  useEffect(() => {
    if (statusRef.current && statusContainerRef.current) {
      const textWidth = statusRef.current.scrollWidth;
      const containerWidth = statusContainerRef.current.clientWidth;
      setShouldScroll(textWidth > containerWidth);
    }
  }, [status]);

  // Send pending command when connected
  useEffect(() => {
    if (dashboardStatus === "connected" && pendingCommand) {
      setStatus(`SENDING: ${pendingCommand.toUpperCase()}`);
      socket.emit("dashboard-command", pendingCommand);
      setPendingCommand(null);
    }
  }, [dashboardStatus, pendingCommand, socket]);

  const handleCommand = (command, buttonId) => {
    if (!socket) return;
    setActiveButton(buttonId);
    setTimeout(() => setActiveButton(null), 200);

    if (dashboardStatus !== "connected") {
      // Not connected - connect first, queue command
      setStatus("CONNECTING...");
      setPendingCommand(command);
      socket.emit("dashboard-connect", ROBOT_IP);
    } else {
      // Already connected - send directly
      setStatus(`SENDING: ${command.toUpperCase()}`);
      socket.emit("dashboard-command", command);
    }
  };

  const handleStart = () => {
    if (!socket) return;
    if (!qrValue) {
      setStatus("NO PROGRAM - SCAN QR FIRST");
      return;
    }

    setActiveButton("start");
    setTimeout(() => setActiveButton(null), 200);

    const programName = `${qrValue}.urp`;

    if (dashboardStatus !== "connected") {
      setStatus("CONNECTING...");
      setStartMode(true);
      setPendingCommand(`load ${programName}`);
      socket.emit("dashboard-connect", ROBOT_IP);
    } else {
      setStatus(`LOADING: ${programName}`);
      setStartMode(true);
      socket.emit("dashboard-command", `load ${programName}`);
    }
  };

  return (
    <div className="operator-panel">
      <div className="operator-content">
        {/* LED Displays */}
        <div className="operator-displays">
          <div className="led-display">
            <span className="led-display-label">Current Jig in Workspace</span>
            <div className="led-display-screen">
              <span className="led-display-text">
                {qrValue || "NO JIG DETECTED"}
              </span>
            </div>
          </div>

          <div className="led-display">
            <span className="led-display-label">Status</span>
            <div className="led-display-screen" ref={statusContainerRef}>
              <span
                className={`led-display-text ${shouldScroll ? "led-scroll" : ""}`}
                ref={statusRef}
              >
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="operator-buttons">
          {/* Large Play button */}

          <button
            className={`industrial-button industrial-button-cyan industrial-button-large ${
              activeButton === "start" ? "active" : ""
            }`}
            onClick={handleStart}
            disabled={!socket}
          >
            <span className="button-icon">↻</span>
            <span className="button-label">START</span>
          </button>

          {/* Row of smaller buttons */}
          <div className="operator-button-row">
            <button
              className={`industrial-button industrial-button-green ${
                activeButton === "play" ? "active" : ""
              }`}
              onClick={() => handleCommand("play", "play")}
              disabled={!socket}
            >
              <span className="button-icon">▶</span>
              <span className="button-label">PLAY</span>
            </button>
            <button
              className={`industrial-button industrial-button-yellow ${
                activeButton === "pause" ? "active" : ""
              }`}
              onClick={() => handleCommand("pause", "pause")}
              disabled={!socket}
            >
              <span className="button-icon">⏸</span>
              <span className="button-label">PAUSE</span>
            </button>

            <button
              className={`industrial-button industrial-button-red ${
                activeButton === "stop" ? "active" : ""
              }`}
              onClick={() => handleCommand("stop", "stop")}
              disabled={!socket}
            >
              <span className="button-icon">⏹</span>
              <span className="button-label">STOP</span>
            </button>

            <button
              className={`industrial-button industrial-button-blue ${
                activeButton === "poweron" ? "active" : ""
              }`}
              onClick={() => handleCommand("power on", "poweron")}
              disabled={!socket}
            >
              <span className="button-icon">⚡</span>
              <span className="button-label">PWR ON</span>
            </button>

            <button
              className={`industrial-button industrial-button-purple ${
                activeButton === "poweroff" ? "active" : ""
              }`}
              onClick={() => handleCommand("power off", "poweroff")}
              disabled={!socket}
            >
              <span className="button-icon">○</span>
              <span className="button-label">PWR OFF</span>
            </button>
          </div>
        </div>

        {/* Robot IP display */}
        <div className="operator-robot-ip">
          Robot: {ROBOT_IP} ({dashboardStatus})
        </div>
      </div>
    </div>
  );
}

export default OperatorPanel;
