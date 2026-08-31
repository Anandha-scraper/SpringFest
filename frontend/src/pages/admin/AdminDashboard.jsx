import { useCallback } from "react";
import "@/styles/pages/admin/dashboard.css";
import { Link } from "react-router-dom";
import Loader from "@/components/common/Loader.jsx";
import StatCard from "@/components/admin/StatCard.jsx";
import ParticipationChart from "@/components/admin/ParticipationChart.jsx";
import { getAdminStats, getAuthUsers, getVenueRollup } from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";

const load = () => Promise.all([getAdminStats(), getAuthUsers(), getVenueRollup()]);

export default function AdminDashboard() {
  const fetcher = useCallback(load, []);
  const { data, error, loading } = useApi(fetcher);
  const [stats, authUsers, venues] = data || [];

  if (loading) return <Loader />;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="admin">
      {/* Headline numbers down the left, chart filling the right. */}
      <div className="overview-grid">
        <div className="stat-cards">
          {/* Sign-ins, not registration rows: every non-staff Google account. */}
          <StatCard label="Signed-in Users" value={authUsers?.participants ?? stats.signed_users} />
          {/* People, not rows: someone who enters four events is one signed user. */}
          <StatCard label="Registered Users" value={stats.signed_users} />
          {/* Evaluated — not "paid". Reads 0 until scoring starts writing
              evaluated_at, so it says so rather than looking like a broken
              number mid-fest. */}
          <StatCard
            label="Completed"
            value={stats.evaluated_users}
            tone="ok"
            note={stats.evaluated_users ? "" : "Judging hasn't started yet"}
          />
          <StatCard label="Revenue Collected" value={stats.revenue} prefix="₹" tone="accent" />
        </div>

        <section className="admin-panel">
          <div className="panel-head">
            <h2>Participation by event</h2>
            <Link to="/admin/registrations" className="btn btn-ghost btn-sm">
              View all registrations
            </Link>
          </div>
          {!stats.per_event.length ? (
            <p className="empty-state">No events yet. Create one from the Events page.</p>
          ) : (
            <ParticipationChart data={stats.per_event} />
          )}
        </section>
      </div>

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
