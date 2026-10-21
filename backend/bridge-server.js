/**
 * Pipette Bridge Server (Node.js)
 * ================================
 *
 * TCP-to-Serial bridge with real-time web dashboard
 *
 * Features:
 * - TCP server for robot connections (port 5001)
 * - Multi-pipette auto-discovery and per-model routing
 * - HTTP + WebSocket server for web dashboard (port 3001)
 * - UR Dashboard Server TCP client
 * - QR code TCP receiver (port 5002)
 * - Real-time communication logs
 */

import net from "net";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const CONFIG = {
  serialBaudRate: 230400,
  tcpPort: 5001,
  qrPort: 5002,
  dishPort: 5003,
  httpPort: 3001,
  handshakeTimeout: 5000, // 5 seconds
  discoveryTimeout: 5000, // 5 seconds per port during discovery
  dishDedupMs: 1500, // same jig inside this window is a robot retry, not a new dish
  dishIdleFlushMs: 150, // flush an unterminated buffer (socket_send_string sends no \n)
  dishMaxCycleMs: 2 * 60 * 60 * 1000, // a longer gap is not a real cycle time
  dishMaxLineBytes: 512,
  expectedPipettes: 2,
  pipetteRescanMs: 5000, // rescan forever at this interval while < expectedPipettes connected
};

// State (robot / dashboard / qr fields only — pipette state lives in pipetteRegistry)
const state = {
  commandNumber: 0,
  robotConnected: false,
  robotClient: null,
  pendingRobotResponse: null,
  // Dashboard server state
  dashboardConnected: false,
  dashboardConnecting: false,
  dashboardSocket: null,
  dashboardIp: null,
  dashboardPendingCommand: null,
  pollingInterval: null,
  // QR code receiver state
  currentQrValue: null,
  qrConnected: false,
  qrClient: null,
  // Dish log receiver state. A Set, not a single slot: the existing qrClient /
  // robotClient pattern breaks when a second client connects, because the FIRST
  // one disconnecting flips connected to false while the second is still live.
  dishSockets: new Set(),
  dishConnected: false,
};

// Pipette Registry for multi-pipette support
const pipetteRegistry = {
  discovered: [], // Array of {model, port, serialPort, parser, connected, currentHandshake, pendingResponse}
  activeModel: null, // Currently selected model for commands
};

// Set by shutdown() so closing serial ports doesn't trigger a rescan/reconnect
let shuttingDown = false;

// Express app for HTTP + WebSocket
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend", "dist")));

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Logging utility
function log(type, source, message, data = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type, // 'info', 'error', 'command', 'response', 'handshake'
    source, // 'robot', 'pipette', 'server', 'dashboard', 'qr', 'dish'
    message,
    data,
  };

  console.log(
    `[${logEntry.timestamp}] [${type.toUpperCase()}] ${source}: ${message}`,
  );

  // Broadcast to all connected web clients
  io.emit("log", logEntry);

  return logEntry;
}

// Emit status update (includes all subsystems for backward compat)
function emitStatus() {
  const anyPipetteConnected = pipetteRegistry.discovered.some(
    (p) => p.connected,
  );
  const status = {
    robot: state.robotConnected ? "connected" : "disconnected",
    serial: anyPipetteConnected ? "connected" : "disconnected",
    server: "running",
    dashboard: state.dashboardConnected
      ? "connected"
      : state.dashboardConnecting
        ? "connecting"
        : "disconnected",
    qr: state.qrConnected ? "connected" : "disconnected",
    dish: state.dishConnected ? "connected" : "disconnected",
  };

  io.emit("status", status);
  return status;
}

// ============================================================================
// DISH LOG STORE (append-only JSONL in backend/data/)
// ============================================================================
//
// Initialised at module scope, BEFORE any TCP listener exists. startServer()
// blocks up to CONFIG.discoveryTimeout per serial port, so a dish arriving in
// that window with the store uninitialised would be written with seq 1 and
// silently truncate the file's sequence.

const DISH_DATA_DIR = path.join(__dirname, "data");
const DISH_ACTIVE_FILE = path.join(DISH_DATA_DIR, "dishlog.jsonl");
const DISH_ACTIVE_NAME = "dishlog.jsonl";
const DISH_FILE_RE = /^dishlog(-\d{4}-\d{2})?\.jsonl$/;
const DISH_SCHEMA_V = 1;
const DISH_ID_RE = /^[A-Z0-9][A-Z0-9_.-]{0,31}$/;
// These belong to the QR port's vocabulary (see qrServer) — never a dish type.
const DISH_IGNORE = new Set(["", "OK", "PING", "FINISHED", "IDLE", "NULL"]);
const DISH_MEM_MAX = 20000; // ~4 weeks of live events; aggregates cover all history
const DISH_SNAPSHOT_N = 100; // websocket hydrate cap
const DISH_LIMIT_DEFAULT = 200;
const DISH_LIMIT_MAX = 5000;
const DISH_RANGE_MAX_DAYS = 400;
const DISH_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const SERVER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const BOOT_ID = Math.random().toString(16).slice(2, 10);

// en-CA yields YYYY-MM-DD. Never hand-roll with getFullYear() — that silently
// uses the process TZ and is the classic off-by-one-day bug.
const dishDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SERVER_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dishHourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SERVER_TZ,
  hour: "2-digit",
  hourCycle: "h23",
});

const dishLog = {
  events: [], // ring of the most recent DISH_MEM_MAX records
  fd: null, // long-lived append fd
  activeMonth: null, // "YYYY-MM" of the records in dishlog.jsonl
  lastSeq: 0,
  lastTsMs: null, // for cycleMs + dedupe
  lastJigId: null,
  totalsByJig: new Map(), // jigId -> {count, firstTs, lastTs}
  dayIndex: new Map(), // "YYYY-MM-DD" (local) -> Map<jigId, count>
  hourIndex: new Map(), // "YYYY-MM-DDTHH" (local) -> count
  total: 0,
  suspect: 0,
  ignored: 0,
  dedup: 0,
  writeErrors: 0,
  parseErrors: 0,
  droppedFromMemory: 0,
  clockWarning: false,
  loaded: false,
  statsTimer: null,
};

function dishDayKey(ms) {
  return dishDayFormatter.format(new Date(ms));
}

function dishHourKey(ms) {
  return `${dishDayKey(ms)}T${dishHourFormatter.format(new Date(ms))}`;
}

// Pure calendar-label arithmetic — stepping UTC days over date-only strings is
// exact and sidesteps DST entirely.
function dishEnumerateDays(fromDay, toDay) {
  const days = [];
  let ms = Date.parse(`${fromDay}T00:00:00Z`);
  const end = Date.parse(`${toDay}T00:00:00Z`);
  if (Number.isNaN(ms) || Number.isNaN(end)) return days;
  while (ms <= end && days.length < DISH_RANGE_MAX_DAYS) {
    days.push(new Date(ms).toISOString().slice(0, 10));
    ms += 86400000;
  }
  return days;
}

