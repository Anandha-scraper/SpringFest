import { useCallback } from "react";
import { Link } from "react-router-dom";
import { getEvents, getMyRegistrations } from "../../api/client.js";
import EventCard from "../../components/EventCard.jsx";
import { useApi } from "../../hooks/useApi.js";

const load = () => Promise.all([getEvents(), getMyRegistrations()]);

export default function ParticipantHome() {
  const fetcher = useCallback(load, []);
  const { data, error, loading } = useApi(fetcher);
  const [events, registrations] = data || [[], []];

  if (loading) return <div className="spinner" />;
  if (error) return <p className="error">{error}</p>;

  // One lookup for "have I already signed up for this?", so each tile can
  // show a status instead of inviting a duplicate registration the API would
  // reject anyway.
  const mine = new Map(registrations.map((r) => [r.event_id, r]));
  const registered = events.filter((e) => mine.has(e.id));
  const open = events.filter((e) => !mine.has(e.id));

  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <span className="eyebrow">Your fest</span>
          <h1>Overview</h1>
          <p className="muted">
            Everything running at Spring Fest. Pick an event to register — you'll find
            your entry passes under My Registrations.
          </p>
        </div>
      </div>

      {!!registered.length && (
        <section className="admin-panel">
          <div className="panel-head">
            <h2>You're registered for</h2>
            <span className="muted">{registered.length}</span>
          </div>
          <div className="grid">
            {registered.map((e) => (
              <EventCard key={e.id} event={e} registration={mine.get(e.id)} />
            ))}
          </div>
        </section>
      )}

      <section className="admin-panel">
        <div className="panel-head">
          <h2>{registered.length ? "More events" : "Events"}</h2>
          <span className="muted">{open.length} open</span>
        </div>

        {!events.length ? (
          <p className="empty-state">
            No events published yet — check back once the organisers add them.
          </p>
        ) : !open.length ? (
          <p className="empty-state">
            You've registered for everything on offer. See your passes under{" "}
            <Link to="/participant/registrations">My Registrations</Link>.
          </p>
        ) : (
          <div className="grid">
            {open.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
