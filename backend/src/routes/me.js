import { Router } from "express";

import { CurrentUser } from "../middleware/auth.js";
import * as aggregate from "../services/aggregate.js";
import { getDb } from "../services/firebase.js";
import { loadPersonRegistrations, matchMemberIndex } from "../services/registrationLookup.js";
import { personalQrPng } from "../services/qr.js";
import { getAppSettings } from "../services/settings.js";
import { contentTypeFor, downloadBuffer } from "../services/storage.js";
import { ApiError } from "../errors.js";

export const router = Router();

router.get("/", ...CurrentUser, async (req, res) => {
  // The caller's identity, role, and whatever they've been assigned.
  //
  // A judge's own dashboard needs their event_ids and a volunteer's needs
  // their venue_id, and neither should have to hit an admin-only endpoint to
  // get it. Both already come off req.user — the auth middleware's role
  // lookup reads the same roles doc, so there's no second Firestore read here.
  //
  // The payment mode rides along because the registration form has to know
  // which UI to render (gateway checkout vs. upload a screenshot); registration_open
  // rides along for the same reason — so the form can show "closed" up front
  // instead of letting someone fill it out only to get a 403 on submit.
  // Putting both here rather than their own endpoint keeps that to zero extra
  // round trips, and it's cached server-side so it costs nothing per request.
  const s = await getAppSettings();
  res.json({
    ...req.user,
    payment_mode: s.payment_mode,
    payment_upi_id: s.payment_upi_id,
    // The boolean, never payment_qr_path — that's an internal bucket address,
    // and the client only needs to know whether to fetch the image below.
    // Deriving it from the stored string rather than a bucket exists() check
    // keeps this endpoint (hit on every page load) free of any Cloud Storage
    // round trip, and unaffected by a missing STORAGE_BUCKET.
    has_payment_qr: Boolean(s.payment_qr_path),
    registration_open: s.registration_open,
  });
});

/** The payment QR participants scan to pay in screenshot mode.
 *
 * CurrentUser, not AdminUser: this is the one payment-related image that
 * participants themselves have to see. Admins are CurrentUser too, so their
 * own preview on the Payment settings page reads the same route — there is
 * deliberately no second admin-side copy of it.
 *
 * Streamed through the API like every other stored object; see the note in
 * services/storage.js about why there are no signed URLs. */
router.get("/payment-qr", ...CurrentUser, async (req, res) => {
  const { payment_qr_path } = await getAppSettings();
  if (!payment_qr_path) throw new ApiError(404, "No payment QR has been uploaded");
  const buffer = await downloadBuffer(payment_qr_path);
  res.set("Content-Type", contentTypeFor(payment_qr_path));
  res.send(buffer);
});

router.get("/registrations", ...CurrentUser, async (req, res) => {
  const db = getDb();
  // Not just "registrations I created": a team member typed into someone
  // else's registration (matched by email — they never get a uid on the doc)
  // sees it here too, once they sign in themselves.
  const rows = await loadPersonRegistrations({ uid: req.user.uid, email: req.user.email });

  const eventsSnap = await db.collection("events").get();
  const names = Object.fromEntries(eventsSnap.docs.map((d) => [d.id, d.data()?.name || d.id]));
  for (const r of rows) r.event_name = names[r.event_id] ?? r.event_id;

  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  res.json(rows);
});

/** Download the team's uploaded submission file. Streamed through this
 * authenticated route (like the QR) — the storage bucket stays private.
 * Any ticket holder on the registration can fetch it, not just the lead. */
router.get("/registrations/:registrationId/submission", ...CurrentUser, async (req, res) => {
  const ref = getDb().collection("registrations").doc(req.params.registrationId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");
  const row = doc.data() ?? {};
  if (matchMemberIndex(row, { uid: req.user.uid, email: req.user.email }) < 0) {
    throw new ApiError(403, "Not your registration");
  }
  if (!row.submission_path) throw new ApiError(404, "No file has been uploaded yet");

  const buffer = await downloadBuffer(row.submission_path);
  const name = `${req.params.registrationId}.${row.submission_ext || "bin"}`;
  res.set("Content-Disposition", `attachment; filename="${name}"`);
  res.set("Content-Type", "application/octet-stream");
  res.send(buffer);
});

/** This person's personal check-in badge — one QR, not one per registration.
 * Generated on the fly (no Cloud Storage round-trip): it's cheap, and the
 * whole point is that it never needs to be reissued when they register for
 * something new. */
router.get("/qr", ...CurrentUser, async (req, res) => {
  const png = await personalQrPng(req.user.uid);
  res.set("Content-Type", "image/png");
  res.send(png);
});

/** Events ordered by how many people have signed up — most first. Reachable
 * by any signed-in user (not admin-gated), unlike the admin stats this
 * shares its count logic with. */
router.get("/schedule", ...CurrentUser, async (req, res) => {
  const data = await aggregate.loadAll();
  const counts = Object.fromEntries(aggregate.perEventCounts(data).map((e) => [e.event_id, e.count]));

  const rows = Object.entries(data.events).map(([id, event]) => ({
    id,
    name: event.name || id,
    venue_name: data.venues[event.venue_id || ""]?.name || "",
    date: event.date || "",
    start_time: event.start_time || "",
    end_time: event.end_time || "",
    fee: event.fee ?? 0,
    category: event.category || "",
    registration_count: counts[id] || 0,
  }));
  rows.sort((a, b) => b.registration_count - a.registration_count);
  res.json(rows);
});
