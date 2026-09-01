/** Admin read models over the registration data, plus the one admin write
 * that touches a registration's own fields.
 *
 * Three different grains coexist on purpose: `/participants` is one row per
 * *person* (services/aggregate.js explains why), the list here is one row per
 * *registration* (what the CSV and per-event views work at), and the raw-doc
 * reads hand back the actual Firestore document for prefilling an edit form.
 */
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import {
  assertUniqueHolders,
  optionalString,
  parseParticipantDetails,
  parseTeamMember,
  requireEmail,
  requirePhone,
  requireString,
} from "../utils/validate.js";
import * as aggregate from "./aggregate.js";
import { writeWithClaims } from "./registration.service.js";
import { ticketHolders } from "./qr.js";
import { averageRating } from "./feedback.service.js";

export const CSV_COLUMNS = [
  "id", "name", "email", "phone", "college", "department", "year", "location",
  "event_id", "event_name", "status", "checked_in", "fee", "team_name", "team_size",
  "allocation_codes",
  "feedback",
  "payment_mode", "transaction_id", "order_id", "payment_id", "payment_method",
  "created_at", "paid_at",
];

function applyFilters(rows, eventId, status) {
  if (eventId) rows = rows.filter((r) => r.event_id === eventId);
  if (status) rows = rows.filter((r) => r.status === status);
  return rows;
}

/** Newest first, with the event's display name resolved onto each row. */
async function filteredRegistrations(eventId, status) {
  const data = await aggregate.loadAll();
  const rows = applyFilters(data.registrations, eventId, status);
  for (const r of rows) r.event_name = aggregate.eventName(data.events, r.event_id || "");
  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return rows;
}

export function listRegistrations({ eventId, status }) {
  return filteredRegistrations(eventId, status);
}

/** One raw event doc, for prefilling the admin edit form. */
export async function rawEvent(eventId) {
  const doc = await getDb().collection("events").doc(eventId).get();
  if (!doc.exists) throw new ApiError(404, "Event not found");
  return { id: doc.id, ...(doc.data() ?? {}) };
}

/** One raw registration doc, `members[]` included. */
export async function rawRegistration(registrationId) {
  const doc = await getDb().collection("registrations").doc(registrationId).get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");
  return { id: doc.id, ...(doc.data() ?? {}) };
}

/** Fix a typo in a registration's own details: the lead's fields and each
 * team member's, validated through the exact same rules the public form uses
 * so an edit can't introduce data the form itself wouldn't accept.
 *
 * Deliberately excludes event_id, team_size (derived from members.length, not
 * settable), fee, status, and every payment field — those stay owned by the
 * approval flow and payment verification, not this route. Editing a team
 * member's email takes effect immediately: registration lookups match live
 * against whatever `members[].email` currently says, so the old email loses
 * access to this registration the moment this write lands, with no separate
 * revocation step needed. */
export async function editRegistration(registrationId, body) {
  const regRef = getDb().collection("registrations").doc(registrationId);
  const doc = await regRef.get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");
  const row = doc.data() ?? {};

  const changes = {};
  if (body.name !== undefined) {
    changes.name = requireString(body.name, { field: "name", minLength: 2 });
  }
  if (body.email !== undefined) changes.email = requireEmail(body.email);
  if (body.phone !== undefined) changes.phone = requirePhone(body.phone);
  if (body.team_name !== undefined) changes.team_name = optionalString(body.team_name);
  if (
    body.college !== undefined ||
    body.department !== undefined ||
    body.year !== undefined ||
    body.location !== undefined
  ) {
    Object.assign(
      changes,
      parseParticipantDetails({
        college: body.college ?? row.college,
        department: body.department ?? row.department,
        year: body.year ?? row.year,
        location: body.location ?? row.location,
        location_other: body.location_other,
      })
    );
  }
  if (body.members !== undefined) {
    if (!Array.isArray(body.members) || body.members.length !== (row.members || []).length) {
      throw new ApiError(
        400,
        "members: team size can't be changed here — fix existing members' details only"
      );
    }
    changes.members = body.members.map(parseTeamMember);
  }
  if (!Object.keys(changes).length) throw new ApiError(400, "Nothing to update");

  const next = { ...row, ...changes };
  // Same roster rule the participant form is held to — an admin fixing a typo
  // must not be able to put one address on two seats.
  assertUniqueHolders(ticketHolders(next));

  // This is the second write path for emails and phone numbers, so it has to
  // move their claims too: release what this registration no longer holds and
  // claim what it now does, in the same transaction as the edit. Without it an
  // admin's correction would leave the old address locked and the new one
  // unreserved.
  const data = await aggregate.loadAll();
  await writeWithClaims(getDb(), {
    regRef,
    regDoc: changes,
    merge: true,
    eventId: row.event_id || "",
    eventName: aggregate.eventName(data.events, row.event_id || ""),
    holders: ticketHolders(next),
    previousHolders: ticketHolders(row),
  });
  aggregate.invalidateLoadAll();
  return { id: regRef.id, ...row, ...changes };
}

export async function eventParticipants(eventId) {
  const data = await aggregate.loadAll();
  const event = data.events[eventId];
  if (!event) throw new ApiError(404, "Event not found");

  const rows = data.registrations.filter((r) => r.event_id === eventId);
  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  for (const r of rows) r.event_name = event.name || eventId;
  const completed = rows.filter((r) => r.status === aggregate.STATUS_COMPLETED);

  return {
    event: { ...event, venue_name: data.venues[event.venue_id || ""]?.name || "" },
    total: rows.length,
    completed: completed.length,
    checked_in: rows.filter((r) => r.checked_in).length,
    revenue: completed.reduce((sum, r) => sum + (r.fee || 0), 0),
    // Envelope only — `participants` stays the raw registration docs, so
    // feedback[] rides along on each row untouched.
    feedback_count: rows.reduce((n, r) => n + (r.feedback || []).length, 0),
    feedback_avg: averageRating(rows),
    participants: rows,
  };
}

/** The registration export, as a CSV body ready to send. */
export async function registrationsCsv({ eventId, status }) {
  const rows = await filteredRegistrations(eventId, status);

  const csvEscape = (value) => {
    const s = String(value ?? "");
    // \r matters as much as \n: rows are separated by \r\n below, so a lone
    // carriage return inside a cell — which is exactly what a browser textarea
    // submits — splits the row and shifts every column after it. Feedback
    // comments are normalised on write too (feedback.service.js); this covers
    // anything already on file.
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // One row is one registration but feedback is per person, so the whole team's
  // answers share a cell — same flattening as allocation_codes above.
  const cell = (r, c) => {
    if (c === "allocation_codes") return (r.allocation_codes || []).join(" ");
    if (c === "feedback") {
      return (r.feedback || [])
        .map((f) => {
          // Flattened to a single line. A quoted field may legally contain a
          // newline, but it still costs one row per line in anything that
          // splits naively, and an organiser scanning this in a spreadsheet
          // wants one row per registration. saveFeedback already strips \r
          // from new comments; this also covers whatever is on file.
          const comment = (f.comment || "").replace(/\s*[\r\n]+\s*/g, " ").trim();
          return `${f.name || f.email} ${f.rating}/5${comment ? `: ${comment}` : ""}`;
        })
        .join(" | ");
    }
    return r[c];
  };
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvEscape(cell(r, c) ?? "")).join(","));

  return lines.join("\r\n") + "\r\n";
}
