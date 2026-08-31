"use client";

import { useCallback, useMemo, useState } from "react";
import "@/styles/pages/participant-schedule.css";
import { Calendar, MapPin } from "lucide-react";
import { getEvents, getMyRegistrations } from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { formatEventTime } from "@/utils/format.js";
import Loader from "@/components/common/Loader.jsx";

const load = () => Promise.all([getMyRegistrations(), getEvents()]);

// NOTE: "Checked in" is the interim third group — a volunteer scanned this
// person in at the venue. It stands in for a scored "Finished by you"
// group, which needs a scoring dashboard/collection that doesn't exist yet.
const GROUPS = [
  { key: "ongoing", label: "On going" },
  { key: "ended", label: "Ended" },
  { key: "checkedIn", label: "Checked in" },
];

/** Which group a registered event falls into, or null to omit it (no date, or
 * it hasn't started yet). Local-time parsing matches lib/format.js. */
function classify(row, event, now) {
  const date = event?.date;
  if (!date) return null;
  const entry = (row.member_checkins || []).find((c) => c.member_index === row.member_index);
  if (entry) return "checkedIn"; // wins over the time-based groups
  const start = new Date(`${date}T${event.start_time || "00:00"}:00`);
  const end = new Date(`${date}T${event.end_time || "23:59"}:00`);
  if (now > end) return "ended";
  if (now >= start && now <= end) return "ongoing";
  return null; // upcoming — omitted
}

export default function ParticipantSchedule() {
  const { data, error, loading } = useApi(useCallback(load, []));
  const [visible, setVisible] = useState(() => new Set(GROUPS.map((g) => g.key)));

  const grouped = useMemo(() => {
    const [regs, events] = data || [[], []];
    const byId = new Map(events.map((e) => [e.id, e]));
    const now = new Date();
    const out = { ongoing: [], ended: [], checkedIn: [] };
    for (const r of regs) {
      if (r.status === "draft") continue;
      const event = byId.get(r.event_id);
      const bucket = classify(r, event, now);
      if (bucket) out[bucket].push({ ...r, event: event || { name: r.event_name || r.event_id } });
    }
    return out;
  }, [data]);

  if (loading) return <Loader />;
  if (error) return <p className="error">{error}</p>;

  const total = grouped.ongoing.length + grouped.ended.length + grouped.checkedIn.length;

  const toggle = (key) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="admin-panel">
      <div className="panel-head">
        <h2>Schedule</h2>
        <span className="muted">{total} events</span>
      </div>

      {!total ? (
        <p className="empty-state">
          Nothing on your schedule yet , register for an event to see it here.
        </p>
      ) : (
        <>
          <div className="schedule-filters">
            {GROUPS.map((g) => (
              <label key={g.key}>
                <input
                  type="checkbox"
                  checked={visible.has(g.key)}
                  onChange={() => toggle(g.key)}
                />
                {g.label} <span className="muted">({grouped[g.key].length})</span>
              </label>
            ))}
          </div>

          {GROUPS.filter((g) => visible.has(g.key)).map((g) => (
            <div className="schedule-group" key={g.key}>
              <h3>{g.label}</h3>
              {grouped[g.key].length === 0 ? (
                <p className="muted">Nothing here yet.</p>
              ) : (
                <ul className="schedule-list">
                  {grouped[g.key].map((e) => (
                    <li className="schedule-row" key={e.id}>
                      <strong className="schedule-name">{e.event.name}</strong>
                      <span className="schedule-meta">
                        <Calendar size={14} aria-hidden="true" />
                        {formatEventTime(e.event) || "Date to be announced"}
                      </span>
                      {e.event.venue_name && (
                        <span className="schedule-meta">
                          <MapPin size={14} aria-hidden="true" />
                          {e.event.venue_name}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
