import { Router } from "express";
import multer from "multer";

import { settings } from "../config.js";
import { ApiError } from "../errors.js";
import { CurrentUser } from "../middleware/auth.js";
import * as aggregate from "../services/aggregate.js";
import { getDb } from "../services/firebase.js";
import { createOrder, fetchPaymentMethod, verifySignature } from "../services/payment.js";
import { generateForRegistration } from "../services/qr.js";
import { MODE_SCREENSHOT, getAppSettings } from "../services/settings.js";
import { uploadBuffer } from "../services/storage.js";
import {
  LIVE_STATUSES,
  PROOF_SUBMITTABLE,
  STATUS_AWAITING_APPROVAL,
  STATUS_COMPLETED,
  STATUS_FAILED,
  STATUS_PENDING,
} from "../statuses.js";
import {
  optionalString,
  parseParticipantDetails,
  parseTeamMember,
  requireEmail,
  requirePhone,
  requireString,
} from "../validate.js";

export const router = Router();

const PROOF_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const PROOF_MAX_BYTES = 5 * 1024 * 1024;

/** Multipart is mounted on this one route rather than app-wide so
 * express.json() keeps handling every other endpoint untouched. */
const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PROOF_MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!PROOF_TYPES[file.mimetype]) {
      return cb(new ApiError(400, "Screenshot must be a PNG, JPEG or WebP image"));
    }
    cb(null, true);
  },
}).single("screenshot");

/** This user's live registration for this event, if there is one.
 *
 * Guards the admin's per-person view — without it the same account could
 * appear under one event several times — and doubles as the resume path for
 * an abandoned checkout, which used to create a second document every time.
 */
async function existingRegistration(db, uid, eventId) {
  const snap = await db
    .collection("registrations")
    .where("uid", "==", uid)
    .where("event_id", "==", eventId)
    .get();
  for (const doc of snap.docs) {
    if (LIVE_STATUSES.includes(doc.data()?.status)) return doc;
  }
  return null;
}

function parseRegistrationCreate(body) {
  const members = Array.isArray(body.members) ? body.members.map(parseTeamMember) : [];
  return {
    event_id: requireString(body.event_id, { field: "event_id" }),
    name: requireString(body.name, { field: "name", minLength: 2 }),
    email: requireEmail(body.email),
    phone: requirePhone(body.phone),
    ...parseParticipantDetails(body),
    team_name: optionalString(body.team_name),
    members,
  };
}

router.post("/", ...CurrentUser, async (req, res) => {
  const payload = parseRegistrationCreate(req.body || {});
  const db = getDb();
  const eventDoc = await db.collection("events").doc(payload.event_id).get();
  if (!eventDoc.exists) throw new ApiError(404, "Event not found");
  const eventData = eventDoc.data() ?? {};
  const fee = eventData.fee || 0;

  // Team rules come from the event, never the client.
  const members = payload.members;
  if (eventData.is_team_event) {
    const size = 1 + members.length;
    const teamMin = eventData.team_min ?? 1;
    const teamMax = eventData.team_max ?? 1;
    if (!payload.team_name.trim()) throw new ApiError(400, "This is a team event — give your team a name");
    if (size < teamMin || size > teamMax) {
      throw new ApiError(400, `Teams for this event must have ${teamMin}–${teamMax} members (you have ${size})`);
    }
  } else if (members.length || payload.team_name) {
    throw new ApiError(400, "This event is for individuals, not teams");
  }

  // How this registration will be paid for is decided here, once, and
  // recorded on the row. The admin can flip the mode mid-fest (gateway down
  // -> collect screenshots -> gateway back), so rows created either side of
  // a switch have to keep behaving the way they started.
  const { payment_mode: paymentMode } = await getAppSettings();
  const isScreenshot = paymentMode === MODE_SCREENSHOT;

  const user = req.user;
  let regRef;
  const existing = await existingRegistration(db, user.uid, payload.event_id);
  if (existing) {
    const row = existing.data() ?? {};
    if (row.status === STATUS_COMPLETED) throw new ApiError(409, "You have already registered for this event");
    if (row.status === STATUS_AWAITING_APPROVAL) {
      throw new ApiError(409, "Your payment proof is already submitted and waiting for approval");
    }
    // Pending or rejected: hand back the same document rather than making a
    // duplicate — the user is finishing a checkout they abandoned, or
    // resubmitting proof an admin turned down.
    regRef = existing.ref;
    const orderId = row.order_id || "";
    if (!isScreenshot && orderId) {
      return res.json({
        registration_id: regRef.id,
        payment_mode: paymentMode,
        order_id: orderId,
        amount: fee * 100,
        currency: "INR",
        key_id: settings.PAYMENT_KEY_ID,
      });
    }
  } else {
    regRef = db.collection("registrations").doc();
  }

  await regRef.set({
    ...payload,
    team_size: 1 + members.length,
    uid: user.uid,
    user_email: user.email,
    fee,
    payment_mode: paymentMode,
    status: STATUS_PENDING,
    checked_in: false,
    created_at: new Date().toISOString(),
  });
  aggregate.invalidateLoadAll();

  if (isScreenshot) {
    // No gateway order at all. The participant pays out-of-band and comes
    // back to POST /:id/proof; an admin advances it from there.
    return res.json({
      registration_id: regRef.id,
      payment_mode: paymentMode,
      order_id: "",
      amount: fee * 100,
      currency: "INR",
      key_id: "",
    });
  }

  let order;
  try {
    order = await createOrder(fee, regRef.id);
  } catch (err) {
    if (/not configured/i.test(err.message)) {
      throw new ApiError(503, "Paid registrations are temporarily unavailable — payments aren't configured");
    }
    throw err;
  }
  await regRef.update({ order_id: order.id });
  res.json({
    registration_id: regRef.id,
    payment_mode: paymentMode,
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: settings.PAYMENT_KEY_ID,
  });
});

