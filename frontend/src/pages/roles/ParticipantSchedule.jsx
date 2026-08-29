import { useCallback } from "react";
import { Calendar, MapPin } from "lucide-react";
import { getSchedule } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { formatEventTime } from "../../lib/format.js";

const load = () => getSchedule();

export default function ParticipantSchedule() {
  const { data, error, loading } = useApi(useCallback(load, []));

  if (loading) return <div className="spinner" />;
  if (error) return <p className="error">{error}</p>;

  const events = data || [];

  return (
    <section className="admin-panel">
      <div className="panel-head">
        <h2>Schedule</h2>
        <span className="muted">{events.length} events</span>
      </div>

      {!events.length ? (
        <p className="empty-state">No events published yet — check back once the organisers add them.</p>
      ) : (
        <ul className="schedule-list">
          {events.map((e) => (
            <li className="schedule-row" key={e.id}>
              <strong className="schedule-name">{e.name}</strong>
              <span className="schedule-meta">
                <Calendar size={14} aria-hidden="true" />
                {formatEventTime(e) || "Date to be announced"}
              </span>
              {e.venue_name && (
                <span className="schedule-meta">
                  <MapPin size={14} aria-hidden="true" />
                  {e.venue_name}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