// Single funnel for every record, whether it came from disk or the wire.
// "suspect" records land in events and total but NEVER in the aggregates, so
// garbage can't pollute a throughput number.
function indexDishRecord(rec) {
  if (typeof rec.seq === "number" && rec.seq > dishLog.lastSeq) {
    dishLog.lastSeq = rec.seq;
  }

  const tsMs = Date.parse(rec.ts);
  if (!Number.isNaN(tsMs)) dishLog.lastTsMs = tsMs;
  dishLog.lastJigId = rec.jigId;
  dishLog.total++;

  if (rec.status === "suspect") {
    dishLog.suspect++;
  } else {
    const jigTotal = dishLog.totalsByJig.get(rec.jigId);
    if (jigTotal) {
      jigTotal.count++;
      jigTotal.lastTs = rec.ts;
    } else {
      dishLog.totalsByJig.set(rec.jigId, {
        count: 1,
        firstTs: rec.ts,
        lastTs: rec.ts,
      });
    }

    let day = dishLog.dayIndex.get(rec.day);
    if (!day) {
      day = new Map();
      dishLog.dayIndex.set(rec.day, day);
    }
    day.set(rec.jigId, (day.get(rec.jigId) || 0) + 1);

    if (!Number.isNaN(tsMs)) {
      const hk = dishHourKey(tsMs);
      dishLog.hourIndex.set(hk, (dishLog.hourIndex.get(hk) || 0) + 1);
    }
  }

  dishLog.events.push(rec);
  while (dishLog.events.length > DISH_MEM_MAX) {
    dishLog.events.shift();
    dishLog.droppedFromMemory++;
  }
}

function openDishFd() {
  dishLog.fd = fs.openSync(DISH_ACTIVE_FILE, "a");

  // A power cut mid-writeSync leaves a torn final line with NO trailing
  // newline. Heal it before appending, or the next record is concatenated onto
  // the garbage and lost too — turning one lost dish into two.
  try {
    const size = fs.fstatSync(dishLog.fd).size;
    if (size > 0) {
      const tail = Buffer.alloc(1);
      const readFd = fs.openSync(DISH_ACTIVE_FILE, "r");
      try {
        fs.readSync(readFd, tail, 0, 1, size - 1);
      } finally {
        fs.closeSync(readFd);
      }
      if (tail[0] !== 0x0a) {
        fs.writeSync(dishLog.fd, "\n");
        fs.fsyncSync(dishLog.fd);
        log(
          "error",
          "dish",
          "Healed a torn final line in dishlog.jsonl (missing newline added)",
        );
      }
    }
  } catch (err) {
    log("error", "dish", `Could not check dish log tail: ${err.message}`);
  }
}

function closeDishLog() {
  if (dishLog.fd === null) return;
  try {
    fs.fsyncSync(dishLog.fd);
  } catch {
    // closing anyway
  }
  try {
    fs.closeSync(dishLog.fd);
  } catch {
    // closing anyway
  }
  dishLog.fd = null;
}

// Driven by a write, never a timer, so nothing races an in-flight append.
function dishRotateIfNeeded(ms) {
  const month = dishDayKey(ms).slice(0, 7);
  if (dishLog.activeMonth === null) {
    dishLog.activeMonth = month;
    return;
  }
  if (month === dishLog.activeMonth) return;

  closeDishLog();
  const archive = path.join(
    DISH_DATA_DIR,
    `dishlog-${dishLog.activeMonth}.jsonl`,
  );
  try {
    if (fs.existsSync(DISH_ACTIVE_FILE)) {
      fs.renameSync(DISH_ACTIVE_FILE, archive);
      log("info", "dish", `Rolled dish log over to ${path.basename(archive)}`);
    }
  } catch (err) {
    log("error", "dish", `Dish log rollover failed: ${err.message}`);
  }
  dishLog.activeMonth = month;
  openDishFd();
}

// fsyncSync is the whole point: appendFileSync's close() does NOT flush the
// page cache, so on ext4 with the default commit=5 the last record — exactly
// the one you care about after a power cut — can vanish. One blocking fsync per
// completed dish is ~0.03% duty cycle.
function writeDishRecord(rec) {
  const line = JSON.stringify(rec) + "\n";
  try {
    dishRotateIfNeeded(Date.parse(rec.ts));
    if (dishLog.fd === null) openDishFd();
    fs.writeSync(dishLog.fd, line);
    fs.fsyncSync(dishLog.fd);
    return true;
  } catch (err) {
    dishLog.writeErrors++;
    log("error", "dish", `Dish log write failed: ${err.message}`);
    closeDishLog(); // force a reopen next time (EBADF after a rotate/unlink)
    return false;
  }
}

function dishLogFiles() {
  return fs
    .readdirSync(DISH_DATA_DIR)
    .filter((name) => DISH_FILE_RE.test(name))
    .sort((a, b) => {
      // archive names sort chronologically; the active file always goes last
      if (a === DISH_ACTIVE_NAME) return 1;
      if (b === DISH_ACTIVE_NAME) return -1;
      return a.localeCompare(b);
    });
}

function initDishLog() {
  fs.mkdirSync(DISH_DATA_DIR, { recursive: true });

  let activeLastDay = null;

  for (const name of dishLogFiles()) {
    const full = path.join(DISH_DATA_DIR, name);
    let bad = 0;
    const lines = fs.readFileSync(full, "utf8").split("\n");
    for (const raw of lines) {
      if (!raw) continue;
      let rec;
      try {
        rec = JSON.parse(raw);
      } catch {
        // A torn final line is EXPECTED after a power cut mid-writeSync.
        // Never let one bad byte stop the boot.
        bad++;
        continue;
      }
      indexDishRecord(rec);
      if (name === DISH_ACTIVE_NAME && rec.day) activeLastDay = rec.day;
    }
    if (bad) {
      dishLog.parseErrors += bad;
      log("error", "dish", `${name}: ${bad} unparseable line(s) skipped`);
    }
  }

  dishLog.activeMonth = (activeLastDay || dishDayKey(Date.now())).slice(0, 7);
  openDishFd();
  dishLog.loaded = true;

  if (dishLog.lastTsMs !== null && dishLog.lastTsMs > Date.now() + 60000) {
    dishLog.clockWarning = true;
  }
}

