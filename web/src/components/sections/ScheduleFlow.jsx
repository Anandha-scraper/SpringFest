"use client";

import { Clock, MapPin, Tag } from "lucide-react";
import Loader from "@/components/common/Loader.jsx";
import { useApi } from "@/hooks/useApi.js";
import { getEvents } from "@/api/client.js";
import { formatEventDate, formatEventTimeRange } from "@/utils/format.js";

/**
 * The landing schedule, built from the real events table rather than the
 * static `fest.schedule` placeholder.
 *
 * Events without a `date` are dropped (they aren't schedulable yet); the rest
 * are sorted by date + start_time and grouped into one column per distinct
 * date, labelled "Day 1", "Day 2", … in chronological order.
 *
 * There is deliberately NO fallback to `fest.schedule`: showing invented rows
 * when the API is down is worse than an honest empty state, because visitors
 * would plan around fictional times.
 *
 * `getEvents` is module-scope (a stable ref), which is what useApi requires.
 * EventsPreview fetches the same public endpoint on this page — the duplicate
 * GET is accepted rather than prop-drilled through Schedule.jsx.
 */
function groupByDay(events) {
  const dated = (events || []).filter((event) => event?.date);

  // Both fields are zero-padded strings ("2026-03-14", "09:00"), so plain
  // lexicographic order is chronological order — no Date parsing needed.
  const sorted = [...dated].sort((a, b) =>
    `${a.date}T${a.start_time || "00:00"}`.localeCompare(`${b.date}T${b.start_time || "00:00"}`)
  );

  const days = [];
  for (const event of sorted) {
    const last = days[days.length - 1];
    if (last && last.date === event.date) last.events.push(event);
    else days.push({ date: event.date, events: [event] });
  }
  return days;
}

export default function ScheduleFlow() {
  const { data, error, loading } = useApi(getEvents);

  if (loading) {
    return (
      <div className="schedule-flow schedule-flow--status">
        <Loader />
      </div>
    );
  }

  const days = groupByDay(data);

  if (error || days.length === 0) {
    return (
      <div className="schedule-flow schedule-flow--status">
        <p className="empty-state">
          {error
            ? "The schedule couldn't be loaded right now. Please try again shortly."
            : "The schedule will be published here as soon as events are dated."}
        </p>
      </div>
    );
  }

  return (
    <div className="schedule-flow">
      <div className="schedule-day-list">
        {days.map((day, index) => (
          <div className="schedule-day" key={day.date}>
            <div className="flow-day">
              <strong>Day {index + 1}</strong>
              {/* formatEventDate only reads `.date`, so the day object works as-is */}
              <span>{formatEventDate(day)}</span>
            </div>

            <ol className="flow-slot-list">
              {day.events.map((event) => (
                <li className="flow-slot" key={event.id}>
                  <div className="flow-slot-head">
                    <h4>{event.name}</h4>
                    {event.category && (
                      <span className="flow-tag">
                        <Tag size={12} aria-hidden="true" />
                        {event.category}
                      </span>
                    )}
                  </div>

                  <p className="flow-meta">
                    <span className="flow-meta__item">
                      <Clock size={14} aria-hidden="true" />
                      {formatEventTimeRange(event) || "Time TBA"}
                    </span>
                    <span className="flow-meta__item">
                      <MapPin size={14} aria-hidden="true" />
                      {event.venue_name || "Venue TBA"}
                    </span>
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
