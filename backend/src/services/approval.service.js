/** The screenshot-payment approval queue.
 *
 * Only registrations stamped `payment_mode: screenshot` ever land here —
 * gateway rows advance on a verified signature instead. Approving one is the
 * screenshot-mode equivalent of that signature.
 */
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { STATUS_AWAITING_APPROVAL, STATUS_COMPLETED, STATUS_REJECTED } from "../utils/statuses.js";
import { requireOneOf, requireString } from "../utils/validate.js";
import * as aggregate from "./aggregate.js";
import { MODE_SCREENSHOT } from "./settings.js";
import { contentTypeFor, downloadBuffer } from "./storage.js";

export async function pending() {
  const data = await aggregate.loadAll();
  const rows = data.registrations.filter(
    (r) => r.payment_mode === MODE_SCREENSHOT && r.status === STATUS_AWAITING_APPROVAL
  );
  // Oldest first — this is a queue, and whoever has waited longest goes next.
  rows.sort((a, b) => (a.proof_uploaded_at || "").localeCompare(b.proof_uploaded_at || ""));

  return rows.map((r) => ({
    ...r,
    event_name: aggregate.eventName(data.events, r.event_id || ""),
    // The screenshot is fetched from its own endpoint rather than a signed
    // URL — see proofImage() for why.
    has_proof: Boolean(r.proof_path),
  }));
}

/** The payment screenshot itself, for the reviewing admin.
 *
 * Deliberately not a signed URL: signing needs a private key, and on App
 * Hosting the SDK runs on Application Default Credentials with none — it would
 * need the IAM Service Account Credentials API and a serviceAccountTokenCreator
 * grant, and would otherwise fail in production while working locally.
 * Streaming needs neither, keeps the bucket private, and matches how QR
 * tickets are served. */
export async function proofImage(registrationId) {
  const doc = await getDb().collection("registrations").doc(registrationId).get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");
  const proofPath = doc.data()?.proof_path;
  if (!proofPath) throw new ApiError(404, "No payment screenshot on this registration");

  return {
    buffer: await downloadBuffer(proofPath),
    contentType: contentTypeFor(proofPath),
  };
}

export async function decide({ registrationId, body, actorEmail }) {
  const decision = requireOneOf(body.decision, ["approve", "reject"], { field: "decision" });
  const regRef = getDb().collection("registrations").doc(registrationId);
  const reg = await regRef.get();
  if (!reg.exists) throw new ApiError(404, "Registration not found");
  const row = reg.data() ?? {};
  if (row.status !== STATUS_AWAITING_APPROVAL) {
    throw new ApiError(409, "This registration is not waiting for approval");
  }

  const now = new Date().toISOString();
  const audit = { reviewed_by: actorEmail, reviewed_at: now };

  if (decision === "reject") {
    // A rejection the participant can't act on is a dead end, so the reason
    // is mandatory — it's shown to them next to the resubmit button.
    const note = requireString(body.note, { field: "note", minLength: 4 });
    await regRef.update({ status: STATUS_REJECTED, review_note: note, ...audit });
    aggregate.invalidateLoadAll();
    return { registration_id: reg.id, status: STATUS_REJECTED, ...audit };
  }

  await regRef.update({
    status: STATUS_COMPLETED,
    paid_at: now,
    payment_method: "manual",
    review_note: "",
    // Clears any teammate top-up that was awaiting this approval.
    amount_due: 0,
    ...audit,
  });
  aggregate.invalidateLoadAll();
  return { registration_id: reg.id, status: STATUS_COMPLETED, ...audit };
}
