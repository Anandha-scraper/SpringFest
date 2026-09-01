import { Router } from "express";

import * as volunteer from "../controllers/volunteer.controller.js";
import { VolunteerUser } from "../middleware/auth.js";

export const router = Router();

// ── Check-in ─────────────────────────────────────────────────
router.post("/scan", ...VolunteerUser, volunteer.scan);
router.post("/fest-check-in", ...VolunteerUser, volunteer.festCheckIn);
router.post("/check-in/toggle", ...VolunteerUser, volunteer.toggleCheckIn);
router.get("/summary", ...VolunteerUser, volunteer.summary);
router.get("/roster", ...VolunteerUser, volunteer.roster);
router.get("/registrations/:registrationId/submission", ...VolunteerUser, volunteer.submission);

// ── Scoring ──────────────────────────────────────────────────
// These were /api/judge/* before the judge role was folded into volunteer.
// Literal paths before their `/:param` siblings — Express matches in order.
router.get("/events", ...VolunteerUser, volunteer.events);
router.get("/events/:eventId/participants", ...VolunteerUser, volunteer.participants);
router.get("/events/:eventId/queue", ...VolunteerUser, volunteer.getQueue);
router.put("/events/:eventId/queue", ...VolunteerUser, volunteer.setQueue);
router.post("/events/:eventId/evaluations", ...VolunteerUser, volunteer.saveEvaluation);
router.delete(
  "/events/:eventId/evaluations/:registrationId",
  ...VolunteerUser,
  volunteer.deleteEvaluation
);
