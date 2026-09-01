/** The footer access code — the only unauthenticated, write-capable surface
 * in this app, so every decision here is a security decision.
 *
 * An admin generates a code per event; anyone holding it — no account, no
 * sign-in — can see that event's checked-in teams and open their submission
 * files, entered through a permanently visible field in the site footer.
 * That is a real trade: a code on a shared screen is a leak until it's
 * rotated. What keeps the blast radius to "this one event's team names and
 * files" rather than anything worse:
 *
 *   - Codes are never named in `event.service.js`'s `toEvent()` — the same
 *     allow-list technique that already keeps `marking_criteria` private.
 *     There is no public route that can leak one.
 *   - `resolveEventByCode()` gives an identical 403 for a blank code, an
 *     unknown code and a revoked code. Which of those was wrong is not this
 *     endpoint's business to say.
 *   - `venueSubmissionFile()` checks the resolved event's id against the
 *     registration's own `event_id` before streaming anything — a code for
 *     event A can never open a file that belongs to event B.
 *   - The view is a strict allow-list: lead name, their own allocation code,
 *     teammate names, whether a file exists. No email, no phone, no payment
 *     field, no other event's data.
 *
 * Rate limiting is `middleware/rateLimit.js`'s job, mounted on the routes
 * that call into this file — this module has no opinion on request volume.
 */
import { randomInt } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";

import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { STATUS_COMPLETED } from "../utils/statuses.js";
import { everEventCheckedIn, holderCheckins } from "./checkin.service.js";
import { venueNames } from "./event.service.js";
import { contentTypeFor, downloadBuffer } from "./storage.js";
import { submissionFilename } from "./submissionAccess.js";

// No 0/O/1/I/L — read aloud or off a phone screen at a noisy venue desk,
// those are exactly the characters people mistype.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;
const MAX_GENERATE_ATTEMPTS = 5;

function randomCode() {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Same normalization on the way in as on the way out: uppercase, strip
 * anything that isn't in the alphabet (spaces, a pasted dash from how it was
 * displayed). A code that normalizes to "" is never valid — checked by the
 * caller, not here, so this stays a pure string function. */
function normalize(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function isCodeTaken(db, code) {
  const snap = await db.collection("events").where("access_code", "==", code).limit(1).get();
  return !snap.empty;
}

/** Mint a code no other event is currently using. Collisions are astronomically
 * unlikely at 10 chars from a 32-letter alphabet (~2^49) — the retry exists so
 * a freak collision fails safe instead of silently handing out a duplicate. */
async function generateUniqueCode(db) {
  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
    const code = randomCode();
    if (!(await isCodeTaken(db, code))) return code;
  }
  throw new ApiError(500, "Could not generate a unique access code — try again.");
}

/** Generate (or rotate — same operation) the code for one event. The old
 * code, if any, stops working the instant this returns; there is no grace
 * overlap, which is the point of rotating one someone else has seen. */
export async function rotateAccessCode(eventId) {
  const db = getDb();
  const ref = db.collection("events").doc(eventId);
  if (!(await ref.get()).exists) throw new ApiError(404, "Event not found");

  const code = await generateUniqueCode(db);
  await ref.set({ access_code: code, access_code_updated_at: new Date().toISOString() }, { merge: true });
  return code;
}

export async function revokeAccessCode(eventId) {
  const db = getDb();
  const ref = db.collection("events").doc(eventId);
  if (!(await ref.get()).exists) throw new ApiError(404, "Event not found");
  // FieldValue.delete() removes the field entirely, not just blanks it —
  // "no code" and "code is an empty string" must not both be reachable
  // states, or an empty-string comparison could accidentally match one.
  await ref.update({ access_code: FieldValue.delete(), access_code_updated_at: new Date().toISOString() });
}

const UNIFORM_INVALID = "That code isn't valid";

/** Resolve a submitted code to its event. Blank, unknown and revoked all
 * throw the exact same error — see the module header for why. */
export async function resolveEventByCode(rawCode) {
  const code = normalize(rawCode);
  if (!code) throw new ApiError(403, UNIFORM_INVALID);

  const snap = await getDb().collection("events").where("access_code", "==", code).limit(1).get();
  if (snap.empty) throw new ApiError(403, UNIFORM_INVALID);

  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() ?? {}) };
}

/** The shaped, code-gated view: this event, and every checked-in team on it.
 * Strict allow-list — see the module header for exactly what this omits. */
export async function venueView(rawCode) {
  const event = await resolveEventByCode(rawCode);
  const venues = await venueNames();

  const snap = await getDb().collection("registrations").where("event_id", "==", event.id).get();
  const teams = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() ?? {}) }))
    .filter((row) => row.status === STATUS_COMPLETED && everEventCheckedIn(row))
    .map((row) => {
      const holders = holderCheckins(row);
      return {
        registration_id: row.id,
        team_name: row.team_name || "",
        lead_name: row.name || "",
        lead_allocation_code: holders[0]?.allocation_code || "",
        member_names: holders.slice(1).map((h) => h.name).filter(Boolean),
        has_submission: Boolean(row.submission_path),
      };
    })
    .sort((a, b) => (a.team_name || a.lead_name).localeCompare(b.team_name || b.lead_name));

  return {
    event: {
      name: event.name || event.id,
      venue_name: venues[event.venue_id || ""] || "",
      date: event.date || "",
      start_time: event.start_time || "",
      end_time: event.end_time || "",
    },
    teams,
  };
}

/** Stream one team's submission — but only if it genuinely belongs to the
 * event this code names. This is the lateral-access guard: without it, a
 * valid code for event A plus a guessed/borrowed registration id from event B
 * would open a file this code was never meant to reach. */
export async function venueSubmissionFile({ code: rawCode, registrationId }) {
  const event = await resolveEventByCode(rawCode);

  const doc = await getDb().collection("registrations").doc(registrationId).get();
  if (!doc.exists) throw new ApiError(404, "File not found");
  const row = doc.data() ?? {};

  if ((row.event_id || "") !== event.id) {
    // Deliberately the same "not found" a stranger sees for any bad id —
    // not "wrong event", which would confirm the id belongs to something.
    throw new ApiError(404, "File not found");
  }
  if (row.status !== STATUS_COMPLETED || !everEventCheckedIn(row)) {
    throw new ApiError(404, "File not found");
  }
  if (!row.submission_path) throw new ApiError(404, "No file has been uploaded yet");

  return {
    buffer: await downloadBuffer(row.submission_path),
    filename: submissionFilename(row, registrationId),
    contentType: contentTypeFor(row.submission_path),
  };
}
