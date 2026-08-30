import { Router } from "express";

import * as volunteer from "../controllers/volunteer.controller.js";
import { VolunteerUser } from "../middleware/auth.js";

export const router = Router();

router.post("/scan", ...VolunteerUser, volunteer.scan);
router.post("/fest-check-in", ...VolunteerUser, volunteer.festCheckIn);
router.post("/check-in/toggle", ...VolunteerUser, volunteer.toggleCheckIn);
router.get("/summary", ...VolunteerUser, volunteer.summary);
router.get("/roster", ...VolunteerUser, volunteer.roster);
router.get("/registrations/:registrationId/submission", ...VolunteerUser, volunteer.submission);
