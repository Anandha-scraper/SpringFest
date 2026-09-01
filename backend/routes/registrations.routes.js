import { Router } from "express";

import * as registrations from "../controllers/registrations.controller.js";
import { CurrentUser } from "../middleware/auth.js";
import { proofUpload, submissionUpload } from "../middleware/upload.js";

export const router = Router();

router.post("/", ...CurrentUser, registrations.create);
router.post("/verify", ...CurrentUser, registrations.verify);

router.post("/:registrationId/proof", ...CurrentUser, proofUpload, registrations.proof);
router.post(
  "/:registrationId/submission",
  ...CurrentUser,
  submissionUpload,
  registrations.submission
);
router.post("/:registrationId/members", ...CurrentUser, registrations.addMember);
// PUT, not POST: there is exactly one feedback per person per registration and
// "edit it freely" means a replace. Lives here rather than under /api/me because
// every participant *write* against a registration already does (proof,
// submission, members) — /api/me is the read side and is entirely GET.
router.put("/:registrationId/feedback", ...CurrentUser, registrations.feedback);
router.get("/:registrationId/topup", ...CurrentUser, registrations.topup);
