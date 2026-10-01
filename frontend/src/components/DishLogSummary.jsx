function DishLogSummary({ summary, rangeLabel }) {
  if (!summary) return <div className="response-empty">Loading summary…</div>;

  const today = summary.today || { byJig: [], total: 0 };
  const range = summary.range;
  const allTime = summary.allTime || { byJig: [], total: 0 };

  const todayByJig = new Map(today.byJig.map((r) => [r.jigId, r.count]));
  const rangeByJig = new Map(
    (range ? range.byJig : []).map((r) => [r.jigId, r.count]),
  );

  // All-time ordering drives the rows, so a jig with no dishes today still shows.
  const rows = allTime.byJig.map((r) => ({
    jigId: r.jigId,
    today: todayByJig.get(r.jigId) || 0,
    range: rangeByJig.get(r.jigId) || 0,
    allTime: r.count,
    lastTs: r.lastTs,
  }));

  if (!rows.length) {
    return <div className="response-empty">No dishes recorded yet.</div>;
  }

  return (
    <div className="dishlog-table-wrap">
      <table className="dishlog-table">
        <thead>
          <tr>
            <th>Jig</th>
            <th className="dishlog-num">Today</th>
            {range && <th className="dishlog-num">{rangeLabel}</th>}
            <th className="dishlog-num">All time</th>
            <th>Last made</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.jigId}>
              <td>
                <span className="dishlog-jig">{r.jigId}</span>
              </td>
              <td className="dishlog-num">{r.today}</td>
              {range && <td className="dishlog-num">{r.range}</td>}
              <td className="dishlog-num">{r.allTime}</td>
              <td>
                {r.lastTs
                  ? new Date(r.lastTs).toLocaleString("en-GB", {
                      hour12: false,
                    })
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="dishlog-num">{today.total}</td>
            {range && <td className="dishlog-num">{range.total}</td>}
            <td className="dishlog-num">{allTime.total}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default DishLogSummary;
