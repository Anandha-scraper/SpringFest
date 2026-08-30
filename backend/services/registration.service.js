/** Everything a participant can do to their own registration: create or
 * resume it, upload proof of an out-of-band payment, attach a submission
 * file, add a teammate, and finish a gateway payment.
 *
 * All the rules live here rather than in the HTTP layer — the fee is always
 * `event.fee * headcount` computed server-side, team size comes from the
 * event, and status only ever advances here. See utils/statuses.js for the
 * lifecycle diagram.
 */
import { getDb } from "../config/firebase.js";
import { settings } from "../config/index.js";
import { ApiError } from "../utils/ApiError.js";
import {
  LIVE_STATUSES,
  PROOF_SUBMITTABLE,
  STATUS_AWAITING_APPROVAL,
  STATUS_COMPLETED,
  STATUS_DRAFT,
  STATUS_FAILED,
  STATUS_PENDING,
  STATUS_REJECTED,
} from "../utils/statuses.js";
import {
  optionalString,
  parseParticipantDetails,
  parseTeamMember,
  requireEmail,
  requirePhone,
  requireString,
} from "../utils/validate.js";
import * as aggregate from "./aggregate.js";
import { createOrder, fetchPaymentMethod, verifySignature } from "./payment.js";
import { MODE_GATEWAY, MODE_SCREENSHOT, getAppSettings } from "./settings.js";
import { uploadBuffer } from "./storage.js";

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

/** The per-event half of the registration gate.
 *
 * The fest-wide `registration_open` in settings/app is the master switch; each
 * event carries its own flag as well, so organisers can close one event whose
 * slots are full while the rest of the fest keeps taking entries. Both must be
 * open. Kept as its own message because "everything is closed" and "this one
 * event is closed" are different facts to someone staring at the form.
 *
 * `!== false` for the same reason toEvent() uses it: events created before the
 * field existed have no value and must read as open.
 *
 * Deliberately NOT called from verifyPayment, submitProof or resumeTopUp — a
 * payment already in flight has to be able to finish after an organiser closes
 * an event, which is the same rationale as the global switch. */
