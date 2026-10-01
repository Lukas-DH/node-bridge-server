import { useState } from "react";

// Column chart, not a line: a line implies continuity between buckets and
// visually interpolates across idle hours, which for a machine that stops
// overnight is actively misleading. Zero-filled buckets render as empty slots so
// downtime reads as a gap.
//
// Single series => one colour => no legend (the panel heading names it).
// #3987e5 is validated against the #2a2a2a card surface (lightness band, chroma
// floor and >= 3:1 contrast all pass). The app's #4a9eff fails the band for
// marks, so it stays on the status pills.
const BAR = "#3987e5";
const BAR_HOVER = "#5ba0f0";
const GRID = "#3a3a3a";
const INK_MUTED = "#888";
const INK = "#e0e0e0";

const VB_W = 960;
const VB_H = 240;
const PAD = { top: 18, right: 12, bottom: 30, left: 46 };
const PLOT_W = VB_W - PAD.left - PAD.right;
const PLOT_H = VB_H - PAD.top - PAD.bottom;

// Round axis maxima — never label a gridline 7.3333.
function niceTicks(max) {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  for (const step of steps) {
    const count = Math.ceil(max / step);
    if (count <= 4) {
      const top = step * count;
      const ticks = [];
      for (let v = 0; v <= top; v += step) ticks.push(v);
      return { top, ticks };
    }
  }
  const step = Math.ceil(max / 4);
  return { top: step * 4, ticks: [0, step, step * 2, step * 3, step * 4] };
}

function ThroughputChart({ points, bucket, tz }) {
  const [hover, setHover] = useState(null);

  if (!points || !points.length) {
    return (
      <div className="dishlog-chart-empty">No dishes in this range</div>
    );
  }

  const max = points.reduce((m, p) => (p.count > m ? p.count : m), 0);
  const { top, ticks } = niceTicks(max);
  const band = PLOT_W / points.length;
  const barW = Math.max(1, Math.min(24, band - 2)); // 2px surface gap between bars

  // Thin x labels so they can never collide.
  const labelEvery = Math.max(1, Math.ceil(points.length / 14));
  const peakIndex = max > 0 ? points.findIndex((p) => p.count === max) : -1;

  const xOf = (i) => PAD.left + i * band + (band - barW) / 2;
  const yOf = (v) => PAD.top + PLOT_H - (v / top) * PLOT_H;

  const hovered = hover !== null ? points[hover] : null;

  return (
    <div className="dishlog-chart">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Dishes per ${bucket}, ${points.length} buckets, peak ${max}`}
      >
        {/* Recessive gridlines: 1px solid, one step off the surface, never dashed */}
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={VB_W - PAD.right}
              y1={yOf(v)}
              y2={yOf(v)}
              stroke={GRID}
              strokeWidth="1"
            />
            <text
              x={PAD.left - 10}
              y={yOf(v) + 4}
              textAnchor="end"
              fill={INK_MUTED}
              fontSize="12"
            >
              {v}
            </text>
          </g>
        ))}

        {points.map((p, i) => {
          const h = p.count > 0 ? PLOT_H - (yOf(p.count) - PAD.top) : 0;
          const x = xOf(i);
          const y = yOf(p.count);
          const isHover = hover === i;
          return (
            <g key={p.t}>
              {/* Hit target spans the whole band and full height — bigger than the mark */}
              <rect
                x={PAD.left + i * band}
                y={PAD.top}
                width={band}
                height={PLOT_H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {p.count > 0 && (
                <path
                  d={`M${x},${y + h} L${x},${y + 4}
                      Q${x},${y} ${x + 4},${y}
                      L${x + barW - 4},${y}
                      Q${x + barW},${y} ${x + barW},${y + 4}
                      L${x + barW},${y + h} Z`}
                  fill={isHover ? BAR_HOVER : BAR}
                  pointerEvents="none"
                />
              )}
              {i % labelEvery === 0 && (
                <text
                  x={PAD.left + i * band + band / 2}
                  y={VB_H - 10}
                  textAnchor="middle"
                  fill={INK_MUTED}
                  fontSize="11"
                  pointerEvents="none"
                >
                  {p.label}
                </text>
              )}
              {/* Direct-label the peak only — never a number on every bar */}
              {i === peakIndex && !isHover && (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fill={INK}
                  fontSize="12"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {p.count}
                </text>
              )}
            </g>
          );
        })}

        <line
          x1={PAD.left}
          x2={VB_W - PAD.right}
          y1={PAD.top + PLOT_H}
          y2={PAD.top + PLOT_H}
          stroke={GRID}
          strokeWidth="1"
        />
      </svg>

      {hovered && (
        <div
          className="dishlog-tooltip"
          style={{
            left: `${((PAD.left + hover * band + band / 2) / VB_W) * 100}%`,
            top: `${(yOf(hovered.count) / VB_H) * 100}%`,
          }}
        >
          <strong>{hovered.count}</strong>{" "}
          {hovered.count === 1 ? "dish" : "dishes"}
          <span className="dishlog-tooltip-sub">
            {hovered.label}
            {bucket === "hour" && tz ? ` · ${tz}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

export default ThroughputChart;
