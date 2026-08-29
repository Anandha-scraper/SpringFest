/** Check-in: marking that someone actually turned up.
 *
 * Volunteers do this on the day, at the venue. It's separate from payment —
 * a registration can be completed (paid) but never checked in (didn't show).
 * Admins satisfy the volunteer guard too, which is what lets the whole flow
 * be tested from the admin account before the volunteer screens exist.
 */
import { Router } from "express";

import { ApiError } from "../errors.js";
import { VolunteerUser } from "../middleware/auth.js";
import * as aggregate from "../services/aggregate.js";
import { getDb } from "../services/firebase.js";
import { ticketHolders, verifyToken } from "../services/qr.js";
import { STATUS_COMPLETED } from "../statuses.js";
import { requireBool, requireString } from "../validate.js";

export const router = Router();

/** Check in one person by their scanned QR ticket.
 *
 * A team registers as one document but arrives one person at a time, so
 * check-in is tracked per member in `member_checkins`. The top-level
 * `checked_in` flag is still set — every admin aggregate, stat card and CSV
 * column reads that, and "someone from this registration turned up" remains
 * the right meaning for all of them.
 */
router.post("/check-in/scan", ...VolunteerUser, async (req, res) => {
  const token = requireString(req.body?.token, { field: "token" });
  const claim = verifyToken(token);
  // Signature first: a hand-crafted or corrupted code never reaches Firestore.
  if (!claim) throw new ApiError(400, "That QR code isn't valid");

  const ref = getDb().collection("registrations").doc(claim.registrationId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");
  const row = doc.data() ?? {};

  // The signature proves we minted the ticket; this proves the registration
  // is still good. A rejected or refunded row must not get anyone through the
  // door on a ticket issued earlier.
  if (row.status !== STATUS_COMPLETED) {
    throw new ApiError(409, "This registration is not confirmed — payment is still pending or was rejected");
  }

  const holders = ticketHolders(row);
  const holder = holders[claim.memberIndex];
  if (!holder) throw new ApiError(404, "No such member on this registration");

  const existing = (row.member_checkins || []).find((c) => c.member_index === claim.memberIndex);
  if (existing) {
    // A second scan at a busy door is an accident, not an error. Report the
    // original check-in so the volunteer can see it already happened.
    return res.json({
      registration_id: claim.registrationId,
      already_checked_in: true,
      member: existing,
      event_id: row.event_id || "",
      team_name: row.team_name || "",
    });
  }

  const entry = {
    member_index: claim.memberIndex,
    name: holder.name,
    at: new Date().toISOString(),
    by: req.user.email,
  };
  await ref.set(
    {
      member_checkins: [...(row.member_checkins || []), entry],
      checked_in: true,
      checked_in_at: row.checked_in_at || entry.at,
      checked_in_by: row.checked_in_by || entry.by,
    },
    { merge: true }
  );
  aggregate.invalidateLoadAll();
  res.json({
    registration_id: claim.registrationId,
    already_checked_in: false,
    member: entry,
    event_id: row.event_id || "",
    team_name: row.team_name || "",
    team_size: holders.length,
    checked_in_count: (row.member_checkins || []).length + 1,
  });
});

/** Whole-registration check-in, by id. Predates the QR flow and stays as the
 * manual fallback for when someone turns up without their ticket. */
router.post("/check-in", ...VolunteerUser, async (req, res) => {
  const registrationId = requireString(req.body?.registration_id, { field: "registration_id" });
  const checkedIn = req.body?.checked_in === undefined ? true : requireBool(req.body.checked_in, true);

  const ref = getDb().collection("registrations").doc(registrationId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");

  let update = { checked_in: checkedIn };
  if (checkedIn) {
    update = { ...update, checked_in_at: new Date().toISOString(), checked_in_by: req.user.email };
  } else {
    // Undoing a mistaken check-in clears the trail rather than leaving a
    // timestamp that contradicts the flag — including the per-member entries,
    // which would otherwise still claim people had arrived.
    update = { ...update, checked_in_at: "", checked_in_by: "", member_checkins: [] };
  }

  await ref.set(update, { merge: true });
  aggregate.invalidateLoadAll();
  res.json({ registration_id: registrationId, ...update });
});
