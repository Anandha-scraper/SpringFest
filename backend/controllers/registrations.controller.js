/** HTTP layer for /api/registrations. The uploaded file arrives on `req.file`
 * from middleware/upload.js; the extension for the stored object comes from
 * the same mime maps that accepted it. */
import { IMAGE_TYPES, SUBMISSION_TYPES } from "../middleware/upload.js";
import * as registrations from "../services/registration.service.js";

export async function create(req, res) {
  res.json(await registrations.createOrResume({ user: req.user, body: req.body || {} }));
}

export async function proof(req, res) {
  res.json(
    await registrations.submitProof({
      user: req.user,
      registrationId: req.params.registrationId,
      transactionId: req.body?.transaction_id,
      file: req.file,
      extension: IMAGE_TYPES[req.file?.mimetype],
    })
  );
}

export async function submission(req, res) {
  res.json(
    await registrations.submitFile({
      user: req.user,
      registrationId: req.params.registrationId,
      file: req.file,
      extension: SUBMISSION_TYPES[req.file?.mimetype],
    })
  );
}

export async function addMember(req, res) {
  res.json(
    await registrations.addMember({
      user: req.user,
      registrationId: req.params.registrationId,
      body: req.body || {},
    })
  );
}

export async function topup(req, res) {
  res.json(
    await registrations.resumeTopUp({
      user: req.user,
      registrationId: req.params.registrationId,
    })
  );
}

export async function verify(req, res) {
  res.json(await registrations.verifyPayment({ user: req.user, body: req.body || {} }));
}
