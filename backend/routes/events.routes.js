import { Router } from "express";

import * as events from "../controllers/events.controller.js";
import { AdminUser } from "../middleware/auth.js";

export const router = Router();

// ── Public reads ─────────────────────────────────────────────
router.get("/", events.list);
router.get("/:eventId", events.detail);

// ── Admin writes ─────────────────────────────────────────────
router.post("/", ...AdminUser, events.create);
router.patch("/:eventId", ...AdminUser, events.update);
router.delete("/:eventId", ...AdminUser, events.remove);
