import { Link } from "react-router-dom";

export default function EventCard({ event }) {
  return (
    <div className="card">
      <h3>{event.name}</h3>
      <p>{event.description}</p>
      <div className="card-meta">
        <span>{event.date}</span>
        <span>{event.fee > 0 ? `₹${event.fee}` : "Free"}</span>
      </div>
      <Link className="btn" to={`/events/${event.id}`}>
        Register
      </Link>
    </div>
  );
}
