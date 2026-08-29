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
import { requireBool, requireString } from "../validate.js";

export const router = Router();

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
    // timestamp that contradicts the flag.
    update = { ...update, checked_in_at: "", checked_in_by: "" };
  }

  await ref.set(update, { merge: true });
  aggregate.invalidateLoadAll();
  res.json({ registration_id: registrationId, ...update });
});
