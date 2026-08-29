/** Check-in: marking that someone actually turned up.
 *
 * Volunteers do this on the day, at the venue. It's separate from payment —
 * a registration can be completed (paid) but never checked in (didn't show).
 * Admins satisfy the volunteer guard too, which is what lets the whole flow
 * be tested from the admin account before the volunteer screens exist.
 *
 * Check-in is per-member, per-event: a team registers as one document but
 * arrives one person at a time, and each of them may need to leave and come
 * back (check-out), so `member_checkins[]` entries are attributed on both
 * sides rather than just the one flag the old whole-registration fallback
 * used to flip.
 */
import { Router } from "express";

import { ApiError } from "../errors.js";
import { VolunteerUser } from "../middleware/auth.js";
import * as aggregate from "../services/aggregate.js";
import { getAuth, getDb } from "../services/firebase.js";
import { loadPersonRegistrations } from "../services/registrationLookup.js";
import { ticketHolders, verifyPersonToken } from "../services/qr.js";
import { STATUS_COMPLETED } from "../statuses.js";
import { requireBool, requireInt, requireString } from "../validate.js";

export const router = Router();

function isCheckedIn(entry) {
  return !!entry && !entry.checked_out_at;
}

/** Scan someone's personal QR: who they are, and every event they're
 * registered for (as lead or as a team member), with each one's current
 * check-in state. */
router.post("/scan", ...VolunteerUser, async (req, res) => {
  const token = requireString(req.body?.token, { field: "token" });
  const claim = verifyPersonToken(token);
  if (!claim) throw new ApiError(400, "That QR code isn't valid");

  let account;
  try {
    account = await getAuth().getUser(claim.uid);
  } catch {
    throw new ApiError(404, "No account found for this QR code");
  }

  const [rows, data] = await Promise.all([
    loadPersonRegistrations({ uid: claim.uid, email: account.email || "" }),
    aggregate.loadAll(),
  ]);

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
      team_name: row.team_name || "",
      checked_in: isCheckedIn(entry),
      checked_in_at: entry?.at || null,
      checked_out_at: entry?.checked_out_at || null,
    };
  });

  res.json({
    uid: claim.uid,
    name: account.displayName || "",
    email: account.email || "",
    picture: account.photoURL || "",
    registrations,
  });
});

/** Check a specific member of a specific registration in or out. The only
 * check-in write path — a "no ticket, just their id" desk fallback is just
 * this call with `member_index: 0` (the lead). */
router.post("/check-in/toggle", ...VolunteerUser, async (req, res) => {
  const registrationId = requireString(req.body?.registration_id, { field: "registration_id" });
  const memberIndex = requireInt(req.body?.member_index, { field: "member_index", min: 0 });
  const checkedIn = requireBool(req.body?.checked_in, true);

  const ref = getDb().collection("registrations").doc(registrationId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");
  const row = doc.data() ?? {};

  if (row.status !== STATUS_COMPLETED) {
    throw new ApiError(409, "This registration is not confirmed — payment is still pending or was rejected");
  }
  const holder = ticketHolders(row)[memberIndex];
  if (!holder) throw new ApiError(404, "No such member on this registration");

  const checkins = row.member_checkins || [];
  const existingIdx = checkins.findIndex((c) => c.member_index === memberIndex);
  const now = new Date().toISOString();

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
        by: req.user.email,
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
      entry = { ...checkins[existingIdx], checked_out_at: now, checked_out_by: req.user.email };
      checkins[existingIdx] = entry;
    }
  }

  await ref.set(
    {
      member_checkins: checkins,
      checked_in: checkins.some(isCheckedIn),
    },
    { merge: true }
  );
  aggregate.invalidateLoadAll();

  res.json({
    registration_id: registrationId,
    already_done: alreadyDone,
    member: entry
      ? {
          member_index: entry.member_index,
          name: entry.name,
          at: entry.at,
          by: entry.by,
          checked_in: isCheckedIn(entry),
          checked_out_at: entry.checked_out_at || null,
          checked_out_by: entry.checked_out_by || null,
        }
      : null,
  });
});
