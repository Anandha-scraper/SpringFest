/** Who owns an email address and a phone number.
 *
 * Three rules, all enforced here:
 *   1. one email may appear at most once per event, across every ticket holder
 *   2. one phone may appear at most once per event, likewise
 *   3. fest-wide, a phone number belongs to one email address
 *
 * Rules 1 and 2 stop a person registering twice for one event — under a second
 * Google account, or by being typed onto two different teams — which no
 * existing check caught: `existingRegistration()` keys on uid + event_id, and
 * a teammate has no uid at all. Rule 3 stops one number being used to
 * manufacture a second identity.
 *
 * **Why a separate collection with meaningful document ids.** Firestore has no
 * unique index, and a query-then-write ("is this email taken? no? write it")
 * is racy by construction — two simultaneous submissions both read "no". A
 * document id, on the other hand, is unique by definition, and reading it
 * inside a transaction takes a lock on it. Four collections here already work
 * this way: `roles/{email}`, `events/{slug}`, `fest_checkins/{uid}`,
 * `counters/{eventId}`.
 *
 * **Why `tx.get` + `tx.set` rather than `tx.create`.** `tx.create()` looks like
 * the obvious fit — it fails if the document exists — but it cannot express
 * *takeover*, and takeover is not optional:
 *
 *   - `LIVE_STATUSES` deliberately excludes `failed` so a declined card lets
 *     someone start over. `existingRegistration()` then returns null and a
 *     NEW registration document is created — so without takeover the retry
 *     collides with the participant's own abandoned row and they are locked
 *     out of their own event by their own failed payment.
 *   - An admin rewriting `members[]` can strand a claim pointing at a seat
 *     that no longer exists.
 *
 * So a claim is taken over when the row it points at is gone, `failed`, or no
 * longer lists that holder. Reading the claim to decide is exactly as atomic:
 * the Admin SDK locks every document a transaction reads.
 *
 * **The complete set of writers** is three functions, and any future code that
 * writes `email`, `phone` or `members[]` outside them silently bypasses all of
 * this: `registration.service.createOrResume`, `registration.service.addMember`,
 * and `adminReports.editRegistration`.
 */
import { ApiError } from "../utils/ApiError.js";
import { normalizeEmail, normalizePhone } from "../utils/identity.js";
import { STATUS_FAILED } from "../utils/statuses.js";
import { ticketHolders } from "./qr.js";

export const COLLECTION = "registration_claims";

const KIND_EVENT_EMAIL = "event_email";
const KIND_EVENT_PHONE = "event_phone";
const KIND_PHONE_OWNER = "phone_owner";

/** Document ids. `|` and `:` are legal in Firestore ids and `/` is not — no
 * email contains one, and an event id is `slugify()` output (a-z0-9-), so the
 * three formats can never collide with each other. */
const idEventEmail = (eventId, email) => `event:${eventId}|email:${email}`;
const idEventPhone = (eventId, phone) => `event:${eventId}|phone:${phone}`;
const idPhoneOwner = (phone) => `phone:${phone}`;

/** Show enough of someone else's address to be recognisable to its owner
 * without disclosing it to a stranger — the same allow-list posture
 * `event.service.toEvent()` and `venueAccess` already take. */
function maskEmail(email) {
  const [user = "", domain = ""] = String(email || "").split("@");
  if (!user || !domain) return "another participant";
  return `${user.slice(0, 1)}${"•".repeat(Math.max(user.length - 1, 1))}@${domain}`;
}

/** Every claim a registration's roster needs, as `{ id, doc }` pairs.
 *
 * `registration_id` + `member_index` on each claim is what makes a stale one
 * recoverable: it is exactly enough to re-read the owning row and ask whether
 * the claim still describes reality. Nothing points back the other way, so a
 * registration never has to be kept in step with its claims.
 */
export function claimTargets({ registrationId, eventId, holders, now }) {
  const at = now || new Date().toISOString();
  const targets = [];
  for (const holder of holders || []) {
    const email = normalizeEmail(holder?.email);
    const phone = normalizePhone(holder?.phone);
    const base = {
      event_id: eventId,
      email,
      phone,
      registration_id: registrationId,
      member_index: holder?.member_index ?? 0,
      holder_name: holder?.name || "",
      updated_at: at,
    };
    if (email) {
      targets.push({ id: idEventEmail(eventId, email), doc: { ...base, kind: KIND_EVENT_EMAIL } });
    }
    if (phone) {
      targets.push({ id: idEventPhone(eventId, phone), doc: { ...base, kind: KIND_EVENT_PHONE } });
      targets.push({ id: idPhoneOwner(phone), doc: { ...base, kind: KIND_PHONE_OWNER, event_id: "" } });
    }
  }
  return targets;
}

