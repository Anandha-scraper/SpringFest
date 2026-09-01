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

/** Assert that *this specific event's day* has arrived and hasn't finished.
 *
 * `assertFestCheckinOpen()` above only answers "has the fest begun" — which is
 * true all weekend once the earliest event starts. This is the per-event gate:
 * a team from a Sept 26 event can't be checked in on Sept 25 or the 27th.
 *
 * Deliberately NOT gated to the event's own `start_time`/`end_time` — a team
 * legitimately shows up before the posted start, or needs checking in after
 * it, and the room's exact schedule isn't check-in's business to enforce. The
 * window is always the full day, `00:00` to `23:59`, regardless of what
 * `start_time`/`end_time` the event actually has. */
export function assertEventDayOpen(event, { what = "Check-in" } = {}) {
  const name = event?.name || "this event";
  if (!event?.date) {
    throw new ApiError(409, `"${name}" has no date set yet — an organiser needs to schedule it.`);
  }

  const now = nowInFestZone();
  const opensAt = `${event.date}T00:00`;
  const closesAt = `${event.date}T23:59`;
  if (now < opensAt) {
    throw new ApiError(403, `${what} for "${name}" opens on ${humanStart(opensAt)}.`);
  }
  if (now > closesAt) {
    throw new ApiError(403, `${what} for "${name}" was on ${humanStart(opensAt)} — that day has passed.`);
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
