import { useEffect, useMemo, useState } from "react";
import { getEvents } from "../api/client.js";
import EventCard from "../components/EventCard.jsx";
import { fest } from "../content/fest.js";

const FEE_FILTERS = [
  { key: "all", label: "All" },
  { key: "free", label: "Free" },
  { key: "paid", label: "Paid" },
];

export default function Events() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [fee, setFee] = useState("all");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .catch((e) => {
        setError(e.message);
        setEvents([]);
      });
  }, []);

  const categories = useMemo(() => {
    if (!events) return [];
    return [...new Set(events.map((e) => e.category).filter(Boolean))];
  }, [events]);

  const filtered = useMemo(() => {
    if (!events) return [];
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (fee === "free" && e.fee > 0) return false;
      if (fee === "paid" && !(e.fee > 0)) return false;
      if (category !== "all" && e.category !== category) return false;
      if (!q) return true;
      return (
        e.name?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q)
      );
    });
  }, [events, query, fee, category]);

  return (
    <div className="container page-pad">
      <div className="section-head">
        <span className="eyebrow">{fest.dates}</span>
        <h2>All Events</h2>
        <p>
          {events === null
            ? "Loading the line-up…"
            : `${filtered.length} of ${events.length} events`}
        </p>
      </div>

      <div className="filter-bar">
        <input
          className="input"
          type="search"
          placeholder="Search events…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="chips">
          {FEE_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`chip ${fee === f.key ? "active" : ""}`}
              onClick={() => setFee(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <div className="chips">
            <button
              className={`chip ${category === "all" ? "active" : ""}`}
              onClick={() => setCategory("all")}
            >
              All tracks
            </button>
            {categories.map((c) => (
              <button
                key={c}
                className={`chip ${category === c ? "active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="error">
          Couldn't load events — {error}. Is the backend running?
        </p>
      )}

      {events === null ? (
        <div className="spinner" />
      ) : filtered.length === 0 ? (
        <p className="empty-state">No events match your filters.</p>
      ) : (
        <div className="grid">
          {filtered.map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      )}
    </div>
  );
}
