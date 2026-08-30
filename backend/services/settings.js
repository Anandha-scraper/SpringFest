/** App-wide settings — how participants pay, and whether they can register.
 *
 * Stored as a single Firestore document (`settings/app`) rather than an env
 * var because organisers change it *during* the fest: if the payment gateway
 * goes down mid-registration they switch to collecting screenshots, then
 * switch back. An env var would need a redeploy.
 *
 * The mode is deliberately NOT locked once registrations exist. A single
 * event can hold ten gateway registrations and ten screenshot ones; each
 * registration records the mode it was created under (`payment_mode` on the
 * doc) so only screenshot rows ever enter the approval queue.
 *
 * Read through the same short-TTL cache as venue names (services/cache.js) —
 * every request to POST /api/registrations needs this, and the TTL is only a
 * backstop behind the explicit invalidate on write.
 */
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { optionalString, requireBool, requireOneOf } from "../utils/validate.js";
import { cached, invalidate } from "./cache.js";
import { eventEnded } from "./festClock.js";
import { uploadBuffer } from "./storage.js";

const COLLECTION = "settings";
const DOC_ID = "app";
const CACHE_KEY = "settings:app";
const TTL_SECONDS = 30;

export const MODE_GATEWAY = "gateway";
export const MODE_SCREENSHOT = "screenshot";
export const PAYMENT_MODES = [MODE_GATEWAY, MODE_SCREENSHOT];

// Stamped on a registration whose fee works out to ₹0 — there's nothing to
// charge, so it skips both payment flows and goes straight to the admin
// approval queue for a plain "yes, you're in". Never a selectable app mode.
export const MODE_FREE = "free";

const DEFAULTS = {
  payment_mode: MODE_GATEWAY,
  // How a screenshot-mode participant is told to pay: the UPI handle they
  // send money to, and a QR they can scan instead of typing it. Replaces the
  // free-text instructions block that used to live here — nobody reads a
  // paragraph at a payment step, and a mistyped handle silently routes real
  // money to the wrong account.
  payment_upi_id: "",
  // Cloud Storage object path. Never sent to a client: the browser gets a
  // has_payment_qr boolean and streams the bytes from GET /api/me/payment-qr.
  payment_qr_path: "",
  // Once the organisers have confirmed the handle and QR are right, they lock
  // them. Enforced server-side, not just in the UI — the UPI id is the single
  // highest-consequence string in this app and there is no gateway signature
  // downstream to catch a wrong one. Covers ONLY the UPI id and the QR;
  // payment_mode and registration_open must stay switchable mid-fest.
  payment_locked: false,
  // Fest-wide switch: closing it stops new registrations (including saving a
  // new draft, or turning an existing draft into a real one) without
  // disturbing anything already paid or mid-checkout — see registrations.js.
  // Each event carries its own flag too; both must be open.
  registration_open: true,
  updated_at: "",
  updated_by: "",
};

/** Whether screenshot-mode payment is fully set up: a UPI id, a QR, and both
 * locked so they can't be edited into something wrong. One of this or the
 * gateway must be ready before a paid event can be created. */
export function screenshotPathReady(s) {
  return Boolean(s.payment_upi_id && s.payment_qr_path && s.payment_locked);
}

export async function getAppSettings() {
  return cached(CACHE_KEY, TTL_SECONDS, async () => {
    const doc = await getDb().collection(COLLECTION).doc(DOC_ID).get();
    // No document yet (fresh deployment) is not an error — the gateway is
    // the default, which is exactly how the app behaved before this existed.
    if (!doc.exists) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(doc.data() ?? {}) };
  });
}

export async function setAppSettings(patch, actorEmail = "") {
  const update = { ...patch, updated_at: new Date().toISOString(), updated_by: actorEmail };
  await getDb().collection(COLLECTION).doc(DOC_ID).set(update, { merge: true });
  invalidateAppSettings();
  return getAppSettings();
}

function invalidateAppSettings() {
  invalidate(CACHE_KEY);
}

/** The lock covers the UPI id and the QR and nothing else. payment_mode and
 * registration_open stay editable while locked, deliberately — a locked
 * payment block must never freeze the gateway kill switch. */
function assertUnlocked(current) {
  if (current.payment_locked) {
    throw new ApiError(409, "Payment details are locked — unlock them before editing");
  }
}

/** Admin edit of the settings singleton.
 *
 * Deliberately no lock on existing registrations: switching modes is the whole
 * point (gateway goes down mid-fest). Rows already created keep the mode they
 * were stamped with, so nothing in flight is disturbed. */
export async function applySettingsPatch(body, actorEmail) {
  const current = await getAppSettings();
  const patch = {};
  if (body.payment_mode !== undefined) {
    patch.payment_mode = requireOneOf(body.payment_mode, PAYMENT_MODES, { field: "payment_mode" });
  }
  if (body.payment_upi_id !== undefined) {
    assertUnlocked(current);
    patch.payment_upi_id = optionalString(body.payment_upi_id);
  }
  if (body.payment_locked !== undefined) {
    patch.payment_locked = requireBool(body.payment_locked);
  }
  if (body.registration_open !== undefined) {
    patch.registration_open = requireBool(body.registration_open);
  }
  if (!Object.keys(patch).length) throw new ApiError(400, "Nothing to update");

  return setAppSettings(patch, actorEmail);
}

/** Store the payment QR participants scan. */
export async function savePaymentQr({ file, extension, actorEmail }) {
  assertUnlocked(await getAppSettings());
  if (!file) throw new ApiError(400, "qr: an image file is required");

  // Timestamped, never a fixed path: uploadBuffer sets a one-year
  // cacheControl, so overwriting a stable path would leave browsers — the
  // admin's own preview included — showing last week's QR.
  const path = `payment-qr/${Date.now()}.${extension}`;
  await uploadBuffer(path, file.buffer, file.mimetype);
  const saved = await setAppSettings({ payment_qr_path: path }, actorEmail);
  return { ...saved, has_payment_qr: true };
}

/** Forget the payment QR. The stored object is left in place: there is no
 * delete helper in services/storage.js and these are a handful of tiny private
 * files — the same reasoning that keeps every payment-proof attempt around.
 *
 * Blocked while any paid event is still running: for screenshot-mode
 * participants that QR is the only way to pay, so it may be *replaced*
 * (savePaymentQr) but not removed until every event has closed
 * (`registration_open === false`) or ended (past its end time). */
export async function clearPaymentQr(actorEmail) {
  assertUnlocked(await getAppSettings());

  const snap = await getDb().collection("events").get();
  const running = snap.docs
    .map((d) => d.data() ?? {})
    .filter((e) => (e.fee || 0) > 0 && e.registration_open !== false && !eventEnded(e));
  if (running.length) {
    throw new ApiError(
      409,
      "The payment QR can't be removed while paid events are still running — replace it " +
        "instead, or wait until every event has closed or ended."
    );
  }

  return setAppSettings({ payment_qr_path: "" }, actorEmail);
}
