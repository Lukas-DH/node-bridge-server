function HandshakeViewer({ steps, onClear }) {
  const getStepIcon = (type) => {
    switch (type) {
      case 'ACK':
        return '✅'
      case 'BEGIN':
        return '▶️'
      case 'DATA':
        return '📊'
      case 'OK':
        return '✔️'
      case 'ERROR':
        return '❌'
      case 'END':
        return '⏹️'
      default:
        return '•'
    }
  }

  const getStepColor = (type) => {
    switch (type) {
      case 'ACK':
        return '#51cf66'
      case 'BEGIN':
        return '#4a9eff'
      case 'DATA':
        return '#ffd43b'
      case 'OK':
        return '#51cf66'
      case 'ERROR':
        return '#ff6b6b'
      case 'END':
        return '#868e96'
      default:
        return '#868e96'
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 })
  }

  const isComplete = steps.length > 0 && (
    steps.some((s) => s.type === 'END') ||
    steps.some((s) => s.type === 'OK' || s.type === 'ERROR')
  )

  return (
    <div className="handshake-viewer">
      <div className="handshake-header">
        <h2>Handshake Monitor</h2>
        <div className="handshake-controls">
          {isComplete && <span className="handshake-complete">✓ Complete</span>}
          {!isComplete && steps.length > 0 && (
            <span className="handshake-pending">⏳ In Progress...</span>
          )}
          <button onClick={onClear} className="clear-button">
            Clear
          </button>
        </div>
      </div>

      <div className="handshake-steps">
        {steps.length === 0 ? (
          <div className="handshake-empty">
            No handshake in progress. Send a command to see the handshake flow.
          </div>
        ) : (
          <div className="handshake-flow">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`handshake-step step-${step.type.toLowerCase()}`}
              >
                <div className="step-number">{index + 1}</div>
                <div
                  className="step-icon"
                  style={{ backgroundColor: getStepColor(step.type) }}
                >
                  {getStepIcon(step.type)}
                </div>
                <div className="step-content">
                  <div className="step-type">{step.type}</div>
                  <div className="step-line">{step.line}</div>
                  <div className="step-time">{formatTime(step.timestamp)}</div>
                </div>
                {index < steps.length - 1 && (
                  <div className="step-connector">↓</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {steps.length > 0 && (
        <div className="handshake-footer">
          <span>{steps.length} steps</span>
          <span>•</span>
          <span>
            Duration:{' '}
            {steps.length > 1
              ? `${(
                  (new Date(steps[steps.length - 1].timestamp) -
                    new Date(steps[0].timestamp)) /
                  1000
                ).toFixed(2)}s`
              : '0s'}
          </span>
        </div>
      )}
    </div>
  )
}

export default HandshakeViewer
