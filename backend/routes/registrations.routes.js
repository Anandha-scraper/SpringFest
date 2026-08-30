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
router.get("/:registrationId/topup", ...CurrentUser, registrations.topup);
