import { Link } from "react-router-dom";
import "@/styles/components/event-card.css";
import { MapPin } from "lucide-react";
import { formatEventDate, formatEventTimeRange } from "@/utils/format.js";
import StatusPill from "@/components/admin/StatusPill.jsx";

// En dash stands in for a cell we have no value for, so every card keeps the
// same four-row shape instead of collapsing.
const EMPTY = "–";

/**
 * One event as a fixed four-row card:
 *   category           venue
 *   name               time
 *   date  ───────────  amount
 *   status             action
 *
 * Used on the participant Overview and on My Registrations. Pass `registration`
 * for the status pill, `note` for a status-specific message under the card, and
 * `action` to replace the default footer link.
 */
export default function EventCard({ event = {}, registration, note, action }) {
  const fee = Number(event.fee || 0);
  const date = formatEventDate(event);
  const time = formatEventTimeRange(event);

  const defaultAction = registration ? (
    <Link className="btn btn-ghost btn-sm" to="/participant/registrations">
      {registration.status === "completed" ? "View pass" : "View"}
    </Link>
  ) : (
    <Link className="btn btn-sm" to={`/events/${event.id}`}>
      Register
    </Link>
  );

  return (
    <div className="event-card">
      <div className="event-card__row">
        <span className="tag">{event.category || "Event"}</span>
        <span className="event-card__meta event-card__venue">
          {event.venue_name ? (
            <>
              <MapPin size={13} aria-hidden="true" />
              {event.venue_name}
            </>
          ) : (
            EMPTY
          )}
        </span>
      </div>

      <div className="event-card__row">
        <h3 className="event-card__name">{event.name || event.event_id || "Event"}</h3>
        <span className="event-card__meta">{time || EMPTY}</span>
      </div>

      <div className="event-card__row event-card__row--rule">
        <span className="event-card__meta">{date || "Date TBA"}</span>
        <span className="price">{fee > 0 ? `₹${fee}` : "Free"}</span>
      </div>

      <div className="event-card__row event-card__foot">
        {registration ? <StatusPill status={registration.status} /> : <span />}
        {action || defaultAction}
      </div>

      {note ? <div className="event-card__note">{note}</div> : null}
    </div>
  );
}
