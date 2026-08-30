import { Router } from "express";

import * as judge from "../controllers/judge.controller.js";
import { JudgeUser } from "../middleware/auth.js";

export const router = Router();

// Literal paths before their `/:param` siblings — Express matches in order.
router.get("/events", ...JudgeUser, judge.events);
router.get("/events/:eventId/participants", ...JudgeUser, judge.participants);
router.get("/events/:eventId/queue", ...JudgeUser, judge.getQueue);
router.put("/events/:eventId/queue", ...JudgeUser, judge.setQueue);
router.post("/events/:eventId/evaluations", ...JudgeUser, judge.saveEvaluation);
router.delete("/events/:eventId/evaluations/:registrationId", ...JudgeUser, judge.deleteEvaluation);
router.get("/registrations/:registrationId/submission", ...JudgeUser, judge.submission);
