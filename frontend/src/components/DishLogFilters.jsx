function DishLogFilters({
  from,
  to,
  jig,
  jigOptions,
  bucket,
  loading,
  onChange,
  onPreset,
  onDownloadCsv,
}) {
  return (
    <div className="dishlog-filters">
      <label className="dishlog-field">
        <span>From</span>
        <input
          type="date"
          className="ip-input"
          value={from}
          max={to || undefined}
          onChange={(e) => onChange({ from: e.target.value })}
        />
      </label>

      <label className="dishlog-field">
        <span>To</span>
        <input
          type="date"
          className="ip-input"
          value={to}
          min={from || undefined}
          onChange={(e) => onChange({ to: e.target.value })}
        />
      </label>

      <label className="dishlog-field">
        <span>Jig</span>
        <select
          className="filter-input"
          value={jig}
          onChange={(e) => onChange({ jig: e.target.value })}
        >
          <option value="">All jigs</option>
          {jigOptions.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
      </label>

      <label className="dishlog-field">
        <span>Buckets</span>
        <select
          className="filter-input"
          value={bucket}
          onChange={(e) => onChange({ bucket: e.target.value })}
        >
          <option value="hour">Hourly</option>
          <option value="day">Daily</option>
        </select>
      </label>

      <div className="dishlog-presets">
        <button className="control-button" onClick={() => onPreset("today")}>
          Today
        </button>
        <button className="control-button" onClick={() => onPreset("7d")}>
          7 days
        </button>
        <button className="control-button" onClick={() => onPreset("30d")}>
          30 days
        </button>
        <button className="control-button" onClick={() => onPreset("all")}>
          All
        </button>
        <button
          className="control-button control-button-blue"
          onClick={onDownloadCsv}
        >
          Download CSV
        </button>
      </div>

      {loading && <span className="dishlog-loading">Loading…</span>}
    </div>
  );
}

export default DishLogFilters;
