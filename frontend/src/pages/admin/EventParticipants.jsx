import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatCard from "../../components/admin/StatCard.jsx";
import RegistrationsTable from "../../components/admin/RegistrationsTable.jsx";
import { getEventParticipants, downloadRegistrationsCsv } from "../../api/client.js";

export default function EventParticipants() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setData(null);
    getEventParticipants(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadRegistrationsCsv({ event_id: id });
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  if (error) {
    return (
      <div className="container page-pad">
        <p className="error">{error}</p>
        <Link to="/admin" className="btn btn-ghost">← Back to dashboard</Link>
      </div>
    );
  }

  if (!data) return <div className="spinner" />;

  return (
    <div className="admin">
      <Link to="/admin" className="back-link">← Back to dashboard</Link>

      <div className="admin-head">
        <div>
          <span className="eyebrow">Event participants</span>
          <h1>{data.event.name}</h1>
          <p className="muted">
            {data.event.date}
            {data.event.fee > 0 ? ` · ₹${data.event.fee} entry` : " · Free entry"}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={handleExport} disabled={exporting}>
          {exporting ? "Preparing…" : "⤓ Export CSV"}
        </button>
      </div>

      <div className="stat-cards">
        <StatCard label="Registered" value={data.total} />
        <StatCard label="Confirmed" value={data.confirmed} tone="ok" />
        <StatCard label="Revenue" value={data.revenue} prefix="₹" tone="accent" />
      </div>

      <section className="admin-panel">
        <h2>Participants</h2>
        <RegistrationsTable rows={data.participants} showEvent={false} />
      </section>
    </div>
  );
}
