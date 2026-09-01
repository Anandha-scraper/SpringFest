/** The signed-in user's own view of the fest: their profile, their
 * registrations, their badge, and the files they're allowed to download.
 *
 * The streaming endpoints return `{ buffer, contentType, filename }` rather
 * than touching `res` — deciding *which* object a caller may read is a domain
 * question, writing the bytes out is the controller's.
 */
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { STATUS_COMPLETED } from "../utils/statuses.js";
import * as aggregate from "./aggregate.js";
import { personalQrPng } from "./qr.js";
import { loadPersonRegistrations, matchMemberIndex } from "./registrationLookup.js";
import { getAppSettings } from "./settings.js";
import { eventDayState } from "./festClock.js";
import { contentTypeFor, downloadBuffer } from "./storage.js";
import { submissionFilename } from "./submissionAccess.js";

/** The caller's identity, role, and whatever they've been assigned.
 *
 * A volunteer's own dashboard needs their venue_id, and shouldn't have to hit
 * an admin-only endpoint to get it. It already comes off req.user — the auth middleware's role lookup reads the
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
    // Same argument as registration_open: the event page can say "you're at
    // your limit for this category" before someone fills the form in, rather
    // than letting them submit into a 409.
    category_limits: s.category_limits || {},
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

  // The whole event doc, not just its name: the feedback window below is a
  // fest-timezone wall-clock comparison, and a browser has no equivalent of
  // festClock.nowInFestZone() — a client comparing a bare "YYYY-MM-DD" against
  // its own clock is wrong by hours outside Asia/Kolkata, and wrong exactly at
  // the midnight boundary that decides the answer. This scan already ran for
  // the names, so deciding it here is free.
  const eventsSnap = await db.collection("events").get();
  const events = Object.fromEntries(eventsSnap.docs.map((d) => [d.id, d.data() ?? {}]));
  for (const r of rows) {
    const event = events[r.event_id] || {};
    r.event_name = event.name || r.event_id;
    r.feedback_state = eventDayState(event);
    r.feedback_closes_at = event.date ? `${event.date}T23:59` : "";

    // Everything else on this row is shared by design — the roster, the
    // allocation codes, what each teammate typed about themselves. Feedback
    // isn't: it is the one field a holder writes *about* the event, often
    // about the people running it. Shipping the array raw would let a teammate
    // read the lead's, which changes what people are willing to write and so
    // quietly destroys the data this exists to collect.
    const mine = (Array.isArray(r.feedback) ? r.feedback : []).find(
      (f) => f.member_index === r.member_index
    );
    r.my_feedback = mine || null;
    // Safe: loadPersonRegistrations builds a fresh { id, ...doc.data() } object
    // per row, not a live snapshot.
    delete r.feedback;
  }

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
    filename: submissionFilename(row, registrationId),
    contentType: contentTypeFor(row.submission_path),
  };
}

/** This person's personal check-in badge — one QR, not one per registration.
 * Generated on the fly (no Cloud Storage round-trip): it's cheap, and the
 * whole point is that it never needs to be reissued when they register for
 * something new.
 *
 * Withheld until at least one registration is `completed`: an unconfirmed
 * request carries no allocation codes, so the pass would scan to nothing —
 * and it shouldn't look like a ticket before an organiser has said yes. */
export async function badgePng(user) {
  const rows = await loadPersonRegistrations({ uid: user.uid, email: user.email });
  if (!rows.some((r) => r.status === STATUS_COMPLETED)) {
    throw new ApiError(409, "Your entry pass unlocks once an organiser confirms your registration.");
  }
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
