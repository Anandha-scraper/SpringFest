import { Router } from "express";

import * as streamController from "../controllers/stream.controller.js";
import { CurrentUser } from "../middleware/auth.js";

export const router = Router();

// Signed in is the whole bar: the stream carries resource names, never data.
// Anyone who can call the API at all already knows more than this tells them.
//
// Note this is reached by EventSource, which cannot set an Authorization
// header — so in practice it authenticates with the __session cookie
// (auth/session.js). The bearer path still works for anything else.
router.get("/", ...CurrentUser, streamController.stream);
