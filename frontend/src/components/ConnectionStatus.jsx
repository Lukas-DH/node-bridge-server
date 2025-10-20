function ConnectionStatus({ status, connected }) {
  const getStatusIcon = (state) => {
    switch (state) {
      case 'connected':
        return '🟢'
      case 'disconnected':
        return '🔴'
      default:
        return '🟡'
    }
  }

  return (
    <div className="connection-status">
      <div className="status-item">
        <span className="status-icon">{getStatusIcon(status.server)}</span>
        <span className="status-label">Server</span>
      </div>
      <div className="status-item">
        <span className="status-icon">{getStatusIcon(status.robot)}</span>
        <span className="status-label">Robot</span>
      </div>
      <div className="status-item">
        <span className="status-icon">{getStatusIcon(status.serial)}</span>
        <span className="status-label">Pipette</span>
      </div>
    </div>
  )
}

export default ConnectionStatus
