/** Every API router, mounted under /api. app.js mounts this one router so the
 * URL layout of the whole API is readable in a single file. */
import { Router } from "express";

import { router as adminRouter } from "./admin.routes.js";
import { router as eventsRouter } from "./events.routes.js";
import { router as meRouter } from "./me.routes.js";
import { router as registrationsRouter } from "./registrations.routes.js";
import { router as sessionRouter } from "./session.routes.js";
import { router as volunteerRouter } from "./volunteer.routes.js";

export const router = Router();

// Health check. Kept under /api so `/` is free for the SPA.
router.get("/health", (req, res) => res.json({ status: "ok" }));

// Sign-in/sign-out: swaps a Firebase ID token for the __session cookie that
// makes server-side rendering possible. See auth/session.js.
router.use("/session", sessionRouter);

router.use("/events", eventsRouter);
router.use("/registrations", registrationsRouter);
router.use("/me", meRouter);
// Scoring used to live under its own /judge mount. The judge role was folded
// into volunteer, so those endpoints are now part of /volunteer.
router.use("/volunteer", volunteerRouter);
router.use("/admin", adminRouter);
