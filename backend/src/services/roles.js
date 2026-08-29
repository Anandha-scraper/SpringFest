/** Role resolution.
 *
 * Precedence, highest first:
 *
 * 1. ADMIN_EMAILS in backend/.env — the seeded organiser accounts. These can
 *    never be removed through the API, so there is always a way back in.
 * 2. The Firestore `roles` collection — one document per person, id = the
 *    lowercased email, written by the admin "manage people" endpoints.
 * 3. Everyone else is a participant.
 *
 * That last rule is why there is no participant list to maintain: anyone who
 * signs in and isn't a judge, volunteer or admin simply is one.
 */

import { settings } from "../config.js";
import { getDb } from "./firebase.js";

export const ROLE_ADMIN = "admin";
export const ROLE_JUDGE = "judge";
export const ROLE_VOLUNTEER = "volunteer";
export const ROLE_PARTICIPANT = "participant";

// Every role resolveRoleAndAssignments may read back out of a stored document.
export const KNOWN_ROLES = new Set([ROLE_ADMIN, ROLE_JUDGE, ROLE_VOLUNTEER, ROLE_PARTICIPANT]);

// What an admin may hand out. "participant" is absent on purpose: it's the
// absence of a record, so demoting someone is a DELETE, not a write.
export const ASSIGNABLE_ROLES = new Set([ROLE_ADMIN, ROLE_JUDGE, ROLE_VOLUNTEER]);

export const COLLECTION = "roles";

export function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

/** The caller's role, plus whatever they've been assigned (event_ids for a
 * judge, venue_id for a volunteer) — one Firestore read, not two.
 *
 * Throws whatever Firestore throws if the lookup fails — deliberately.
 * Quietly returning "participant" on an outage would demote real judges and
 * admins with no signal; the auth middleware turns the failure into a 503
 * instead. Seeded env admins never reach Firestore, so they stay usable
 * during an outage — and have no assignments, same as everyone else.
 */
export async function resolveRoleAndAssignments(email) {
  const key = normalizeEmail(email);
  if (!key) return { role: ROLE_PARTICIPANT, assignments: {} };
  if (settings.ADMIN_EMAILS.has(key)) return { role: ROLE_ADMIN, assignments: {} };

  const doc = await getDb().collection(COLLECTION).doc(key).get();
  if (doc.exists) {
    const record = doc.data() ?? {};
    const assignments = { event_ids: record.event_ids ?? [], venue_id: record.venue_id ?? "" };
    const role = record.role;
    if (KNOWN_ROLES.has(role)) return { role, assignments };
    return { role: ROLE_PARTICIPANT, assignments };
  }
  return { role: ROLE_PARTICIPANT, assignments: {} };
}

/** Everyone with an explicit role record, plus the seeded env admins. */
export async function listPeople(role) {
  const snap = await getDb().collection(COLLECTION).get();
  const byEmail = new Map(snap.docs.map((d) => [d.id, { email: d.id, ...(d.data() ?? {}) }]));

  // Surface the env-seeded admins too, so the UI shows every organiser and not
  // just the ones added through the API. The env always wins over a document.
  for (const seeded of settings.ADMIN_EMAILS) {
    const row = byEmail.get(seeded) ?? { email: seeded, name: "" };
    row.role = ROLE_ADMIN;
    row.seeded = true;
    byEmail.set(seeded, row);
  }

  let rows = [...byEmail.values()];
  if (role) rows = rows.filter((r) => r.role === role);
  rows.sort((a, b) => (a.role || "").localeCompare(b.role || "") || a.email.localeCompare(b.email));
  return rows;
}

export async function upsertPerson({ email, role, name, addedBy }) {
  if (!ASSIGNABLE_ROLES.has(role)) {
    throw new Error(`Unknown role: ${role}`);
  }

  const key = normalizeEmail(email);
  const ref = getDb().collection(COLLECTION).doc(key);
  const existing = await ref.get();
  const now = new Date().toISOString();

  const payload = { role, name: name || "", updated_at: now, updated_by: addedBy };
  if (!existing.exists) {
    // Only stamp provenance on create, so "added by" doesn't drift into
    // meaning "last edited by".
    Object.assign(payload, { added_by: addedBy, created_at: now });
  }

  await ref.set(payload, { merge: true });
  return { email: key, ...(existing.data() ?? {}), ...payload };
}

/** Delete the role record; the person keeps their account and becomes a
 * participant again. Returns false if there was nothing to remove —
 * Firestore deletes are idempotent, so the caller can't tell otherwise. */
export async function removePerson(email) {
  const ref = getDb().collection(COLLECTION).doc(normalizeEmail(email));
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.delete();
  return true;
}

export function isSeededAdmin(email) {
  return settings.ADMIN_EMAILS.has(normalizeEmail(email));
}

// ── Assignments: judges work events, volunteers cover a venue ──

/** Same day and overlapping [start, end). Times are "HH:MM", so a plain
 * string comparison is also a chronological one. */
export function eventsOverlap(a, b) {
  if (!a || !b || a.date !== b.date) return false;
  const aStart = a.start_time || "", aEnd = a.end_time || "";
  const bStart = b.start_time || "", bEnd = b.end_time || "";
  if (!(aStart && aEnd && bStart && bEnd)) return false;
  return aStart < bEnd && bStart < aEnd;
}

/** The first pair of assigned events that collide in time, or null.
 *
 * A judge can hold several assignments but can't be in two rooms at once, so
 * this runs before an assignment is saved rather than surfacing a
 * double-booking on the day. */
export function findConflict(eventIds, events) {
  const chosen = eventIds.filter((id) => events[id]).map((id) => events[id]);
  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      if (eventsOverlap(chosen[i], chosen[j])) return [chosen[i], chosen[j]];
    }
  }
  return null;
}

/** Write a judge's events or a volunteer's venue onto their role record.
 *
 * Uses merge, so the role/name/provenance written by upsertPerson survive,
 * and equally an assignment survives a later role edit. */
export async function setAssignments(email, { eventIds, venueId } = {}) {
  const key = normalizeEmail(email);
  const ref = getDb().collection(COLLECTION).doc(key);
  const existing = await ref.get();
  if (!existing.exists) {
    const err = new Error(`No role record for ${key}`);
    err.notFound = true;
    throw err;
  }

  const payload = { updated_at: new Date().toISOString() };
  if (eventIds !== undefined) payload.event_ids = eventIds;
  if (venueId !== undefined) payload.venue_id = venueId;

  await ref.set(payload, { merge: true });
  return { email: key, ...(existing.data() ?? {}), ...payload };
}
