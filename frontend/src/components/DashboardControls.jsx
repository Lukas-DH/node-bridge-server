import { useState } from "react";

function DashboardControls({ onSendCommand, disabled }) {
  const [programPath, setProgramPath] = useState("");

  const controlGroups = [
    {
      title: "Program Control",
      commands: [
        { label: "Play", command: "play", color: "green" },
        { label: "Pause", command: "pause", color: "yellow" },
        { label: "Stop", command: "stop", color: "red" },
      ],
    },
    {
      title: "Power Control",
      commands: [
        { label: "Power On", command: "power on", color: "green" },
        { label: "Power Off", command: "power off", color: "red" },
        { label: "Brake Release", command: "brake release", color: "blue" },
      ],
    },
    {
      title: "Safety",
      commands: [
        { label: "Unlock Protective Stop", command: "unlock protective stop", color: "yellow" },
        { label: "Close Safety Popup", command: "close safety popup", color: "default" },
        { label: "Restart Safety", command: "restart safety", color: "red" },
      ],
    },
    {
      title: "Status Queries",
      commands: [
        { label: "Robot Mode", command: "robotmode", color: "default" },
        { label: "Program State", command: "programState", color: "default" },
        { label: "Running", command: "running", color: "default" },
        { label: "Safety Status", command: "safetystatus", color: "default" },
        { label: "Loaded Program", command: "get loaded program", color: "default" },
        { label: "Remote Control", command: "is in remote control", color: "default" },
        { label: "Serial Number", command: "get serial number", color: "default" },
        { label: "Robot Model", command: "get robot model", color: "default" },
        { label: "Version", command: "version", color: "default" },
        { label: "Operational Mode", command: "get operational mode", color: "default" },
      ],
    },
    {
      title: "Utility",
      commands: [
        { label: "Close Popup", command: "close popup", color: "default" },
      ],
    },
  ];

  const handleLoadProgram = () => {
    if (programPath.trim()) {
      onSendCommand(`load ${programPath.trim()}`);
    }
  };

  const getButtonClass = (color) => {
    switch (color) {
      case "green":
        return "control-button control-button-green";
      case "red":
        return "control-button control-button-red";
      case "yellow":
        return "control-button control-button-yellow";
      case "blue":
        return "control-button control-button-blue";
      default:
        return "control-button";
    }
  };

  return (
    <div className="dashboard-controls">
      <h2>Dashboard Controls</h2>

      {/* Load Program Section */}
      <div className="control-group">
        <h3>Load Program</h3>
        <div className="load-program-row">
          <input
            type="text"
            value={programPath}
            onChange={(e) => setProgramPath(e.target.value)}
            placeholder="program.urp"
            disabled={disabled}
            className="program-input"
          />
          <button
            onClick={handleLoadProgram}
            disabled={disabled || !programPath.trim()}
            className="control-button control-button-blue"
          >
            Load
          </button>
        </div>
      </div>

      {/* Control Groups */}
      {controlGroups.map((group) => (
        <div key={group.title} className="control-group">
          <h3>{group.title}</h3>
          <div className="control-buttons">
            {group.commands.map((cmd) => (
              <button
                key={cmd.command}
                onClick={() => onSendCommand(cmd.command)}
                disabled={disabled}
                className={getButtonClass(cmd.color)}
              >
                {cmd.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {disabled && (
        <div className="tester-disabled">
          Not connected to dashboard server. Enter robot IP and click Connect.
        </div>
      )}
    </div>
  );
}

export default DashboardControls;
