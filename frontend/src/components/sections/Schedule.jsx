import { useState } from "react";
import { fest } from "../../content/fest.js";

export default function Schedule() {
  const [active, setActive] = useState(0);
  const day = fest.schedule[active];

  return (
    <section id="schedule" className="section">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Three days</span>
          <h2>Schedule</h2>
          <p>{fest.dates} · {fest.venue}</p>
        </div>

        <div className="day-tabs">
          {fest.schedule.map((d, i) => (
            <button
              key={d.day}
              className={`day-tab ${i === active ? "active" : ""}`}
              onClick={() => setActive(i)}
            >
              <strong>{d.day}</strong>
              <span>{d.date}</span>
            </button>
          ))}
        </div>

        <ol className="timeline">
          {day.items.map((item) => (
            <li key={`${day.day}-${item.time}-${item.title}`} className="timeline-item">
              <span className="timeline-time">{item.time}</span>
              <span className="timeline-dot" aria-hidden="true" />
              <div className="timeline-body">
                <h3>{item.title}</h3>
                <p className="muted">{item.venue}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
