import { Router } from "express";
import multer from "multer";

import { ApiError } from "../errors.js";
import { AdminUser } from "../middleware/auth.js";
import * as aggregate from "../services/aggregate.js";
import { getDb } from "../services/firebase.js";
import * as roles from "../services/roles.js";
import { MODE_SCREENSHOT, PAYMENT_MODES, getAppSettings, setAppSettings } from "../services/settings.js";
import { contentTypeFor, downloadBuffer, uploadBuffer } from "../services/storage.js";
import { STATUS_AWAITING_APPROVAL, STATUS_COMPLETED, STATUS_REJECTED } from "../statuses.js";
import {
  optionalString,
  parseParticipantDetails,
  parseTeamMember,
  requireBool,
  requireEmail,
  requireOneOf,
  requirePhone,
  requireString,
} from "../validate.js";
import { invalidateVenueNames, slugify as eventSlugify } from "./events.js";

export const router = Router();

export const CSV_COLUMNS = [
  "id", "name", "email", "phone", "college", "department", "year", "location",
  "event_id", "event_name", "status", "checked_in", "fee", "team_name", "team_size",
  "payment_mode", "transaction_id", "order_id", "payment_id", "payment_method",
  "created_at", "paid_at",
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

/** Signed-in account totals split by staff vs attendee (participant). Gives
 * organisers a true "how many people signed in" number rather than the
 * registration-derived `signed_users`, which only counts people who actually
 * registered. Staff = admins + judges + volunteers. */
router.get("/auth-users", ...AdminUser, async (req, res) => {
  res.json(await aggregate.countAuthByRole());
});

router.get("/participants", ...AdminUser, async (req, res) => {
  // One row per person — the Registrations screen. See services/aggregate.js
  // for why this isn't just the registration list.
  res.json(await aggregate.participantRows());
});

router.get("/venues/rollup", ...AdminUser, async (req, res) => {
  res.json(await aggregate.venueRollup());
});

/** Per-event attendance and evaluation progress — the Manage Roles view.
 *
 * MUST stay above `/events/:eventId` below: Express matches in registration
 * order, so the parameterised route would otherwise swallow "rollup" and
 * 404 looking for an event by that id. */
router.get("/events/rollup", ...AdminUser, async (req, res) => {
  res.json(await aggregate.eventRollup());
});

/** One raw event doc, for prefilling the admin edit form — including
 * `marking_criteria`, which events.js's toEvent() deliberately never emits
 * because GET /api/events is public. Mirrors /registrations/:id below. */
router.get("/events/:eventId", ...AdminUser, async (req, res) => {
  const doc = await getDb().collection("events").doc(req.params.eventId).get();
  if (!doc.exists) throw new ApiError(404, "Event not found");
  res.json({ id: doc.id, ...(doc.data() ?? {}) });
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

/** One raw registration doc — for prefilling the admin edit form. Unlike
 * `/registrations` (the flat list) and `/participants` (the per-person
 * pivot), this is the actual Firestore document, `members[]` included. */
router.get("/registrations/:registrationId", ...AdminUser, async (req, res) => {
  const doc = await getDb().collection("registrations").doc(req.params.registrationId).get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");
  res.json({ id: doc.id, ...(doc.data() ?? {}) });
});

/** Fix a typo in a registration's own details: the lead's fields and each
 * team member's, validated through the exact same rules the public form
 * uses so an edit can't introduce data the form itself wouldn't accept.
 *
 * Deliberately excludes event_id, team_size (derived from members.length,
 * not settable), fee, status, and every payment field — those stay owned by
 * the approval flow and payment verification, not this route. Editing a team
 * member's email takes effect immediately: registration lookups match
 * live against whatever `members[].email` currently says, so the old email
 * loses access to this registration the moment this write lands, with no
 * separate revocation step needed. */
router.patch("/registrations/:registrationId", ...AdminUser, async (req, res) => {
  const regRef = getDb().collection("registrations").doc(req.params.registrationId);
  const doc = await regRef.get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");
  const row = doc.data() ?? {};
  const body = req.body || {};

  const changes = {};
  if (body.name !== undefined) changes.name = requireString(body.name, { field: "name", minLength: 2 });
  if (body.email !== undefined) changes.email = requireEmail(body.email);
  if (body.phone !== undefined) changes.phone = requirePhone(body.phone);
  if (body.team_name !== undefined) changes.team_name = optionalString(body.team_name);
  if (
    body.college !== undefined ||
    body.department !== undefined ||
    body.year !== undefined ||
    body.location !== undefined
  ) {
    Object.assign(
      changes,
      parseParticipantDetails({
        college: body.college ?? row.college,
        department: body.department ?? row.department,
        year: body.year ?? row.year,
        location: body.location ?? row.location,
        location_other: body.location_other,
      })
    );
  }
  if (body.members !== undefined) {
    if (!Array.isArray(body.members) || body.members.length !== (row.members || []).length) {
      throw new ApiError(400, "members: team size can't be changed here — fix existing members' details only");
    }
    changes.members = body.members.map(parseTeamMember);
  }
  if (!Object.keys(changes).length) throw new ApiError(400, "Nothing to update");

  await regRef.set(changes, { merge: true });
  aggregate.invalidateLoadAll();
  res.json({ id: regRef.id, ...row, ...changes });
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

// ── Payment mode ─────────────────────────────────────────────
router.get("/settings", ...AdminUser, async (req, res) => {
  res.json(await getAppSettings());
});

router.put("/settings", ...AdminUser, async (req, res) => {
  const current = await getAppSettings();
  const patch = {};
  if (req.body?.payment_mode !== undefined) {
    patch.payment_mode = requireOneOf(req.body.payment_mode, PAYMENT_MODES, { field: "payment_mode" });
  }
  if (req.body?.payment_upi_id !== undefined) {
    // The lock covers the UPI id and the QR and nothing else. payment_mode
    // and registration_open stay editable while locked, deliberately — a
    // locked payment block must never freeze the gateway kill switch.
    if (current.payment_locked) {
      throw new ApiError(409, "Payment details are locked — unlock them before editing");
    }
    patch.payment_upi_id = optionalString(req.body.payment_upi_id);
  }
  if (req.body?.payment_locked !== undefined) {
    patch.payment_locked = requireBool(req.body.payment_locked);
  }
  if (req.body?.registration_open !== undefined) {
    patch.registration_open = requireBool(req.body.registration_open);
  }
  if (!Object.keys(patch).length) throw new ApiError(400, "Nothing to update");

  // Deliberately no lock on existing registrations: switching is the whole
  // point (gateway goes down mid-fest). Rows already created keep the mode
  // they were stamped with, so nothing in flight is disturbed.
  res.json(await setAppSettings(patch, req.user.email));
});

/** The payment QR participants scan. This is the admin router's only
 * multipart route, so multer is mounted per-route rather than app-wide and
 * express.json() keeps handling everything else. Mirrors proofUpload in
 * routes/registrations.js. */
const QR_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

const paymentQrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!QR_TYPES[file.mimetype]) {
      return cb(new ApiError(400, "QR must be a PNG, JPEG or WebP image"));
    }
    cb(null, true);
  },
}).single("qr");

router.post("/settings/payment-qr", ...AdminUser, paymentQrUpload, async (req, res) => {
  const current = await getAppSettings();
  if (current.payment_locked) {
    throw new ApiError(409, "Payment details are locked — unlock them before editing");
  }
  if (!req.file) throw new ApiError(400, "qr: an image file is required");

  // Timestamped, never a fixed path: uploadBuffer sets a one-year
  // cacheControl, so overwriting a stable path would leave browsers — the
  // admin's own preview included — showing last week's QR.
  const path = `payment-qr/${Date.now()}.${QR_TYPES[req.file.mimetype]}`;
  await uploadBuffer(path, req.file.buffer, req.file.mimetype);
  const saved = await setAppSettings({ payment_qr_path: path }, req.user.email);
  res.json({ ...saved, has_payment_qr: true });
});

router.delete("/settings/payment-qr", ...AdminUser, async (req, res) => {
  const current = await getAppSettings();
  if (current.payment_locked) {
    throw new ApiError(409, "Payment details are locked — unlock them before editing");
  }
  // The stored object is left in place. There is no delete helper in
  // services/storage.js and these are a handful of tiny private files — the
  // same reasoning that keeps every payment-proof attempt around.
  res.json(await setAppSettings({ payment_qr_path: "" }, req.user.email));
});

// ── Screenshot payment approvals ─────────────────────────────
router.get("/approvals", ...AdminUser, async (req, res) => {
  const data = await aggregate.loadAll();
  const rows = data.registrations.filter(
    (r) => r.payment_mode === MODE_SCREENSHOT && r.status === STATUS_AWAITING_APPROVAL
  );
  // Oldest first — this is a queue, and whoever has waited longest goes next.
  rows.sort((a, b) => (a.proof_uploaded_at || "").localeCompare(b.proof_uploaded_at || ""));

  res.json(
    rows.map((r) => ({
      ...r,
      event_name: aggregate.eventName(data.events, r.event_id || ""),
      // The screenshot is fetched from the endpoint below rather than a
      // signed URL — see there for why.
      has_proof: Boolean(r.proof_path),
    }))
  );
});

/** Stream a payment screenshot to the reviewing admin.
 *
 * Deliberately not a signed URL: signing needs a private key, and on App
 * Hosting the SDK runs on Application Default Credentials with none — it
 * would need the IAM Service Account Credentials API and a
 * serviceAccountTokenCreator grant, and would otherwise fail in production
 * while working locally. Streaming needs neither, keeps the bucket private,
 * and matches how QR tickets are served.
 */
router.get("/approvals/:registrationId/proof", ...AdminUser, async (req, res) => {
  const doc = await getDb().collection("registrations").doc(req.params.registrationId).get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");
  const proofPath = doc.data()?.proof_path;
  if (!proofPath) throw new ApiError(404, "No payment screenshot on this registration");

  const buffer = await downloadBuffer(proofPath);
  res.set("Content-Type", contentTypeFor(proofPath));
  res.send(buffer);
});

router.post("/approvals/:registrationId", ...AdminUser, async (req, res) => {
  const decision = requireOneOf(req.body?.decision, ["approve", "reject"], { field: "decision" });
  const regRef = getDb().collection("registrations").doc(req.params.registrationId);
  const reg = await regRef.get();
  if (!reg.exists) throw new ApiError(404, "Registration not found");
  const row = reg.data() ?? {};
  if (row.status !== STATUS_AWAITING_APPROVAL) {
    throw new ApiError(409, "This registration is not waiting for approval");
  }

  const now = new Date().toISOString();
  const audit = { reviewed_by: req.user.email, reviewed_at: now };

  if (decision === "reject") {
    // A rejection the participant can't act on is a dead end, so the reason
    // is mandatory — it's shown to them next to the resubmit button.
    const note = requireString(req.body?.note, { field: "note", minLength: 4 });
    await regRef.update({ status: STATUS_REJECTED, review_note: note, ...audit });
    aggregate.invalidateLoadAll();
    return res.json({ registration_id: reg.id, status: STATUS_REJECTED, ...audit });
  }

  // Approving is the screenshot-mode equivalent of a verified signature.
  await regRef.update({
    status: STATUS_COMPLETED,
    paid_at: now,
    payment_method: "manual",
    review_note: "",
    // Clears any teammate top-up that was awaiting this approval.
    amount_due: 0,
    ...audit,
  });
  aggregate.invalidateLoadAll();
  res.json({ registration_id: reg.id, status: STATUS_COMPLETED, ...audit });
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

/** What's already on file for this email, so the "Add a person" form can
 * warn before silently overwriting a role or missing that the address is
 * also a participant — surfaced to the admin, not blocked here. */
router.get("/people/:email/lookup", ...AdminUser, async (req, res) => {
  const key = roles.normalizeEmail(req.params.email);
  const seeded = roles.isSeededAdmin(key);

  let role = seeded ? roles.ROLE_ADMIN : null;
  if (!seeded) {
    const doc = await getDb().collection(roles.COLLECTION).doc(key).get();
    const docRole = doc.data()?.role;
    if (doc.exists && roles.ASSIGNABLE_ROLES.has(docRole)) role = docRole;
  }

  const data = await aggregate.loadAll();
  const regs = data.registrations.filter(
    (r) =>
      (r.email || "").toLowerCase() === key ||
      (r.user_email || "").toLowerCase() === key ||
      (r.members || []).some((m) => (m.email || "").toLowerCase() === key)
  );
  const events = [...new Set(regs.map((r) => aggregate.eventName(data.events, r.event_id || "")))];

  res.json({ email: key, role, seeded, registrations_count: regs.length, events });
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
