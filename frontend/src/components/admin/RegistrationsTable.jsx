import StatusPill from "./StatusPill.jsx";

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

export default function RegistrationsTable({ rows, showEvent = true }) {
  if (!rows.length) return <p className="empty-state">No registrations match these filters.</p>;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Participant</th>
            <th>Contact</th>
            <th>College</th>
            {showEvent && <th>Event</th>}
            <th>Status</th>
            <th className="num">Amount</th>
            <th>Registered</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.name}</strong>
                <span className="cell-sub">{r.email}</span>
              </td>
              <td>{r.phone || "—"}</td>
              <td>{r.college || "—"}</td>
              {showEvent && <td>{r.event_name || r.event_id}</td>}
              <td><StatusPill status={r.status} /></td>
              <td className="num">{r.fee > 0 ? `₹${r.fee}` : "Free"}</td>
              <td className="cell-sub">{fmtDate(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
