/** "Every registration this person touches" — as lead (`uid`) or as a team
 * member typed into someone else's registration (email match on `members[]`).
 *
 * Deliberately NOT routed through `aggregate.js`'s cached `loadAll()`: that
 * cache exists for admin rollups that tolerate a 20s-stale view, but
 * check-in/ownership decisions here need a live read. Firestore also can't
 * query inside `members[].email` (an array of maps), so this is a full
 * `registrations` scan either way — the same cost class as `aggregate.js`'s
 * own scans, just uncached.
 */
import { getDb } from "../config/firebase.js";

/** The index into `ticketHolders(row)` this person occupies on this
 * registration, or -1 if they're not on it at all. Index 0 is the lead;
 * indices 1+ are team members (matched by email, since they never get a uid
 * of their own on the doc).
 *
 * The lead is normally matched by uid. The exception is an *unclaimed* row —
 * one written by the Excel import or the desk for someone who has never
 * signed in, so there was no uid to stamp (see accountLink.service.js). Those
 * carry `unclaimed_email` and are matched by address instead, which is what
 * makes an imported registration visible to its owner even if the linking
 * pass never runs.
 *
 * The `!row.uid` guard is load-bearing and must not be relaxed: a row that
 * HAS a uid still requires uid equality, so nobody reaches seat 0 on someone
 * else's claimed registration by typing their address into the form. For the
 * same reason this never consults `user_email` — that field belongs to a
 * claimed row and is empty on an unclaimed one. */
export function matchMemberIndex(row, { uid, email }) {
  if (uid && row.uid === uid) return 0;
  const needle = (email || "").toLowerCase();
  if (!needle) return -1;
  if (!row.uid && (row.unclaimed_email || row.email || "").toLowerCase() === needle) return 0;
  const members = Array.isArray(row.members) ? row.members : [];
  const i = members.findIndex((m) => (m?.email || "").toLowerCase() === needle);
  return i === -1 ? -1 : i + 1;
}

/** Every registration where this person is the lead or a team member, each
 * annotated with `member_index` — the position that's theirs. */
export async function loadPersonRegistrations({ uid, email }) {
  const snap = await getDb().collection("registrations").get();
  const rows = [];
  for (const doc of snap.docs) {
    const row = { id: doc.id, ...(doc.data() ?? {}) };
    const memberIndex = matchMemberIndex(row, { uid, email });
    if (memberIndex >= 0) rows.push({ ...row, member_index: memberIndex });
  }
  return rows;
}
