/**
 * Display formatting shared across the admin screens.
 *
 * These are presentation, not data — they moved here out of the mock module so
 * that deleting the mock didn't take the formatting with it. Field names match
 * the API's snake_case (`start_time`, `end_time`), not the old camelCase.
 */

const fmtTime = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${period}`;
};

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
};

/** "14 Mar 2026, 6:04 PM" — payment and registration timestamps. */
export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "March 14, 2026 · 10:00 AM – 1:00 PM" — an event's schedule line. */
export function formatEventTime(event) {
  if (!event) return "";
  return [formatEventDate(event), formatEventTimeRange(event)].filter(Boolean).join(" · ");
}

/** Just the date half of an event's schedule — "March 14, 2026". */
export function formatEventDate(event) {
  return event ? fmtDate(event.date) : "";
}

/** Just the time half — "10:00 AM – 1:00 PM", or "" when times aren't set. */
export function formatEventTimeRange(event) {
  if (!event?.start_time || !event?.end_time) return "";
  return `${fmtTime(event.start_time)} – ${fmtTime(event.end_time)}`;
}

/** Same day and overlapping [start, end). Mirrors the server's own check, so
 *  the UI can grey out a clashing option before the API refuses it. */
export function eventsOverlap(a, b) {
  if (!a || !b || a.date !== b.date) return false;
  if (!a.start_time || !a.end_time || !b.start_time || !b.end_time) return false;
  return a.start_time < b.end_time && b.start_time < a.end_time;
}

export const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