/** Submit (or resubmit) proof of an out-of-band payment: a transaction id
 * and a screenshot. Moves the row into the admin approval queue. */
router.post("/:registrationId/proof", ...CurrentUser, proofUpload, async (req, res) => {
  const registrationId = requireString(req.params.registrationId, { field: "registration_id" });
  // multipart text fields arrive as strings on req.body, same validators apply.
  const transactionId = requireString(req.body?.transaction_id, {
    field: "transaction_id",
    minLength: 4,
  });
  if (!req.file) throw new ApiError(400, "screenshot: a payment screenshot is required");

  const db = getDb();
  const regRef = db.collection("registrations").doc(registrationId);
  const reg = await regRef.get();
  if (!reg.exists) throw new ApiError(404, "Registration not found");
  const row = reg.data() ?? {};
  if (row.uid !== req.user.uid) throw new ApiError(403, "Not your registration");
  if (row.payment_mode !== MODE_SCREENSHOT) {
    throw new ApiError(400, "This registration is being paid through the payment gateway");
  }
  if (!PROOF_SUBMITTABLE.includes(row.status)) {
    throw new ApiError(409, "This registration is not waiting for a payment screenshot");
  }

  const uploadedAt = new Date().toISOString();
  const ext = PROOF_TYPES[req.file.mimetype];
  // Timestamped rather than overwritten: a resubmission after a rejection
  // keeps the earlier attempt, so an admin can see what changed.
  const proofPath = `payment-proofs/${registrationId}/${Date.now()}.${ext}`;
  await uploadBuffer(proofPath, req.file.buffer, req.file.mimetype);

  const update = {
    status: STATUS_AWAITING_APPROVAL,
    transaction_id: transactionId,
    proof_path: proofPath,
    proof_uploaded_at: uploadedAt,
    // Clear the previous verdict so a resubmission doesn't still show the
    // old rejection reason while it waits.
    review_note: "",
    reviewed_by: "",
    reviewed_at: "",
  };
  await regRef.update(update);
  aggregate.invalidateLoadAll();
  res.json({ registration_id: registrationId, ...update });
});

router.post("/verify", ...CurrentUser, async (req, res) => {
  const body = req.body || {};
  const registrationId = requireString(body.registration_id, { field: "registration_id" });
  const razorpayOrderId = requireString(body.razorpay_order_id, { field: "razorpay_order_id" });
  const razorpayPaymentId = requireString(body.razorpay_payment_id, { field: "razorpay_payment_id" });
  const razorpaySignature = requireString(body.razorpay_signature, { field: "razorpay_signature" });

  const db = getDb();
  const regRef = db.collection("registrations").doc(registrationId);
  const reg = await regRef.get();
  if (!reg.exists) throw new ApiError(404, "Registration not found");
  const row = reg.data() ?? {};
  if (row.uid !== req.user.uid) throw new ApiError(403, "Not your registration");
  // The order the client reports must be the one we created for this row.
  if (row.order_id && row.order_id !== razorpayOrderId) {
    throw new ApiError(400, "Order does not match this registration");
  }

  const ok = verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!ok) {
    await regRef.update({ status: STATUS_FAILED });
    aggregate.invalidateLoadAll();
    throw new ApiError(400, "Payment verification failed");
  }

  await regRef.update({
    status: STATUS_COMPLETED,
    payment_id: razorpayPaymentId,
    payment_method: await fetchPaymentMethod(razorpayPaymentId),
    paid_at: new Date().toISOString(),
    // Both confirmation paths mint the same tickets — see the admin approval
    // handler for the screenshot side. Storage being down must not undo a
    // payment that has already been verified, so a failure here is logged and
    // swallowed; the participant's QR can be regenerated later.
    qr: await generateForRegistration(registrationId, row).catch((err) => {
      console.error(`QR generation failed for ${registrationId}:`, err);
      return [];
    }),
  });
  aggregate.invalidateLoadAll();
  res.json({ status: STATUS_COMPLETED, registration_id: registrationId });
});
