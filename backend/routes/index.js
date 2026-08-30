/** Every API router, mounted under /api. app.js mounts this one router so the
 * URL layout of the whole API is readable in a single file. */
import { Router } from "express";

import { router as adminRouter } from "./admin.routes.js";
import { router as eventsRouter } from "./events.routes.js";
import { router as judgeRouter } from "./judge.routes.js";
import { router as meRouter } from "./me.routes.js";
import { router as registrationsRouter } from "./registrations.routes.js";
import { router as volunteerRouter } from "./volunteer.routes.js";

export const router = Router();

// Health check. Kept under /api so `/` is free for the SPA.
router.get("/health", (req, res) => res.json({ status: "ok" }));

router.use("/events", eventsRouter);
router.use("/registrations", registrationsRouter);
router.use("/me", meRouter);
router.use("/volunteer", volunteerRouter);
router.use("/judge", judgeRouter);
router.use("/admin", adminRouter);
