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

import { listPeople, ROLE_ADMIN, ROLE_VOLUNTEER } from "../auth/roles.js";
import { getAuth, getDb } from "../config/firebase.js";
import { settings } from "../config/index.js";
import { STATUS_COMPLETED } from "../utils/statuses.js";
import { buildUidByEmail, keyResolver, normalizeEmail, personKeyFor } from "../utils/identity.js";
import { ticketHolders } from "./qr.js";
import { cached, invalidate } from "./cache.js";
import { nowInFestZone } from "./festClock.js";

// Re-exported because the admin read models filter on it and importing it
// from here keeps them to one import; utils/statuses.js is the single source.
export { STATUS_COMPLETED };

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
 * Thin wrapper over utils/identity.js, which is now the single definition —
 * this used to be one of three that quietly disagreed on whether to lowercase.
 * Kept as an export because callers read naturally as `personKey(row)`. */
export function personKey(r) {
  return personKeyFor({ uid: r.uid, email: r.email }) || "unknown";
}

/** Did THIS seat check in? Not `row.checked_in`, which means "somebody on
 * this registration is in" — copying that onto every holder would mark a
 * teammate who never showed up as attended because their lead did.
 *
 * Read straight off `member_checkins[]` rather than through
 * `checkin.service.holderCheckins()`: that module imports this one, and the
 * cycle is not worth one array lookup. Check-in is one-way, so the presence
 * of an entry is the answer. */
