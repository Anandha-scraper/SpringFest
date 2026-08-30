/** Allocation codes — the short human-readable handle a check-in desk uses to
 * find and seat someone, minted the moment a registration is confirmed.
 *
 *   SF <category letter> <event letter> <participant number>
 *   └┬┘ └──────┬───────┘ └─────┬──────┘ └───────┬─────────┘
 *   const     N/T/H/W      A = 1st event    1,2,3… = Nth person
 *                          created under        (lead + team members
 *                          that category         each get their own,
 *                          by created_at         in a contiguous block)
 *
 * e.g. SFTA1, SFTA2 (people 1 & 2 of the first Technical event), SFNB3.
 *
 * One code per *ticket holder*, stored index-aligned with `ticketHolders(row)`
 * (services/qr.js) so `allocation_codes[member_index]` is always "this person's
 * code for this event". The personal QR (auth/qrToken.js) is untouched — it
 * still names only the uid, and check-in resolves the codes fresh on scan.
 *
 * This module owns the first Firestore transaction in the codebase: the
 * per-event participant number comes from a dedicated `counters/{eventId}` doc
 * bumped atomically, and the event's letter is assigned on first use and then
 * frozen (safe because `category` is a LOCKED_FIELD once an event has any
 * registration — see event.service.js).
 */
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { STATUS_COMPLETED } from "../utils/statuses.js";
import * as aggregate from "./aggregate.js";
import { ticketHolders } from "./qr.js";

/** Flip to false to hold codes until an admin explicitly approves — the
 * screenshot path always mints; this only gates the gateway auto-verify path.
 * Kept as a constant so "approval-only" is a one-line change. */
export const MINT_ON_GATEWAY_VERIFY = true;

/** The one status a code is minted for. Widen here if "confirmed" ever means
 * more than `completed`. */
export function isMintableStatus(status) {
  return status === STATUS_COMPLETED;
}

/** Keyed on the exact EVENT_CATEGORIES strings (utils/validate.js). Explicit,
 * not `category[0]` — that's the contract, and "Non-Technical" → N is a choice
 * rather than a coincidence. */
export const CATEGORY_LETTER = {
  Technical: "T",
  "Non-Technical": "N",
  Hackathon: "H",
  Workshop: "W",
};

function categoryLetter(category) {
  const letter = CATEGORY_LETTER[category];
  if (!letter) throw new ApiError(500, `No allocation letter for category "${category}"`);
  return letter;
}

/** 0→A … 25→Z, 26→AA, 27→AB … spreadsheet-column style, so >26 events in one
 * category still produce a valid (if longer) code. */
export function toLetter(pos) {
  let n = pos + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Mint any codes this registration is still missing.
 *
 * Idempotent (fills only empty slots — safe to call twice, from either
 * completion path, after addMember, or from the backfill script) and monotonic
 * (the counter is never decremented, so a later rejection never frees a
 * number). Returns the full `allocation_codes` array, or null if the row is
 * gone / not in a mintable status.
 */
export async function mintAllocationCodes(registrationId) {
  const db = getDb();

  const result = await db.runTransaction(async (tx) => {
    const regRef = db.collection("registrations").doc(registrationId);
    const regSnap = await tx.get(regRef);
    if (!regSnap.exists) return null;

    const row = regSnap.data() || {};
    if (!isMintableStatus(row.status)) return null;

    const holders = ticketHolders(row);
    const codes = Array.isArray(row.allocation_codes) ? [...row.allocation_codes] : [];
    const missing = [];
    for (let i = 0; i < holders.length; i += 1) {
      if (!codes[i]) missing.push(i);
    }
    if (missing.length === 0) return codes;

    const eventId = row.event_id || "";
    const eventRef = db.collection("events").doc(eventId);
    const counterRef = db.collection("counters").doc(eventId);

    // Every read before any write — Firestore transactions require it.
    const [eventSnap, counterSnap] = await Promise.all([tx.get(eventRef), tx.get(counterRef)]);
    const eventData = eventSnap.data() || {};

    let letter = eventData.allocation_letter || "";
    if (!letter) {
      const siblings = await tx.get(
        db.collection("events").where("category", "==", eventData.category || "")
      );
      const alreadyLettered = siblings.docs
        .map((d) => d.data() || {})
        .filter((e) => e.allocation_letter).length;
      // "next after the highest assigned" — delete-safe and order-independent
      // once the backfill has lettered every event that exists today.
      letter = toLetter(alreadyLettered);
    }

    const prefix = `SF${categoryLetter(eventData.category)}${letter}`;
    let n = counterSnap.exists ? Number(counterSnap.data().participants || 0) : 0;
    const now = new Date().toISOString();
    for (const i of missing) {
      n += 1;
      codes[i] = `${prefix}${n}`;
    }

    if (!eventData.allocation_letter) {
      tx.set(eventRef, { allocation_letter: letter }, { merge: true });
    }
    tx.set(counterRef, { event_id: eventId, participants: n, updated_at: now }, { merge: true });
    tx.update(regRef, {
      allocation_codes: codes,
      allocation_codes_minted_at: row.allocation_codes_minted_at || now,
    });
    return codes;
  });

  if (result) aggregate.invalidateLoadAll();
  return result;
}

/** Mint, swallowing failure. Used from the completion paths: the status is
 * already `completed` at that point, so a missed mint is a log line and a
 * job for the next call / the backfill script, never a failed request. */
export async function mintQuietly(registrationId) {
  try {
    return await mintAllocationCodes(registrationId);
  } catch (err) {
    console.error(`allocation code mint failed for ${registrationId}:`, err?.message || err);
    return null;
  }
}
