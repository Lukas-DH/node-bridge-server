import { useState, useEffect, useMemo, useRef } from "react";
import { BACKEND_URL } from "../App";
import DishLogFilters from "../components/DishLogFilters";
import DishLogSummary from "../components/DishLogSummary";
import DishLogTable, { formatCycle } from "../components/DishLogTable";
import ThroughputChart from "../components/ThroughputChart";

function todayLocal() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function daysAgoLocal(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function DishLog({ liveEvents, stats }) {
  const [from, setFrom] = useState(todayLocal());
  const [to, setTo] = useState(todayLocal());
  const [jig, setJig] = useState("");
  const [bucket, setBucket] = useState("hour");
  const [bucketPinned, setBucketPinned] = useState(false);

  const [rangeEvents, setRangeEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [throughput, setThroughput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const seenSeq = useRef(new Set());

  const spanDays = useMemo(() => {
    if (!from || !to) return 1;
    const a = Date.parse(`${from}T00:00:00Z`);
    const b = Date.parse(`${to}T00:00:00Z`);
    if (Number.isNaN(a) || Number.isNaN(b)) return 1;
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }, [from, to]);

  // Hourly buckets stop being readable past a few days, so switch to daily
  // unless the user has chosen a bucket explicitly.
  useEffect(() => {
    if (bucketPinned) return;
    setBucket(spanDays > 3 ? "day" : "hour");
  }, [spanDays, bucketPinned]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (jig) params.set("jig", jig);
    return params;
  }, [from, to, jig]);

  // Debounced so a fast click-through doesn't fire a request per keystroke, and
  // aborted so a slow earlier response can't overwrite a newer one.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const events = new URLSearchParams(query);
        events.set("limit", "1000");
        const through = new URLSearchParams(query);
        through.set("bucket", bucket);

        const [eventsRes, summaryRes, throughputRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/dishlog/events?${events}`, {
            signal: controller.signal,
          }),
          fetch(`${BACKEND_URL}/api/dishlog/summary?${query}`, {
            signal: controller.signal,
          }),
          fetch(`${BACKEND_URL}/api/dishlog/throughput?${through}`, {
            signal: controller.signal,
          }),
        ]);

        for (const res of [eventsRes, summaryRes, throughputRes]) {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Request failed (${res.status})`);
          }
        }

        const eventsBody = await eventsRes.json();
        seenSeq.current = new Set(eventsBody.events.map((e) => e.seq));
        setRangeEvents(eventsBody.events);
        setSummary(await summaryRes.json());
        setThroughput(await throughputRes.json());
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, bucket]);

  // One table data path: live deltas are merged into rangeEvents rather than
  // rendered separately, so there is no "live vs historical" mode to diverge.
  const newestLive = liveEvents.length ? liveEvents[0] : null;
  useEffect(() => {
    if (!newestLive) return;
    if (seenSeq.current.has(newestLive.seq)) return;
    const inRange =
      (!from || newestLive.day >= from) &&
      (!to || newestLive.day <= to) &&
      (!jig || newestLive.jigId === jig);
    if (!inRange) return;

    seenSeq.current.add(newestLive.seq);
    setRangeEvents((prev) => [newestLive, ...prev]);
  }, [newestLive, from, to, jig]);

  const jigOptions = useMemo(() => {
    const names = new Set();
    if (summary?.allTime?.byJig) {
      for (const row of summary.allTime.byJig) names.add(row.jigId);
    }
    return [...names].sort();
  }, [summary]);

  const handleChange = (patch) => {
    if (patch.from !== undefined) setFrom(patch.from);
    if (patch.to !== undefined) setTo(patch.to);
    if (patch.jig !== undefined) setJig(patch.jig);
    if (patch.bucket !== undefined) {
      setBucket(patch.bucket);
      setBucketPinned(true);
    }
  };

  const handlePreset = (preset) => {
    setBucketPinned(false);
    if (preset === "today") {
      setFrom(todayLocal());
      setTo(todayLocal());
    } else if (preset === "7d") {
      setFrom(daysAgoLocal(6));
      setTo(todayLocal());
    } else if (preset === "30d") {
      setFrom(daysAgoLocal(29));
      setTo(todayLocal());
    } else {
      setFrom("");
      setTo("");
    }
  };

  const handleDownloadCsv = () => {
    window.location.href = `${BACKEND_URL}/api/dishlog/export.csv?${query}`;
  };

  const tz = summary?.tz || stats?.tz || null;
  const rangeLabel =
    from && to && from === to ? from.slice(5) : `${from || "start"} → ${to || "now"}`;
  const todayTotal = stats?.today?.total ?? summary?.today?.total ?? 0;
  const allTimeTotal = stats?.allTime?.total ?? summary?.allTime?.total ?? 0;
  const lastCycle = stats?.lastCycleMs ?? null;
  const warnings = [];
  if (stats?.clockWarning) {
    warnings.push(
      "System clock may be unsynced (a Pi has no RTC) — timestamps on recent records could be wrong.",
    );
  }
  if (stats?.writeErrors) {
    warnings.push(
      `${stats.writeErrors} record(s) could not be written to disk — check free space on the Pi.`,
    );
  }
  if (stats?.suspect) {
    warnings.push(
      `${stats.suspect} unrecognised value(s) stored but excluded from totals.`,
    );
  }

  return (
    <main className="dishlog-page">
      <div className="left-panel">
        <div className="connection-card">
          <h2>Dish Log</h2>

          {warnings.map((w) => (
            <div key={w} className="dishlog-warning">
              {w}
            </div>
          ))}
          {error && <div className="dishlog-warning">{error}</div>}

          <div className="dishlog-stat-row">
            <div className="dishlog-stat">
              <span className="dishlog-stat-label">
                Today{tz ? ` (${tz})` : ""}
              </span>
              <span className="dishlog-stat-value">{todayTotal}</span>
            </div>
            <div className="dishlog-stat">
              <span className="dishlog-stat-label">All time</span>
              <span className="dishlog-stat-value">{allTimeTotal}</span>
            </div>
            <div className="dishlog-stat">
              <span className="dishlog-stat-label">Last cycle</span>
              <span className="dishlog-stat-value">{formatCycle(lastCycle)}</span>
            </div>
          </div>

          <DishLogFilters
            from={from}
            to={to}
            jig={jig}
            jigOptions={jigOptions}
            bucket={bucket}
            loading={loading}
            onChange={handleChange}
            onPreset={handlePreset}
            onDownloadCsv={handleDownloadCsv}
          />
        </div>

        <div className="connection-card">
          <h2>
            Dishes per {bucket === "hour" ? "hour" : "day"}
            {throughput ? ` — ${throughput.total} total` : ""}
          </h2>
          <ThroughputChart
            points={throughput?.points}
            bucket={bucket}
            tz={tz}
          />
        </div>

        <div className="connection-card">
          <h2>Summary by jig</h2>
          <DishLogSummary summary={summary} rangeLabel={rangeLabel} />
        </div>
      </div>

      <div className="right-panel">
        <div className="connection-card">
          <h2>Dishes — {rangeLabel}</h2>
          <DishLogTable events={rangeEvents} tz={tz} />
          <div className="logs-footer">
            <span>{rangeEvents.length} dishes shown</span>
            {jig && <span>• filtered to {jig}</span>}
          </div>
        </div>
      </div>
    </main>
  );
}

export default DishLog;
