/** Admin-side role management: who is a volunteer, and what they're assigned
 * to.
 *
 * The role *resolution* rules live in auth/roles.js — this is the write side
 * plus the guards that only matter when an admin is doing the writing (you
 * can't demote yourself; ADMIN_EMAILS wins over any document).
 */
import * as roles from "../auth/roles.js";
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { requireEmail, requireOneOf } from "../utils/validate.js";
import * as aggregate from "./aggregate.js";

export function listPeople(role) {
  return roles.listPeople(role);
}

/** What's already on file for this email, so the "Add a person" form can warn
 * before silently overwriting a role or missing that the address is also a
 * participant — surfaced to the admin, not blocked here. */
export async function lookup(email) {
  const key = roles.normalizeEmail(email);
  const seeded = roles.isSeededAdmin(key);

  let role = seeded ? roles.ROLE_ADMIN : null;
  if (!seeded) {
    const doc = await getDb().collection(roles.COLLECTION).doc(key).get();
    const docRole = doc.data()?.role;
    if (doc.exists && roles.ASSIGNABLE_ROLES.has(docRole)) role = docRole;
  }

  const data = await aggregate.loadAll();
  const regs = data.registrations.filter(
    (r) =>
      (r.email || "").toLowerCase() === key ||
      (r.user_email || "").toLowerCase() === key ||
      (r.members || []).some((m) => (m.email || "").toLowerCase() === key)
  );
  const events = [...new Set(regs.map((r) => aggregate.eventName(data.events, r.event_id || "")))];

  return { email: key, role, seeded, registrations_count: regs.length, events };
}

export async function addPerson({ body, actorEmail }) {
  const email = roles.normalizeEmail(requireEmail(body.email));
  const role = requireOneOf(body.role, [...roles.ASSIGNABLE_ROLES], { field: "role" });
  const name = body.name || "";

  // Changing your own role is the realistic way to lock the last admin out.
  if (email === roles.normalizeEmail(actorEmail)) {
    throw new ApiError(400, "You cannot change your own role");
  }
  // Seeded admins come from ADMIN_EMAILS; a document would be ignored anyway.
  if (roles.isSeededAdmin(email)) {
    throw new ApiError(403, "This account is managed in ADMIN_EMAILS");
  }

  const row = await roles.upsertPerson({ email, role, name, addedBy: actorEmail });
  aggregate.invalidateLoadAll();
  return row;
}

/** Volunteers get a venue — and, since the venue backs exactly one event, that
 * is also what they check people into and score. There is no per-event
 * assignment any more: it belonged to the judge role, which was folded in. */
export async function setAssignments({ email, body }) {
  const key = roles.normalizeEmail(email);
  const db = getDb();

  const doc = await db.collection(roles.COLLECTION).doc(key).get();
  if (!doc.exists) throw new ApiError(404, "No role record for that address");
  const role = doc.data()?.role;

  const venueId = body.venue_id;
  if (venueId !== undefined && venueId !== null) {
    if (role !== roles.ROLE_VOLUNTEER) {
      throw new ApiError(400, "Only volunteers are allocated to a venue");
    }
    if (venueId && !(await db.collection("venues").doc(venueId).get()).exists) {
      throw new ApiError(404, "Venue not found");
    }
  }

  const row = await roles.setAssignments(key, {
    venueId: venueId === null ? undefined : venueId,
  });
  aggregate.invalidateLoadAll();
  return row;
}

export async function removePerson({ email, actorEmail }) {
  const key = roles.normalizeEmail(email);

  if (key === roles.normalizeEmail(actorEmail)) {
    throw new ApiError(400, "You cannot remove yourself");
  }
  if (roles.isSeededAdmin(key)) {
    throw new ApiError(403, "This account is managed in ADMIN_EMAILS");
  }

  if (!(await roles.removePerson(key))) throw new ApiError(404, "No role record for that address");
  aggregate.invalidateLoadAll();
}
