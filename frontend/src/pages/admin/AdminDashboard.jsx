import { useCallback } from "react";
import { Link } from "react-router-dom";
import StatCard from "../../components/admin/StatCard.jsx";
import ParticipationChart from "../../components/admin/ParticipationChart.jsx";
import { getAdminStats, getVenueRollup } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";

const load = () => Promise.all([getAdminStats(), getVenueRollup()]);

export default function AdminDashboard() {
  const fetcher = useCallback(load, []);
  const { data, error, loading } = useApi(fetcher);
  const [stats, venues] = data || [];

  if (loading) return <div className="spinner" />;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <span className="eyebrow">Organiser view</span>
          <h1>Admin Dashboard</h1>
          <p className="muted">Registrations, payments and participation at a glance.</p>
        </div>
        <Link to="/admin/registrations" className="btn btn-ghost">
          View all registrations
        </Link>
      </div>

      <div className="stat-cards">
        {/* People, not rows: someone who enters four events is one signed user. */}
        <StatCard label="Signed Users" value={stats.signed_users} />
        <StatCard label="Completed" value={stats.completed_users} tone="ok" />
        <StatCard label="Revenue Collected" value={stats.revenue} prefix="₹" tone="accent" />
      </div>

      <section className="admin-panel">
        <div className="panel-head">
          <h2>Participation by event</h2>
          <Link to="/admin/events" className="btn btn-ghost btn-sm">Manage events</Link>
        </div>
        {!stats.per_event.length ? (
          <p className="empty-state">No events yet. Create one from the Events page.</p>
        ) : (
          <ParticipationChart data={stats.per_event} />
        )}
      </section>

      <section className="admin-panel">
        <div className="panel-head">
          <h2>Venues</h2>
          <Link to="/admin/allocations" className="btn btn-ghost btn-sm">Manage allocations</Link>
        </div>
        {!venues.length ? (
          <p className="empty-state">No venues yet. Add one from the Events page.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Event</th>
                  <th className="num">Registrations</th>
                  <th className="num">Checked in</th>
                  <th className="num">Completed</th>
                  <th>Judge</th>
                  <th>Volunteer</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((v) => (
                  <tr key={v.id}>
                    <td><strong>{v.name}</strong></td>
                    <td>
                      {v.event_id ? (
                        <Link to={`/admin/events/${v.event_id}`}>{v.event_name}</Link>
                      ) : (
                        <span className="cell-sub">No event assigned</span>
                      )}
                    </td>
                    <td className="num">{v.registrations}</td>
                    <td className="num">{v.checked_in}</td>
                    <td className="num">{v.completed}</td>
                    <td>{v.judges.join(", ") || <span className="cell-sub">—</span>}</td>
                    <td>{v.volunteers.join(", ") || <span className="cell-sub">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
