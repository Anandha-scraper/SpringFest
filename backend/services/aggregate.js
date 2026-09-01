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

import { listPeople, normalizeEmail, ROLE_ADMIN, ROLE_VOLUNTEER } from "../auth/roles.js";
import { getAuth, getDb } from "../config/firebase.js";
import { settings } from "../config/index.js";
import { STATUS_COMPLETED } from "../utils/statuses.js";
import { cached, invalidate } from "./cache.js";
import { nowInFestZone } from "./festClock.js";

// Re-exported because the admin read models filter on it and importing it
// from here keeps them to one import; utils/statuses.js is the single source.
export { STATUS_COMPLETED };

/** Judged, as opposed to paid.
 *
 * `status === "completed"` means the *money* cleared, and it must keep
 * meaning exactly that everywhere it is already used — revenue, the CSV, the
 * approvals queue, the venue rollup, the check-in guard. Evaluation is a
 * separate axis on its own field.
 *
 * Nothing writes `evaluated_at` yet: the judging phase will, along with a
 * score and the scorer's identity. Until then every count below reads 0, which
 * is the honest answer to "how many have been evaluated" before judging has
 * started. A timestamp rather than a boolean because that is how this codebase
 * records state everywhere else (paid_at, reviewed_at, proof_uploaded_at) and
 * it answers "when" for free. */
function isEvaluated(r) {
  return Boolean(r.evaluated_at);
}

// Short TTL: just long enough to collapse the near-simultaneous calls one
// page load makes (the admin dashboard's own parallel fetches) into a single
// real scan. Every write path that touches registrations/events/venues/roles
// calls invalidateLoadAll(), so this is a backstop, not the primary way
// admin screens stay fresh.
const CACHE_KEY = "aggregate:load_all";
const TTL_SECONDS = 20;

async function scanAll() {
  const db = getDb();
  const [registrationsSnap, eventsSnap, venuesSnap, festCheckinsSnap, people] = await Promise.all([
    db.collection("registrations").get(),
    db.collection("events").get(),
    db.collection("venues").get(),
    db.collection("fest_checkins").get(),
    listPeople(),
  ]);

  const registrations = registrationsSnap.docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }));
  const events = Object.fromEntries(eventsSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() ?? {}) }]));
  const venues = Object.fromEntries(venuesSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() ?? {}) }]));
  const festCheckins = festCheckinsSnap.docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }));

  return { registrations, events, venues, festCheckins, people };
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

/** How this codebase decides two registrations belong to the same person.
 *
 * The Firebase uid, falling back to the email for rows written before uid was
 * stored. Exported because the headline stats and the attendance view must
 * agree on it: two definitions of "one person" would make "142 registered
 * users" and a 143-row attendance list both look correct and disagree. */
export function personKey(r) {
  return r.uid || r.email || "unknown";
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
    allocation_codes: r.allocation_codes || [],
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
    const key = personKey(r);
    if (!byUid.has(key)) byUid.set(key, []);
    byUid.get(key).push(r);
  }

  const rows = [];
  for (const [uid, regsIn] of byUid) {
    const regs = [...regsIn].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    const latest = regs[0];
    const completed = regs.filter((r) => r.status === STATUS_COMPLETED);
    const views = regs.map((r) => registrationView(r, events));

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
      events: views,
      // Solo and team entries are split here rather than in the table because
      // they are genuinely different things to an organiser: a solo entry is
      // one name against one event, a team entry is a roster. Someone can
      // hold both at once — and can lead two different teams for two
      // different events — so neither can be a single value on the person.
      solo_events: views.filter((v) => !v.team_name).map((v) => v.event_name),
      teams: views
        .filter((v) => v.team_name)
        .map((v) => ({
          registration_id: v.registration_id,
          event_id: v.event_id,
          event_name: v.event_name,
          team_name: v.team_name,
          team_size: v.team_size,
          members: v.members,
          status: v.status,
        })),
      total_paid: completed.reduce((sum, r) => sum + (r.fee || 0), 0),
      status: completed.length ? STATUS_COMPLETED : latest.status || "",
      checked_in: regs.some((r) => r.checked_in),
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
      evaluated: regs.filter(isEvaluated).length,
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

  const completed = registrations.filter((r) => r.status === STATUS_COMPLETED);

  return {
    // Everyone who signed in and registered, paid or not.
    signed_users: new Set(registrations.map(personKey)).size,
    // Of those, the ones who paid for at least one event.
    completed_users: new Set(completed.map(personKey)).size,
    // And of *those*, the ones a scorer has actually evaluated. Reads 0 until
    // the judging phase writes evaluated_at — see isEvaluated. Kept beside
    // completed_users rather than replacing it: revenue, the CSV and the
    // approvals queue all still mean "paid".
    evaluated_users: new Set(registrations.filter(isEvaluated).map(personKey)).size,
    revenue: completed.reduce((sum, r) => sum + (r.fee || 0), 0),
    checked_in: registrations.filter((r) => r.checked_in).length,
    // People who cleared the door (fest entry), a separate axis from event
    // check-in and payment.
    fest_checked_in: (data.festCheckins || []).length,
    total_registrations: registrations.length,
    events_count: Object.keys(events).length,
    per_event: perEventCounts(data),
  };
}