function assertEventOpen(eventData) {
  if (eventData.registration_open === false) {
    throw new ApiError(403, `Registration for "${eventData.name || "this event"}" is closed`);
  }
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

/** The caller's own registration, or a 403/404. Every route below this point
 * is scoped to one document the signed-in user owns. */
async function ownedRegistration(db, registrationId, uid, denial = "Not your registration") {
  const regRef = db.collection("registrations").doc(registrationId);
  const reg = await regRef.get();
  if (!reg.exists) throw new ApiError(404, "Registration not found");
  const row = reg.data() ?? {};
  if (row.uid !== uid) throw new ApiError(403, denial);
  return { regRef, row };
}

/** A gateway order, with the "keys aren't set up" case turned into a 503 the
 * participant can act on rather than a raw SDK failure. */
async function openOrder(amount, receipt, unavailable) {
  try {
    return await createOrder(amount, receipt);
  } catch (err) {
    if (/not configured/i.test(err.message)) throw new ApiError(503, unavailable);
    throw err;
  }
}

/** Create a registration, resume an abandoned one, or save it as a draft.
 *
 * A saved draft doesn't commit to paying, so it's exempt from nothing else —
 * full validation still applies (a draft is a real, valid registration, just
 * without a fee/order attached yet). */
export async function createOrResume({ user, body }) {
  const saveAsDraft = body.save_as_draft === true;

  const appSettings = await getAppSettings();
  if (!appSettings.registration_open) {
    // Only new commitments are blocked — a payment already in flight
    // (an existing order, or a screenshot for an already-pending row)
    // finishes through verifyPayment or submitProof, neither of which
    // checks this.
    throw new ApiError(403, "Registration is closed");
  }

  const payload = parseRegistrationCreate(body);
  const db = getDb();
  const eventDoc = await db.collection("events").doc(payload.event_id).get();
  if (!eventDoc.exists) throw new ApiError(404, "Event not found");
  const eventData = eventDoc.data() ?? {};
  assertEventOpen(eventData);
  const members = payload.members;
  // Team pricing is per person: the event's fee is what one member costs,
  // and the team is charged for everyone it's registering, lead included.
  const fee = (eventData.fee || 0) * (1 + members.length);

  // Team rules come from the event, never the client.
  if (eventData.is_team_event) {
    const size = 1 + members.length;
    const teamMin = eventData.team_min ?? 1;
    const teamMax = eventData.team_max ?? 1;
    if (!payload.team_name.trim()) {
      throw new ApiError(400, "This is a team event — give your team a name");
    }
    if (size < teamMin || size > teamMax) {
      throw new ApiError(
        400,
        `Teams for this event must have ${teamMin}–${teamMax} members (you have ${size})`
      );
    }
  } else if (members.length || payload.team_name) {
    throw new ApiError(400, "This event is for individuals, not teams");
  }

  // How this registration will be paid for is decided here, once, and
  // recorded on the row. The admin can flip the mode mid-fest (gateway down
  // -> collect screenshots -> gateway back), so rows created either side of
  // a switch have to keep behaving the way they started.
  const paymentMode = appSettings.payment_mode;
  const isScreenshot = paymentMode === MODE_SCREENSHOT;

  let regRef;
  const existing = await existingRegistration(db, user.uid, payload.event_id);
  if (existing) {
    const row = existing.data() ?? {};
    if (row.status === STATUS_COMPLETED) {
      throw new ApiError(409, "You have already registered for this event");
    }
    if (row.status === STATUS_AWAITING_APPROVAL) {
      throw new ApiError(409, "Your payment proof is already submitted and waiting for approval");
    }
    // Draft, pending or rejected: hand back the same document rather than
    // making a duplicate — the user is finishing a form they saved, resuming
    // a checkout they abandoned, or resubmitting proof an admin turned down.
    regRef = existing.ref;
    const orderId = row.order_id || "";
    if (!saveAsDraft && !isScreenshot && orderId) {
      return {
        registration_id: regRef.id,
        payment_mode: paymentMode,
        order_id: orderId,
        amount: fee * 100,
        currency: "INR",
        key_id: settings.PAYMENT_KEY_ID,
      };
    }
  } else {
    regRef = db.collection("registrations").doc();
  }

  if (saveAsDraft) {
    // No fee, no order — a draft is just the form, persisted. Submitting it
    // for real later (a normal, non-draft create) is what turns it into a
    // pending registration and computes the actual charge.
    await regRef.set({
      ...payload,
      team_size: 1 + members.length,
      uid: user.uid,
      user_email: user.email,
      payment_mode: paymentMode,
      status: STATUS_DRAFT,
      checked_in: false,
      created_at: new Date().toISOString(),
    });
    aggregate.invalidateLoadAll();
    return { registration_id: regRef.id, status: STATUS_DRAFT };
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
    // back to submitProof; an admin advances it from there.
    return {
      registration_id: regRef.id,
      payment_mode: paymentMode,
      order_id: "",
      amount: fee * 100,
      currency: "INR",
      key_id: "",
    };
  }

  const order = await openOrder(
    fee,
    regRef.id,
    "Paid registrations are temporarily unavailable — payments aren't configured"
  );
  await regRef.update({ order_id: order.id });
  return {
    registration_id: regRef.id,
    payment_mode: paymentMode,
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: settings.PAYMENT_KEY_ID,
  };
}

/** Submit (or resubmit) proof of an out-of-band payment: a transaction id
 * and a screenshot. Moves the row into the admin approval queue. */
export async function submitProof({ user, registrationId, transactionId, file, extension }) {
  const id = requireString(registrationId, { field: "registration_id" });
  // multipart text fields arrive as strings on req.body, same validators apply.
  const txnId = requireString(transactionId, { field: "transaction_id", minLength: 4 });
  if (!file) throw new ApiError(400, "screenshot: a payment screenshot is required");

  const db = getDb();
  const { regRef, row } = await ownedRegistration(db, id, user.uid);
  if (row.payment_mode !== MODE_SCREENSHOT) {
    throw new ApiError(400, "This registration is being paid through the payment gateway");
  }
  if (!PROOF_SUBMITTABLE.includes(row.status)) {
    throw new ApiError(409, "This registration is not waiting for a payment screenshot");
  }

  const uploadedAt = new Date().toISOString();
  // Timestamped rather than overwritten: a resubmission after a rejection
  // keeps the earlier attempt, so an admin can see what changed.
  const proofPath = `payment-proofs/${id}/${Date.now()}.${extension}`;
  await uploadBuffer(proofPath, file.buffer, file.mimetype);

  const update = {
    status: STATUS_AWAITING_APPROVAL,
    transaction_id: txnId,
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
  return { registration_id: id, ...update };
}

/** Attach (or replace) the team's presentation file for an event that opts in
 * to submissions. The stored object is named by the registration id — one
 * file per team, latest overwrites — unlike a payment proof, which is kept
 * per-attempt. */
export async function submitFile({ user, registrationId, file, extension }) {
  const id = requireString(registrationId, { field: "registration_id" });
  if (!file) throw new ApiError(400, "file: a submission file is required");

  const db = getDb();
  const { regRef, row } = await ownedRegistration(
    db,
    id,
    user.uid,
    "Only the team lead can upload the submission"
  );
  if (row.status === STATUS_DRAFT) {
    throw new ApiError(409, "Finish your registration before uploading a file");
  }

  const event = await db.collection("events").doc(row.event_id).get();
  if (!event.data()?.allow_submissions) {
    throw new ApiError(400, "This event isn't accepting file uploads");
  }

  const objectPath = `submissions/${id}.${extension}`;
  await uploadBuffer(objectPath, file.buffer, file.mimetype);

  const update = {
    submission_path: objectPath,
    submission_ext: extension,
    submission_filename: file.originalname || `${id}.${extension}`,
    submission_uploaded_at: new Date().toISOString(),
  };
  await regRef.update(update);
  aggregate.invalidateLoadAll();
  return { registration_id: id, ...update };
}

/** Add one more teammate to an already-confirmed team registration while
 * registration is still open. Costs one extra person's fee, collected through
 * the same payment flow the registration used. The row drops back to `pending`
 * with `amount_due` set to just the top-up, and finishes via the existing
 * proof (+ admin approval) or verify path. */
export async function addMember({ user, registrationId, body }) {
  const id = requireString(registrationId, { field: "registration_id" });
  const db = getDb();
  const { regRef, row } = await ownedRegistration(
    db,
    id,
    user.uid,
    "Only the team lead can add a teammate"
  );

  const { registration_open } = await getAppSettings();
  if (!registration_open) throw new ApiError(403, "Registration is closed");
  if (row.status !== STATUS_COMPLETED) {
    throw new ApiError(409, "You can only add a teammate to a confirmed registration");
  }

  const eventSnap = await db.collection("events").doc(row.event_id).get();
  const eventData = eventSnap.data() ?? {};
  assertEventOpen(eventData);
  if (!eventData.is_team_event) throw new ApiError(400, "This isn't a team event");

  const members = Array.isArray(row.members) ? row.members : [];
  const newSize = 2 + members.length;
  const teamMax = eventData.team_max ?? 1;
  if (newSize > teamMax) throw new ApiError(400, `Your team is full (max ${teamMax})`);

  const member = parseTeamMember(body, members.length);
  const topUp = eventData.fee || 0;
  const update = {
    members: [...members, member],
    team_size: newSize,
    fee: (eventData.fee || 0) * newSize,
  };

  if (topUp <= 0) {
    await regRef.update(update);
    aggregate.invalidateLoadAll();
    return { registration_id: id, status: STATUS_COMPLETED, amount: 0 };
  }

  update.amount_due = topUp;
  update.status = STATUS_PENDING;

  if (row.payment_mode === MODE_SCREENSHOT) {
    await regRef.update(update);
    aggregate.invalidateLoadAll();
    return {
      registration_id: id,
      payment_mode: MODE_SCREENSHOT,
      amount: topUp * 100,
      currency: "INR",
      status: STATUS_PENDING,
    };
  }

  const order = await openOrder(topUp, regRef.id, "Online payments are not configured right now");
  update.order_id = order.id;
  await regRef.update(update);
  aggregate.invalidateLoadAll();
  return {
    registration_id: id,
    payment_mode: MODE_GATEWAY,
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: settings.PAYMENT_KEY_ID,
    status: STATUS_PENDING,
  };
}

/** Payment details for resuming an in-progress teammate top-up (the lead
 * closed the sheet before paying). */
export async function resumeTopUp({ user, registrationId }) {
  const id = requireString(registrationId, { field: "registration_id" });
  const db = getDb();
  const { regRef, row } = await ownedRegistration(db, id, user.uid);

  const amountDue = row.amount_due || 0;
  const resumable = amountDue > 0 && [STATUS_PENDING, STATUS_REJECTED].includes(row.status);
  if (!resumable) throw new ApiError(409, "Nothing to pay for on this registration");

  if (row.payment_mode === MODE_SCREENSHOT) {
    const { payment_upi_id, payment_qr_path } = await getAppSettings();
    return {
      payment_mode: MODE_SCREENSHOT,
      amount_due: amountDue,
      upi_id: payment_upi_id || "",
      has_qr: Boolean(payment_qr_path),
      rejection_note: row.review_note || "",
    };
  }

  const order = await openOrder(amountDue, regRef.id, "Online payments are not configured right now");
  await regRef.update({ order_id: order.id });
  aggregate.invalidateLoadAll();
  return {
    payment_mode: MODE_GATEWAY,
    amount_due: amountDue,
    amount: order.amount,
    order_id: order.id,
    currency: order.currency,
    key_id: settings.PAYMENT_KEY_ID,
  };
}

/** Finish a gateway payment. The signature is re-checked server-side before
 * anything advances — the client's word that it paid is never enough. */
export async function verifyPayment({ user, body }) {
  const registrationId = requireString(body.registration_id, { field: "registration_id" });
  const razorpayOrderId = requireString(body.razorpay_order_id, { field: "razorpay_order_id" });
  const razorpayPaymentId = requireString(body.razorpay_payment_id, {
    field: "razorpay_payment_id",
  });
  const razorpaySignature = requireString(body.razorpay_signature, { field: "razorpay_signature" });

  const db = getDb();
  const { regRef, row } = await ownedRegistration(db, registrationId, user.uid);
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
    // A teammate top-up that just cleared owes nothing more.
    amount_due: 0,
  });
  aggregate.invalidateLoadAll();
  return { status: STATUS_COMPLETED, registration_id: registrationId };
}
