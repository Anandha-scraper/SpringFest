/** Read-side rollups for the admin screens.
 *
 * Every admin aggregate is built here so the shapes can't drift between
 * endpoints. The collections are small (one fest, a few hundred
 * registrations), so each rollup does a handful of full-collection scans and
 * filters in memory rather than maintaining composite indexes.
 *
 * The key idea: a *registration* is one person-or-team signing up for one
 * event, but the organiser thinks in *people* — "who registered, for how
 * many events, and what did they pay in total". participantRows is that
 * pivot, grouped on `uid` (the Firebase account, stored on every
 * registration since the first version).
 */

import { cached, invalidate } from "./cache.js";
import { getDb } from "./firebase.js";
import { listPeople, ROLE_JUDGE, ROLE_VOLUNTEER } from "./roles.js";

export const STATUS_COMPLETED = "completed";

// Short TTL: just long enough to collapse the near-simultaneous calls one
// page load makes (the admin dashboard's own parallel fetches) into a single
// real scan. Every write path that touches registrations/events/venues/roles
// calls invalidateLoadAll(), so this is a backstop, not the primary way
// admin screens stay fresh.
const CACHE_KEY = "aggregate:load_all";
const TTL_SECONDS = 20;

async function scanAll() {
  const db = getDb();
  const [registrationsSnap, eventsSnap, venuesSnap, people] = await Promise.all([
    db.collection("registrations").get(),
    db.collection("events").get(),
    db.collection("venues").get(),
    listPeople(),
  ]);

  const registrations = registrationsSnap.docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }));
  const events = Object.fromEntries(eventsSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() ?? {}) }]));
  const venues = Object.fromEntries(venuesSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() ?? {}) }]));

  return { registrations, events, venues, people };
}

/** One trip for everything the rollups need, so an endpoint that wants two
 * of them doesn't re-read the same collections — and, within the TTL above,
 * so two endpoints in the same page load don't either. */
export function loadAll() {
  return cached(CACHE_KEY, TTL_SECONDS, scanAll);
}

/** Call after any write to registrations/events/venues/roles so admin
 * screens reflect it immediately instead of waiting out the TTL. */
export function invalidateLoadAll() {
  invalidate(CACHE_KEY);
}

export function eventName(events, eventId) {
  return events[eventId]?.name ?? eventId;
}

/** One registration as the admin detail panel wants it. */
function registrationView(r, events) {
  return {
    registration_id: r.id,
    event_id: r.event_id || "",
    event_name: eventName(events, r.event_id || ""),
    status: r.status || "",
    fee: r.fee || 0,
    checked_in: Boolean(r.checked_in),
    member_checkins: r.member_checkins || [],
    team_name: r.team_name || "",
    team_size: r.team_size ?? 1,
    members: r.members || [],
    created_at: r.created_at || "",
    paid_at: r.paid_at || "",
    payment_id: r.payment_id || "",
    order_id: r.order_id || "",
    payment_method: r.payment_method || "",
    // Screenshot-mode fields. Empty on gateway rows, which is what tells the
    // admin screens which payment story to show.
    payment_mode: r.payment_mode || "",
    transaction_id: r.transaction_id || "",
    review_note: r.review_note || "",
    reviewed_by: r.reviewed_by || "",
    reviewed_at: r.reviewed_at || "",
  };
}

/** One row per person, newest registration first.
 *
 * total_paid counts only completed registrations — an abandoned checkout
 * never took money. status is "completed" if the person paid for at least
 * one event, which is the same definition the Overview's Completed card
 * uses. */