function conflictMessage(target, existing, eventName) {
  const who =
    target.doc.member_index === 0
      ? "You are"
      : `${target.doc.holder_name || `Member ${target.doc.member_index + 1}`} is`;
  const where = eventName ? `"${eventName}"` : "this event";

  if (target.doc.kind === KIND_EVENT_EMAIL) {
    return `${who} already registered for ${where} with ${target.doc.email} — one email address per person per event.`;
  }
  if (target.doc.kind === KIND_EVENT_PHONE) {
    return `${who} already registered for ${where} with the phone number ${target.doc.phone}.`;
  }
  // phone_owner — never name the other participant's address in full.
  return (
    `The phone number ${target.doc.phone} is already registered to ${maskEmail(existing?.email)}. ` +
    `Each participant needs their own number.`
  );
}

/** Is this claim already ours to rewrite?
 *
 * `heldEmails` is every address this write currently speaks for — the roster
 * as it stands before the write. It matters only for the fest-wide phone
 * binding, and it is what lets a phone be *rebound*: the binding is shared
 * across all of one person's registrations, so a person's second registration
 * rewrites it to point at that newer row. Correcting the email on the first
 * row would then collide with a binding "owned" by the second one — even
 * though it is the same human and the same phone. The rule that resolves it
 * is simply: you may rebind a phone you already hold.
 */
function ownedByUs(target, existing, registrationId, heldEmails) {
  if (!existing) return false;
  if (existing.registration_id === registrationId) return true;
  if (target.doc.kind === KIND_PHONE_OWNER) {
    const bound = normalizeEmail(existing.email);
    // Already bound to the address we're claiming it for.
    if (bound === target.doc.email) return true;
    // …or bound to an address this roster held a moment ago, which is an
    // admin correcting a typo, not a stranger taking someone's number.
    if (heldEmails?.has(bound)) return true;
  }
  return false;
}

/** Has the claim's owner stopped being real? Covers the failed-payment retry,
 * a deleted registration, and a seat an admin edited away. */
function ownerIsStale(target, existing, ownerRow) {
  if (!ownerRow) return true;
  if (ownerRow.status === STATUS_FAILED) return true;
  const holders = ticketHolders(ownerRow);
  if (target.doc.kind === KIND_EVENT_EMAIL || target.doc.kind === KIND_PHONE_OWNER) {
    return !holders.some((h) => normalizeEmail(h.email) === normalizeEmail(existing.email));
  }
  return !holders.some((h) => normalizePhone(h.phone) === normalizePhone(existing.phone));
}

/** Decide, given everything already read inside the transaction, which claims
 * to write — or throw the 409 that refuses the registration.
 *
 * Pure: it performs no reads and no writes, so the caller keeps Firestore's
 * "all reads before all writes" rule without this function needing to know
 * about it.
 */
export function decideClaims({
  targets,
  existingByIndex,
  ownerRowsById,
  registrationId,
  eventName,
  heldEmails,
}) {
  const writes = [];
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const existing = existingByIndex[i];

    if (!existing) {
      writes.push(target);
      continue;
    }
    if (ownedByUs(target, existing, registrationId, heldEmails)) {
      writes.push(target);
      continue;
    }
    if (ownerIsStale(target, existing, ownerRowsById[existing.registration_id])) {
      writes.push(target);
      continue;
    }
    throw new ApiError(409, conflictMessage(target, existing, eventName));
  }
  return writes;
}

/** The registration ids a decision pass will need to read to judge staleness.
 * Returned separately so the caller can fetch them in the transaction's read
 * phase, before any write happens. */
export function ownerIdsToCheck({ targets, existingByIndex, registrationId, heldEmails }) {
  const ids = new Set();
  for (let i = 0; i < targets.length; i++) {
    const existing = existingByIndex[i];
    if (!existing) continue;
    if (ownedByUs(targets[i], existing, registrationId, heldEmails)) continue;
    if (existing.registration_id) ids.add(existing.registration_id);
  }
  return [...ids];
}

/** Claim ids a registration no longer needs, given what it used to hold.
 *
 * The fest-wide phone binding is released only when the releasing holder owns
 * it, which is safe by construction: that claim exists solely to block *other*
 * addresses, so dropping it is at worst permissive until the same email
 * re-claims it. It also stops an admin's typo-fix leaving a number locked to
 * nobody.
 */
export function claimsToRelease({ before, after }) {
  const keep = new Set(after.map((t) => t.id));
  return before.filter((t) => !keep.has(t.id)).map((t) => t.id);
}

/** The addresses a roster currently speaks for, for `ownedByUs` above. */
export function heldEmailSet(holders) {
  return new Set((holders || []).map((h) => normalizeEmail(h?.email)).filter(Boolean));
}
