import { Router } from "express";

import * as session from "../controllers/session.controller.js";
import { CurrentUser } from "../middleware/auth.js";

export const router = Router();

// Creating a session is how you become authenticated, so it cannot require
// being authenticated — the posted ID token is the credential, and
// auth/session.js verifies it (and refuses one from a stale sign-in).
router.post("/", session.create);

// Destroying one does require it: revoking every refresh token for an account
// is not something an anonymous caller gets to do to a uid they name.
router.delete("/", ...CurrentUser, session.destroy);
