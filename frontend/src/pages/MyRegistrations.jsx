import { useEffect, useState } from "react";
import { getMyRegistrations } from "../api/client.js";

export default function MyRegistrations() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyRegistrations().then(setItems).catch((e) => setError(e.message));
  }, []);

  return (
    <main className="container">
      <h1>My Registrations</h1>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {items.map((r) => (
          <div className="card" key={r.id}>
            <h3>{r.event_id}</h3>
            <p>Status: {r.status}</p>
            <div className="card-meta">
              <span>{r.fee > 0 ? `₹${r.fee}` : "Free"}</span>
              <span>{r.id}</span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
