import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SpotlightCard from "../reactbits/SpotlightCard.jsx";
import AnimatedContent from "../reactbits/AnimatedContent.jsx";
import { getEvents } from "../../api/client.js";
import { fest } from "../../content/fest.js";

export default function EventsPreview() {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    getEvents()
      .then((list) => setEvents(list.slice(0, 6)))
      .catch(() => setEvents([])); // fall back to placeholder categories
  }, []);

  const liveEvents = events && events.length > 0;

  return (
    <section id="events" className="section section-tint">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Compete</span>
          <h2>Events &amp; Competitions</h2>
          <p>
            {liveEvents
              ? "Pick your arena. Register online and get your entry pass instantly."
              : "Across three tracks, with something for every kind of student."}
          </p>
        </div>

        <div className="grid">
          {liveEvents
            ? events.map((ev, i) => (
                <AnimatedContent key={ev.id} distance={50} duration={0.7} delay={0.06 * i}>
                  <Link to={`/events/${ev.id}`} className="event-link">
                    <SpotlightCard className="event-card" spotlightColor="rgba(242, 120, 159, 0.18)">
                      <h3>{ev.name}</h3>
                      <p>{ev.description}</p>
                      <div className="card-meta">
                        <span>{ev.date}</span>
                        <span className="price">{ev.fee > 0 ? `₹${ev.fee}` : "Free"}</span>
                      </div>
                    </SpotlightCard>
                  </Link>
                </AnimatedContent>
              ))
            : fest.eventCategories.map((c, i) => (
                <AnimatedContent key={c.name} distance={50} duration={0.7} delay={0.08 * i}>
                  <SpotlightCard className="event-card" spotlightColor="rgba(242, 120, 159, 0.18)">
                    <h3>{c.name}</h3>
                    <p>{c.description}</p>
                    <div className="card-meta">
                      <span>{c.count} events</span>
                    </div>
                  </SpotlightCard>
                </AnimatedContent>
              ))}
        </div>

        <div className="center" style={{ marginTop: 40 }}>
          <Link to="/events" className="btn">Browse all events</Link>
        </div>
      </div>
    </section>
  );
}
