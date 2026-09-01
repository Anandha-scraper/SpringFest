import { Router } from "express";

import * as venue from "../controllers/venue.controller.js";
import { rateLimit } from "../middleware/rateLimit.js";

export const router = Router();

// No auth middleware anywhere in this file — the access code IS the
// credential. Every route is POST, code (and any id) in the body, never in
// the URL: a code in a URL ends up in server access logs and in a browser's
// own history, exactly what this is meant to avoid.
//
// This is the only unauthenticated surface in the whole API, so it is the
// only place rate limiting matters — see middleware/rateLimit.js.
const guard = rateLimit({ windowMs: 60_000, max: 10 });

router.post("/access", guard, venue.access);
router.post("/submission", guard, venue.submission);
