import { useCallback } from "react";
import "@/styles/pages/admin/roles.css";
import { getEvents, getMe } from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { eventsOverlap, formatEventTime } from "@/utils/format.js";
import Loader from "@/components/common/Loader.jsx";

// GET /api/me carries the caller's own event_ids, so a judge can read their
// assignments without an admin-only endpoint.
const load = () => Promise.all([getMe(), getEvents()]);

export default function JudgeHome() {
  const fetcher = useCallback(load, []);
  const { data, error, loading } = useApi(fetcher);

  if (loading) return <Loader />;
  if (error) return <p className="error">{error}</p>;

  const [me, allEvents] = data;
  const events = (me.event_ids || [])
    .map((id) => allEvents.find((e) => e.id === id))
    .filter(Boolean)
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));

  return (
    <section className="admin-panel">
      <div className="panel-head">
        <h2>My assignments</h2>
        <span className="muted">{events.length} event{events.length === 1 ? "" : "s"}</span>
      </div>

      {!events.length ? (
        <p className="empty-state">No events assigned to you yet.</p>
      ) : (
        <ul className="assignment-list assignment-list-lg">
          {events.map((ev) => {
            // The API refuses to save a clash, so this should never fire — it's
            // here to surface one that predates the check rather than hide it.
            const clash = events.find((other) => other.id !== ev.id && eventsOverlap(ev, other));
            return (
              <li key={ev.id} className="assignment-chip">
                <span>
                  <strong>{ev.name}</strong>
                  <span className="cell-sub">
                    {ev.venue_name || "No venue"} · {formatEventTime(ev)}
                  </span>
                  {ev.category && <span className="tag">{ev.category}</span>}
                </span>
                {clash && (
                  <span className="pill pill-failed" title={`Overlaps with ${clash.name}`}>
                    conflict
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
