import { useState, useEffect, useRef } from "react";
import caringLogo from "../assets/caring-ivf.png";

const ROBOT_IP = "192.168.1.95";

function OperatorPanel({ socket, qrValue, dashboardStatus }) {
  const [activeButton, setActiveButton] = useState(null);
  const [status, setStatus] = useState("READY");
  const [pendingCommand, setPendingCommand] = useState(null);
  const statusRef = useRef(null);
  const statusContainerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [startMode, setStartMode] = useState(false);
  const [powerOnMode, setPowerOnMode] = useState(false);
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  const powerOnIntervalRef = useRef(null);

  useEffect(() => {
    if (socket) {
      socket.on("dashboard-response", (data) => {
        const response = data.response || data.toString();

        // Detect power state from robotmode responses
        const responseLower = response.toLowerCase();
        if (responseLower.includes("power_off")) {
          setIsPoweredOn(false);
        } else if (responseLower.includes("idle")) {
          setIsPoweredOn(true);
        }

        // Handle power-on sequence polling
        if (powerOnMode) {
          // Check if this is a robotmode response indicating idle state
          if (responseLower.includes("idle")) {
            // Robot is ready - send brake release
            clearInterval(powerOnIntervalRef.current);
            powerOnIntervalRef.current = null;
            setStatus("RELEASING BRAKES...");
            socket.emit("dashboard-command", "brake release");
            setPowerOnMode(false);
          } else if (
            responseLower.includes("power_off") ||
            responseLower.includes("power_on") ||
            responseLower.includes("booting")
          ) {
            // Still in progress - update status
            setStatus(`POWER ON: ${response.toUpperCase()}`);
          }
          return; // Don't process further during power sequence
        }

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
        if (powerOnIntervalRef.current) {
          clearInterval(powerOnIntervalRef.current);
        }
      };
    }
  }, [socket, powerOnMode]);

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
      if (pendingCommand === "__power_on_sequence__") {
        setPendingCommand(null);
        // Trigger power sequence now that we're connected
        setStatus("POWERING ON...");
        setPowerOnMode(true);
        socket.emit("dashboard-command", "power on");
        setTimeout(() => {
          powerOnIntervalRef.current = setInterval(() => {
            socket.emit("dashboard-command", "robotmode");
          }, 1500);
        }, 1000);
      } else {
        setStatus(`SENDING: ${pendingCommand.toUpperCase()}`);
        socket.emit("dashboard-command", pendingCommand);
        setPendingCommand(null);
      }
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

  const handlePowerOn = () => {
    if (!socket) return;

    setActiveButton("poweron");
    setTimeout(() => setActiveButton(null), 200);

    const startPowerSequence = () => {
      setStatus("POWERING ON...");
      setPowerOnMode(true);
      socket.emit("dashboard-command", "power on");

      // Start polling for robot mode after initial command
      setTimeout(() => {
        powerOnIntervalRef.current = setInterval(() => {
          socket.emit("dashboard-command", "robotmode");
        }, 1500); // Poll every 1.5 seconds
      }, 1000); // Wait 1 second before starting to poll
    };

    if (dashboardStatus !== "connected") {
      setStatus("CONNECTING...");
      setPendingCommand("__power_on_sequence__"); // Special marker
      socket.emit("dashboard-connect", ROBOT_IP);
    } else {
      startPowerSequence();
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
            className={`industrial-button industrial-button-white industrial-button-large ${
              activeButton === "start" ? "active" : ""
            }`}
            onClick={handleStart}
            disabled={!socket || !isPoweredOn}
          >
            <img src={caringLogo} alt="Start" className="button-logo" />
            <span className="button-label">START</span>
          </button>

          {/* Row of smaller buttons */}
          <div className="operator-button-row">
            <button
              className={`industrial-button industrial-button-green ${
                activeButton === "play" ? "active" : ""
              }`}
              onClick={() => handleCommand("play", "play")}
              disabled={!socket || !isPoweredOn}
            >
              <span className="button-icon">▶</span>
              <span className="button-label">PLAY</span>
            </button>
            <button
              className={`industrial-button industrial-button-yellow ${
                activeButton === "pause" ? "active" : ""
              }`}
              onClick={() => handleCommand("pause", "pause")}
              disabled={!socket || !isPoweredOn}
            >
              <span className="button-icon">⏸</span>
              <span className="button-label">PAUSE</span>
            </button>

            <button
              className={`industrial-button industrial-button-red ${
                activeButton === "stop" ? "active" : ""
              }`}
              onClick={() => handleCommand("stop", "stop")}
              disabled={!socket || !isPoweredOn}
            >
              <span className="button-icon">⏹</span>
              <span className="button-label">STOP</span>
            </button>
          </div>
          <div className="operator-button-row">
            <button
              className={`industrial-button industrial-button-blue ${
                activeButton === "poweron" ? "active" : ""
              }`}
              onClick={handlePowerOn}
              disabled={!socket || powerOnMode || isPoweredOn}
            >
              <span className="button-icon">⚡</span>
              <span className="button-label">
                {powerOnMode ? "..." : "PWR ON"}
              </span>
            </button>

            <button
              className={`industrial-button industrial-button-cyan ${
                activeButton === "poweroff" ? "active" : ""
              }`}
              onClick={() => handleCommand("power off", "poweroff")}
              disabled={!socket || !isPoweredOn}
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
