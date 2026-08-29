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
import { getDb } from "./firebase.js";

/** The index into `ticketHolders(row)` this person occupies on this
 * registration, or -1 if they're not on it at all. Index 0 is the lead
 * (matched by uid); indices 1+ are team members (matched by email, since
 * they never get a uid of their own on the doc). */
export function matchMemberIndex(row, { uid, email }) {
  if (uid && row.uid === uid) return 0;
  const needle = (email || "").toLowerCase();
  if (!needle) return -1;
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