function recordDish(rawInput, srcIp) {
  const raw = String(rawInput).replace(/\r/g, "").trim();

  // Tolerant parsing: "J01" or "J01;prog=sperm_wash;op=anna". Unknown keys land
  // in meta, so the URScript can start sending extras with no server change.
  const parts = raw.split(";");
  const jigId = parts[0].trim().toUpperCase();

  if (DISH_IGNORE.has(jigId)) {
    dishLog.ignored++;
    log("info", "dish", `Ignored control value: ${raw || "(empty)"}`);
    return { action: "ignored" };
  }

  const meta = {};
  let malformedExtras = false;
  for (const pair of parts.slice(1)) {
    const eq = pair.indexOf("=");
    const key = eq === -1 ? "" : pair.slice(0, eq).trim();
    if (!key) {
      // Don't silently discard a segment we can't read — it makes the whole
      // message suspect rather than quietly counting a clean dish.
      malformedExtras = true;
      continue;
    }
    meta[key] = pair.slice(eq + 1).trim();
  }

  const nowMs = Date.now();

  if (
    dishLog.lastJigId === jigId &&
    dishLog.lastTsMs !== null &&
    nowMs - dishLog.lastTsMs >= 0 &&
    nowMs - dishLog.lastTsMs < CONFIG.dishDedupMs
  ) {
    dishLog.dedup++;
    log(
      "info",
      "dish",
      `Duplicate ${jigId} within ${CONFIG.dishDedupMs}ms — not counted`,
    );
    return { action: "dedup" };
  }

  // Log-and-store, never silently drop: this is a production ledger, and a
  // dropped line undercounts dishes with no trace. Suspects are excluded from
  // the aggregates instead.
  const known = DISH_ID_RE.test(jigId) && !malformedExtras;
  if (!known) {
    log("error", "dish", `Suspect dish value stored: ${JSON.stringify(raw)}`);
  }

  let cycleMs = null;
  if (dishLog.lastTsMs !== null) {
    const delta = nowMs - dishLog.lastTsMs;
    if (delta >= 0 && delta <= CONFIG.dishMaxCycleMs) {
      cycleMs = delta;
    } else if (delta < 0) {
      meta.clockJump = true; // never display a negative cycle time
    }
  }

  // Did the robot report the dish the vision system actually saw?
  if (state.currentQrValue && state.currentQrValue.toUpperCase() !== jigId) {
    meta.qr = state.currentQrValue;
  }

  const operator = meta.op !== undefined ? meta.op : null;
  delete meta.op;

  const record = {
    v: DISH_SCHEMA_V,
    seq: dishLog.lastSeq + 1,
    ts: new Date(nowMs).toISOString(),
    day: dishDayKey(nowMs),
    jigId,
    operator,
    cycleMs,
    status: known ? "ok" : "suspect",
    raw,
    src: srcIp,
    boot: BOOT_ID,
    up: Math.round(performance.now()),
    meta,
  };

  writeDishRecord(record); // failure is non-fatal — still index, emit and ack
  indexDishRecord(record);

  log(
    "info",
    "dish",
    `Dish recorded: ${jigId} (seq ${record.seq}` +
      (cycleMs !== null ? `, cycle ${(cycleMs / 1000).toFixed(1)}s` : "") +
      ")",
  );
  io.emit("dish-event", record);
  emitDishStats();

  return { action: "stored", record };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Date-only bounds compare against the stored local `day` field (lexicographic
// on ISO dates), so there is no timezone maths anywhere. Full ISO instants
// compare against `ts`.
function dishRangeFilter({ from, to, jig }) {
  const jigUpper = jig ? jig.trim().toUpperCase() : null;
  const fromDay = from && DISH_DAY_RE.test(from) ? from : null;
  const toDay = to && DISH_DAY_RE.test(to) ? to : null;
  const fromMs = from && !fromDay ? Date.parse(from) : null;
  const toMs = to && !toDay ? Date.parse(to) : null;

  return (rec) => {
    if (jigUpper && rec.jigId !== jigUpper) return false;
    if (fromDay && rec.day < fromDay) return false;
    if (toDay && rec.day > toDay) return false;
    if (fromMs !== null && Date.parse(rec.ts) < fromMs) return false;
    if (toMs !== null && Date.parse(rec.ts) > toMs) return false;
    return true;
  };
}

function validateDishRange(from, to) {
  for (const [name, value] of [
    ["from", from],
    ["to", to],
  ]) {
    if (!value) continue;
    if (DISH_DAY_RE.test(value)) continue;
    if (Number.isNaN(Date.parse(value))) return `Invalid ${name}: ${value}`;
  }
  const a = from
    ? Date.parse(DISH_DAY_RE.test(from) ? `${from}T00:00:00Z` : from)
    : null;
  const b = to
    ? Date.parse(DISH_DAY_RE.test(to) ? `${to}T00:00:00Z` : to)
    : null;
  if (a !== null && b !== null) {
    if (b < a) return "`to` is before `from`";
    if (b - a > DISH_RANGE_MAX_DAYS * 86400000) {
      return `Range exceeds ${DISH_RANGE_MAX_DAYS} days`;
    }
  }
  return null;
}

function dishDayOf(bound, fallback) {
  if (!bound) return fallback;
  if (DISH_DAY_RE.test(bound)) return bound;
  const ms = Date.parse(bound);
  return Number.isNaN(ms) ? fallback : dishDayKey(ms);
}

// Served from the ring when the range is inside it (the common "today" case),
// otherwise from disk, opening only the months the range touches.
function dishEventsInRange({ from, to, jig, limit, order }) {
  const predicate = dishRangeFilter({ from, to, jig });
  const oldestInMemory = dishLog.events.length ? dishLog.events[0] : null;
  const fromDay = from ? dishDayOf(from, null) : null;
  const ringCovers =
    dishLog.droppedFromMemory === 0 ||
    (oldestInMemory !== null &&
      fromDay !== null &&
      oldestInMemory.day <= fromDay);

  const source = ringCovers ? "memory" : "disk";
  const matched = ringCovers
    ? dishLog.events.filter(predicate)
    : dishEventsFromDisk(predicate, limit, order);

  const ordered =
    order === "asc"
      ? matched.slice().sort((a, b) => a.seq - b.seq)
      : matched.slice().sort((a, b) => b.seq - a.seq);

  return {
    source,
    truncated: ordered.length > limit,
    events: ordered.slice(0, limit),
  };
}

function dishEventsFromDisk(predicate, limit, order) {
  const files = dishLogFiles();
  // Newest file first for a desc query so we can stop early.
  const ordered = order === "asc" ? files : files.slice().reverse();
  const out = [];

  for (const name of ordered) {
    let lines;
    try {
      lines = fs
        .readFileSync(path.join(DISH_DATA_DIR, name), "utf8")
        .split("\n");
    } catch (err) {
      log("error", "dish", `Could not read ${name}: ${err.message}`);
      continue;
    }
    if (order !== "asc") lines.reverse();

    for (const raw of lines) {
      if (!raw) continue;
      let rec;
      try {
        rec = JSON.parse(raw);
      } catch {
        continue;
      }
      if (predicate(rec)) out.push(rec);
      if (out.length > limit) return out;
    }
  }
  return out;
}

function dishByJigFromDays(days) {
  const totals = new Map();
  for (const day of days) {
    const perJig = dishLog.dayIndex.get(day);
    if (!perJig) continue;
    for (const [jigId, count] of perJig) {
      totals.set(jigId, (totals.get(jigId) || 0) + count);
    }
  }
  return [...totals.entries()]
    .map(([jigId, count]) => ({ jigId, count }))
    .sort((a, b) => b.count - a.count || a.jigId.localeCompare(b.jigId));
}

function dishSummary({ from, to }) {
  const today = dishDayKey(Date.now());
  const todayByJig = dishByJigFromDays([today]);

  const allTimeByJig = [...dishLog.totalsByJig.entries()]
    .map(([jigId, t]) => ({
      jigId,
      count: t.count,
      firstTs: t.firstTs,
      lastTs: t.lastTs,
    }))
    .sort((a, b) => b.count - a.count || a.jigId.localeCompare(b.jigId));

  let range = null;
  if (from || to) {
    const days = [...dishLog.dayIndex.keys()].sort();
    const fromDay = dishDayOf(from, days[0] || today);
    const toDay = dishDayOf(to, days[days.length - 1] || today);
    const byJig = dishByJigFromDays(dishEnumerateDays(fromDay, toDay));
    range = {
      from: fromDay,
      to: toDay,
      total: byJig.reduce((n, r) => n + r.count, 0),
      byJig,
    };
  }

  return {
    tz: SERVER_TZ,
    today: {
      date: today,
      total: todayByJig.reduce((n, r) => n + r.count, 0),
      byJig: todayByJig,
    },
    allTime: {
      total: allTimeByJig.reduce((n, r) => n + r.count, 0),
      firstTs: allTimeByJig.length
        ? allTimeByJig.reduce(
            (min, r) => (r.firstTs < min ? r.firstTs : min),
            allTimeByJig[0].firstTs,
          )
        : null,
      lastTs: allTimeByJig.length
        ? allTimeByJig.reduce(
            (max, r) => (r.lastTs > max ? r.lastTs : max),
            allTimeByJig[0].lastTs,
          )
        : null,
      byJig: allTimeByJig,
    },
    range,
    suspect: dishLog.suspect,
    ignored: dishLog.ignored,
    dedup: dishLog.dedup,
  };
}

// Points are zero-filled across the whole range: a gap must render as an empty
// slot, not be omitted, or idle hours get visually interpolated away.
function dishThroughput({ bucket, from, to }) {
  const today = dishDayKey(Date.now());
  const known = [...dishLog.dayIndex.keys()].sort();
  const fromDay = dishDayOf(from, known[0] || today);
  const toDay = dishDayOf(to, known[known.length - 1] || today);
  const days = dishEnumerateDays(fromDay, toDay);
  const points = [];

  if (bucket === "hour") {
    for (const day of days) {
      for (let h = 0; h < 24; h++) {
        const hh = String(h).padStart(2, "0");
        const key = `${day}T${hh}`;
        points.push({
          t: key,
          label: days.length > 1 ? `${day.slice(5)} ${hh}:00` : `${hh}:00`,
          count: dishLog.hourIndex.get(key) || 0,
        });
      }
    }
  } else {
    for (const day of days) {
      const perJig = dishLog.dayIndex.get(day);
      let count = 0;
      if (perJig) for (const n of perJig.values()) count += n;
      points.push({ t: day, label: day.slice(5), count });
    }
  }

  return {
    tz: SERVER_TZ,
    bucket: bucket === "hour" ? "hour" : "day",
    from: fromDay,
    to: toDay,
    max: points.reduce((m, p) => (p.count > m ? p.count : m), 0),
    total: points.reduce((n, p) => n + p.count, 0),
    points,
  };
}

function dishStatsPayload() {
  const summary = dishSummary({});
  const last = dishLog.events.length
    ? dishLog.events[dishLog.events.length - 1]
    : null;
  return {
    tz: SERVER_TZ,
    today: summary.today,
    allTime: { total: summary.allTime.total, byJig: summary.allTime.byJig },
    lastTs: last ? last.ts : null,
    lastJigId: last ? last.jigId : null,
    lastCycleMs: last ? last.cycleMs : null,
    suspect: dishLog.suspect,
    writeErrors: dishLog.writeErrors,
    clockWarning: dishLog.clockWarning,
  };
}

function emitDishStats() {
  if (dishLog.statsTimer) return;
  dishLog.statsTimer = setTimeout(() => {
    dishLog.statsTimer = null;
    io.emit("dish-stats", dishStatsPayload());
  }, 1000);
}

function dishCsvValue(value) {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function formatCycleMmss(ms) {
  if (ms === null || ms === undefined) return "";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Logging a dish must never be worth losing the pipette bridge: if data/ is not
// writable by the systemd User=, run memory-only.
try {
  initDishLog();
} catch (err) {
  dishLog.loaded = false;
  log(
    "error",
    "dish",
    `Dish log could not be initialised (${err.message}) — running in memory only`,
  );
}

// ============================================================================
// MULTI-PIPETTE DISCOVERY & CONNECTION
// ============================================================================

// Discover and identify all connected pipettes
// excludePorts: paths owned by connected pipettes — never probe those.
// quiet: periodic rescans stay silent unless there is something to probe.
async function discoverPipettes({ excludePorts = [], quiet = false } = {}) {
  if (!quiet) log("info", "server", "Starting pipette discovery...");

  try {
    const ports = await SerialPort.list();

    // Filter for likely pipette ports (macOS: tty.usbmodem*, Linux/Pi: ttyACM*)
    const candidatePorts = ports.filter((port) => {
      const path = port.path;
      return (
        (path.includes("tty.usbmodem") || path.includes("ttyACM")) &&
        !excludePorts.includes(path)
      );
    });

    if (quiet && candidatePorts.length === 0) return [];

    log("info", "server", `Found ${ports.length} serial ports`);
    log(
      "info",
      "server",
      `Candidate ports: ${candidatePorts.map((p) => p.path).join(", ")}`,
    );

    const discovered = [];

    for (const portInfo of candidatePorts) {
      const portPath = portInfo.path;
      log("info", "server", `Probing port: ${portPath}`);

      try {
        const model = await identifyPipette(portPath);

        if (model) {
          log("info", "server", `✓ Identified ${model} on ${portPath}`);
          discovered.push({
            model,
            port: portPath,
            serialPort: null,
            parser: null,
            connected: false,
            currentHandshake: null,
            pendingResponse: null,
          });
        } else {
          log("info", "server", `✗ No valid response from ${portPath}`);
        }
      } catch (err) {
        log("error", "server", `Failed to probe ${portPath}: ${err.message}`);
      }
    }

    log(
      "info",
      "server",
      `Discovery complete: Found ${discovered.length} pipette(s)`,
    );
    return discovered;
  } catch (err) {
    log("error", "server", `Port discovery failed: ${err.message}`);
    return [];
  }
}

// Identify a pipette by sending GET_MODEL command
function identifyPipette(portPath) {
  return new Promise((resolve) => {
    let testPort;
    let parser;
    const receivedLines = [];

    const cleanup = () => {
      clearTimeout(timeoutHandle);
      if (parser) parser.removeAllListeners();
      if (testPort && testPort.isOpen) testPort.close();
    };

    const timeoutHandle = setTimeout(() => {
      cleanup();
      resolve(null);
    }, CONFIG.discoveryTimeout);

    try {
      testPort = new SerialPort({
        path: portPath,
        baudRate: CONFIG.serialBaudRate,
      });

      parser = testPort.pipe(new ReadlineParser({ delimiter: "\n" }));

      testPort.on("open", () => {
        const cmd = JSON.stringify({ no: 0, data: "GET_MODEL" }) + "\n";
        testPort.write(cmd);
      });

      testPort.on("error", () => {
        cleanup();
        resolve(null);
      });

      parser.on("data", (line) => {
        const lineStr = line.trim();
        if (!lineStr) return;

        log("info", "server", `[Discovery] ${portPath} <- ${lineStr}`);
        receivedLines.push(lineStr);

        const hasEnd = receivedLines.some((l) =>
          l.toUpperCase().includes("END"),
        );
        const hasOK = receivedLines.some((l) => l.toUpperCase().includes("OK"));

        if (hasEnd || hasOK) {
          const model = extractModelFromResponse(receivedLines);
          cleanup();
          resolve(model);
        }
      });
    } catch (err) {
      cleanup();
      resolve(null);
    }
  });
}

// Extract model name from handshake response lines
function extractModelFromResponse(lines) {
  for (const line of lines) {
    const upper = line.toUpperCase();

    if (["ACK", "BEGIN", "END", "OK", "ERROR"].some((kw) => upper.includes(kw)))
      continue;

    if (line.startsWith("{") || line.startsWith("[")) {
      try {
        const data = JSON.parse(line);
        if (data.model) return data.model;
        if (data.data && data.data.model) return data.data.model;
      } catch {
        // fall through
      }
    }

    if (line.trim()) return line.trim();
  }
  return null;
}

// Connect to a specific pipette
function connectToPipette(pipetteInfo) {
  const { model, port } = pipetteInfo;

  log("info", "server", `Connecting to ${model} on ${port}`);

  // Detach the previous port so its late close/data events can't touch the registry
  if (pipetteInfo.serialPort) {
    const old = pipetteInfo.serialPort;
    old.removeAllListeners();
    if (pipetteInfo.parser) pipetteInfo.parser.removeAllListeners();
    old.on("error", () => {}); // swallow errors from the abandoned port
    if (old.isOpen) old.close();
  }

  const serialPort = new SerialPort({
    path: port,
    baudRate: CONFIG.serialBaudRate,
  });

  const parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }));

  pipetteInfo.serialPort = serialPort;
  pipetteInfo.parser = parser;

  serialPort.on("open", () => {
    pipetteInfo.connected = true;
    log("info", "pipette", `${model} connected on ${port}`);
    emitPipetteStatus();
  });

  serialPort.on("error", (err) => {
    pipetteInfo.connected = false;
    log("error", "pipette", `${model} error: ${err.message}`);
    emitPipetteStatus();
    // Close so the "close" handler cleans up and the port path is freed for rescan
    if (serialPort.isOpen) serialPort.close();
    // A failed open emits only "error", never "close" — the rescan loop covers both
    scheduleRescan(CONFIG.pipetteRescanMs);
  });

  serialPort.on("close", () => {
    pipetteInfo.connected = false;
    pipetteInfo.currentHandshake = null;
    // Fail an in-flight command now rather than after handshakeTimeout
    if (pipetteInfo.pendingResponse) {
      clearTimeout(pipetteInfo.pendingResponse.timeout);
      pipetteInfo.pendingResponse.resolve({
        status: "ERROR",
        message: `Pipette ${model} disconnected`,
        data: null,
      });
      pipetteInfo.pendingResponse = null;
    }
    log("info", "pipette", `${model} disconnected`);
    emitPipetteStatus();
    // Reconnection is owned by ensurePipettes(): the port path may change on replug
    scheduleRescan(CONFIG.pipetteRescanMs);
  });

  parser.on("data", (line) => {
    const lineStr = line.trim();
    if (!lineStr) return;

    log("response", "pipette", `[${model}] ${lineStr}`);

    io.emit("handshake", {
      timestamp: new Date().toISOString(),
      line: lineStr,
      type: detectHandshakeType(lineStr),
      pipette: model,
    });

    if (pipetteInfo.currentHandshake) {
      pipetteInfo.currentHandshake.lines.push(lineStr);

      if (isHandshakeComplete(pipetteInfo.currentHandshake.lines)) {
        const response = parseHandshake(pipetteInfo.currentHandshake.lines);
        pipetteInfo.currentHandshake = null;

        // Resolve dashboard/REST pending response
        if (pipetteInfo.pendingResponse) {
          clearTimeout(pipetteInfo.pendingResponse.timeout);
          pipetteInfo.pendingResponse.resolve(response);
          pipetteInfo.pendingResponse = null;
        }

        // Send response to robot if triggered by a robot command
        if (state.robotClient && state.pendingRobotResponse) {
          const responseJson = JSON.stringify(response) + "\n";
          state.robotClient.write(responseJson);
          log("response", "server", `Sent to robot: ${responseJson.trim()}`);
          clearTimeout(state.pendingRobotResponse.timeout);
          state.pendingRobotResponse = null;
        }
      }
    }
  });

  return serialPort;
}

// Connect to all discovered pipettes and set first as active
async function connectAllPipettes() {
  log(
    "info",
    "server",
    `Connecting to ${pipetteRegistry.discovered.length} pipette(s)...`,
  );

  for (const pipetteInfo of pipetteRegistry.discovered) {
    try {
      connectToPipette(pipetteInfo);
    } catch (err) {
      log(
        "error",
        "server",
        `Failed to connect to ${pipetteInfo.model}: ${err.message}`,
      );
    }
  }

  if (pipetteRegistry.discovered.length > 0) {
    pipetteRegistry.activeModel = pipetteRegistry.discovered[0].model;
    log("info", "server", `Active pipette: ${pipetteRegistry.activeModel}`);
  }
}

// ----------------------------------------------------------------------------
// Rescan supervisor: while fewer than CONFIG.expectedPipettes are connected,
// rediscover pipettes every CONFIG.pipetteRescanMs and reconnect them by model
// (not by port path — USB replug can move /dev/ttyACM0 to /dev/ttyACM2).
// ----------------------------------------------------------------------------

const rescan = { timer: null, running: false, lastMissing: null };

function scheduleRescan(delayMs) {
  if (shuttingDown) return;
  clearTimeout(rescan.timer);
  rescan.timer = setTimeout(ensurePipettes, delayMs);
}

async function ensurePipettes() {
  if (shuttingDown || rescan.running) return;

  const connected = pipetteRegistry.discovered.filter((p) => p.connected);
  const missing = CONFIG.expectedPipettes - connected.length;

  // Log only on change so the dashboard log isn't flooded every 5s
  if (missing !== rescan.lastMissing) {
    rescan.lastMissing = missing;
    if (missing > 0) {
      log(
        "error",
        "server",
        `${connected.length}/${CONFIG.expectedPipettes} pipettes connected — rescanning every ${CONFIG.pipetteRescanMs / 1000}s`,
      );
    } else {
      log("info", "server", `All ${CONFIG.expectedPipettes} pipettes connected`);
    }
  }

  if (missing <= 0) {
    scheduleRescan(CONFIG.pipetteRescanMs);
    return;
  }

  rescan.running = true;
  try {
    const found = await discoverPipettes({
      // Includes ports still mid-open, which aren't "connected" yet
      excludePorts: pipetteRegistry.discovered
        .filter((p) => p.serialPort?.isOpen || p.serialPort?.opening)
        .map((p) => p.port),
      quiet: true,
    });

    for (const f of found) {
      if (shuttingDown) break;
      const existing = pipetteRegistry.discovered.find(
        (p) => p.model === f.model,
      );
      if (existing?.connected) continue;
      if (existing) {
        existing.port = f.port;
        connectToPipette(existing);
      } else {
        pipetteRegistry.discovered.push(f);
        connectToPipette(f);
      }
      log("info", "server", `Recovered ${f.model} on ${f.port}`);
    }

    if (!pipetteRegistry.activeModel && pipetteRegistry.discovered.length > 0) {
      pipetteRegistry.activeModel = pipetteRegistry.discovered[0].model;
      log("info", "server", `Active pipette: ${pipetteRegistry.activeModel}`);
    }
    if (found.length > 0) emitPipetteStatus();
  } catch (err) {
    log("error", "server", `Pipette rescan failed: ${err.message}`);
  } finally {
    rescan.running = false;
    scheduleRescan(CONFIG.pipetteRescanMs);
  }
}

// Emit pipette + full system status to dashboard
function emitPipetteStatus() {
  const pipettesStatus = pipetteRegistry.discovered.map((p) => ({
    model: p.model,
    port: p.port,
    connected: p.connected,
  }));

  io.emit("pipettes-list", pipettesStatus);
  io.emit("active-pipette", pipetteRegistry.activeModel);

  // Also emit unified status so existing listeners stay in sync
  emitStatus();
}

// ============================================================================
// HANDSHAKE HELPERS
// ============================================================================

function detectHandshakeType(line) {
  const upper = line.toUpperCase();
  if (upper.includes("ACK")) return "ACK";
  if (upper.includes("BEGIN")) return "BEGIN";
  if (upper.includes("END")) return "END";
  if (upper.includes("ERROR")) return "ERROR";
  if (upper.includes("OK")) return "OK";
  return "DATA";
}

function isHandshakeComplete(lines) {
  const hasEnd = lines.some((l) => l.toUpperCase().includes("END"));
  const hasResult = lines.some(
    (l) => l.toUpperCase().includes("OK") || l.toUpperCase().includes("ERROR"),
  );
  return hasEnd || hasResult;
}

function parseHandshake(lines) {
  const response = { status: "ERROR", data: null, message: null };

  for (const line of lines) {
    const upper = line.toUpperCase();

    if (upper.includes("OK") && !upper.includes("ERROR")) {
      response.status = "OK";
    } else if (upper.includes("ERROR")) {
      response.status = "ERROR";
      const parts = line.split(/ERROR/i);
      if (parts[1]) {
        response.message =
          parts[1].trim().split(/\s+/).slice(1).join(" ") || "Unknown error";
      }
    }

    if (!["ACK", "BEGIN", "END", "OK", "ERROR"].some((kw) => upper.includes(kw))) {
      if (line.startsWith("{") || line.startsWith("[")) {
        try {
          response.data = JSON.parse(line);
        } catch {
          response.data = line;
        }
      } else {
        response.data = line;
      }
    }
  }

  return response;
}

// ============================================================================
// SEND TO PIPETTE (multi-registry, async)
// ============================================================================

function sendToPipette(commandStr) {
  const activePipette = pipetteRegistry.discovered.find(
    (p) => p.model === pipetteRegistry.activeModel,
  );

  if (!activePipette) {
    log("error", "server", "No pipette selected");
    return Promise.resolve({
      status: "ERROR",
      message: "No pipette selected",
      data: null,
    });
  }

  if (!activePipette.serialPort || !activePipette.connected) {
    log("error", "server", `Pipette ${activePipette.model} not connected`);
    return Promise.resolve({
      status: "ERROR",
      message: `Pipette ${activePipette.model} not connected`,
      data: null,
    });
  }

  state.commandNumber++;

  let cmd;
  try {
    cmd = JSON.parse(commandStr);
    if (!cmd.no) cmd.no = state.commandNumber;
  } catch {
    cmd = { no: state.commandNumber, data: commandStr };
  }

  const cmdJson = JSON.stringify(cmd) + "\n";

  activePipette.currentHandshake = {
    command: cmdJson.trim(),
    lines: [],
    startTime: Date.now(),
  };

  activePipette.serialPort.write(cmdJson, (err) => {
    if (err) {
      log(
        "error",
        "server",
        `Failed to write to ${activePipette.model}: ${err.message}`,
      );
    } else {
      log(
        "command",
        "server",
        `Sent to ${activePipette.model}: ${cmdJson.trim()}`,
      );
    }
  });

  return new Promise((resolve) => {
    activePipette.pendingResponse = {
      resolve,
      timeout: setTimeout(() => {
        if (activePipette.currentHandshake) {
          resolve({
            status: "ERROR",
            message: `Pipette ${activePipette.model} response timeout`,
            data: null,
          });
          activePipette.currentHandshake = null;
          activePipette.pendingResponse = null;
        }
      }, CONFIG.handshakeTimeout),
    };
  });
}

// ============================================================================
// UR DASHBOARD SERVER TCP CLIENT
// ============================================================================

const DASHBOARD_PORT = 29999;

function connectToDashboard(robotIp) {
  return new Promise((resolve, reject) => {
    if (state.dashboardSocket || state.dashboardConnecting) {
      disconnectFromDashboard();
    }

    state.dashboardConnecting = true;
    state.dashboardIp = robotIp;
    emitStatus();

    log(
      "info",
      "dashboard",
      `Connecting to UR Dashboard Server at ${robotIp}:${DASHBOARD_PORT}`,
    );

    const socket = new net.Socket();
    socket.setTimeout(5000);

    socket.connect(DASHBOARD_PORT, robotIp, () => {
      state.dashboardConnected = true;
      state.dashboardConnecting = false;
      state.dashboardSocket = socket;
      log(
        "info",
        "dashboard",
        `Connected to UR Dashboard Server at ${robotIp}`,
      );
      emitStatus();
      resolve(true);
      startDashboardPolling();
    });

    socket.on("data", (data) => {
      const response = data.toString().trim();
      log("response", "dashboard", `Dashboard response: ${response}`);

      io.emit("dashboard-response", {
        timestamp: new Date().toISOString(),
        response,
        success: true,
      });

      if (state.dashboardPendingCommand) {
        state.dashboardPendingCommand.resolve({ success: true, response });
        state.dashboardPendingCommand = null;
      }
    });

    socket.on("timeout", () => {
      log("error", "dashboard", "Connection timeout");
      state.dashboardConnecting = false;
      socket.destroy();
      emitStatus();
      reject(new Error("Connection timeout"));
    });

    socket.on("error", (err) => {
      log("error", "dashboard", `Dashboard socket error: ${err.message}`);
      state.dashboardConnected = false;
      state.dashboardConnecting = false;
      state.dashboardSocket = null;
      emitStatus();
      reject(err);
    });

    socket.on("close", () => {
      stopDashboardPolling();
      log("info", "dashboard", "Dashboard connection closed");
      state.dashboardConnected = false;
      state.dashboardConnecting = false;
      state.dashboardSocket = null;
      emitStatus();
    });
  });
}

function disconnectFromDashboard() {
  stopDashboardPolling();
  if (state.dashboardSocket) {
    state.dashboardSocket.removeAllListeners();
    state.dashboardSocket.destroy();
    state.dashboardSocket = null;
  }
  state.dashboardConnected = false;
  state.dashboardConnecting = false;
  log("info", "dashboard", "Disconnected from Dashboard Server");
  emitStatus();
}

function sendDashboardCommand(command) {
  return new Promise((resolve, reject) => {
    if (!state.dashboardSocket || !state.dashboardConnected) {
      reject(new Error("Not connected to Dashboard Server"));
      return;
    }

    log("command", "dashboard", `Sending dashboard command: ${command}`);

    const timeout = setTimeout(() => {
      if (state.dashboardPendingCommand) {
        state.dashboardPendingCommand = null;
        reject(new Error("Command timeout"));
      }
    }, 5000);

    state.dashboardPendingCommand = {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    };

    state.dashboardSocket.write(command + "\n");
  });
}

const POLL_QUERIES = ["robotmode", "programstate"];
let pollIndex = 0;

function startDashboardPolling() {
  stopDashboardPolling();
  state.pollingInterval = setInterval(() => {
    if (!state.dashboardConnected || !state.dashboardSocket) {
      stopDashboardPolling();
      return;
    }
    if (state.dashboardPendingCommand) return;
    const query = POLL_QUERIES[pollIndex % 2];
    pollIndex++;
    state.dashboardSocket.write(query + "\n");
  }, 500);
}

function stopDashboardPolling() {
  if (state.pollingInterval) {
    clearInterval(state.pollingInterval);
    state.pollingInterval = null;
  }
}

// ============================================================================
// TCP SERVER FOR ROBOT
// ============================================================================

const tcpServer = net.createServer((socket) => {
  const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;

  log("info", "robot", `Robot connected: ${clientAddr}`);
  state.robotConnected = true;
  state.robotClient = socket;
  emitStatus();

  socket.on("data", async (data) => {
    const command = data.toString("utf-8").trim();
    log("command", "robot", `Received: ${command}`);

    // Check if first word is a known pipette model (for per-model routing)
    const parts = command.split(" ");
    const firstWord = parts[0];
    const pipette = pipetteRegistry.discovered.find(
      (p) => p.model === firstWord,
    );

    let actualCommand;
    if (pipette) {
      pipetteRegistry.activeModel = firstWord;
      actualCommand = parts.slice(1).join(" ");
      log("info", "robot", `Switched to pipette: ${firstWord}`);
      io.emit("active-pipette", firstWord);
    } else {
      actualCommand = command;
    }

    // Track pending robot response so connectToPipette's data handler can reply
    const response = await new Promise((resolve) => {
      state.pendingRobotResponse = {
        resolve,
        timeout: setTimeout(() => {
          state.pendingRobotResponse = null;
          resolve({
            status: "ERROR",
            message: "Robot response timeout",
            data: null,
          });
        }, CONFIG.handshakeTimeout + 1000),
      };
      sendToPipette(actualCommand).then((res) => {
        if (state.pendingRobotResponse) {
          clearTimeout(state.pendingRobotResponse.timeout);
          state.pendingRobotResponse = null;
          resolve(res);
        }
      });
    });

    const responseJson = JSON.stringify(response) + "\n";
    socket.write(responseJson);
    log("response", "server", `Sent to robot: ${responseJson.trim()}`);
  });

  socket.on("end", () => {
    log("info", "robot", `Robot disconnected: ${clientAddr}`);
    state.robotConnected = false;
    state.robotClient = null;
    emitStatus();
  });

  socket.on("error", (err) => {
    log("error", "robot", `Socket error: ${err.message}`);
    state.robotConnected = false;
    state.robotClient = null;
    emitStatus();
  });
});

tcpServer.listen(CONFIG.tcpPort, "0.0.0.0", () => {
  log("info", "server", `TCP server listening on port ${CONFIG.tcpPort}`);
});

// ============================================================================
// QR CODE TCP SERVER
// ============================================================================

const qrServer = net.createServer((socket) => {
  const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;

  log("info", "qr", `QR client connected: ${clientAddr}`);
  state.qrConnected = true;
  state.qrClient = socket;

  socket.on("data", async (data) => {
    const qrValue = data.toString("utf-8").trim();
    state.currentQrValue = qrValue;
    const timestamp = new Date().toISOString();

    log("info", "qr", `QR code received: ${qrValue}`);

    io.emit("qr-update", { value: qrValue, timestamp });

    socket.write("OK\n");

    // "finished" → load __ready.urp and play
    if (qrValue.toLowerCase() === "finished") {
      log("info", "server", "QR 'finished' received — loading __ready.urp");
      try {
        if (!state.dashboardConnected && state.dashboardIp) {
          log("info", "server", "Dashboard disconnected — reconnecting before load...");
          await connectToDashboard(state.dashboardIp);
        }
        await sendDashboardCommand("load __ready.urp");
        await new Promise((r) => setTimeout(r, 500));
        await sendDashboardCommand("play");
        log("info", "server", "Loaded and started __ready.urp");
      } catch (err) {
        log("error", "server", `Failed to load __ready.urp: ${err.message}`);
      }
    }
  });

  socket.on("end", () => {
    log("info", "qr", `QR client disconnected: ${clientAddr}`);
    state.qrConnected = false;
    state.qrClient = null;
  });

  socket.on("error", (err) => {
    log("error", "qr", `QR socket error: ${err.message}`);
    state.qrConnected = false;
    state.qrClient = null;
  });
});

qrServer.listen(CONFIG.qrPort, "0.0.0.0", () => {
  log("info", "server", `QR server listening on port ${CONFIG.qrPort}`);
});

// ============================================================================
// DISH LOG TCP SERVER
// ============================================================================
//
// The robot sends one jig ID per completed dish:
//   socket_open(SERVER_IP, 5003, "dishlog")
//   socket_send_line("J01", "dishlog")      # _line, NOT _string — only _line appends \n
//   socket_close("dishlog")
//
// Deliberately NOT a copy of the 5001/5002 framing: those do
// data.toString().trim() and treat one TCP chunk as one message, so two rapid
// sends coalesce into "J01J02". Here we buffer and split on \n, with a short
// idle flush so socket_send_string (which appends nothing) still works.

const dishServer = net.createServer((socket) => {
  const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
  const srcIp = socket.remoteAddress
    ? socket.remoteAddress.replace(/^::ffff:/, "")
    : "unknown";

  state.dishSockets.add(socket);
  state.dishConnected = true;
  log("info", "dish", `Dish client connected: ${clientAddr}`);
  emitStatus();

  socket.setNoDelay(true);
  socket.setKeepAlive(true, 30000); // reap half-open sockets after a robot power cycle

  let buffer = "";
  let idleTimer = null;

  const handle = (line) => {
    const result = recordDish(line, srcIp);
    // Always ACK OK to the robot: the URScript has no error branch, and a stray
    // row beats someone debugging a stalled program at 2am. IGN is for humans
    // testing with nc.
    socket.write(result.action === "ignored" ? "IGN\n" : "OK\n");
  };

  const drain = (force) => {
    let i;
    while ((i = buffer.indexOf("\n")) !== -1) {
      handle(buffer.slice(0, i));
      buffer = buffer.slice(i + 1);
    }
    if (force && buffer.trim()) {
      handle(buffer);
      buffer = "";
    }
  };

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf-8");

    if (buffer.length > CONFIG.dishMaxLineBytes) {
      log(
        "error",
        "dish",
        `Oversized payload from ${clientAddr} (${buffer.length}B) — discarded`,
      );
      buffer = "";
      socket.write("ERR overflow\n");
      return;
    }

    drain(false);

    if (idleTimer) clearTimeout(idleTimer);
    if (buffer.length) {
      idleTimer = setTimeout(() => {
        idleTimer = null;
        drain(true);
      }, CONFIG.dishIdleFlushMs);
    }
  });

  let torn = false;
  const teardown = (errMessage) => {
    if (torn) return;
    torn = true;
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    // Drain before deregistering: a send immediately followed by socket_close
    // must still record the dish when the FIN lands inside the idle window.
    drain(true);
    state.dishSockets.delete(socket);
    state.dishConnected = state.dishSockets.size > 0;
    if (errMessage) {
      log("error", "dish", `Dish socket error (${clientAddr}): ${errMessage}`);
    } else {
      log("info", "dish", `Dish client disconnected: ${clientAddr}`);
    }
    emitStatus();
  };

  socket.on("end", () => teardown(null));
  socket.on("close", () => teardown(null));
  socket.on("error", (err) => teardown(err.message));
});

