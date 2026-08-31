import { useCallback } from "react";
import "@/styles/pages/admin/dashboard.css";
import { Link, useParams } from "react-router-dom";
import StatCard from "@/components/admin/StatCard.jsx";
import StatusPill from "@/components/admin/StatusPill.jsx";
import { downloadRegistrationsCsv, getEventParticipants, getEventResults } from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { formatDateTime, formatEventTime, rupees } from "@/utils/format.js";
import Loader from "@/components/common/Loader.jsx";

export default function EventParticipants() {
  const { id } = useParams();
  const fetcher = useCallback(() => getEventParticipants(id), [id]);
  const { data, error, loading } = useApi(fetcher);
  const resultsFetcher = useCallback(() => getEventResults(id), [id]);
  const { data: results } = useApi(resultsFetcher);

  if (loading) return <Loader />;
  if (error) {
    return (
      <div className="admin">
        <p className="error">{error}</p>
        <Link to="/admin" className="btn btn-ghost">← Back to dashboard</Link>
      </div>
    );
  }

  const { event } = data;

  return (
    <div className="admin">
      <Link to="/admin" className="back-link">← Back to dashboard</Link>

      <div className="admin-head">
        <div>
          <span className="eyebrow">Event participants</span>
          <h1>{event.name}</h1>
          <p className="muted">
            {formatEventTime(event)} · {event.venue_name || "No venue"}
            {event.fee > 0 ? ` · ${rupees(event.fee)} entry` : " · Free entry"}
          </p>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => downloadRegistrationsCsv({ event_id: id })}
        >
          Export CSV
        </button>
      </div>

      <div className="stat-cards">
        <StatCard label="Registered" value={data.total} />
        <StatCard label="Completed" value={data.completed} tone="ok" />
        <StatCard label="Checked in" value={data.checked_in} tone="warn" />
        <StatCard label="Revenue" value={data.revenue} prefix="₹" tone="accent" />
      </div>

      <section className="admin-panel">
        <h2>Participants</h2>
        {/* Per-event, so this stays one row per registration — unlike the
            Registrations page, which pivots to one row per person. */}
        {!data.participants.length ? (
          <p className="empty-state">Nobody has registered for this event yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Contact</th>
                  <th>College</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Checked in</th>
                  <th className="num">Amount</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {data.participants.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <span className="cell-sub">{r.email}</span>
                    </td>
                    <td>{r.phone || "—"}</td>
                    <td>{r.college || "—"}</td>
                    <td>
                      {r.team_name || "—"}
                      {r.team_size > 1 && <span className="cell-sub">{r.team_size} members</span>}
                    </td>
                    <td><StatusPill status={r.status} /></td>
                    <td>{r.checked_in ? "Yes" : "No"}</td>
                    <td className="num">{r.fee > 0 ? rupees(r.fee) : "Free"}</td>
                    <td className="cell-sub">{formatDateTime(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <h2>Judging results</h2>
        {!results || !results.results.length ? (
          <p className="empty-state">No teams have been evaluated yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th className="num">Average</th>
                  <th>Scores</th>
                </tr>
              </thead>
              <tbody>
                {results.results.map((r) => (
                  <tr key={r.registration_id}>
                    <td>{r.rank ?? "—"}</td>
                    <td>
                      <strong>{r.team_name || r.lead_name}</strong>
                      {r.allocation_codes?.length > 0 && (
                        <span className="cell-sub">{r.allocation_codes.join(", ")}</span>
                      )}
                    </td>
                    <td className="num">
                      {r.average === null ? "—" : r.average.toFixed(1)} / {results.event.criteria_total}
                    </td>
                    <td>
                      {r.evaluations.length === 0 ? (
                        <span className="muted">not scored</span>
                      ) : (
                        <ul className="cell-sub" style={{ margin: 0, paddingLeft: "1rem" }}>
                          {r.evaluations.map((e, i) => (
                            <li key={i}>
                              {e.judge_name}: <strong>{e.total}</strong>
                              {e.note ? ` — "${e.note}"` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
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
