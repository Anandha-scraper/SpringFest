/** Check-in: marking that someone actually turned up.
 *
 * Two separate marks, on the day, at the fest — with two different clocks
 * (services/festClock.js):
 *
 *   1. Fest entry  — any volunteer scans a personal QR and marks the *person*
 *      present at the fest. One flag per person (`fest_checkins/{uid}`), no
 *      check-out. This is the gate on the door, so it is gated on the *fest*
 *      having started and nothing narrower: someone arriving at 09:00 for an
 *      11:00 event still has to get through the door.
 *
 *   2. Event check-in — only the volunteer covering that event's venue (or an
 *      admin) checks a participant in *for that event*. Per member, per event,
 *      via `member_checkins[]` on the registration doc, check-out supported.
 *      Gated on *that event's own* [start, end) window, not just the fest's.
 *      Being event-checked-in is what makes a team visible for scoring.
 *
 * Admins satisfy the volunteer guard, skip the venue restriction, and skip the
 * clock — which is what lets the whole flow be tested from the admin account,
 * and what makes a mistyped event time fixable while the fest is running.
 */
import { verifyPersonToken } from "../auth/qrToken.js";
import { getAuth, getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { STATUS_COMPLETED } from "../utils/statuses.js";
import { requireBool, requireInt, requireString } from "../utils/validate.js";
import * as aggregate from "./aggregate.js";
import { assertEventWindowOpen, assertFestCheckinOpen } from "./festClock.js";
import { ticketHolders } from "./qr.js";
import { loadPersonRegistrations } from "./registrationLookup.js";
import { resolveVolunteerEventId } from "./submissionAccess.js";

function isCheckedIn(entry) {
  return !!entry && !entry.checked_out_at;
}

/** Has anyone on this registration ever been event-checked-in? The gate the
 * scoring dashboards use — a team stays visible even after it checks out, so
 * scores entered against it never disappear from view. */
export function everEventCheckedIn(row) {
  return Array.isArray(row?.member_checkins) && row.member_checkins.length > 0;
}

/** Scan someone's personal QR: who they are, and every event they're
 * registered for (as lead or as a team member), with each one's current
 * check-in state. Read-only — allowed before the fest opens so volunteers can
 * dry-run; only the writes below are gated. */
export async function scan({ token, actor }) {
  const raw = requireString(token, { field: "token" });
  const claim = verifyPersonToken(raw);
  if (!claim) throw new ApiError(400, "That QR code isn't valid");

  let account;
  try {
    account = await getAuth().getUser(claim.uid);
  } catch {
    throw new ApiError(404, "No account found for this QR code");
  }

  const [rows, data, volunteerEventId] = await Promise.all([
    loadPersonRegistrations({ uid: claim.uid, email: account.email || "" }),
    aggregate.loadAll(),
    actor?.is_admin ? Promise.resolve("") : resolveVolunteerEventId(actor || {}),
  ]);

  const festDoc = await getDb().collection("fest_checkins").doc(claim.uid).get();

  const registrations = rows.map((row) => {
    const holder = ticketHolders(row)[row.member_index] || {};
    const entry = (row.member_checkins || []).find((c) => c.member_index === row.member_index);
    const event = data.events[row.event_id || ""] || {};
    return {
      registration_id: row.id,
      event_id: row.event_id || "",
      event_name: event.name || row.event_id || "",
      venue_name: data.venues[event.venue_id || ""]?.name || "",
      date: event.date || "",
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      status: row.status || "",
      member_index: row.member_index,
      member_name: holder.name || "",
      // This person's code for this event, resolved from their single QR.
      allocation_code:
        (Array.isArray(row.allocation_codes) ? row.allocation_codes[row.member_index] : "") || "",
      team_name: row.team_name || "",
      checked_in: isCheckedIn(entry),
      checked_in_at: entry?.at || null,
      checked_out_at: entry?.checked_out_at || null,
      // Whether *this* volunteer may event-check-in this row: admins always,
      // otherwise only their venue's event.
      can_event_check_in:
        Boolean(actor?.is_admin) || (row.event_id || "") === volunteerEventId,
    };
  });

  return {
    uid: claim.uid,
    name: account.displayName || "",
    email: account.email || "",
    picture: account.photoURL || "",
    fest_checked_in: festDoc.exists,
    registrations,
  };
}

/** Mark a person present at the fest — the door check. One flag per uid, no
 * check-out. Any volunteer can do this for anyone. */
export async function festCheckIn({ actor, body }) {
  const uid = requireString(body.uid, { field: "uid" });
  await assertFestCheckinOpen();

  let account;
  try {
    account = await getAuth().getUser(uid);
  } catch {
    throw new ApiError(404, "No account found for this person");
  }

  const ref = getDb().collection("fest_checkins").doc(uid);
  const existing = await ref.get();
  if (!existing.exists) {
    await ref.set({
      uid,
      name: account.displayName || "",
      email: account.email || "",
      at: new Date().toISOString(),
      by: actor.email,
    });
    aggregate.invalidateLoadAll();
  }

  return {
    uid,
    name: account.displayName || "",
    fest_checked_in: true,
    already_done: existing.exists,
  };
}

/** Check a specific member of a specific registration in or out — for one
 * event. Restricted to the volunteer covering that event's venue (admins
 * unrestricted). A "no ticket, just their id" desk fallback is this call with
 * `member_index: 0` (the lead).
 *
 * Checking *in* also has to happen while the event is actually running, which
 * is a stricter gate than "the fest has begun" — see the window check below.
 * Checking *out* is deliberately never time-gated: an event ending must not
 * strand people marked present with no way to close them out. */
export async function toggle({ actor, body }) {
  const registrationId = requireString(body.registration_id, { field: "registration_id" });
  const memberIndex = requireInt(body.member_index, { field: "member_index", min: 0 });
  const checkedIn = requireBool(body.checked_in, true);

  // Returns every event, which the per-event window check below reuses rather
  // than reading the collection a second time.
  const events = await assertFestCheckinOpen();

  const db = getDb();
  const ref = db.collection("registrations").doc(registrationId);

  if (checkedIn && !actor.is_admin) {
    // One plain read to learn which event this registration is for. The
    // transaction below re-reads it authoritatively; this copy only decides
    // which clock to check. Admins bypass, exactly as they bypass the venue
    // guard — it's what makes a mistyped end_time recoverable on the day.
    const preview = await ref.get();
    if (!preview.exists) throw new ApiError(404, "Registration not found");
    const event = events.find((e) => e.id === (preview.data()?.event_id || ""));
    // A registration whose event was deleted has no window to enforce.
    if (event) assertEventWindowOpen(event, { what: "Check-in" });
  }

  let volunteerEventId = "";
  if (!actor.is_admin) {
    volunteerEventId = await resolveVolunteerEventId(actor);
    if (!volunteerEventId) {
      throw new ApiError(403, "You're not assigned to a venue.");
    }
  }

  const now = new Date().toISOString();

  const result = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new ApiError(404, "Registration not found");
    const row = doc.data() ?? {};

    if (!actor.is_admin && (row.event_id || "") !== volunteerEventId) {
      throw new ApiError(403, "This participant isn't registered for your venue's event.");
    }
    if (row.status !== STATUS_COMPLETED) {
      throw new ApiError(
        409,
        "This registration is not confirmed — payment is still pending or was rejected"
      );
    }
    const holder = ticketHolders(row)[memberIndex];
    if (!holder) throw new ApiError(404, "No such member on this registration");

    const checkins = [...(row.member_checkins || [])];
    const existingIdx = checkins.findIndex((c) => c.member_index === memberIndex);

    let entry;
    let alreadyDone = false;
    if (checkedIn) {
      if (existingIdx >= 0 && isCheckedIn(checkins[existingIdx])) {
        alreadyDone = true;
        entry = checkins[existingIdx];
      } else if (existingIdx >= 0) {
        // Checking back in after a check-out: clear the out fields rather than
        // adding a second entry, so there's one continuous record per member.
        entry = { ...checkins[existingIdx], checked_out_at: null, checked_out_by: null };
        checkins[existingIdx] = entry;
      } else {
        entry = {
          member_index: memberIndex,
          name: holder.name,
          at: now,
          by: actor.email,
          checked_out_at: null,
          checked_out_by: null,
        };
        checkins.push(entry);
      }
    } else {
      if (existingIdx < 0 || !isCheckedIn(checkins[existingIdx])) {
        alreadyDone = true;
        entry = checkins[existingIdx] || null;
      } else {
        entry = { ...checkins[existingIdx], checked_out_at: now, checked_out_by: actor.email };
        checkins[existingIdx] = entry;
      }
    }

    if (!alreadyDone) {
      tx.set(
        ref,
        {
          member_checkins: checkins,
          // "At least one member currently has no checked_out_at" — the flag
          // every existing aggregate, stat card and CSV column already reads.
          checked_in: checkins.some(isCheckedIn),
        },
        { merge: true }
      );
    }

    return { alreadyDone, entry };
  });

  aggregate.invalidateLoadAll();

  return {
    registration_id: registrationId,
    already_done: result.alreadyDone,
    member: result.entry
      ? {
          member_index: result.entry.member_index,
          name: result.entry.name,
          at: result.entry.at,
          by: result.entry.by,
          checked_in: isCheckedIn(result.entry),
          checked_out_at: result.entry.checked_out_at || null,
          checked_out_by: result.entry.checked_out_by || null,
        }
      : null,
  };
}

