import { useState, useEffect, useRef } from "react";
import dishbotLogo from "../assets/dishbot.jpg";

const ROBOT_IP = "192.168.1.95";

function OperatorPanel2({ socket, qrValue, dashboardStatus }) {
  const [activeButton, setActiveButton] = useState(null);
  const [status, setStatus] = useState("READY");
  const statusRef = useRef(null);
  const statusContainerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [robotMode, setRobotMode] = useState(null);
  const [buttonCooldown, setButtonCooldown] = useState(false);
  const [programState, setProgramState] = useState(null);
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  const [retractMode, setRetractMode] = useState(false);
  const [extendMode, setExtendMode] = useState(false);
  const [startMode, setStartMode] = useState(false);

  const startCooldown = () => {
    setButtonCooldown(true);
    setTimeout(() => setButtonCooldown(false), 1000);
  };

  useEffect(() => {
    if (socket) {
      socket.on("dashboard-response", (data) => {
        const response = data.response || data.toString();
        const responseLower = response.toLowerCase();

        if (responseLower.includes("robotmode: power_off")) {
          setIsPoweredOn(false);
          setRobotMode("POWER OFF");
        } else if (responseLower.includes("robotmode: idle")) {
          setIsPoweredOn(true);
          setRobotMode("IDLE");
        } else if (responseLower.includes("robotmode: running")) {
          setIsPoweredOn(true);
          setRobotMode("RUNNING");
        } else if (responseLower.includes("power_on")) {
          setRobotMode("POWER ON");
        } else if (responseLower.includes("booting")) {
          setRobotMode("BOOTING");
        } else if (responseLower.includes("brake releasing")) {
          setRobotMode("BRAKE RELEASING");
        }

        if (responseLower.startsWith("playing")) {
          setProgramState("playing");
        } else if (responseLower.startsWith("paused")) {
          setProgramState("paused");
        } else if (responseLower.startsWith("stopped")) {
          setProgramState("stopped");
        }

        if (responseLower.includes("robotmode")) return;

        setStatus(response);

        if (startMode && data.success) {
          setStartMode(false);
          if (responseLower.startsWith("file not found")) {
            setStatus(`ERROR: ${qrValue}.urp NOT FOUND`);
          } else {
            setStatus("STARTING PROGRAM...");
            socket.emit("dashboard-command", "play");
          }
        }

        if (retractMode && data.success) {
          setRetractMode(false);
          if (responseLower.startsWith("file not found")) {
            setStatus("ERROR: __retract.urp NOT FOUND");
          } else {
            setStatus("STARTING RETRACT...");
            socket.emit("dashboard-command", "play");
          }
        }

        if (extendMode && data.success) {
          setExtendMode(false);
          if (responseLower.startsWith("file not found")) {
            setStatus("ERROR: __ready.urp NOT FOUND");
          } else {
            setStatus("STARTING EXTEND...");
            socket.emit("dashboard-command", "play");
          }
        }
      });

      socket.on("dashboard-command-response", (data) => {
        if (!data.success && data.error) {
          const err = data.error;
          if (err.includes("EHOSTUNREACH")) {
            setStatus("HOST UNREACHABLE — CHECK NETWORK");
          } else if (err.includes("ECONNREFUSED")) {
            setStatus("CONNECTION REFUSED");
          } else if (err.includes("timeout") || err.includes("ETIMEDOUT")) {
            setStatus("CONNECTION TIMED OUT");
          } else {
            setStatus(`ERROR: ${err.toUpperCase()}`);
          }
          setRobotMode(null);
          setIsPoweredOn(false);
        }
      });

      return () => {
        socket.off("dashboard-response");
        socket.off("dashboard-command-response");
      };
    }
  }, [socket, startMode, retractMode, extendMode]);

  useEffect(() => {
    if (statusRef.current && statusContainerRef.current) {
      const textWidth = statusRef.current.scrollWidth;
      const containerWidth = statusContainerRef.current.clientWidth;
      setShouldScroll(textWidth > containerWidth);
    }
  }, [status]);

  const notConnected = !socket || dashboardStatus !== "connected";

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
            onClick={() => {
              if (!socket || dashboardStatus !== "connected") return;
              if (!qrValue) {
                setStatus("NO PROGRAM — SCAN QR FIRST");
                return;
              }
              startCooldown();
              setActiveButton("start");
              setTimeout(() => setActiveButton(null), 200);
              const programName = `${qrValue}.urp`;
              setStatus(`LOADING: ${programName}`);
              setStartMode(true);
              socket.emit("dashboard-command", `load ${programName}`);
            }}
            disabled={notConnected || buttonCooldown || startMode || (qrValue && qrValue.toLowerCase().includes("idle"))}
          >
            <span className="button-label">{startMode ? "..." : "START"}</span>
          </button>

          {/* Row: Play / Pause / Stop */}
          <div className="operator-button-row">
            <button
              className={`industrial-button industrial-button-green ${
                activeButton === "play" ? "active" : ""
              }`}
              disabled={
                notConnected ||
                programState === "playing" ||
                buttonCooldown ||
                (qrValue && qrValue.toLowerCase().includes("idle"))
              }
            >
              <span className="button-icon">▶</span>
              <span className="button-label">PLAY</span>
            </button>
            <button
              className={`industrial-button industrial-button-yellow ${
                activeButton === "pause" ? "active" : ""
              }`}
              disabled={
                notConnected ||
                programState === "paused" ||
                programState === "stopped" ||
                buttonCooldown
              }
            >
              <span className="button-icon">⏸</span>
              <span className="button-label">PAUSE</span>
            </button>
            <button
              className={`industrial-button industrial-button-red ${
                activeButton === "stop" ? "active" : ""
              }`}
              disabled={
                notConnected ||
                programState === "stopped" ||
                buttonCooldown
              }
            >
              <span className="button-icon">⏹</span>
              <span className="button-label">STOP</span>
            </button>
          </div>

          {/* Row: Retract / Extend */}
          <div className="operator-button-row">
            <button
              className={`industrial-button industrial-button-blue ${
                activeButton === "retract" ? "active" : ""
              }`}
              onClick={() => {
                if (!socket || dashboardStatus !== "connected") return;
                startCooldown();
                setActiveButton("retract");
                setTimeout(() => setActiveButton(null), 200);
                setStatus("LOADING __retract.urp...");
                setRetractMode(true);
                socket.emit("dashboard-command", "load __retract.urp");
              }}
              disabled={notConnected || buttonCooldown || retractMode}
            >
              <span className="button-icon">↩</span>
              <span className="button-label">{retractMode ? "..." : "RETRACT"}</span>
            </button>
            <button
              className={`industrial-button industrial-button-purple ${
                activeButton === "extend" ? "active" : ""
              }`}
              onClick={() => {
                if (!socket || dashboardStatus !== "connected") return;
                startCooldown();
                setActiveButton("extend");
                setTimeout(() => setActiveButton(null), 200);
                setStatus("LOADING __ready.urp...");
                setExtendMode(true);
                socket.emit("dashboard-command", "load __ready.urp");
              }}
              disabled={notConnected || buttonCooldown || extendMode}
            >
              <span className="button-icon">↪</span>
              <span className="button-label">{extendMode ? "..." : "EXTEND"}</span>
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
          <button
            className={`connect-button ${
              dashboardStatus === "connected"
                ? "connect-button-connected"
                : "connect-button-disconnected"
            }`}
            title={dashboardStatus === "connected" ? "Disconnect" : "Connect"}
            onClick={() => {
              if (dashboardStatus === "connected") {
                socket.emit("dashboard-disconnect");
              } else {
                socket.emit("dashboard-connect", ROBOT_IP);
              }
            }}
            disabled={!socket}
          />
        </div>
      </div>

      {/* Robot mode indicator — bottom-left corner */}
      {(() => {
        const isDisconnected = dashboardStatus !== "connected";
        const mode = isDisconnected ? "DISCONNECTED" : (robotMode || "POWER OFF");
        const isRunning = mode === "RUNNING";
        const isPowerOff = mode === "POWER OFF";
        const dotColor = isDisconnected
          ? { hi: "#aaaaaa", lo: "#666666", glow: "rgba(150,150,150,0.3)" }
          : isRunning
          ? { hi: "#44ff66", lo: "#00aa33", glow: "rgba(0,200,80,0.4)" }
          : isPowerOff
          ? { hi: "#ff4444", lo: "#cc0000", glow: "rgba(255,80,80,0.4)" }
          : { hi: "#ffe044", lo: "#cc9900", glow: "rgba(255,200,0,0.4)" };
        const textColor = "#111111";
        const isClickable = (isRunning || isPowerOff) && !isDisconnected && !buttonCooldown;
        const handleIndicatorClick = () => {
          if (!isClickable) return;
          startCooldown();
          if (isRunning) {
            setStatus("SENDING: POWER OFF");
            socket.emit("dashboard-command", "power off");
          } else if (isPowerOff) {
            setStatus("SENDING: BRAKE RELEASE");
            socket.emit("dashboard-command", "brake release");
          }
        };
        return (
      <div style={{
        position: "fixed",
        bottom: "24px",
        left: "24px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        zIndex: 100,
      }}>
        <div
          onClick={handleIndicatorClick}
          style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          background: "linear-gradient(145deg, #e8e8e8, #c8c8c8)",
          boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.25), inset -2px -2px 4px rgba(255,255,255,0.6), 0 2px 8px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isClickable ? "pointer" : "default",
        }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: `radial-gradient(circle at 38% 35%, ${dotColor.hi}, ${dotColor.lo})`,
            border: "3px solid #1a1a1a",
            boxShadow: `0 2px 6px rgba(0,0,0,0.5), inset 0 1px 3px ${dotColor.glow}`,
          }} />
        </div>
        <span style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontWeight: "700",
          fontSize: "14px",
          letterSpacing: "0.12em",
          color: textColor,
          textTransform: "uppercase",
          textShadow: "0 1px 3px rgba(0,0,0,0.6)",
        }}>
          {mode}
        </span>
      </div>
        );
      })()}
    </div>
  );
}

export default OperatorPanel2;
