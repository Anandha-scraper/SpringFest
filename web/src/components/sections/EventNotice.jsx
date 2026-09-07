"use client";

import "@/styles/components/event-notice.css";
import { Info } from "lucide-react";

import { useApi } from "@/hooks/useApi.js";
import { getPublicSettings } from "@/api/client.js";

/** One notice, as a torn-paper card.
 *
 * The scalloped left edge is a CSS pseudo-element, not markup — see
 * event-notice.css. That keeps this component to the two things it actually
 * carries, and lets the edge tile at whatever height the text needs.
 *
 * Either field may be empty: an organiser can write a bare heading
 * ("Registrations close 20 March") or a bare line with no heading, and both
 * are legitimate cards rather than broken ones.
 */
function NoticeCard({ title, text }) {
  return (
    <article className="notice-card">
      {title && <p className="notice-card__title">{title}</p>}
      {text && <p className="notice-card__text">{text}</p>}
    </article>
  );
}

/** The organisers' common instructions, under the EVENTS heading.
 *
 * Read from a PUBLIC endpoint on purpose: the person who most needs to read
 * "teams of two to three" or "bring your college ID" is someone deciding
 * whether to register, and they have not signed in yet.
 *
 * Renders **nothing at all** when there are no points — not an empty card, not
 * a heading with a gap under it. A fest that has nothing to say here should
 * look exactly as it did before the feature existed, which is also what makes
 * this safe to leave switched off.
 *
 * The same silence covers a failed or still-loading fetch. This is supporting
 * copy on a landing page: a spinner or an error where the instructions would
 * be is worse than the instructions simply not being there yet.
 */
const fetchPublicSettings = () => getPublicSettings();

export default function EventNotice() {
  const { data } = useApi(fetchPublicSettings, { liveOn: "settings" });

  const points = data?.event_instructions || [];
  if (!points.length) return null;

  return (
    <aside className="event-notice" aria-label="Before you register">
      <div className="event-notice__head">
        <Info size={17} aria-hidden="true" />
        <h3>Before you register</h3>
      </div>

      <div className="event-notice__grid">
        {points.map((p, i) => (
          <NoticeCard key={i} title={p?.title || ""} text={p?.text || ""} />
        ))}
      </div>
    </aside>
  );
}
