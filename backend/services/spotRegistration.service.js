/** Desk registration — an organiser entering a walk-in on fest day.
 *
 * By the time the fest opens, `registration_open` is off and every self-serve
 * path is shut. Somebody still turns up at the desk wanting to enter, pays in
 * cash or scans a UPI code in front of the organiser, and needs a seat and an
 * allocation code there and then. That is the whole feature.
 *
 * ── What it bypasses, and what it does not ──
 * Bypassed, deliberately: the fest-wide `registration_open`, the event's own
 * flag, and both payment flows. Those exist to stop *participants* committing
 * themselves after the cut-off; an organiser standing at the desk with the
 * money in hand has already made that decision.
 *
 * NOT bypassed, equally deliberately:
 *   • the team shape (`assertTeamShape`) — a team of nine in a three-person
 *     event is broken data, not a policy call;
 *   • the per-category cap (`assertCategoryCapacityFor`) — the cap is about
 *     one person hoarding seats, and the desk is exactly where that happens;
 *   • email/phone uniqueness — this goes through `writeWithClaims`, the same
 *     transaction the public form uses. An organiser may decide who gets in
 *     late; never that one seat can be sold twice.
 *
 * ── Two fields the public form has no equivalent of ──
 * `origin: "spot"` gives these rows an `SP…` allocation code instead of `SF…`
 * (utils/origin.js), so a code read aloud at a venue says how its holder got
 * in. And `fee` is admin-settable here, unlike everywhere else in the app
 * where it is computed and never taken from a payload: desk prices genuinely
 * vary — a late discount, a waiver, a part payment — and the alternative is an
 * organiser unable to record what they actually collected. It is still
 * pre-filled from the event, and a departure from that number is recorded in
 * `fee_overridden` so revenue reconciliation can see it rather than quietly
 * absorbing it.
 *
 * The person may never have signed in, in which case the row is written
 * unclaimed and attaches to their account the first time they do — see
 * accountLink.service.js.
 */
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { normalizeEmail } from "../utils/identity.js";
import { ORIGIN_SPOT } from "../utils/origin.js";
import { STATUS_COMPLETED } from "../utils/statuses.js";
import { requireInt, requireOneOf, requireString } from "../utils/validate.js";
import * as aggregate from "./aggregate.js";
import { resolveUidByEmail } from "./accountLink.service.js";
import { mintAllocationCodes } from "./allocation.service.js";
import { ticketHolders } from "./qr.js";
import {
  assertCategoryCapacityFor,
  assertTeamShape,
  parseRegistrationCreate,
  writeWithClaims,
} from "./registration.service.js";

/** How the money arrived at the desk. Cash needs no reference; an online
 * transfer does, or there is nothing to reconcile it against later. */
export const SPOT_PAYMENT_METHODS = ["cash", "online"];

/** The payment mode stamped on a desk row.
 *
 * Inert everywhere else by design: the approvals queue filters on
 * `screenshot`/`free` so these never enter it, and the proof/top-up paths are
 * unreachable because the row is already `completed`. */
export const MODE_SPOT = "spot";

export async function createSpotRegistration({ actorEmail, body = {} }) {
  // Exactly the public form's parsing and roster rules — reused rather than
  // re-implemented, so the desk cannot create data the form would reject.
  const payload = parseRegistrationCreate(body);

  const db = getDb();
  const eventDoc = await db.collection("events").doc(payload.event_id).get();
  if (!eventDoc.exists) throw new ApiError(404, "Event not found");
  const eventData = eventDoc.data() ?? {};

  assertTeamShape(eventData, payload);

  const teamSize = 1 + payload.members.length;
  const expectedFee = (eventData.fee || 0) * teamSize;
  const fee =
    body.fee === undefined || body.fee === null || body.fee === ""
      ? expectedFee
      : requireInt(body.fee, { field: "fee", min: 0 });

  const paymentMethod = requireOneOf(body.payment_method, SPOT_PAYMENT_METHODS, {
    field: "payment_method",
  });
  // A cash payment has no reference to record; an online one is unreconcilable
  // without it. Only asked for when it can actually be answered.
  const transactionId =
    paymentMethod === "online"
      ? requireString(body.transaction_id, { field: "transaction_id", minLength: 4 })
      : "";

  // The cap counts what this person already leads. They may have no account at
  // all, so it is asked by address; see assertCategoryCapacityFor.
  await assertCategoryCapacityFor(db, { email: payload.email }, eventData);

  // If they have signed in before, stamp the real uid and skip the unclaimed
  // state entirely — the row is live on their dashboard immediately.
  const uid = await resolveUidByEmail(payload.email);
  const now = new Date().toISOString();

  const regRef = db.collection("registrations").doc();
  const regDoc = {
    ...payload,
    team_size: teamSize,
    uid,
    user_email: uid ? payload.email : "",
    ...(uid ? {} : { unclaimed_email: normalizeEmail(payload.email) }),
    origin: ORIGIN_SPOT,
    // Already paid, in person. No approval queue, no proof to review.
    status: STATUS_COMPLETED,
    payment_mode: MODE_SPOT,
    payment_method: paymentMethod,
    transaction_id: transactionId,
    fee,
    fee_overridden: fee !== expectedFee,
    amount_due: 0,
    paid_at: now,
    collected_by: actorEmail,
    checked_in: false,
    created_at: now,
  };

  await writeWithClaims(db, {
    regRef,
    regDoc,
    eventId: payload.event_id,
    eventName: eventData.name || "",
    holders: ticketHolders(regDoc),
    previousHolders: [],
  });
  aggregate.invalidateLoadAll();

  // Minted loudly, not with mintQuietly: this is one row and the organiser is
  // standing there waiting to read the code out. A silent failure would send
  // someone away with nothing.
  const codes = await mintAllocationCodes(regRef.id);

  return {
    registration_id: regRef.id,
    event_id: payload.event_id,
    event_name: eventData.name || "",
    status: STATUS_COMPLETED,
    origin: ORIGIN_SPOT,
    allocation_codes: codes || [],
    holders: ticketHolders(regDoc),
    team_size: teamSize,
    fee,
    fee_overridden: regDoc.fee_overridden,
    expected_fee: expectedFee,
    payment_method: paymentMethod,
    transaction_id: transactionId,
    unclaimed: !uid,
  };
}
