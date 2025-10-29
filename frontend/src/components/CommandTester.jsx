import { useState } from "react";

function CommandTester({ onSendCommand, disabled, activePipette }) {
  const [command, setCommand] = useState("");
  const [customCommand, setCustomCommand] = useState("");

  const presetCommands = [
    { label: "Get Version", value: '{"data":"GET_VERSION"}' },
    { label: "Home", value: '{"data":"HOME"}' },
    { label: "Blowout", value: '{"data":"BLOW_OUT 1 1 3000"}' },
    {
      label: "Aspirate 120µL",
      value: '{"no": 2, "data": "RUN_ASPIRATE 120 7"}',
    },
    {
      label: "Dispense 100µL",
      value: '{"no": 3, "data": "RUN_DISPENSE 100 7"}',
    },
    {
      label: "Automatic mode ON",
      value: '{"no": 0, "data": "AUTO 1"}',
    },
    {
      label: "Enable Motor Control",
      value: '{"no": 0, "data": "ENABLE_MOTOR_CONTROL 1"}',
    },
    {
      label: "Tip Eject",
      value: '{"no": 99, "data":"TIP_EJECT"}',
    },
  ];

  const handlePresetCommand = (cmd) => {
    setCommand(cmd);
    onSendCommand(cmd);
  };

  const handleCustomCommand = (e) => {
    e.preventDefault();
    if (customCommand.trim()) {
      onSendCommand(customCommand.trim());
      setCustomCommand("");
    }
  };

  return (
    <div className="command-tester">
      <h2>Command Tester</h2>

      {activePipette && (
        <div className="active-target">
          <strong>Active Target:</strong> {activePipette}
        </div>
      )}

      {!activePipette && (
        <div className="no-target-warning">
          ⚠️ No pipette selected. Please select a pipette above.
        </div>
      )}

      <div className="preset-commands">
        <h3>Preset Commands</h3>
        <div className="preset-buttons">
          {presetCommands.map((preset, index) => (
            <button
              key={index}
              onClick={() => handlePresetCommand(preset.value)}
              disabled={disabled}
              className="preset-button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="custom-command">
        <h3>Custom Command</h3>
        <form onSubmit={handleCustomCommand}>
          <textarea
            value={customCommand}
            onChange={(e) => setCustomCommand(e.target.value)}
            placeholder='Enter JSON command, e.g., {"data":"GET_VERSION"}'
            rows={4}
            disabled={disabled}
            className="command-input"
          />
          <button type="submit" disabled={disabled || !customCommand.trim()}>
            Send Command
          </button>
        </form>
      </div>

      {command && (
        <div className="last-command">
          <h3>Last Sent</h3>
          <code>{command}</code>
        </div>
      )}

      {disabled && (
        <div className="tester-disabled">
          ⚠️ Server not connected. Start the backend server to test commands.
        </div>
      )}
    </div>
  );
}

export default CommandTester;
