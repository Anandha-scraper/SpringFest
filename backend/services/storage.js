/** Cloud Storage access for the two binary artefacts this app produces:
 * payment-proof screenshots (uploaded by participants) and QR tickets
 * (generated on confirmation).
 *
 * The bucket is private. Nothing here ever makes an object public — admins
 * view proofs through short-lived signed URLs, participants download their
 * QR through an authenticated API route that streams the bytes. That keeps
 * the same "backend is the sole authority" posture as Firestore: the browser
 * never holds a durable handle on storage.
 *
 * Like services/payment.js, a missing configuration degrades to a 503 on the
 * routes that need it rather than crashing the server at boot.
 */
import { ApiError } from "../utils/ApiError.js";
import { settings } from "../config/index.js";
import { getStorage } from "../config/firebase.js";

function getBucket() {
  if (!settings.STORAGE_BUCKET) {
    throw new ApiError(503, "File storage is not configured (STORAGE_BUCKET)");
  }
  return getStorage().bucket(settings.STORAGE_BUCKET);
}

export async function uploadBuffer(objectPath, buffer, contentType) {
  const file = getBucket().file(objectPath);
  await file.save(buffer, {
    contentType,
    // These objects are addressed by path from Firestore, never guessed, and
    // are replaced rather than edited — so a long cache is safe and keeps
    // repeat views of a proof or a QR off the network.
    metadata: { cacheControl: "private, max-age=31536000" },
  });
  return objectPath;
}

/** Note: there is deliberately no signed-URL helper here. Signing requires a
 * private key, and on App Hosting the SDK runs on Application Default
 * Credentials with none — it would need the IAM Service Account Credentials
 * API plus a serviceAccountTokenCreator grant, and would fail in production
 * while working locally off serviceAccountKey.json. Both proofs and tickets
 * are streamed through authenticated routes instead. */
export async function downloadBuffer(objectPath) {
  const file = getBucket().file(objectPath);
  const [exists] = await file.exists();
  if (!exists) throw new ApiError(404, "File not found");
  const [buffer] = await file.download();
  return buffer;
}

/** Objects are stored with the extension we validated on upload, so the path
 * is enough to name the type back — no need to store it separately. Shared by
 * every route that streams bytes: payment proofs (admin.js) and the payment
 * QR (me.js). */
export function contentTypeFor(objectPath) {
  const ext = objectPath.slice(objectPath.lastIndexOf(".") + 1).toLowerCase();
  return { png: "image/png", jpg: "image/jpeg", webp: "image/webp" }[ext] || "application/octet-stream";
}
