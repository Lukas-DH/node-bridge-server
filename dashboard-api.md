# UR Dashboard Server API Reference

**Port:** 29999 (TCP)

## Commands

### Program Control (Require Remote Control)

| Command | Success Response | Failure Response |
|---------|------------------|------------------|
| `load <program.urp>` | `Loading program: <program.urp>` | `File not found: <program.urp>` or `Error while loading program: <program.urp>` |
| `play` | `Starting program` | `Failed to execute: play` |
| `stop` | `Stopped` | `Failed to execute: stop` |
| `pause` | `Pausing program` | `Failed to execute: pause` |

### Power Control (Require Remote Control)

| Command | Response |
|---------|----------|
| `power on` | `Powering on` |
| `power off` | `Powering off` |
| `brake release` | `Brake releasing` |

### Safety (Require Remote Control)

| Command | Success Response | Failure Response |
|---------|------------------|------------------|
| `unlock protective stop` | `Protective stop releasing` | `Cannot unlock protective stop until 5s after occurrence...` |
| `close safety popup` | `closing safety popup` | - |
| `load installation <file.installation>` | `Loading installation: <file>` | `File not found: <file>` or `Failed to load installation: <file>` |
| `restart safety` | `Restarting safety` | - |

### Status Queries (No Remote Control Required)

| Command | Response |
|---------|----------|
| `running` | `Program running: true` or `Program running: false` |
| `robotmode` | `Robotmode: <mode>` |
| `programState` | `STOPPED`, `PLAYING`, or `PAUSED` |
| `safetystatus` | `Safetystatus: <status>` |
| `get loaded program` | `Loaded program: <path>` or `No program loaded` |
| `is in remote control` | `true` or `false` |
| `get serial number` | Serial number string |
| `get robot model` | `UR3`, `UR5`, `UR10`, or `UR16` |
| `PolyscopeVersion` | Version string |
| `version` | Version number (e.g., `5.13.0.11013`) |
| `isProgramSaved` | `true <program.name>` or `false <program.name>` |
| `get operational mode` | `MANUAL`, `AUTOMATIC`, or `NONE` |

### Robot Modes
`NO_CONTROLLER`, `DISCONNECTED`, `CONFIRM_SAFETY`, `BOOTING`, `POWER_OFF`, `POWER_ON`, `IDLE`, `BACKDRIVE`, `RUNNING`

### Safety Statuses
`NORMAL`, `REDUCED`, `PROTECTIVE_STOP`, `RECOVERY`, `SAFEGUARD_STOP`, `SYSTEM_EMERGENCY_STOP`, `ROBOT_EMERGENCY_STOP`, `VIOLATION`, `FAULT`, `AUTOMATIC_MODE_SAFEGUARD_STOP`, `SYSTEM_THREE_POSITION_ENABLING_STOP`

### Operational Mode Control

| Command | Response |
|---------|----------|
| `set operational mode <manual\|automatic>` | `Setting operational mode: <mode>` or `Failed setting operational mode: <mode>` |
| `clear operational mode` | `operational mode is no longer controlled by Dashboard Server` |

### Utility

| Command | Response |
|---------|----------|
| `popup <text>` | `showing popup` |
| `close popup` | `closing popup` |
| `addToLog <message>` | `Added log message` or `No log message to add` |
| `shutdown` | `Shutting down` |
| `quit` | `Disconnected` |

## Connection Example

```bash
# Single command via netcat
echo "robotmode" | nc <robot_ip> 29999

# Multiple commands
{ echo "get robot model"; echo "safetystatus"; echo "quit"; } | nc <robot_ip> 29999
```
