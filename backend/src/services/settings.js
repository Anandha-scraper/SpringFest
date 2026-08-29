/** App-wide settings — currently just how participants pay.
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
  payment_instructions: "",
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
