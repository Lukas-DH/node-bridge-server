// Matches CommunicationLogs.jsx's time formatting so the two logs read the same.
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", { hour12: false });
}

function formatDay(day) {
  return day ? day.slice(5) : "";
}

export function formatCycle(ms) {
  if (ms === null || ms === undefined) return "—";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function DishLogTable({ events, tz }) {
  if (!events.length) {
    return (
      <div className="response-empty">
        No dishes recorded in this range yet.
      </div>
    );
  }

  return (
    <div className="dishlog-table-wrap">
      <table className="dishlog-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Time{tz ? ` (${tz})` : ""}</th>
            <th>Jig</th>
            <th className="dishlog-num">Cycle</th>
            <th>Operator</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const mismatch = e.meta && e.meta.qr;
            const suspect = e.status === "suspect";
            return (
              <tr
                key={e.seq}
                className={suspect ? "dishlog-row-suspect" : undefined}
              >
                <td className="dishlog-num dishlog-seq">{e.seq}</td>
                <td>{formatDay(e.day)}</td>
                <td>{formatTime(e.ts)}</td>
                <td>
                  <span className="dishlog-jig">{e.jigId}</span>
                  {suspect && (
                    <span
                      className="dishlog-flag"
                      title={`Unrecognised value, excluded from totals: ${e.raw}`}
                    >
                      suspect
                    </span>
                  )}
                  {mismatch && (
                    <span
                      className="dishlog-flag"
                      title={`Vision sensor saw "${e.meta.qr}" in the workspace`}
                    >
                      QR {e.meta.qr}
                    </span>
                  )}
                </td>
                <td className="dishlog-num">{formatCycle(e.cycleMs)}</td>
                <td>{e.operator || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DishLogTable;