// Neither existing TCP server has a listen-error handler; without this an
// EADDRINUSE on 5003 would take down the whole bridge.
dishServer.on("error", (err) => {
  log("error", "server", `Dish log server error: ${err.message}`);
});

dishServer.listen(CONFIG.dishPort, "0.0.0.0", () => {
  log("info", "server", `Dish log server listening on port ${CONFIG.dishPort}`);
});

// ============================================================================
// HTTP + WEBSOCKET SERVER FOR WEB DASHBOARD
// ============================================================================

app.get("/api/status", (req, res) => {
  res.json(emitStatus());
});

app.post("/api/command", async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: "Command required" });

  log("command", "dashboard", `Test command: ${command}`);
  const response = await sendToPipette(command);
  res.json(response);
});

// --- Dish log -------------------------------------------------------------
// NOTE: these MUST stay above the app.get("*") SPA catch-all below, or every
// one of them returns index.html with a 200.

app.get("/api/dishlog/events", (req, res) => {
  const { from, to, jig, order } = req.query;
  const rangeError = validateDishRange(from, to);
  if (rangeError) return res.status(400).json({ error: rangeError });

  let limit = DISH_LIMIT_DEFAULT;
  if (req.query.limit !== undefined) {
    limit = Number.parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit < 1) {
      return res.status(400).json({ error: `Invalid limit: ${req.query.limit}` });
    }
    limit = Math.min(limit, DISH_LIMIT_MAX);
  }

  const result = dishEventsInRange({
    from,
    to,
    jig,
    limit,
    order: order === "asc" ? "asc" : "desc",
  });

  res.json({
    tz: SERVER_TZ,
    from: from || null,
    to: to || null,
    jig: jig || null,
    order: order === "asc" ? "asc" : "desc",
    count: result.events.length,
    truncated: result.truncated,
    source: result.source,
    events: result.events,
  });
});

