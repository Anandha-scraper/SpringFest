import { Router } from "express";

import { ApiError } from "../errors.js";
import { AdminUser } from "../middleware/auth.js";
import * as aggregate from "../services/aggregate.js";
import { getDb } from "../services/firebase.js";
import * as roles from "../services/roles.js";
import { requireEmail, requireOneOf, requireString } from "../validate.js";
import { invalidateVenueNames, slugify as eventSlugify } from "./events.js";

export const router = Router();

export const CSV_COLUMNS = [
  "id", "name", "email", "phone", "college", "event_id", "event_name",
  "status", "checked_in", "fee", "team_name", "team_size",
  "order_id", "payment_id", "payment_method", "created_at", "paid_at",
];

function applyFilters(rows, eventId, status) {
  if (eventId) rows = rows.filter((r) => r.event_id === eventId);
  if (status) rows = rows.filter((r) => r.status === status);
  return rows;
}

// ── Dashboards ───────────────────────────────────────────────
router.get("/stats", ...AdminUser, async (req, res) => {
  res.json(await aggregate.buildStats());
});

router.get("/participants", ...AdminUser, async (req, res) => {
  // One row per person — the Registrations screen. See services/aggregate.js
  // for why this isn't just the registration list.
  res.json(await aggregate.participantRows());
});

router.get("/venues/rollup", ...AdminUser, async (req, res) => {
  res.json(await aggregate.venueRollup());
});

router.get("/registrations", ...AdminUser, async (req, res) => {
  // The flat, one-row-per-registration list. Kept alongside /participants
  // because the CSV export and per-event views work at this grain.
  const data = await aggregate.loadAll();
  const rows = applyFilters(data.registrations, req.query.event_id, req.query.status);
  for (const r of rows) r.event_name = aggregate.eventName(data.events, r.event_id || "");
  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  res.json(rows);
});

router.get("/events/:eventId/participants", ...AdminUser, async (req, res) => {
  const data = await aggregate.loadAll();
  const event = data.events[req.params.eventId];
  if (!event) throw new ApiError(404, "Event not found");

  const rows = data.registrations.filter((r) => r.event_id === req.params.eventId);
  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  for (const r of rows) r.event_name = event.name || req.params.eventId;
  const completed = rows.filter((r) => r.status === aggregate.STATUS_COMPLETED);

  res.json({
    event: { ...event, venue_name: data.venues[event.venue_id || ""]?.name || "" },
    total: rows.length,
    completed: completed.length,
    checked_in: rows.filter((r) => r.checked_in).length,
    revenue: completed.reduce((sum, r) => sum + (r.fee || 0), 0),
    participants: rows,
  });
});

router.get("/registrations.csv", ...AdminUser, async (req, res) => {
  const data = await aggregate.loadAll();
  const rows = applyFilters(data.registrations, req.query.event_id, req.query.status);
  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  for (const r of rows) r.event_name = aggregate.eventName(data.events, r.event_id || "");

  const csvEscape = (value) => {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvEscape(r[c] ?? "")).join(","));

  res.set("Content-Type", "text/csv");
  res.set("Content-Disposition", 'attachment; filename="registrations.csv"');
  res.send(lines.join("\r\n") + "\r\n");
});

// ── Venues ───────────────────────────────────────────────────
router.get("/venues", ...AdminUser, async (req, res) => {
  const snap = await getDb().collection("venues").get();
  const rows = snap.docs.map((d) => ({ id: d.id, name: d.data()?.name || "", created_at: d.data()?.created_at || "" }));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  res.json(rows);
});

router.post("/venues", ...AdminUser, async (req, res) => {
  const name = requireString(req.body?.name, { field: "name", minLength: 2 });
  const venueId = eventSlugify(name);
  if (!venueId) throw new ApiError(400, "Venue name must contain letters or numbers");

  const ref = getDb().collection("venues").doc(venueId);
  if ((await ref.get()).exists) throw new ApiError(409, "A venue with that name already exists");

  const data = { name: name.trim(), created_at: new Date().toISOString() };
  await ref.set(data);
  invalidateVenueNames();
  aggregate.invalidateLoadAll();
  res.status(201).json({ id: venueId, ...data });
});

