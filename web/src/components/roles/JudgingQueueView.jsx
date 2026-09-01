"use client";

import { ArrowRight, Mic } from "lucide-react";

const teamLabel = (t) => t?.team_name || t?.lead_name || t?.name || t?.registration_id || "—";

/** Read-only "now evaluating / up next" panel. Shared by the scoring
 * screen and the volunteer roster so the two never drift. `queue` is the
 * shape returned by GET /volunteer/events/:id/queue or the volunteer summary
 * (`{ current, upcoming }` / `{ now_evaluating, up_next }`). */
export default function JudgingQueueView({ current, upcoming }) {
  if (!current && (!upcoming || upcoming.length === 0)) {
    return <p className="muted">No team is on stage yet.</p>;
  }
  return (
    <div className="queue-view">
      <p>
        <Mic size={15} aria-hidden="true" />{" "}
        <strong>Now evaluating:</strong> {current ? teamLabel(current) : "—"}
      </p>
      {upcoming && upcoming.length > 0 && (
        <ol className="queue-upcoming">
          {upcoming.map((t) => (
            <li key={t.registration_id}>
              <ArrowRight size={13} aria-hidden="true" /> {teamLabel(t)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
