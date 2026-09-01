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
 * `members[]` entries with a name and an email. **Every ticket holder gets
 * their own row**, teammates included — they turn up, get checked in and hold
 * an allocation code like anyone else. A teammate who also leads a
 * registration elsewhere collapses onto that same one row, holding both;
 * `utils/identity.js` is what makes those two appearances resolve together.
 *
 * (This reverses the earlier "one team is one roster" rule. The roster still
 * exists on the lead's own entry for context, but a member is no longer
 * *only* visible there.)
 *
 * Approved only, matching `participantRows()`: `checkin.toggle` refuses any
 * registration that isn't confirmed, so an unapproved row here would be a
 * line an organiser cannot act on.
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
import { holderFeedback } from "./feedback.service.js";
import * as aggregate from "./aggregate.js";
import { eventDayState } from "./festClock.js";
import { ticketHolders } from "./qr.js";
import { buildUidByEmail, keyResolver, normalizeEmail } from "../utils/identity.js";
import { STATUS_COMPLETED } from "../utils/statuses.js";

const lower = normalizeEmail;

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
  const myFeedback = holderFeedback(row)[memberIndex] || null;
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
    // …and their own feedback. The rating and whether they answered, never the
    // comment: this screen answers "who turned up", and the words belong on
    // the registrations view where there is room to read them.
    feedback_given: Boolean(myFeedback?.given),
    feedback_rating: myFeedback?.rating ?? null,
    // Has this event's day arrived? "Not arrived" is only a fair thing to say
    // about someone once their event has actually started — before that there
    // is nothing to report, and the two must not look the same. Decided
    // server-side: a browser has no equivalent of nowInFestZone() and would
    // get the midnight boundary wrong outside Asia/Kolkata.
    day_state: eventDayState(event),
    lead_name: holders[0]?.name || "",
    // Only on the lead's own entry now that every member has a row of their
    // own: repeating the roster under each of them was the same team printed
    // N times.
    holders: isTeam && memberIndex === 0 ? holders : [],
  };
}

/** Every ticket holder, with every event they hold.
 *
 * Someone appears once whether they hold one event or four, and whether they
 * created those registrations or were typed into somebody else's team. */
export async function attendanceRows(data) {
  data = data || (await aggregate.loadAll());
  const { registrations, events, venues, festCheckins } = data;
  const fest = festIndex(festCheckins);

  // The same human can reach this list down two different paths: as a lead,
  // where their Firebase uid identifies them, and as someone else's teammate,
  // where all we have is the email they were typed in as. Keying those
  // independently splits one person into two rows. Shared with
  // aggregate.participantRows() so the two screens cannot disagree — built
  // from EVERY registration, not the approved slice, so a uid learned from a
  // pending row still resolves here.
  const keyFor = keyResolver(buildUidByEmail(registrations));
  const approved = registrations.filter((r) => r.status === STATUS_COMPLETED);

  // key -> { name, email, uid, entries: [] }
  const people = new Map();

  const upsert = (key, { name, email, uid }, entry) => {
    if (!key) return;
    let person = people.get(key);
    if (!person) {
      person = { key, name: "", email: "", uid: "", from_own_account: false, entries: [] };
      people.set(key, person);
    }
    // Whose spelling of this person's name wins. Their own registration beats
    // what somebody else typed into a team roster — same provenance rule
    // aggregate.participantRows() uses, so the two screens agree on how a
    // person is named. Otherwise keep the first non-empty value: a later
    // registration with a blank field must not erase an earlier one.
    const own = Boolean(uid);
    if (own && !person.from_own_account) {
      person.name = name || person.name;
      person.email = email || person.email;
      person.from_own_account = true;
    } else {
      if (!person.name && name) person.name = name;
      if (!person.email && email) person.email = email;
    }
    if (!person.uid && uid) person.uid = uid;
    person.entries.push(entry);
  };

  // One seat, one entry — the lead at index 0 and every teammate after them.
  for (const row of approved) {
    for (const holder of ticketHolders(row)) {
      upsert(
        keyFor({ uid: holder.uid, email: holder.email }),
        { name: holder.name, email: holder.email, uid: holder.uid },
        entryFor(row, events, holder.member_index)
      );
    }
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
