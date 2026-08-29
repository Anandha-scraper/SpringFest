import { Router } from "express";

import { settings } from "../config.js";
import { ApiError } from "../errors.js";
import { CurrentUser } from "../middleware/auth.js";
import * as aggregate from "../services/aggregate.js";
import { getDb } from "../services/firebase.js";
import { createOrder, fetchPaymentMethod, verifySignature } from "../services/payment.js";
import { optionalString, parseTeamMember, requireEmail, requirePhone, requireString } from "../validate.js";

export const router = Router();

const STATUS_PENDING = "pending";
const STATUS_COMPLETED = "completed";
const STATUS_FAILED = "failed";

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
    if ([STATUS_PENDING, STATUS_COMPLETED].includes(doc.data()?.status)) return doc;
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
    college: optionalString(body.college),
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

  const user = req.user;
  let regRef;
  const existing = await existingRegistration(db, user.uid, payload.event_id);
  if (existing) {
    const row = existing.data() ?? {};
    if (row.status === STATUS_COMPLETED) throw new ApiError(409, "You have already registered for this event");
    // Pending: hand back the same document (and order) rather than making a
    // duplicate — the user is finishing a checkout they abandoned.
    regRef = existing.ref;
    const orderId = row.order_id || "";
    if (fee > 0 && orderId) {
      return res.json({
        registration_id: regRef.id,
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
    status: STATUS_PENDING,
    checked_in: false,
    created_at: new Date().toISOString(),
  });
  aggregate.invalidateLoadAll();

  if (fee <= 0) {
    await regRef.update({ status: STATUS_COMPLETED });
    return res.json({
      registration_id: regRef.id,
      order_id: "",
      amount: 0,
      currency: "INR",
      key_id: settings.PAYMENT_KEY_ID,
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
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: settings.PAYMENT_KEY_ID,
  });
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
  });
  aggregate.invalidateLoadAll();
  res.json({ status: STATUS_COMPLETED, registration_id: registrationId });
});
