import { Router } from "express";

import { CurrentUser } from "../middleware/auth.js";
import { getDb } from "../services/firebase.js";

export const router = Router();

router.get("/", ...CurrentUser, (req, res) => {
  // The caller's identity, role, and whatever they've been assigned.
  //
  // A judge's own dashboard needs their event_ids and a volunteer's needs
  // their venue_id, and neither should have to hit an admin-only endpoint to
  // get it. Both already come off req.user — the auth middleware's role
  // lookup reads the same roles doc, so there's no second Firestore read here.
  res.json(req.user);
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
