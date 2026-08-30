import { Router } from "express";

import * as volunteer from "../controllers/volunteer.controller.js";
import { VolunteerUser } from "../middleware/auth.js";

export const router = Router();

router.post("/scan", ...VolunteerUser, volunteer.scan);
router.post("/check-in/toggle", ...VolunteerUser, volunteer.toggleCheckIn);
