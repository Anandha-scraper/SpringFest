import { Link } from "react-router-dom";

export default function EventCard({ event }) {
  return (
    <div className="card event-tile">
      {event.category && <span className="tag">{event.category}</span>}
      <h3>{event.name}</h3>
      <p>{event.description}</p>
      <div className="card-meta">
        <span>{event.date}</span>
        <span className="price">{event.fee > 0 ? `₹${event.fee}` : "Free"}</span>
      </div>
      <Link className="btn btn-sm" to={`/events/${event.id}`}>
        Register
      </Link>
    </div>
  );
}
