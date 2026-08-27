import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../../components/admin/StatCard.jsx";
import RegistrationsTable from "../../components/admin/RegistrationsTable.jsx";
import {
  getAdminStats,
  getAdminRegistrations,
  downloadRegistrationsCsv,
} from "../../api/client.js";

const STATUSES = ["all", "confirmed", "pending", "failed"];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [eventId, setEventId] = useState("all");

  useEffect(() => {
    Promise.all([getAdminStats(), getAdminRegistrations()])
      .then(([s, r]) => {
        setStats(s);
        setRows(r);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (eventId !== "all" && r.event_id !== eventId) return false;
      if (!q) return true;
      return [r.name, r.email, r.phone, r.college, r.event_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, query, status, eventId]);

  const handleExport = async () => {
    setExporting(true);
    setError("");
    try {
      await downloadRegistrationsCsv({
        status: status === "all" ? "" : status,
        event_id: eventId === "all" ? "" : eventId,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="spinner" />;

  const maxCount = Math.max(1, ...(stats?.per_event || []).map((e) => e.count));

  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <span className="eyebrow">Organiser view</span>
          <h1>Admin Dashboard</h1>
          <p className="muted">Registrations, payments and participation at a glance.</p>
        </div>
        <button className="btn btn-ghost" onClick={handleExport} disabled={exporting}>
          {exporting ? "Preparing…" : "⤓ Export CSV"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="stat-cards">
        <StatCard label="Total Registrations" value={stats?.total} />
        <StatCard label="Confirmed" value={stats?.confirmed} tone="ok" />
        <StatCard label="Pending" value={stats?.pending} tone="warn" />
        <StatCard label="Revenue Collected" value={stats?.revenue} prefix="₹" tone="accent" />
      </div>

      <section className="admin-panel">
        <h2>Participation by event</h2>
        {!stats?.per_event?.length ? (
          <p className="empty-state">No registrations yet.</p>
        ) : (
          <div className="bars">
            {stats.per_event.map((e) => (
              <Link key={e.event_id} to={`/admin/events/${e.event_id}`} className="bar-row">
                <span className="bar-name">{e.name}</span>
                <span className="bar-track">
                  <span
                    className="bar-fill"
                    style={{ width: `${(e.count / maxCount) * 100}%` }}
                  />
                </span>
                <span className="bar-count">
                  <strong>{e.count}</strong>
                  <span className="cell-sub">{e.confirmed} paid · ₹{e.revenue}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="panel-head">
          <h2>All registrations</h2>
          <span className="muted">{filtered.length} shown</span>
        </div>

        <div className="filter-bar">
          <input
            className="input"
            type="search"
            placeholder="Search name, email, phone, college…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="all">All events</option>
            {(stats?.per_event || []).map((e) => (
              <option key={e.event_id} value={e.event_id}>{e.name}</option>
            ))}
          </select>
        </div>

        <RegistrationsTable rows={filtered} />
      </section>
    </div>
  );
}
