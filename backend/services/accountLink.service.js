/** Attaching an unclaimed registration to the account that owns it.
 *
 * The Excel import (registrationImport.service.js) and the desk form
 * (spotRegistration.service.js) write registrations for people who may never
 * have signed in, so there is no Firebase uid to stamp. `uid` is what makes a
 * registration *yours* everywhere else in the app — the dashboard, the entry
 * pass, the per-category cap, the "is this your row" guards — so those rows
 * need a way to become normal rows the moment their owner appears.
 *
 * An unclaimed row carries:
 *
 *     uid: ""            user_email: ""      unclaimed_email: "<lowercased>"
 *
 * and `unclaimed_email` exists ONLY while unclaimed — claiming deletes it.
 * That is what makes the lookup affordable on a hot path: it is a
 * single-field equality query (Firestore indexes those automatically; there
 * is no firestore.indexes.json in this repo to update), and in the
 * overwhelmingly common case it matches zero documents, costing one index
 * seek and no document reads.
 *
 * ── Why this can't be used to steal someone's registration ──
 * `claimUnclaimedRows` takes no client-supplied address, ever. Its only input
 * is `req.user.email`, which middleware/auth.js sets from the verified
 * Firebase token — there is no route parameter and no body field anywhere in
 * the chain. On top of that it refuses an unverified address: Google sign-in
 * is always verified so that costs nothing today, and it is what stops a
 * future email/password provider from quietly becoming a takeover vector.
 *
 * The read side has its own answer to the same problem —
 * `registrationLookup.matchMemberIndex` matches seat 0 by address on a row
 * with no uid — so an imported registration is visible to its owner even if
 * this never runs. Both exist because the read path must not depend on a
 * write having succeeded.
 */
import admin from "firebase-admin";
import { getAuth, getDb } from "../config/firebase.js";
import { normalizeEmail } from "../utils/identity.js";
import * as aggregate from "./aggregate.js";

const EMPTY = { claimed: 0, registration_ids: [] };

/** Hand every unclaimed registration for this address to this account.
 *
 * Idempotent by construction: the claim deletes `unclaimed_email`, so the
 * query is permanently empty for that person afterwards and re-running costs
 * one seek and writes nothing.
 *
 * Each row is claimed in its own small transaction. Not for concurrency
 * between two tabs — those would write the identical uid — but because an
 * admin may be editing the address on the same document through
 * `adminReports.editRegistration` at that moment, and the re-read inside the
 * transaction is what stops this stamping a uid onto a row that has since
 * stopped being this person's.
 */
export async function claimUnclaimedRows({ uid, email, emailVerified } = {}) {
  const key = normalizeEmail(email);
  if (!uid || !key || emailVerified === false) return EMPTY;

  const db = getDb();
  const snap = await db.collection("registrations").where("unclaimed_email", "==", key).get();
  if (snap.empty) return EMPTY;

  const claimed = [];
  for (const doc of snap.docs) {
    const ok = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (!fresh.exists) return false;
      const row = fresh.data() || {};
      // Re-assert both halves: someone else may have claimed it, or an admin
      // may have corrected the address, since the query above.
      if (row.uid) return false;
      if (normalizeEmail(row.unclaimed_email) !== key) return false;

      tx.update(doc.ref, {
        uid,
        user_email: email,
        unclaimed_email: admin.firestore.FieldValue.delete(),
        claimed_at: new Date().toISOString(),
      });
      return true;
    });
    if (ok) claimed.push(doc.id);
  }

  if (claimed.length) aggregate.invalidateLoadAll();
  return { claimed: claimed.length, registration_ids: claimed };
}

/** The uid behind an address, or "" if nobody has signed in with it yet.
 *
 * Lets the import and desk paths stamp a real uid when the account already
 * exists, so those rows skip the unclaimed state entirely and are live on the
 * person's dashboard immediately. A lookup failure is not an error — it is
 * the ordinary "this person has never signed in" case, which is exactly what
 * the unclaimed path is for. */
export async function resolveUidByEmail(email) {
  const key = normalizeEmail(email);
  if (!key) return "";
  try {
    const account = await getAuth().getUserByEmail(key);
    return account?.uid || "";
  } catch {
    return "";
  }
}