router.delete("/venues/:venueId", ...AdminUser, async (req, res) => {
  const db = getDb();
  const ref = db.collection("venues").doc(req.params.venueId);
  if (!(await ref.get()).exists) throw new ApiError(404, "Venue not found");

  // An event pointing at a deleted venue would render as "Unassigned" with no
  // trace of what happened, so the event has to be moved first.
  const holderSnap = await db.collection("events").where("venue_id", "==", req.params.venueId).limit(1).get();
  if (!holderSnap.empty) {
    const holder = holderSnap.docs[0];
    throw new ApiError(409, `"${holder.data()?.name || holder.id}" is held at this venue — reassign it first`);
  }

  await ref.delete();
  invalidateVenueNames();
  aggregate.invalidateLoadAll();
  res.status(204).end();
});

// ── People / role management ─────────────────────────────────
router.get("/people", ...AdminUser, async (req, res) => {
  res.json(await roles.listPeople(req.query.role));
});

router.post("/people", ...AdminUser, async (req, res) => {
  const email = roles.normalizeEmail(requireEmail(req.body?.email));
  const role = requireOneOf(req.body?.role, [...roles.ASSIGNABLE_ROLES], { field: "role" });
  const name = req.body?.name || "";

  // Changing your own role is the realistic way to lock the last admin out.
  if (email === roles.normalizeEmail(req.user.email)) throw new ApiError(400, "You cannot change your own role");
  // Seeded admins come from ADMIN_EMAILS; a document would be ignored anyway.
  if (roles.isSeededAdmin(email)) throw new ApiError(403, "This account is managed in ADMIN_EMAILS");

  const row = await roles.upsertPerson({ email, role, name, addedBy: req.user.email });
  aggregate.invalidateLoadAll();
  res.status(201).json(row);
});

router.put("/people/:email/assignments", ...AdminUser, async (req, res) => {
  // Judges get events, volunteers get a venue.
  const key = roles.normalizeEmail(req.params.email);
  const db = getDb();

  const doc = await db.collection(roles.COLLECTION).doc(key).get();
  if (!doc.exists) throw new ApiError(404, "No role record for that address");
  const role = doc.data()?.role;

  const eventIds = req.body?.event_ids;
  if (eventIds !== undefined && eventIds !== null) {
    if (role !== roles.ROLE_JUDGE) throw new ApiError(400, "Only judges are assigned to events");
    const eventsSnap = await db.collection("events").get();
    const events = Object.fromEntries(eventsSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() ?? {}) }]));
    const missing = eventIds.filter((e) => !events[e]);
    if (missing.length) throw new ApiError(404, `Unknown event(s): ${missing.join(", ")}`);
    // A judge can hold several events but can't be in two rooms at once.
    const clash = roles.findConflict(eventIds, events);
    if (clash) {
      const [first, second] = clash;
      throw new ApiError(409, `"${first.name}" and "${second.name}" overlap in time — a judge can't cover both.`);
    }
  }

  const venueId = req.body?.venue_id;
  if (venueId !== undefined && venueId !== null) {
    if (role !== roles.ROLE_VOLUNTEER) throw new ApiError(400, "Only volunteers are allocated to a venue");
    if (venueId && !(await db.collection("venues").doc(venueId).get()).exists) {
      throw new ApiError(404, "Venue not found");
    }
  }

  const row = await roles.setAssignments(key, {
    eventIds: eventIds === null ? undefined : eventIds,
    venueId: venueId === null ? undefined : venueId,
  });
  aggregate.invalidateLoadAll();
  res.json(row);
});

router.delete("/people/:email", ...AdminUser, async (req, res) => {
  const key = roles.normalizeEmail(req.params.email);

  if (key === roles.normalizeEmail(req.user.email)) throw new ApiError(400, "You cannot remove yourself");
  if (roles.isSeededAdmin(key)) throw new ApiError(403, "This account is managed in ADMIN_EMAILS");

  if (!(await roles.removePerson(key))) throw new ApiError(404, "No role record for that address");
  aggregate.invalidateLoadAll();
  res.status(204).end();
});
