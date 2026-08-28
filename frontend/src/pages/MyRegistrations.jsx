import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyRegistrations } from "../api/client.js";
import StatusPill from "../components/admin/StatusPill.jsx";

export default function MyRegistrations() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyRegistrations()
      .then(setItems)
      .catch((e) => {
        setError(e.message);
        setItems([]);
      });
  }, []);

  return (
    <div className="container page-pad">
      <div className="section-head">
        <span className="eyebrow">Your fest</span>
        <h2>My Registrations</h2>
        <p>Everything you've signed up for, with payment status.</p>
      </div>

      {error && <p className="error">{error}</p>}

      {items === null ? (
        <div className="spinner" />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p style={{ marginBottom: 20 }}>You haven't registered for any events yet.</p>
          <Link to="/#events" className="btn">Browse events</Link>
        </div>
      ) : (
        <div className="grid">
          {items.map((r) => (
            <div className="card" key={r.id}>
              <div className="card-meta" style={{ paddingTop: 0 }}>
                <StatusPill status={r.status} />
                <span className="price">{r.fee > 0 ? `₹${r.fee}` : "Free"}</span>
              </div>
              <h3>{r.event_name || r.event_id}</h3>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                Registration ID
                <br />
                <code style={{ fontSize: "0.82rem" }}>{r.id}</code>
              </p>
              {r.status === "pending" && (
                <Link className="btn btn-sm" to={`/events/${r.event_id}`}>
                  Complete payment
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
