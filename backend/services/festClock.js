/** When does "the day" start?
 *
 * Check-in — both the fest-entry mark and the per-event check-in — must not
 * open before the fest is actually running. There is no separate "fest start"
 * setting to keep in sync: the fest starts when its earliest event starts, so
 * that is what gates check-in.
 *
 * An event's `date` ("YYYY-MM-DD") and `start_time` ("HH:MM") are local
 * wall-clock strings with no zone (that's what the admin form's pickers
 * produce). Everything else timestamps with `new Date().toISOString()` (UTC).
 * Comparing the two naively is 5.5h off, so `now` is rendered in the fest's
 * own zone before the string compare — the same trick aggregate.js uses for
 * `eventStarted()`, extracted here so both share one implementation.
 */
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";

/** The fest runs in one place, and the admin form writes wall-clock strings. */
export const FEST_TIMEZONE = "Asia/Kolkata";

/** `now` as a "YYYY-MM-DDTHH:MM" wall-clock string in the fest's zone, so it
 * compares directly against an event's `${date}T${start_time}`. */
export function nowInFestZone(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FEST_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** The earliest `${date}T${start_time}` across events that have both, or null
 * when no event is scheduled yet. */
export function festStartWallClock(events) {
  const list = Array.isArray(events) ? events : Object.values(events || {});
  const starts = list
    .filter((e) => e && e.date)
    .map((e) => `${e.date}T${e.start_time || "00:00"}`);
  if (!starts.length) return null;
  return starts.sort()[0];
}

/** Has this event finished? Past `end_time` on its `date` (undated events never
 * end). Same fest-zone wall-clock compare as `festStarted`. */
export function eventEnded(event, now = new Date()) {
  if (!event?.date) return false;
  return `${event.date}T${event.end_time || "23:59"}` < nowInFestZone(now);
}

/** How long after an event's `end_time` scores can still be entered.
 *
 * Scoring genuinely finishes after the event does — the last team presents,
 * then the room deliberates — and a hard stop at `end_time` would throw that
 * work away with no way to get it back. Admins bypass the clock entirely
 * (see evaluation.service.js), so this is the volunteer's safety margin, not
 * the fest's only escape hatch. */
export const EVALUATION_GRACE_MINUTES = 120;

/** An event's [start, end) as fest wall-clock strings, or null when it has no
 * date. Defaults match eventEnded()/festStartWallClock(): a missing time means
 * "all day". */
export function eventWindow(event) {
  if (!event?.date) return null;
  return {
    opensAt: `${event.date}T${event.start_time || "00:00"}`,
    closesAt: `${event.date}T${event.end_time || "23:59"}`,
  };
}

/** Wall-clock string + N minutes, as calendar arithmetic.
 *
 * Date.UTC is used purely as a calendar here — never as a timezone. Parsing
 * the string as local time instead would make the result depend on the
 * server's own zone and its DST rules; this way "13:00 + 120" is 15:00 on any
 * machine. */
function addMinutes(wallClock, minutes) {
  if (!minutes) return wallClock;
  const [date, time = "00:00"] = wallClock.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d, hh, mm) + minutes * 60000);
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}` +
    `T${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}`
  );
}

/** Assert that *this specific event* is running right now.
 *
 * `assertFestCheckinOpen()` above only answers "has the fest begun" — which is
 * true all weekend once the earliest event starts. This is the per-event gate:
 * a volunteer can't check people into an 11:00 event at 09:00, or score one
 * that finished hours ago.
 *
 * `graceMinutes` extends only the closing bound. The message always names the
 * event's real `end_time`, not the extended one — telling someone scoring
 * "closed at 15:00" for an event that ended at 13:00 would just be confusing.
 */
export function assertEventWindowOpen(
  event,
  { graceMinutes = 0, what = "Check-in", now: at = new Date() } = {}
) {
  const name = event?.name || "this event";
  const window = eventWindow(event);
  if (!window) {
    throw new ApiError(409, `"${name}" has no date set yet — an organiser needs to schedule it.`);
  }

  const now = nowInFestZone(at);
  if (now < window.opensAt) {
    throw new ApiError(403, `${what} for "${name}" opens at ${humanStart(window.opensAt)}.`);
  }
  if (now >= addMinutes(window.closesAt, graceMinutes)) {
    throw new ApiError(403, `${what} for "${name}" closed at ${humanStart(window.closesAt)}.`);
  }
}

export function festStarted(events, now = new Date()) {
  const start = festStartWallClock(events);
  if (!start) return false;
  return start <= nowInFestZone(now);
}

/** A friendly "DD Mon, HH:MM" for the not-yet-open message. */
function humanStart(wallClock) {
  const [date, time] = wallClock.split("T");
  const d = new Date(`${date}T${time || "00:00"}:00`);
  const nice = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
  return Number.isNaN(d.getTime()) ? wallClock : nice;
}

/** Read the events collection once and assert the fest has started. Throws a
 * 403 before the earliest event's start time, or a 409 if nothing is
 * scheduled. Returns the events map on success so callers can reuse it. */
export async function assertFestCheckinOpen() {
  const snap = await getDb().collection("events").get();
  const events = snap.docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }));

  const start = festStartWallClock(events);
  if (!start) {
    throw new ApiError(409, "No events are scheduled yet — check-in can't open.");
  }
  if (start > nowInFestZone()) {
    throw new ApiError(403, `Check-in opens when Spring Fest begins on ${humanStart(start)}.`);
  }
  return events;
}
