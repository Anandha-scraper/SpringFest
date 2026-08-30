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
import { cached, invalidate } from "./cache.js";
import { getDb } from "./firebase.js";

const COLLECTION = "settings";
const DOC_ID = "app";
const CACHE_KEY = "settings:app";
const TTL_SECONDS = 30;

export const MODE_GATEWAY = "gateway";
export const MODE_SCREENSHOT = "screenshot";
export const PAYMENT_MODES = [MODE_GATEWAY, MODE_SCREENSHOT];

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

export function invalidateAppSettings() {
  invalidate(CACHE_KEY);
}
