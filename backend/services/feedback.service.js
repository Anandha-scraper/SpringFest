/** What a participant thought of an event they attended.
 *
 * One entry per *person* per registration, not one per team: on a four-person
 * team all four sign in with the email the lead registered them under, and all
 * four get their own say. Entries live in a `feedback[]` array on the
 * registration document, keyed by `member_index` — the same shape and the same
 * join key as `member_checkins[]` in checkin.service.js, so everything that
 * already reads a registration (aggregate.loadAll(), the admin raw-doc reads,
 * the SSE nudge on the `registrations` collection) picks this up untouched.
 *
 * Its own module rather than part of registration.service.js: that one owns the
 * payment lifecycle and status transitions, and feedback has neither.
 *
 * The window is the event's own day, 00:00 to 23:59 in the fest's timezone —
 * festClock.assertEventDayOpen() already expresses exactly that, so it is
 * reused rather than reimplemented. Note it is NOT festClock.eventEnded(),
 * which closes at `end_time`: an event scheduled to finish at 14:00 would
 * otherwise lock its feedback at 14:01, in the middle of the day it ran.
 */
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { STATUS_COMPLETED } from "../utils/statuses.js";
import { optionalString, requireOneOf, requireString } from "../utils/validate.js";
import * as aggregate from "./aggregate.js";
import { assertEventDayOpen } from "./festClock.js";
import { ticketHolders } from "./qr.js";
import { matchMemberIndex } from "./registrationLookup.js";

const RATINGS = [1, 2, 3, 4, 5];
const MAX_COMMENT = 1000;

/** Every ticket holder with their own feedback, or nulls where there is none.
 *
 * The sibling of checkin.service.js's holderCheckins(), and here for the same
 * stated reason: the roster, the attendance view and the per-event admin table
 * would each rebuild this index join and drift on what "gave feedback" means. */
export function holderFeedback(row) {
  const entries = Array.isArray(row?.feedback) ? row.feedback : [];
  return ticketHolders(row).map((holder, i) => {
    const entry = entries.find((f) => f.member_index === i);
    return {
      member_index: i,
      name: holder.name || "",
      email: holder.email || "",
      given: Boolean(entry),
      rating: entry?.rating ?? null,
      comment: entry?.comment || "",
      at: entry?.at || "",
      updated_at: entry?.updated_at || "",
    };
  });
}

/** The mean rating over a set of registrations, rounded to one decimal, or
 * null when nobody has answered — so a caller can tell "no responses" from a
 * genuine zero. */
export function averageRating(rows) {
  const ratings = rows.flatMap((r) =>
    (Array.isArray(r?.feedback) ? r.feedback : []).map((f) => Number(f.rating)).filter(Boolean)
  );
  if (!ratings.length) return null;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}

function parseFeedback(body) {
  // requireOneOf rather than requireInt: the helper has no `max`, and adding
  // one would touch eight other call sites to buy a worse error message than
  // "rating: input should be one of 1, 2, 3, 4, 5".
  const rating = requireOneOf(Number(body.rating), RATINGS, { field: "rating" });
  // \r\n from a browser textarea is normalised away here rather than at any
  // reader: the CSV export separates rows with \r\n, so a stray \r inside a
  // cell splits the row and corrupts the file for every column after it.
  const comment = optionalString(body.comment).replace(/\r\n?/g, "\n").trim();
  if (comment.length > MAX_COMMENT) {
    throw new ApiError(400, `comment: keep it under ${MAX_COMMENT} characters`);
  }
  return { rating, comment };
}

/** Write (or rewrite) the caller's own feedback on one registration. */
export async function saveFeedback({ user, registrationId, body }) {
  const id = requireString(registrationId, { field: "registration_id" });
  const { rating, comment } = parseFeedback(body || {});

  const db = getDb();
  const ref = db.collection("registrations").doc(id);

  // One plain read first, so a 404 / 403 / closed-window all answer before a
  // transaction is opened. The transaction below re-reads authoritatively;
  // this copy only decides whether the request is allowed at all. Same shape
  // as checkin.service.js's preview read.
  const preview = await ref.get();
  if (!preview.exists) throw new ApiError(404, "Registration not found");
  const previewRow = preview.data() ?? {};

  // matchMemberIndex, NOT registration.service.js's ownedRegistration(): that
  // one is lead-only (`row.uid !== uid`) and would silence every teammate,
  // which is the exact opposite of what this feature is for. The index it
  // returns is also the seat to write into, so the guard and the target are
  // one call.
  if (matchMemberIndex(previewRow, { uid: user.uid, email: user.email }) < 0) {
    throw new ApiError(403, "Not your registration");
  }

  const eventSnap = await db.collection("events").doc(previewRow.event_id || "").get();
  const event = { id: eventSnap.id, ...(eventSnap.data() ?? {}) };
  // Admins skip the clock, exactly as they do for check-in and for the same
  // reason: with no override endpoint anywhere, the admin account is what
  // makes a mistyped event date recoverable — otherwise a whole event's
  // feedback is permanently unreachable. They do NOT skip the seat guard
  // above or the status check below: an admin writing feedback as somebody
  // else would poison the only data this exists to collect.
  if (!user.is_admin) assertEventDayOpen(event, { what: "Feedback" });

  const now = new Date().toISOString();
  const email = (user.email || "").toLowerCase();

  const entry = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new ApiError(404, "Registration not found");
    const row = doc.data() ?? {};

    // Re-resolved inside the transaction: an admin editing members[] between
    // the preview read and here would move which seat is the caller's.
    const memberIndex = matchMemberIndex(row, { uid: user.uid, email: user.email });
    if (memberIndex < 0) throw new ApiError(403, "Not your registration");
    if (row.status !== STATUS_COMPLETED) {
      throw new ApiError(409, "You can only leave feedback on a confirmed registration");
    }
    const holder = ticketHolders(row)[memberIndex];
    if (!holder) throw new ApiError(404, "No such member on this registration");

    const entries = [...(Array.isArray(row.feedback) ? row.feedback : [])];
    const at = entries.findIndex((f) => f.member_index === memberIndex);

    // An admin can rewrite members[] wholesale (adminReports.editRegistration),
    // so member_index alone is not an identity — after an email correction the
    // new address resolves to the old occupant's seat. Keeping `at` only when
    // the stored email still matches means a corrected address starts fresh
    // instead of inheriting, and silently editing, someone else's words.
    const previous = at >= 0 && (entries[at].email || "") === email ? entries[at] : null;

    const saved = {
      member_index: memberIndex,
      name: holder.name || "",
      email,
      rating,
      comment,
      at: previous?.at || now,
      updated_at: now,
    };
    if (at >= 0) entries[at] = saved;
    else entries.push(saved);

    // Whole-array set rather than FieldValue.arrayUnion — arrayUnion can only
    // append, and this has to be able to replace an entry in place. Same
    // read-modify-write as member_checkins.
    tx.set(ref, { feedback: entries }, { merge: true });
    return saved;
  });

  // After the transaction resolves, never inside it: a transaction callback
  // can run more than once under contention, so an invalidate in there fires
  // on rolled-back attempts too.
  aggregate.invalidateLoadAll();

  return entry;
}
