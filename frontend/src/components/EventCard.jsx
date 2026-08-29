import { Link } from "react-router-dom";
import { formatEventTime } from "../lib/format.js";
import StatusPill from "./admin/StatusPill.jsx";

/** One event tile. Pass `registration` to show where the signed-in user
 *  already stands with it instead of another Register link. */
export default function EventCard({ event, registration }) {
  return (
    <div className="card event-tile">
      {event.category && <span className="tag">{event.category}</span>}
      <h3>{event.name}</h3>
      <p>{event.description}</p>
      <div className="card-meta">
        <span>{formatEventTime(event) || "Date to be announced"}</span>
        <span className="price">{event.fee > 0 ? `₹${event.fee}` : "Free"}</span>
      </div>
      {event.venue_name && <p className="muted" style={{ fontSize: "0.85rem" }}>📍 {event.venue_name}</p>}

      {registration ? (
        <div className="card-meta" style={{ paddingTop: 0 }}>
          <StatusPill status={registration.status} />
          <Link className="btn btn-ghost btn-sm" to="/participant/registrations">
            {registration.status === "completed" ? "View pass" : "View"}
          </Link>
        </div>
      ) : (
        <Link className="btn btn-sm" to={`/events/${event.id}`}>
          Register
        </Link>
      )}
    </div>
  );
}