/** The volunteer's own dashboard: their venue, the event held there, and how
 * far along it is. */
export async function volunteerSummary({ user }) {
  const data = await aggregate.loadAll();
  const eventId = await resolveVolunteerEventId(user);
  const event = eventId ? data.events[eventId] : null;

  if (!event) {
    return { venue_id: user.venue_id || "", venue_name: "", event: null };
  }

  const regs = data.registrations.filter((r) => r.event_id === eventId);
  const completed = regs.filter((r) => r.status === STATUS_COMPLETED);

  const nameFor = (registrationId) => {
    const r = data.registrations.find((x) => x.id === registrationId);
    if (!r) return null;
    return { registration_id: r.id, team_name: r.team_name || "", name: r.name || "" };
  };

  return {
    venue_id: event.venue_id || "",
    venue_name: data.venues[event.venue_id || ""]?.name || "",
    event: {
      event_id: eventId,
      name: event.name || eventId,
      date: event.date || "",
      start_time: event.start_time || "",
      end_time: event.end_time || "",
    },
    registrations: regs.length,
    completed: completed.length,
    event_checked_in: completed.filter(everEventCheckedIn).length,
    evaluated: regs.filter((r) => r.evaluated_at).length,
    now_evaluating: event.judging_current ? nameFor(event.judging_current) : null,
    up_next: (event.judging_order || []).map(nameFor).filter(Boolean),
  };
}

/** The confirmed teams for the volunteer's event, each with per-member
 * check-in state — the bulk view behind the scan screen. */
export async function volunteerRoster({ user }) {
  const eventId = user.is_admin ? "" : await resolveVolunteerEventId(user);
  if (!eventId) return { event_id: "", participants: [] };

  const snap = await getDb().collection("registrations").where("event_id", "==", eventId).get();
  const participants = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() ?? {}) }))
    .filter((r) => r.status === STATUS_COMPLETED)
    .map((row) => ({
      registration_id: row.id,
      team_name: row.team_name || "",
      lead_name: row.name || "",
      holders: ticketHolders(row).map((h, i) => {
        const entry = (row.member_checkins || []).find((c) => c.member_index === i);
        return {
          member_index: i,
          name: h.name || "",
          allocation_code: (row.allocation_codes || [])[i] || "",
          checked_in: Boolean(entry) && !entry.checked_out_at,
        };
      }),
    }))
    .sort((a, b) => (a.team_name || a.lead_name).localeCompare(b.team_name || b.lead_name));

  return { event_id: eventId, participants };
}