app.get("/api/dishlog/summary", (req, res) => {
  const { from, to } = req.query;
  const rangeError = validateDishRange(from, to);
  if (rangeError) return res.status(400).json({ error: rangeError });
  res.json(dishSummary({ from, to }));
});

app.get("/api/dishlog/throughput", (req, res) => {
  const { from, to, bucket } = req.query;
  const rangeError = validateDishRange(from, to);
  if (rangeError) return res.status(400).json({ error: rangeError });
  res.json(dishThroughput({ bucket, from, to }));
});

app.get("/api/dishlog/export.csv", (req, res) => {
  const { from, to, jig } = req.query;
  const rangeError = validateDishRange(from, to);
  if (rangeError) return res.status(400).json({ error: rangeError });

  const predicate = dishRangeFilter({ from, to, jig });
  const name = `dishlog_${from || "start"}_${to || "now"}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.write(
    "seq,ts,day,time_local,jig_id,operator,cycle_ms,cycle_mmss,status,raw,src\n",
  );

  // Streamed month by month — never build the whole body in memory.
  let files = [];
  try {
    files = dishLogFiles();
  } catch (err) {
    log("error", "dish", `CSV export could not list files: ${err.message}`);
  }

  for (const fileName of files) {
    let lines;
    try {
      lines = fs
        .readFileSync(path.join(DISH_DATA_DIR, fileName), "utf8")
        .split("\n");
    } catch (err) {
      log("error", "dish", `CSV export could not read ${fileName}: ${err.message}`);
      continue;
    }
    for (const raw of lines) {
      if (!raw) continue;
      let rec;
      try {
        rec = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!predicate(rec)) continue;
      res.write(
        [
          rec.seq,
          rec.ts,
          rec.day,
          new Date(rec.ts).toLocaleTimeString("en-GB", {
            timeZone: SERVER_TZ,
            hour12: false,
          }),
          rec.jigId,
          rec.operator,
          rec.cycleMs,
          formatCycleMmss(rec.cycleMs),
          rec.status,
          rec.raw,
          rec.src,
        ]
          .map(dishCsvValue)
          .join(",") + "\n",
      );
    }
  }

  res.end();
});

app.get("/api/dishlog/stats", (req, res) => {
  let files = [];
  try {
    files = dishLogFiles().map((name) => ({
      name,
      bytes: fs.statSync(path.join(DISH_DATA_DIR, name)).size,
    }));
  } catch {
    // data dir unreadable — report what we have
  }

  res.json({
    loaded: dishLog.loaded,
    total: dishLog.total,
    inMemory: dishLog.events.length,
    droppedFromMemory: dishLog.droppedFromMemory,
    lastSeq: dishLog.lastSeq,
    activeMonth: dishLog.activeMonth,
    files,
    parseErrors: dishLog.parseErrors,
    writeErrors: dishLog.writeErrors,
    suspect: dishLog.suspect,
    ignored: dishLog.ignored,
    dedup: dishLog.dedup,
    clockWarning: dishLog.clockWarning,
    tz: SERVER_TZ,
    bootId: BOOT_ID,
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "dist", "index.html"));
});

io.on("connection", (socket) => {
  log("info", "dashboard", `Web client connected: ${socket.id}`);

  // Send initial status and pipette list
  socket.emit("status", emitStatus());
  socket.emit(
    "pipettes-list",
    pipetteRegistry.discovered.map((p) => ({
      model: p.model,
      port: p.port,
      connected: p.connected,
    })),
  );
  socket.emit("active-pipette", pipetteRegistry.activeModel);
  socket.emit("dish-snapshot", {
    events: dishLog.events.slice(-DISH_SNAPSHOT_N).reverse(), // newest-first
    stats: dishStatsPayload(),
  });

  socket.on("disconnect", () => {
    log("info", "dashboard", `Web client disconnected: ${socket.id}`);
  });

  // Pipette selection from dashboard
  socket.on("select-pipette", (model) => {
    log("info", "dashboard", `Selecting pipette: ${model}`);
    const pipette = pipetteRegistry.discovered.find((p) => p.model === model);
    if (pipette) {
      pipetteRegistry.activeModel = model;
      io.emit("active-pipette", model);
      log("info", "server", `Active pipette changed to: ${model}`);
    } else {
      log("error", "dashboard", `Pipette not found: ${model}`);
    }
  });

  // Test command from dashboard
  socket.on("send-command", async (command) => {
    log("command", "dashboard", `Test command: ${command}`);
    const response = await sendToPipette(command);
    socket.emit("command-response", response);
  });

  // Dashboard server connection
  socket.on("dashboard-connect", async (robotIp) => {
    try {
      await connectToDashboard(robotIp);
      socket.emit("dashboard-command-response", {
        success: true,
        response: `Connected to ${robotIp}`,
      });
    } catch (err) {
      socket.emit("dashboard-command-response", {
        success: false,
        error: err.message,
      });
    }
  });

  socket.on("dashboard-disconnect", () => {
    disconnectFromDashboard();
    socket.emit("dashboard-command-response", {
      success: true,
      response: "Disconnected",
    });
  });

  socket.on("dashboard-command", async (command) => {
    try {
      const result = await sendDashboardCommand(command);
      socket.emit("dashboard-command-response", result);
    } catch (err) {
      socket.emit("dashboard-command-response", {
        success: false,
        error: err.message,
      });
    }
  });
});

httpServer.listen(CONFIG.httpPort, () => {
  log(
    "info",
    "server",
    `HTTP + WebSocket server listening on port ${CONFIG.httpPort}`,
  );
  log(
    "info",
    "server",
    `Dashboard available at: http://localhost:${CONFIG.httpPort}`,
  );
});