export async function participantRows(data) {
  data = data || (await loadAll());
  const { registrations, events } = data;

  const byUid = new Map();
  for (const r of registrations) {
    // Fall back to the email for rows written before uid existed.
    const key = r.uid || r.email || "unknown";
    if (!byUid.has(key)) byUid.set(key, []);
    byUid.get(key).push(r);
  }

  const rows = [];
  for (const [uid, regsIn] of byUid) {
    const regs = [...regsIn].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    const latest = regs[0];
    const completed = regs.filter((r) => r.status === STATUS_COMPLETED);
    // The most recent team registration supplies the table's team columns;
    // the full per-event breakdown is in `events`.
    const team = regs.find((r) => r.team_name);

    rows.push({
      uid,
      name: latest.name || "",
      email: latest.email || "",
      phone: latest.phone || "",
      college: latest.college || "",
      department: latest.department || "",
      year: latest.year || "",
      location: latest.location || "",
      events_count: regs.length,
      events: regs.map((r) => registrationView(r, events)),
      total_paid: completed.reduce((sum, r) => sum + (r.fee || 0), 0),
      status: completed.length ? STATUS_COMPLETED : latest.status || "",
      checked_in: regs.some((r) => r.checked_in),
      team_name: team?.team_name || "",
      team_size: team?.team_size ?? 1,
      members: team?.members || [],
      created_at: latest.created_at || "",
    });
  }

  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return rows;
}

/** Registration counts per event: how many rows total, how many completed,
 * and the revenue those brought in. Sorted by `completed` descending — the
 * admin Overview's ranking. Shared by `buildStats()` and the participant
 * schedule (`GET /me/schedule`), which sorts by `count` instead — see there. */
export function perEventCounts(data) {
  const { registrations, events } = data;
  const rows = Object.entries(events).map(([eid, event]) => {
    const regs = registrations.filter((r) => r.event_id === eid);
    const done = regs.filter((r) => r.status === STATUS_COMPLETED);
    return {
      event_id: eid,
      name: event.name || eid,
      count: regs.length,
      completed: done.length,
      revenue: done.reduce((sum, r) => sum + (r.fee || 0), 0),
    };
  });
  rows.sort((a, b) => b.completed - a.completed);
  return rows;
}

/** Shaped for the Overview. The three headline numbers count *people*, not
 * registration rows — one person registering for four events is one signed
 * user, not four. */
export async function buildStats(data) {
  data = data || (await loadAll());
  const { registrations, events } = data;

  const personKey = (r) => r.uid || r.email || "unknown";
  const completed = registrations.filter((r) => r.status === STATUS_COMPLETED);

  return {
    // Everyone who signed in and registered, paid or not.
    signed_users: new Set(registrations.map(personKey)).size,
    // Of those, the ones who paid for at least one event.
    completed_users: new Set(completed.map(personKey)).size,
    revenue: completed.reduce((sum, r) => sum + (r.fee || 0), 0),
    checked_in: registrations.filter((r) => r.checked_in).length,
    total_registrations: registrations.length,
    events_count: Object.keys(events).length,
    per_event: perEventCounts(data),
  };
}

/** Per venue: the event held there, its headcount, and who is staffing it. */
export async function venueRollup(data) {
  data = data || (await loadAll());
  const { registrations, events, venues, people } = data;

  const rows = [];
  for (const [vid, venue] of Object.entries(venues)) {
    const venueEvents = Object.values(events).filter((e) => e.venue_id === vid);
    const eventIds = new Set(venueEvents.map((e) => e.id));
    const regs = registrations.filter((r) => eventIds.has(r.event_id));
    // One venue backs at most one event (enforced on write), so name the
    // single event rather than making the caller unpack a list.
    const event = venueEvents[0] || null;

    rows.push({
      id: vid,
      name: venue.name || vid,
      event_id: event ? event.id : "",
      event_name: event ? event.name || "" : "",
      registrations: regs.length,
      checked_in: regs.filter((r) => r.checked_in).length,
      completed: regs.filter((r) => r.status === STATUS_COMPLETED).length,
      judges: people
        .filter((p) => p.role === ROLE_JUDGE && (p.event_ids || []).some((id) => eventIds.has(id)))
        .map((p) => p.name || p.email),
      volunteers: people
        .filter((p) => p.role === ROLE_VOLUNTEER && p.venue_id === vid)
        .map((p) => p.name || p.email),
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}