/** Every Firebase account, classified by role, with the participant count.
 *
 * The organisers want a real "how many people signed in" headline, but an
 * attendee is anyone with a Google account on the project, and the project
 * also holds the organisers' own accounts (admins/volunteers) who are staff,
 * not attendees. So this enumerates auth and subtracts staff — a login that
 * isn't admin or volunteer is a participant by definition (see roles.js: no
 * record = participant).
 *
 * Enumeration is `listUsers`, paginated, matching the account's `email`. Staff
 * is the union of seeded `ADMIN_EMAILS` plus every document in the `roles`
 * collection whose role is admin/volunteer (or a not-yet-migrated judge).
 * Returns both the participant count and the raw staff count so callers could
 * probe either.
 */
export async function countAuthByRole() {
  const db = getDb();

  const staffEmails = new Set(settings.ADMIN_EMAILS);
  const rolesSnap = await db.collection("roles").get();
  for (const doc of rolesSnap.docs) {
    const role = doc.data()?.role;
    // "judge" is still matched: a role document that predates the fold into
    // volunteer is still an organiser's account, and must not be counted as
    // an attendee just because the migration script hasn't run yet.
    if (role === ROLE_ADMIN || role === "judge" || role === ROLE_VOLUNTEER) {
      staffEmails.add(normalizeEmail(doc.id));
    }
  }

  let total = 0;
  let staff = 0;
  let nextPageToken;
  do {
    // 1000 is the max page size for auth listUsers.
    const { users, pageToken } = await getAuth().listUsers(1000, nextPageToken);
    for (const u of users) {
      const email = normalizeEmail(u.email);
      if (!email) continue; // provider accounts without an email aren't Google sign-ins
      total += 1;
      if (staffEmails.has(email)) staff += 1;
    }
    nextPageToken = pageToken;
  } while (nextPageToken);

  return { total, staff, participants: total - staff };
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
      // One list, not two: the volunteers on this venue are also the people
      // who score its event now that the judge role is gone.
      volunteers: people
        .filter((p) => p.role === ROLE_VOLUNTEER && p.venue_id === vid)
        .map((p) => p.name || p.email),
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

/** Has this event started yet? Wall-clock string compare in the fest's zone —
 * see services/festClock.js for why the zone conversion is needed. Deliberately
 * not reused for created_at / paid_at / reviewed_at: those are genuine UTC
 * instants and must keep being compared as such. */
function eventStarted(event, now = new Date()) {
  if (!event.date) return false; // an undated event never auto-starts
  return `${event.date}T${event.start_time || "00:00"}` <= nowInFestZone(now);
}

/** Per event: headcount, attendance and evaluation progress, plus who is
 * staffing it — the Manage Roles progress view.
 *
 * A sibling of venueRollup() rather than an extension of perEventCounts(),
 * because that one is shared with the participant-facing GET /me/schedule and
 * should stay lean; venue joins and start-time maths have no business in a
 * participant's payload.
 *
 * `progress` is explicitly null before the event starts. Null and 0 are
 * different facts to an organiser — "hasn't begun" versus "begun and nothing
 * judged yet" — and the UI shouldn't have to re-derive which it's looking at. */
export async function eventRollup(data) {
  data = data || (await loadAll());
  const { registrations, events, venues, people } = data;

  const rows = Object.entries(events).map(([eid, event]) => {
    const regs = registrations.filter((r) => r.event_id === eid);
    const evaluated = regs.filter(isEvaluated).length;
    const started = eventStarted(event);

    return {
      event_id: eid,
      name: event.name || eid,
      category: event.category || "",
      venue_id: event.venue_id || "",
      venue_name: venues[event.venue_id || ""]?.name || "",
      date: event.date || "",
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      registrations: regs.length,
      checked_in: regs.filter((r) => r.checked_in).length,
      // Payment, unchanged — kept so the card can show who actually paid.
      completed: regs.filter((r) => r.status === STATUS_COMPLETED).length,
      evaluated,
      // Whoever staffs the venue staffs the event — check-in and scoring both.
      volunteers: people
        .filter((p) => p.role === ROLE_VOLUNTEER && p.venue_id === event.venue_id)
        .map((p) => p.name || p.email),
      started,
      progress: started && regs.length ? evaluated / regs.length : null,
    };
  });

  // A schedule view, so chronological — unlike venueRollup(), which is by name.
  rows.sort(
    (a, b) =>
      (a.date || "").localeCompare(b.date || "") ||
      (a.start_time || "").localeCompare(b.start_time || "") ||
      a.name.localeCompare(b.name),
  );
  return rows;
}
