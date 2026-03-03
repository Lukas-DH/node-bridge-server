import { useState, useEffect, useRef } from "react";
import dishbotLogo from "../assets/dishbot.jpg";
// import caringLogo from "../assets/caring-ivf.png";

const ROBOT_IP = "192.168.1.95";

function OperatorPanel({ socket, qrValue, dashboardStatus }) {
  const [activeButton, setActiveButton] = useState(null);
  const [status, setStatus] = useState("READY");
  const statusRef = useRef(null);
  const statusContainerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [startMode, setStartMode] = useState(false);
  const [errorModal, setErrorModal] = useState(null); // null = hidden, string = error message
  const [powerOnMode, setPowerOnMode] = useState(false); //change back to false
  const [bootStartMode, setBootStartMode] = useState(false);
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  const [programState, setProgramState] = useState(null); // "playing", "paused", "stopped"
  const [robotMode, setRobotMode] = useState(null);
  const powerOnIntervalRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    if (socket) {
      socket.on("dashboard-response", (data) => {
        const response = data.response || data.toString();
        const responseLower = response.toLowerCase();

        // Detect power/robot state from robotmode responses
        if (responseLower.includes("power_off")) {
          setIsPoweredOn(false);
          setRobotMode("POWER OFF");
        } else if (responseLower.includes("idle")) {
          setIsPoweredOn(true);
          setRobotMode("IDLE");
        } else if (responseLower.includes("running")) {
          setIsPoweredOn(true);
          setRobotMode("RUNNING");
          if (bootStartMode) {
            setBootStartMode(false);
            setStartMode(true);
            setStatus("LOADING DEFAULT PROGRAM...");
            socket.emit("dashboard-command", "load __working.urp");
          }
        } else if (responseLower.includes("power_on")) {
          setRobotMode("POWER ON");
        } else if (responseLower.includes("booting")) {
          setRobotMode("BOOTING");
        } else if (responseLower.includes("brake releasing")) {
          setRobotMode("BRAKE RELEASING");
        }

        // Detect program state from programstate responses
        if (responseLower.startsWith("playing")) {
          setProgramState("playing");
        } else if (responseLower.startsWith("paused")) {
          setProgramState("paused");
        } else if (responseLower.startsWith("stopped")) {
          setProgramState("stopped");
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
            setBootStartMode(true);
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

        // Don't show robotmode polling responses in the status display
        if (responseLower.includes("robotmode")) {
          return;
        }

        // could be a gotcha Lukas
        // if (status !== response) {
        setStatus(response);
        // }

        // If we just loaded a program via START, now play it (unless load failed)
        if (startMode && data.success) {
          setStartMode(false);
          if (responseLower.startsWith("file not found")) {
            setStatus(`ERROR: ${response.toUpperCase()}`);
            setErrorModal(response);
          } else {
            setStatus("STARTING PROGRAM...");
            socket.emit("dashboard-command", "play");
          }
        }

        // Auto-load __ready.urp when __working.urp stops
        if (responseLower.includes("stopped __working")) {
          setStartMode(true);
          setStatus("LOADING READY PROGRAM...");
          socket.emit("dashboard-command", "load __ready.urp");
        }
      });

      return () => {
        socket.off("dashboard-response");
        if (powerOnIntervalRef.current) {
          clearInterval(powerOnIntervalRef.current);
        }
      };
    }
  }, [socket, powerOnMode, startMode, bootStartMode]);

  // Check if status text overflows and needs scrolling
  useEffect(() => {
    if (statusRef.current && statusContainerRef.current) {
      const textWidth = statusRef.current.scrollWidth;
      const containerWidth = statusContainerRef.current.clientWidth;
      setShouldScroll(textWidth > containerWidth);
    }
  }, [status]);

  // Set up status polling when connected
  useEffect(() => {
    if (dashboardStatus === "connected" && socket && !powerOnMode) {
      const queries = ["robotmode", "programstate"];
      let i = 0;
      let cancelled = false;

      const tick = () => {
        if (cancelled) return;
        socket.volatile.emit("dashboard-command", queries[i % 2]);
        i++;
        pollingIntervalRef.current = setTimeout(tick, 500);
      };

      tick();

      return () => {
        cancelled = true;
        clearTimeout(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      };
    } else {
      // Clear polling when disconnected
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [dashboardStatus, socket, powerOnMode]);

  const handleCommand = (command, buttonId) => {
    if (!socket || dashboardStatus !== "connected") return;
    setActiveButton(buttonId);
    setTimeout(() => setActiveButton(null), 200);
    setStatus(`SENDING: ${command.toUpperCase()}`);
    socket.emit("dashboard-command", command);
  };

  const handlePowerOn = () => {
    if (!socket || dashboardStatus !== "connected") return;
    setActiveButton("poweron");
    setTimeout(() => setActiveButton(null), 200);
    setStatus("POWERING ON...");
    setPowerOnMode(true);
    socket.emit("dashboard-command", "power on");
    setTimeout(() => {
      powerOnIntervalRef.current = setInterval(() => {
        socket.emit("dashboard-command", "robotmode");
      }, 1500);
    }, 1000);
  };

  const handlePowerOff = () => {
    if (!socket) return;
    setIsPoweredOn(false); // Immediately disable buttons
    handleCommand("power off", "poweroff");
  };

  const handleStart = () => {
    if (!socket || dashboardStatus !== "connected") return;
    setActiveButton("start");
    setTimeout(() => setActiveButton(null), 200);
    if (!qrValue) {
      setStatus("NO PROGRAM - SCAN QR FIRST");
      return;
    }
    const programName = `${qrValue}.urp`;
    setStatus(`LOADING: ${programName}`);
    setStartMode(true);
    socket.emit("dashboard-command", `load ${programName}`);
  };

  return (
    <div className="operator-panel">
      <div className="operator-content">
        {/* LED Display */}
        <div className="operator-displays">
          <div className="led-display">
            <div className="led-display-screen">
              <div className="led-display-section">
                <span className="led-display-label">
                  Current Jig in Workspace
                </span>
                <span className="led-display-text">{qrValue || "---"}</span>
              </div>
              <div className="led-display-divider" />
              <div className="led-display-row">
                <div className="led-display-section" ref={statusContainerRef}>
                  <span className="led-display-label">Status</span>
                  <span
                    className={`led-display-text ${shouldScroll ? "led-scroll" : ""}`}
                    ref={statusRef}
                  >
                    {status}
                  </span>
                </div>
                <div className="led-display-section led-display-section-bordered">
                  <span className="led-display-label">Robot Mode</span>
                  <span className="led-display-text">{robotMode || "---"}</span>
                </div>
              </div>
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
            {/* <img src={caringLogo} alt="Start" className="button-logo" /> */}
            <span className="button-label">START</span>
          </button>

          {/* Row of smaller buttons */}
          <div className="operator-button-row">
            <button
              className={`industrial-button industrial-button-green ${
                activeButton === "play" ? "active" : ""
              }`}
              onClick={() => handleCommand("play", "play")}
              disabled={!socket || !isPoweredOn || programState === "playing"}
            >
              <span className="button-icon">▶</span>
              <span className="button-label">PLAY</span>
            </button>
            <button
              className={`industrial-button industrial-button-yellow ${
                activeButton === "pause" ? "active" : ""
              }`}
              onClick={() => handleCommand("pause", "pause")}
              disabled={
                !socket ||
                !isPoweredOn ||
                programState === "paused" ||
                programState === "stopped"
              }
            >
              <span className="button-icon">⏸</span>
              <span className="button-label">PAUSE</span>
            </button>

            <button
              className={`industrial-button industrial-button-red ${
                activeButton === "stop" ? "active" : ""
              }`}
              onClick={() => handleCommand("stop", "stop")}
              disabled={!socket || !isPoweredOn || programState === "stopped"}
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
              onClick={handlePowerOff}
              disabled={!socket || !isPoweredOn}
            >
              <span className="button-icon">○</span>
              <span className="button-label">PWR OFF</span>
            </button>
          </div>
        </div>

        {/* Robot IP display */}
        <div className="operator-robot-ip">
          <img
            src={dishbotLogo}
            alt="Dishbot"
            className="operator-robot-ip-logo"
          />
          Robot: {ROBOT_IP} ({dashboardStatus})
        </div>
      </div>
      {errorModal && (
        <div className="error-modal-overlay" onClick={() => setErrorModal(null)}>
          <div className="error-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="error-modal-title">Program Not Found</h2>
            <p className="error-modal-message">{errorModal}</p>
            <button className="error-modal-ok" onClick={() => setErrorModal(null)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OperatorPanel;
