import { Router } from "express";

import { ApiError } from "../errors.js";
import { CurrentUser } from "../middleware/auth.js";
import { getDb } from "../services/firebase.js";
import { getAppSettings } from "../services/settings.js";
import { downloadBuffer } from "../services/storage.js";

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
  // which UI to render (gateway checkout vs. upload a screenshot). Putting it
  // here rather than on its own endpoint keeps that to zero extra round trips,
  // and it's cached server-side so it costs nothing per request.
  const { payment_mode, payment_instructions } = await getAppSettings();
  res.json({ ...req.user, payment_mode, payment_instructions });
});

router.get("/registrations", ...CurrentUser, async (req, res) => {
  const db = getDb();
  const regsSnap = await db.collection("registrations").where("uid", "==", req.user.uid).get();
  const rows = regsSnap.docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }));

  const eventsSnap = await db.collection("events").get();
  const names = Object.fromEntries(eventsSnap.docs.map((d) => [d.id, d.data()?.name || d.id]));
  for (const r of rows) r.event_name = names[r.event_id] ?? r.event_id;

  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  res.json(rows);
});

/** Stream one member's QR ticket.
 *
 * Served through the API rather than handing out a bucket URL so the bucket
 * stays private and the download stays tied to the signed-in owner — same
 * reasoning as the admin CSV export.
 */
router.get("/registrations/:registrationId/qr/:memberIndex", ...CurrentUser, async (req, res) => {
  const doc = await getDb().collection("registrations").doc(req.params.registrationId).get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");
  const row = doc.data() ?? {};
  if (row.uid !== req.user.uid) throw new ApiError(403, "Not your registration");

  const memberIndex = Number(req.params.memberIndex);
  const ticket = (row.qr || []).find((t) => t.member_index === memberIndex);
  if (!ticket) throw new ApiError(404, "No ticket for that member");

  const buffer = await downloadBuffer(ticket.path);
  const safeName = (ticket.name || `member-${memberIndex}`).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  res.set("Content-Type", "image/png");
  res.set("Content-Disposition", `attachment; filename="ticket-${safeName}.png"`);
  res.send(buffer);
});
