/** The admin Attendance view — "who actually turned up, and were they scored".
 *
 * Registrations are the wrong grain for this question. An organiser walking the
 * venues thinks in *people*: one row per human, listing every event they hold
 * and where each one has got to. So this pivots the same way
 * `aggregate.participantRows()` does, on `personKey()` — deliberately the same
 * function, because two definitions of "one person" would let the Overview's
 * headline count and this list disagree while both looked right.
 *
 * Team members are the wrinkle. Only the lead has a `uid`; teammates exist as
 * `members[]` entries with a name and an email, matched exactly the way
 * `registrationLookup.matchMemberIndex()` matches them. So a teammate gets a row
 * of their own keyed on their email, and someone who leads one team and is a
 * member of another collapses into a single row holding both.
 *
 * The two check-in marks stay separate here, as they are everywhere else:
 * `fest_checked_in` is the door (one flag per person), while each entry's
 * `checked_in` / `ever_checked_in` is per event, per member.
 *
 * Reads ride on `aggregate.loadAll()` — no new Firestore scans, and the same
 * 20s cache the rest of the admin screens share. This is read repeatedly during
 * the fest, which is exactly what that cache is for.
 */
import { holderCheckins } from "./checkin.service.js";
import * as aggregate from "./aggregate.js";

const lower = (s) => (s || "").trim().toLowerCase();

/** Fest-entry lookup by uid *and* by email.
 *
 * `fest_checkins/{uid}` is keyed on the Firebase account, but a teammate is
 * only ever an email on someone else's registration — there is no uid to look
 * them up by. The doc stores the email too, so an email index makes the door
 * flag resolvable for people who never led a registration themselves. */
function festIndex(festCheckins) {
  const byUid = new Set();
  const byEmail = new Set();
  for (const doc of festCheckins || []) {
    if (doc.uid) byUid.add(doc.uid);
    if (doc.email) byEmail.add(lower(doc.email));
  }
  return { byUid, byEmail };
}

/** One registration as an attendance line, from the point of view of the person
 * whose row it is sitting in — `member_index` is *their* seat on it. */
function entryFor(row, events, memberIndex) {
  const event = events[row.event_id || ""] || {};
  const holders = holderCheckins(row);
  const mine = holders[memberIndex] || null;
  const isTeam = Boolean(row.team_name) || (row.members || []).length > 0;

  return {
    registration_id: row.id,
    event_id: row.event_id || "",
    event_name: event.name || row.event_id || "",
    venue_name: "",
    date: event.date || "",
    start_time: event.start_time || "",
    status: row.status || "",
    team_name: row.team_name || "",
    is_team: isTeam,
    member_index: memberIndex,
    allocation_code: mine?.allocation_code || "",
    // This person's own attendance for this event.
    checked_in: Boolean(mine?.checked_in),
    ever_checked_in: Boolean(mine?.ever_checked_in),
    // Only teams expand; a solo entry's single holder is the row itself.
    holders: isTeam ? holders : [],
  };
}

/** Every person who holds a registration, with every event they hold.
 *
 * Someone appears once whether they registered for one event or four, and
 * whether they led a team or were typed into someone else's. */
export async function attendanceRows(data) {
  data = data || (await aggregate.loadAll());
  const { registrations, events, venues, festCheckins } = data;
  const fest = festIndex(festCheckins);

  // The same human can reach this list down two different paths: as a lead,
  // where `personKey()` prefers their Firebase uid, and as someone else's
  // teammate, where all we have is the email they were typed in as. Keying
  // those independently splits one person into two rows. So learn every
  // email->uid pairing the leads give us first, and resolve teammates through
  // it — whichever path is seen first, both land on the uid.
  const uidByEmail = new Map();
  for (const row of registrations) {
    const email = lower(row.email);
    if (email && row.uid) uidByEmail.set(email, row.uid);
  }
  const keyForEmail = (email) => uidByEmail.get(email) || email;

  // key -> { name, email, uid, entries: [] }
  const people = new Map();

  const upsert = (key, { name, email, uid }, entry) => {
    if (!key) return;
    let person = people.get(key);
    if (!person) {
      person = { key, name: name || "", email: email || "", uid: uid || "", entries: [] };
      people.set(key, person);
    }
    // Keep the first non-empty name/email we see; a later registration with a
    // blank field must not erase what an earlier one told us.
    if (!person.name && name) person.name = name;
    if (!person.email && email) person.email = email;
    if (!person.uid && uid) person.uid = uid;
    person.entries.push(entry);
  };

  for (const row of registrations) {
    // The lead: index 0, keyed exactly as the headline stats key them.
    upsert(
      aggregate.personKey(row),
      { name: row.name, email: row.email, uid: row.uid },
      entryFor(row, events, 0)
    );

    // Teammates: no uid of their own, so their email is their identity — the
    // same match registrationLookup.js makes when they scan their QR.
    const members = Array.isArray(row.members) ? row.members : [];
    members.forEach((member, i) => {
      const email = lower(member?.email);
      if (!email) return; // nothing to key on; they stay visible inside the team's holders
      upsert(
        keyForEmail(email),
        { name: member?.name, email, uid: uidByEmail.get(email) || "" },
        entryFor(row, events, i + 1)
      );
    });
  }

  const rows = [...people.values()].map((person) => {
    const entries = person.entries.sort(
      (a, b) =>
        (a.date || "").localeCompare(b.date || "") ||
        (a.start_time || "").localeCompare(b.start_time || "") ||
        a.event_name.localeCompare(b.event_name)
    );
    // Fill the venue name now that we know the events involved.
    for (const entry of entries) {
      const event = events[entry.event_id] || {};
      entry.venue_name = venues[event.venue_id || ""]?.name || "";
    }

    return {
      person_key: person.key,
      name: person.name,
      email: person.email,
      // The door, not any one event — see the module header.
      fest_checked_in: fest.byUid.has(person.uid) || fest.byEmail.has(lower(person.email)),
      events_count: entries.length,
      attended_count: entries.filter((e) => e.ever_checked_in).length,
      entries,
    };
  });

  rows.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  return rows;
}
