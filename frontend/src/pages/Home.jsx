import { useEffect, useState } from "react";
import { getEvents } from "../api/client.js";
import EventCard from "../components/EventCard.jsx";

export default function Home() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getEvents().then(setEvents).catch((e) => setError(e.message));
  }, []);

  return (
    <main className="container">
      <header className="hero">
        <h1>Symposium 2026</h1>
        <p>Register for events below</p>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {events.map((ev) => (
          <EventCard key={ev.id} event={ev} />
        ))}
      </div>
    </main>
  );
}
