/** Event reads and the admin write rules — everything `POST/PATCH/DELETE
 * /api/events` does once the HTTP layer has handed over a body.
 *
 * Also owns the venue-name lookup cache: venues rarely change, but the scan
 * runs on every public GET /events hit (the most-visited endpoint in the app),
 * so it gets a longer TTL than aggregate.loadAll()'s.
 */
import * as aggregate from "./aggregate.js";
import { cached, invalidate } from "./cache.js";
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { slugify } from "../utils/slugify.js";
import {
  EVENT_CATEGORIES,
  optionalInt,
  optionalString,
  parseMarkingCriteria,
  requireBool,
  requireInt,
  requireOneOf,
  requireString,
} from "../utils/validate.js";

const VENUE_NAMES_KEY = "events:venue_names";
const VENUE_NAMES_TTL_SECONDS = 60;

async function scanVenueNames() {
  const snap = await getDb().collection("venues").get();
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()?.name ?? d.id]));
}

export function venueNames() {
  return cached(VENUE_NAMES_KEY, VENUE_NAMES_TTL_SECONDS, scanVenueNames);
}

/** Call after any venue create/rename/delete. */
export function invalidateVenueNames() {
  invalidate(VENUE_NAMES_KEY);
}

// Changing any of these after someone has registered would rewrite the deal
// they signed up to, so they freeze. Venue and time can still move.
export const LOCKED_FIELDS = new Set([
  "name",
  "fee",
  "date",
  "category",
  "is_team_event",
  "team_min",
  "team_max",
]);

/** One doc is enough to know an event is live — no need to count them all. */
async function hasRegistrations(eventId) {
  const snap = await getDb()
    .collection("registrations")
    .where("event_id", "==", eventId)
    .limit(1)
    .get();
  return !snap.empty;
}

/** The event already using this venue, if any. A venue backs at most one
 * event, so double-booking a room is rejected at the source. */
async function venueTakenBy(venueId, excludeEventId = "") {
  if (!venueId) return "";
  const snap = await getDb().collection("events").where("venue_id", "==", venueId).get();
  for (const doc of snap.docs) {
    if (doc.id !== excludeEventId) return doc.data()?.name ?? doc.id;
  }
  return "";
}

function toEvent(id, data, venues, locked = false) {
  return {
    id,
    name: data.name || "",
    description: data.description || "",
    category: data.category || "",
    venue_id: data.venue_id || "",
    venue_name: venues[data.venue_id || ""] || "",
    date: data.date || "",
    start_time: data.start_time || "",
    end_time: data.end_time || "",
    fee: data.fee ?? 0,
    is_team_event: Boolean(data.is_team_event),
    team_min: data.team_min ?? 1,
    team_max: data.team_max ?? 1,
    allow_submissions: Boolean(data.allow_submissions),
    // What participants must bring / prepare. Public, unlike marking_criteria.
    instructions: data.instructions || "",
    // `!== false`, NOT Boolean(): every event created before this field
    // existed has no value for it, and those must read as open. Boolean()
    // here would silently close registration on every one of them.
    registration_open: data.registration_open !== false,
    locked,
  };
}

// NOTE: `marking_criteria` is deliberately absent from toEvent(). GET /events
// and GET /events/:id are unauthenticated, and this function is the only
// shaper they use — an allow-list, so the field stays private simply by not
// being named here. Admins read it from GET /api/admin/events/:eventId.

function parseEventCreate(body) {
  return {
    name: requireString(body.name, { field: "name", minLength: 2 }),
    description: optionalString(body.description),
    category: requireOneOf(body.category, EVENT_CATEGORIES, { field: "category" }),
    venue_id: optionalString(body.venue_id),
    date: optionalString(body.date),
    start_time: optionalString(body.start_time),
    end_time: optionalString(body.end_time),
    fee: optionalInt(body.fee, 0, { field: "fee", min: 0 }),
    is_team_event: requireBool(body.is_team_event, false),
    team_min: optionalInt(body.team_min, 1, { field: "team_min", min: 1 }),
    team_max: optionalInt(body.team_max, 1, { field: "team_max", min: 1 }),
    allow_submissions: requireBool(body.allow_submissions, false),
    instructions: optionalString(body.instructions),
    // A list of { label, max } — the event's scoring scheme. Judges only;
    // never leaves the server through a public route.
    marking_criteria: parseMarkingCriteria(body.marking_criteria),
    // Not in LOCKED_FIELDS: closing an event is only ever useful *after*
    // people have registered for it.
    registration_open: requireBool(body.registration_open, true),
  };
}

/** Only what a PATCH body actually sent — "every field optional, only what's
 * sent is changed" (FastAPI's exclude_unset). */
