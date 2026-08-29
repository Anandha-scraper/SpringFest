/** Registration lifecycle, shared by the routes that advance it.
 *
 *                        ┌──────────────────────────────┐
 *   gateway mode:  pending ──(signature verified)──> completed
 *                        └──(bad signature)────────> failed
 *
 *   screenshot mode: pending ──(proof uploaded)──> awaiting_approval
 *                                                   │
 *                              (admin approves) ────┴──> completed
 *                              (admin rejects)  ────┬──> rejected
 *                                                   │
 *                    rejected ──(participant resubmits proof)──┘
 *
 * `rejected` is deliberately not terminal: a blurry screenshot or a mistyped
 * transaction id should be fixable on the same registration rather than
 * forcing a duplicate row. Status only ever advances on the server.
 */
export const STATUS_PENDING = "pending";
export const STATUS_AWAITING_APPROVAL = "awaiting_approval";
export const STATUS_COMPLETED = "completed";
export const STATUS_REJECTED = "rejected";
export const STATUS_FAILED = "failed";

/** Statuses that occupy the "this person has a live registration for this
 * event" slot — anything here blocks or resumes a second attempt. `failed`
 * is absent on purpose: a failed payment should let them start over. */
export const LIVE_STATUSES = [
  STATUS_PENDING,
  STATUS_AWAITING_APPROVAL,
  STATUS_COMPLETED,
  STATUS_REJECTED,
];

/** Statuses a participant can (re)submit payment proof against. */
export const PROOF_SUBMITTABLE = [STATUS_PENDING, STATUS_REJECTED];
