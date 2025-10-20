import { useEffect, useState } from 'react'

function Topology({ status }) {
  const [robotPulse, setRobotPulse] = useState(false)
  const [pipettePulse, setPipettePulse] = useState(false)

  // Animate connections when active
  useEffect(() => {
    if (status.robot === 'connected') {
      const interval = setInterval(() => {
        setRobotPulse((prev) => !prev)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [status.robot])

  useEffect(() => {
    if (status.serial === 'connected') {
      const interval = setInterval(() => {
        setPipettePulse((prev) => !prev)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [status.serial])

  return (
    <div className="topology-container">
      <h2>Network Topology</h2>
      <div className="topology">
        {/* Robot */}
        <div className={`node robot ${status.robot}`}>
          <div className="node-icon">🤖</div>
          <div className="node-label">Robot</div>
          <div className="node-status">{status.robot}</div>
        </div>

        {/* Connection Line: Robot ↔ Server */}
        <div className={`connection ${status.robot === 'connected' && robotPulse ? 'active' : ''}`}>
          <div className="connection-line"></div>
          <div className="connection-label">TCP:5000</div>
        </div>

        {/* Server */}
        <div className={`node server ${status.server}`}>
          <div className="node-icon">⚡</div>
          <div className="node-label">Bridge Server</div>
          <div className="node-status">{status.server}</div>
        </div>

        {/* Connection Line: Server ↔ Pipette */}
        <div className={`connection ${status.serial === 'connected' && pipettePulse ? 'active' : ''}`}>
          <div className="connection-line"></div>
          <div className="connection-label">USB/Serial</div>
        </div>

        {/* Pipette */}
        <div className={`node pipette ${status.serial}`}>
          <div className="node-icon">🧪</div>
          <div className="node-label">Pipette</div>
          <div className="node-status">{status.serial}</div>
        </div>
      </div>
    </div>
  )
}

export default Topology