function parseEventPatch(body) {
  const changes = {};
  if (body.name !== undefined) {
    changes.name = requireString(body.name, { field: "name", minLength: 2 });
  }
  if (body.description !== undefined) changes.description = optionalString(body.description);
  if (body.category !== undefined) {
    changes.category = requireOneOf(body.category, EVENT_CATEGORIES, { field: "category" });
  }
  if (body.venue_id !== undefined) changes.venue_id = optionalString(body.venue_id);
  if (body.date !== undefined) changes.date = optionalString(body.date);
  if (body.start_time !== undefined) changes.start_time = optionalString(body.start_time);
  if (body.end_time !== undefined) changes.end_time = optionalString(body.end_time);
  if (body.fee !== undefined) changes.fee = requireInt(body.fee, { field: "fee", min: 0 });
  if (body.is_team_event !== undefined) changes.is_team_event = requireBool(body.is_team_event);
  if (body.team_min !== undefined) {
    changes.team_min = requireInt(body.team_min, { field: "team_min", min: 1 });
  }
  if (body.team_max !== undefined) {
    changes.team_max = requireInt(body.team_max, { field: "team_max", min: 1 });
  }
  // None of these are in LOCKED_FIELDS — organisers can change file uploads,
  // the participant-facing instructions, the judges' marking criteria and
  // whether the event is still accepting entries at any point in the fest.
  if (body.allow_submissions !== undefined) {
    changes.allow_submissions = requireBool(body.allow_submissions);
  }
  if (body.instructions !== undefined) changes.instructions = optionalString(body.instructions);
  if (body.marking_criteria !== undefined) {
    changes.marking_criteria = parseMarkingCriteria(body.marking_criteria);
  }
  if (body.registration_open !== undefined) {
    changes.registration_open = requireBool(body.registration_open);
  }
  return changes;
}

// ── Public reads ─────────────────────────────────────────────

export async function listEvents() {
  const [venues, snap] = await Promise.all([venueNames(), getDb().collection("events").get()]);
  return snap.docs.map((d) => toEvent(d.id, d.data() ?? {}, venues));
}

export async function getEvent(eventId) {
  const doc = await getDb().collection("events").doc(eventId).get();
  if (!doc.exists) throw new ApiError(404, "Event not found");
  // `locked` only matters when editing, so it's resolved on the single-event
  // read (where the admin form gets its values) and not on the list.
  const [venues, locked] = await Promise.all([venueNames(), hasRegistrations(doc.id)]);
  return toEvent(doc.id, doc.data() ?? {}, venues, locked);
}

// ── Admin writes ─────────────────────────────────────────────

export async function createEvent(body) {
  const payload = parseEventCreate(body);
  const eventId = slugify(payload.name);
  if (!eventId) throw new ApiError(400, "Event name must contain letters or numbers");

  const db = getDb();
  if ((await db.collection("events").doc(eventId).get()).exists) {
    throw new ApiError(409, "An event with that name already exists");
  }

  const takenBy = await venueTakenBy(payload.venue_id);
  if (takenBy) throw new ApiError(409, `That venue is already used by "${takenBy}"`);

  if (payload.start_time && payload.end_time && payload.start_time >= payload.end_time) {
    throw new ApiError(400, "End time must be after the start time");
  }
  if (payload.is_team_event && payload.team_max < payload.team_min) {
    throw new ApiError(400, "team_max must be at least team_min");
  }

  const now = new Date().toISOString();
  const data = { ...payload, created_at: now, updated_at: now };
  await db.collection("events").doc(eventId).set(data);
  aggregate.invalidateLoadAll();

  return toEvent(eventId, data, await venueNames());
}

export async function updateEvent(eventId, body) {
  const db = getDb();
  const ref = db.collection("events").doc(eventId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError(404, "Event not found");

  const current = doc.data() ?? {};
  const changes = parseEventPatch(body);

  const locked = await hasRegistrations(eventId);
  if (locked) {
    // People have already paid against this event's terms, so the terms
    // stop being editable. Venue, time and description still move.
    const frozen = Object.keys(changes)
      .filter((f) => LOCKED_FIELDS.has(f) && changes[f] !== current[f])
      .sort();
    if (frozen.length) {
      throw new ApiError(
        403,
        `This event already has registrations — ${frozen.join(", ")} can no longer ` +
          "be changed. Venue, time and description are still editable."
      );
    }
  }

  if (changes.venue_id !== undefined) {
    const takenBy = await venueTakenBy(changes.venue_id, eventId);
    if (takenBy) throw new ApiError(409, `That venue is already used by "${takenBy}"`);
  }

  const start = changes.start_time ?? current.start_time ?? "";
  const end = changes.end_time ?? current.end_time ?? "";
  if (start && end && start >= end) throw new ApiError(400, "End time must be after the start time");

  changes.updated_at = new Date().toISOString();
  await ref.set(changes, { merge: true });
  aggregate.invalidateLoadAll();

  return toEvent(eventId, { ...current, ...changes }, await venueNames(), locked);
}

export async function deleteEvent(eventId) {
  const db = getDb();
  const ref = db.collection("events").doc(eventId);
  if (!(await ref.get()).exists) throw new ApiError(404, "Event not found");
  if (await hasRegistrations(eventId)) {
    throw new ApiError(
      409,
      "This event has registrations and can't be deleted. Ask an organiser first."
    );
  }
  await ref.delete();
  aggregate.invalidateLoadAll();
}