// ============================================================================
// STARTUP
// ============================================================================

async function startServer() {
  log("info", "server", "=".repeat(60));
  log("info", "server", "Pipette Bridge Server Starting");
  log("info", "server", "=".repeat(60));
  log("info", "server", `TCP port (robot): ${CONFIG.tcpPort}`);
  log("info", "server", `QR port: ${CONFIG.qrPort}`);
  log("info", "server", `Dish log port: ${CONFIG.dishPort}`);
  log("info", "server", `HTTP port (dashboard): ${CONFIG.httpPort}`);
  log(
    "info",
    "server",
    `Dish log: ${dishLog.total} events loaded, ` +
      `${dishLog.totalsByJig.size} jig(s), last seq ${dishLog.lastSeq}` +
      (dishLog.parseErrors
        ? `, ${dishLog.parseErrors} unparseable line(s) skipped`
        : ""),
  );
  if (dishLog.clockWarning) {
    log(
      "error",
      "server",
      "Dish log: newest record is in the future — system clock may be unsynced (no RTC?)",
    );
  }
  log("info", "server", "=".repeat(60));

  const discovered = await discoverPipettes();
  pipetteRegistry.discovered = discovered;

  if (discovered.length === 0) {
    log("error", "server", "No pipettes discovered! Please check connections.");
    log(
      "info",
      "server",
      `Server will continue running and rescan every ${CONFIG.pipetteRescanMs / 1000}s...`,
    );
  } else {
    await connectAllPipettes();

    log("info", "server", "=".repeat(60));
    log("info", "server", "Pipette Summary:");
    for (const p of pipetteRegistry.discovered) {
      log("info", "server", `  - ${p.model} on ${p.port}`);
    }
    log("info", "server", `Active pipette: ${pipetteRegistry.activeModel}`);
    log("info", "server", "=".repeat(60));
  }

  scheduleRescan(CONFIG.pipetteRescanMs);
}

startServer();

// Graceful shutdown. systemd sends SIGTERM (see README "Run as a Service"), so a
// SIGINT-only handler never fires in production.
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimeout(rescan.timer);
  log("info", "server", "Shutting down...");
  for (const p of pipetteRegistry.discovered) {
    if (p.serialPort && p.serialPort.isOpen) {
      p.serialPort.close();
    }
  }
  tcpServer.close();
  qrServer.close();
  dishServer.close();
  closeDishLog();
  httpServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
