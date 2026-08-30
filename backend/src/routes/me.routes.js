import { Router } from "express";

import * as me from "../controllers/me.controller.js";
import { CurrentUser } from "../middleware/auth.js";

export const router = Router();

router.get("/", ...CurrentUser, me.profile);
router.get("/payment-qr", ...CurrentUser, me.paymentQr);
router.get("/qr", ...CurrentUser, me.badge);
router.get("/schedule", ...CurrentUser, me.schedule);
router.get("/registrations", ...CurrentUser, me.registrations);
router.get("/registrations/:registrationId/submission", ...CurrentUser, me.submission);
