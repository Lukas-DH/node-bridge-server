// Injected at build time by vite.config.js
const FRONTEND_VERSION = __APP_VERSION__

const formatTime = (iso) => {
  const d = new Date(iso)
  if (isNaN(d)) return 'unknown'
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function VersionPart({ label, version, timeLabel, time }) {
  if (!version) return <span>{label} —</span>

  return (
    <span>
      {label}{' '}
      <span title={`Commit date: ${formatTime(version.commitDate)}`}>
        {version.sha}
      </span>
      {version.dirty && <span className="version-dirty">-dirty</span>}
      {' · '}
      {timeLabel} {formatTime(time)}
    </span>
  )
}

function VersionInfo({ serverVersion }) {
  const mismatch =
    serverVersion &&
    FRONTEND_VERSION.sha !== 'unknown' &&
    serverVersion.sha !== 'unknown' &&
    FRONTEND_VERSION.sha !== serverVersion.sha

  return (
    <div className="version-info">
      <VersionPart
        label="Frontend"
        version={FRONTEND_VERSION}
        timeLabel="built"
        time={FRONTEND_VERSION.builtAt}
      />
      <span className="version-sep">|</span>
      <VersionPart
        label="Backend"
        version={serverVersion}
        timeLabel="started"
        time={serverVersion?.startedAt}
      />
      {mismatch && (
        <span className="version-mismatch">
          Frontend and backend versions differ. Rebuild the frontend or restart the service.
        </span>
      )}
    </div>
  )
}

export default VersionInfo
