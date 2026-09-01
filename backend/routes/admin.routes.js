import { Router } from "express";

import * as admin from "../controllers/admin.controller.js";
import { AdminUser } from "../middleware/auth.js";
import { paymentQrUpload } from "../middleware/upload.js";

export const router = Router();

// Every route here is admin-gated; the chain is spread onto each one rather
// than router.use()'d so the guard is visible on the line it protects.

// ── Dashboards ───────────────────────────────────────────────
router.get("/stats", ...AdminUser, admin.stats);
router.get("/auth-users", ...AdminUser, admin.authUsers);
router.get("/participants", ...AdminUser, admin.participants);
router.get("/attendance", ...AdminUser, admin.attendanceRows);
router.get("/venues/rollup", ...AdminUser, admin.venuesRollup);

// ── Events ───────────────────────────────────────────────────
// `/events/rollup` MUST stay above `/events/:eventId`: Express matches in
// registration order, so the parameterised route would otherwise swallow
// "rollup" and 404 looking for an event by that id.
router.get("/events/rollup", ...AdminUser, admin.eventsRollup);
router.get("/events/:eventId", ...AdminUser, admin.rawEvent);
router.get("/events/:eventId/participants", ...AdminUser, admin.eventParticipants);
router.get("/events/:eventId/results", ...AdminUser, admin.eventResults);

// ── Registrations ────────────────────────────────────────────
// Likewise, the literal `.csv` path stays above `/registrations/:id`.
router.get("/registrations.csv", ...AdminUser, admin.registrationsCsv);
router.get("/registrations", ...AdminUser, admin.listRegistrations);
router.get("/registrations/:registrationId", ...AdminUser, admin.rawRegistration);
router.patch("/registrations/:registrationId", ...AdminUser, admin.editRegistration);

// ── Payment settings ─────────────────────────────────────────
router.get("/settings", ...AdminUser, admin.settings);
router.put("/settings", ...AdminUser, admin.updateSettings);
router.post("/settings/payment-qr", ...AdminUser, paymentQrUpload, admin.uploadPaymentQr);
router.delete("/settings/payment-qr", ...AdminUser, admin.deletePaymentQr);

// ── Screenshot payment approvals ─────────────────────────────
router.get("/approvals", ...AdminUser, admin.approvalQueue);
router.get("/approvals/:registrationId/proof", ...AdminUser, admin.approvalProof);
router.post("/approvals/:registrationId", ...AdminUser, admin.decideApproval);

// ── Venues ───────────────────────────────────────────────────
router.get("/venues", ...AdminUser, admin.listVenues);
router.post("/venues", ...AdminUser, admin.createVenue);
router.delete("/venues/:venueId", ...AdminUser, admin.deleteVenue);

// ── People / role management ─────────────────────────────────
router.get("/people", ...AdminUser, admin.listPeople);
router.get("/people/:email/lookup", ...AdminUser, admin.lookupPerson);
router.post("/people", ...AdminUser, admin.addPerson);
router.put("/people/:email/assignments", ...AdminUser, admin.setAssignments);
router.delete("/people/:email", ...AdminUser, admin.removePerson);
