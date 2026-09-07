/** Every API router, mounted under /api. app.js mounts this one router so the
 * URL layout of the whole API is readable in a single file. */
import { Router } from "express";

import { publicSettings } from "../services/settings.js";
import { router as adminRouter } from "./admin.routes.js";
import { router as eventsRouter } from "./events.routes.js";
import { router as meRouter } from "./me.routes.js";
import { router as registrationsRouter } from "./registrations.routes.js";
import { router as sessionRouter } from "./session.routes.js";
import { router as streamRouter } from "./stream.routes.js";
import { router as venueRouter } from "./venue.routes.js";
import { router as volunteerRouter } from "./volunteer.routes.js";

export const router = Router();

// Health check. Kept under /api so `/` is free for the SPA.
router.get("/health", (req, res) => res.json({ status: "ok" }));

// The handful of settings a signed-out visitor may read — the landing page's
// instructions, and whether the fest is taking sign-ups. Public because the
// person reading them has not signed in yet and is deciding whether to.
// A strict allow-list; see services/settings.publicSettings.
router.get("/public-settings", async (req, res) => res.json(await publicSettings()));

// Sign-in/sign-out: swaps a Firebase ID token for the __session cookie that
// makes server-side rendering possible. See auth/session.js.
router.use("/session", sessionRouter);

// Live "something changed" nudges, so open dashboards stop showing a
// snapshot from whenever they loaded. See services/changeStream.js.
router.use("/stream", streamRouter);

router.use("/events", eventsRouter);
router.use("/registrations", registrationsRouter);
router.use("/me", meRouter);
// Scoring used to live under its own /judge mount. The judge role was folded
// into volunteer, so those endpoints are now part of /volunteer.
router.use("/volunteer", volunteerRouter);
router.use("/admin", adminRouter);

// The footer access code, no sign-in required. See venue.routes.js and
// services/venueAccess.service.js for why this one route group has no auth
// chain anywhere in it.
router.use("/venue", venueRouter);