function seatCheckedIn(row, memberIndex) {
  const marks = Array.isArray(row?.member_checkins) ? row.member_checkins : [];
  return marks.some((c) => c?.member_index === memberIndex);
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
    // Whole array, not just one seat: this feeds the admin's per-person
    // drawer, which shows every holder's answer for the team.
    feedback: r.feedback || [],
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

/** One row per PERSON — every ticket holder, not just the people who created
 * a registration.
 *
 * A teammate exists only as an email inside someone else's `members[]`, and
 * they used to get no row at all: they were visible only nested inside the
 * lead's entry. They are a real participant who turns up, gets checked in and
 * holds an allocation code, so they get a row. If their email also leads
 * registrations elsewhere, identity resolution folds all of it onto that one
 * row — get that wrong and one human becomes two.
 *
 * Approved only. A draft is a half-filled form and a rejected row is somebody
 * whose payment did not clear; neither is a participant, and counting them is
 * what made "Registered Users" read far higher than the number of people
 * actually coming. The filter lives here rather than in the controller so
 * `buildStats` can count exactly what this returns — two places deciding what
 * "registered" means is how the headline and the list drift apart.
 */
export async function participantRows(data, status = STATUS_COMPLETED) {
  data = data || (await loadAll());
  const { registrations, events } = data;

  // Non-mutating: `registrations` is the array inside the shared loadAll()
  // cache, and other rollups walk the same objects.
  //
  // `status` is a parameter only so the admin can pull up the rejected pile
  // from the same screen. Everything else about the page assumes approved.
  const approved = registrations.filter((r) => r.status === status);
  // Built from EVERY registration, not the approved slice — see the note in
  // utils/identity.js. Someone leading a pending row and sitting on an
  // approved one still needs their uid known here.
  const keyFor = keyResolver(buildUidByEmail(registrations));

  const people = new Map();
  for (const row of approved) {
    for (const holder of ticketHolders(row)) {
      const key = keyFor({ uid: holder.uid, email: holder.email });
      // Neither a uid nor an email: unaddressable. Skipped rather than
      // bucketed together, which would merge strangers into one row.
      if (!key) continue;
      if (!people.has(key)) people.set(key, []);
      people.get(key).push({ row, holder });
    }
  }

  const rows = [];
  for (const [key, seatsIn] of people) {
    // Newest first, and seats on the person's own account first: their own
    // registration is the most authoritative source for their own details.
    const seats = [...seatsIn].sort(
      (a, b) =>
        Number(Boolean(b.holder.uid)) - Number(Boolean(a.holder.uid)) ||
        (b.row.created_at || "").localeCompare(a.row.created_at || "")
    );
    // First non-empty wins, so a teammate typed with a blank college on one
    // team still shows the college they gave on another.
    const pick = (field) => seats.map((s) => s.holder[field]).find(Boolean) || "";
    const leadSeats = seats.filter((s) => s.holder.member_index === 0);

    const views = seats.map((s) => ({
      ...registrationView(s.row, events),
      member_index: s.holder.member_index,
      is_lead: s.holder.member_index === 0,
      // The whole roster, lead included, so the admin's team dialog can list
      // it without reconstructing "the lead plus members[]" — which is what
      // used to put the lead's own address in the list twice.
      holders: ticketHolders(s.row),
    }));

    rows.push({
      person_key: key,
      // The uid only exists if this person leads something. A pure teammate's
      // is "" — which is why nothing may key a React list on it.
      uid: leadSeats[0]?.holder.uid || "",
      name: pick("name"),
      email: normalizeEmail(pick("email")),
      phone: pick("phone"),
      college: pick("college"),
      department: pick("department"),
      year: pick("year"),
      location: pick("location"),
      is_lead_anywhere: leadSeats.length > 0,
      events_count: seats.length,
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
          holders: v.holders,
          status: v.status,
          is_lead: v.is_lead,
          lead_name: v.holders[0]?.name || "",
        })),
      // Lead seats only. `fee` is the whole team's charge, so summing it on
      // every holder's row would report team_size times the real revenue and
      // make the column silently lie. A teammate shows 0 and `paid_by`.
      total_paid: leadSeats.reduce((sum, s) => sum + (s.row.fee || 0), 0),
      paid_by: leadSeats.length
        ? ""
        : seats.map((s) => ticketHolders(s.row)[0]?.name).find(Boolean) || "",
      status,
      // This person's own attendance, never the registration-wide flag.
      checked_in: seats.some((s) => seatCheckedIn(s.row, s.holder.member_index)),
      created_at: seats[0]?.row.created_at || "",
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

/** Shaped for the Overview.
 *
 * Three grains coexist here deliberately. `signed_users` counts *people*;
 * `revenue`, `checked_in` and `total_registrations` count *registration
 * rows*; `per_event` counts rows per event. A four-person team is one
 * registration and four people, and both readings are wanted on one screen. */
export async function buildStats(data) {
  data = data || (await loadAll());
  const { registrations, events } = data;

  const completed = registrations.filter((r) => r.status === STATUS_COMPLETED);
  // Literally the array the Registrations page renders, not a second count
  // computed a second way — the Overview headline and that page's row count
  // cannot disagree if there is only one definition of the list.
  const people = await participantRows(data);

  return {
    // Approved people, counting every ticket holder: a teammate is coming to
    // the fest just as much as whoever filled the form in.
    signed_users: people.length,
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
      // No `completed` column any more: now that the admin's registration
      // views mean "approved", it was the same number printed twice.
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

/** Per event: headcount and attendance, plus who is staffing it — the Manage
 * Roles progress view.
 *
 * A sibling of venueRollup() rather than an extension of perEventCounts(),
 * because that one is shared with the participant-facing GET /me/schedule and
 * should stay lean; venue joins and start-time maths have no business in a
 * participant's payload. */
export async function eventRollup(data) {
  data = data || (await loadAll());
  const { registrations, events, venues, people } = data;

  const rows = Object.entries(events).map(([eid, event]) => {
    const regs = registrations.filter((r) => r.event_id === eid);
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
      // Whoever staffs the venue staffs the event.
      volunteers: people
        .filter((p) => p.role === ROLE_VOLUNTEER && p.venue_id === event.venue_id)
        .map((p) => p.name || p.email),
      started,
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
