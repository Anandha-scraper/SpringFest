import { Router } from "express";

import { CurrentUser } from "../middleware/auth.js";
import * as aggregate from "../services/aggregate.js";
import { getDb } from "../services/firebase.js";
import { loadPersonRegistrations } from "../services/registrationLookup.js";
import { personalQrPng } from "../services/qr.js";
import { getAppSettings } from "../services/settings.js";

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
