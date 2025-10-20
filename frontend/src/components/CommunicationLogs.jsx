import { useEffect, useRef, useState } from 'react'

function CommunicationLogs({ logs, onClear }) {
  const logsEndRef = useRef(null)
  const [filter, setFilter] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const filteredLogs = logs.filter((log) => {
    if (!filter) return true
    const searchText = filter.toLowerCase()
    return (
      log.message.toLowerCase().includes(searchText) ||
      log.source.toLowerCase().includes(searchText) ||
      log.type.toLowerCase().includes(searchText)
    )
  })

  const getLogIcon = (type) => {
    switch (type) {
      case 'info':
        return 'ℹ️'
      case 'error':
        return '❌'
      case 'command':
        return '📤'
      case 'response':
        return '📥'
      case 'handshake':
        return '🤝'
      default:
        return '•'
    }
  }

  const getSourceColor = (source) => {
    switch (source) {
      case 'robot':
        return '#4a9eff'
      case 'pipette':
        return '#ff6b6b'
      case 'server':
        return '#51cf66'
      case 'dashboard':
        return '#ffd43b'
      default:
        return '#868e96'
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour12: false })
  }

  return (
    <div className="communication-logs">
      <div className="logs-header">
        <h2>Communication Logs</h2>
        <div className="logs-controls">
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-input"
          />
          <label className="auto-scroll-label">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
          <button onClick={onClear} className="clear-button">
            Clear
          </button>
        </div>
      </div>

      <div className="logs-list">
        {filteredLogs.length === 0 ? (
          <div className="logs-empty">
            {filter ? 'No logs match your filter' : 'No logs yet. Waiting for activity...'}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className={`log-entry log-${log.type}`}>
              <span className="log-icon">{getLogIcon(log.type)}</span>
              <span className="log-time">{formatTime(log.timestamp)}</span>
              <span
                className="log-source"
                style={{ color: getSourceColor(log.source) }}
              >
                [{log.source}]
              </span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      <div className="logs-footer">
        <span>{filteredLogs.length} logs</span>
        {filter && <span>• Filtered from {logs.length} total</span>}
      </div>
    </div>
  )
}

export default CommunicationLogs
