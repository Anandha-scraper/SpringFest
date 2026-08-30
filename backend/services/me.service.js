/** The signed-in user's own view of the fest: their profile, their
 * registrations, their badge, and the files they're allowed to download.
 *
 * The streaming endpoints return `{ buffer, contentType, filename }` rather
 * than touching `res` — deciding *which* object a caller may read is a domain
 * question, writing the bytes out is the controller's.
 */
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import * as aggregate from "./aggregate.js";
import { personalQrPng } from "./qr.js";
import { loadPersonRegistrations, matchMemberIndex } from "./registrationLookup.js";
import { getAppSettings } from "./settings.js";
import { contentTypeFor, downloadBuffer } from "./storage.js";

/** The caller's identity, role, and whatever they've been assigned.
 *
 * A judge's own dashboard needs their event_ids and a volunteer's needs their
 * venue_id, and neither should have to hit an admin-only endpoint to get it.
 * Both already come off req.user — the auth middleware's role lookup reads the
 * same roles doc, so there's no second Firestore read here.
 *
 * The payment mode rides along because the registration form has to know which
 * UI to render (gateway checkout vs. upload a screenshot); registration_open
 * rides along for the same reason — so the form can show "closed" up front
 * instead of letting someone fill it out only to get a 403 on submit. Putting
 * both here rather than their own endpoint keeps that to zero extra round
 * trips, and it's cached server-side so it costs nothing per request. */
export async function profile(user) {
  const s = await getAppSettings();
  return {
    ...user,
    payment_mode: s.payment_mode,
    payment_upi_id: s.payment_upi_id,
    // The boolean, never payment_qr_path — that's an internal bucket address,
    // and the client only needs to know whether to fetch the image below.
    // Deriving it from the stored string rather than a bucket exists() check
    // keeps this endpoint (hit on every page load) free of any Cloud Storage
    // round trip, and unaffected by a missing STORAGE_BUCKET.
    has_payment_qr: Boolean(s.payment_qr_path),
    registration_open: s.registration_open,
  };
}

/** The payment QR participants scan to pay in screenshot mode.
 *
 * Reachable by any signed-in user, not just admins: this is the one
 * payment-related image participants themselves have to see. Admins are
 * signed-in users too, so their own preview on the Payment settings page reads
 * the same route — there is deliberately no second admin-side copy of it.
 *
 * Streamed through the API like every other stored object; see the note in
 * services/storage.js about why there are no signed URLs. */
export async function paymentQr() {
  const { payment_qr_path } = await getAppSettings();
  if (!payment_qr_path) throw new ApiError(404, "No payment QR has been uploaded");
  return {
    buffer: await downloadBuffer(payment_qr_path),
    contentType: contentTypeFor(payment_qr_path),
  };
}

/** Not just "registrations I created": a team member typed into someone else's
 * registration (matched by email — they never get a uid on the doc) sees it
 * here too, once they sign in themselves. */
export async function myRegistrations(user) {
  const db = getDb();
  const rows = await loadPersonRegistrations({ uid: user.uid, email: user.email });

  const eventsSnap = await db.collection("events").get();
  const names = Object.fromEntries(eventsSnap.docs.map((d) => [d.id, d.data()?.name || d.id]));
  for (const r of rows) r.event_name = names[r.event_id] ?? r.event_id;

  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return rows;
}

/** The team's uploaded submission file. Streamed through an authenticated
 * route (like the QR) — the storage bucket stays private. Any ticket holder on
 * the registration can fetch it, not just the lead. */
export async function submissionFile(user, registrationId) {
  const doc = await getDb().collection("registrations").doc(registrationId).get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");
  const row = doc.data() ?? {};
  if (matchMemberIndex(row, { uid: user.uid, email: user.email }) < 0) {
    throw new ApiError(403, "Not your registration");
  }
  if (!row.submission_path) throw new ApiError(404, "No file has been uploaded yet");

  return {
    buffer: await downloadBuffer(row.submission_path),
    filename: `${registrationId}.${row.submission_ext || "bin"}`,
  };
}

/** This person's personal check-in badge — one QR, not one per registration.
 * Generated on the fly (no Cloud Storage round-trip): it's cheap, and the
 * whole point is that it never needs to be reissued when they register for
 * something new. */
export async function badgePng(user) {
  return personalQrPng(user.uid);
}

/** Events ordered by how many people have signed up — most first. Reachable
 * by any signed-in user (not admin-gated), unlike the admin stats this shares
 * its count logic with. */
export async function schedule() {
  const data = await aggregate.loadAll();
  const counts = Object.fromEntries(
    aggregate.perEventCounts(data).map((e) => [e.event_id, e.count])
  );

  const rows = Object.entries(data.events).map(([id, event]) => ({
    id,
    name: event.name || id,
    venue_name: data.venues[event.venue_id || ""]?.name || "",
    date: event.date || "",
    start_time: event.start_time || "",
    end_time: event.end_time || "",
    fee: event.fee ?? 0,
    category: event.category || "",
    registration_count: counts[id] || 0,
  }));
  rows.sort((a, b) => b.registration_count - a.registration_count);
  return rows;
}
