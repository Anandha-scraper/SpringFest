/** HTTP layer for /api/admin.
 *
 * The dashboard reads are one-liners over services/aggregate.js — there is no
 * service in between because there is no logic to put there. The write paths
 * delegate to the focused services (settings, approvals, venues, people,
 * adminReports) that own their rules.
 */
import { IMAGE_TYPES } from "../middleware/upload.js";
import * as adminReports from "../services/adminReports.service.js";
import * as aggregate from "../services/aggregate.js";
import { STATUS_COMPLETED, STATUS_REJECTED } from "../utils/statuses.js";
import * as approvals from "../services/approval.service.js";
import * as attendance from "../services/attendance.service.js";
import * as people from "../services/people.service.js";
import {
  applySettingsPatch,
  clearPaymentQr,
  getAppSettings,
  savePaymentQr,
} from "../services/settings.js";
import * as venueAccess from "../services/venueAccess.service.js";
import * as venues from "../services/venue.service.js";

// ── Dashboards ───────────────────────────────────────────────

export async function stats(req, res) {
  res.json(await aggregate.buildStats());
}

/** Signed-in account totals split by staff vs attendee (participant). Gives
 * organisers a true "how many people signed in" number rather than the
 * registration-derived `signed_users`, which only counts people who actually
 * registered. Staff = admins + volunteers. */
export async function authUsers(req, res) {
  res.json(await aggregate.countAuthByRole());
}

/** One row per person — the Registrations screen. See services/aggregate.js
 * for why this isn't just the registration list. */
export async function participants(req, res) {
  // Approved unless the admin explicitly asks for the rejected pile — the one
  // other status this screen can show. Anything else would quietly hand back
  // drafts, which is what the page was fixed to stop doing.
  const status = req.query.status === STATUS_REJECTED ? STATUS_REJECTED : STATUS_COMPLETED;
  res.json(await aggregate.participantRows(undefined, status));
}

/** One row per person, with every event they hold and where each has got to —
 * the Attendance screen. See services/attendance.service.js for why this is
 * people-shaped rather than registration-shaped. */
export async function attendanceRows(req, res) {
  res.json(await attendance.attendanceRows());
}

export async function venuesRollup(req, res) {
  res.json(await aggregate.venueRollup());
}

/** Per-event attendance and evaluation progress — the Manage Roles view. */
export async function eventsRollup(req, res) {
  res.json(await aggregate.eventRollup());
}

// ── Registrations & events ───────────────────────────────────

export async function rawEvent(req, res) {
  res.json(await adminReports.rawEvent(req.params.eventId));
}

export async function listRegistrations(req, res) {
  res.json(
    await adminReports.listRegistrations({
      eventId: req.query.event_id,
      status: req.query.status,
    })
  );
}

export async function rawRegistration(req, res) {
  res.json(await adminReports.rawRegistration(req.params.registrationId));
}

export async function editRegistration(req, res) {
  res.json(await adminReports.editRegistration(req.params.registrationId, req.body || {}));
}

export async function eventParticipants(req, res) {
  res.json(await adminReports.eventParticipants(req.params.eventId));
}

/** Generate a code, or replace whatever one already existed — same
 * operation either way, so one route covers both "Generate" and "Rotate"
 * in the UI. */
export async function rotateAccessCode(req, res) {
  res.json({ access_code: await venueAccess.rotateAccessCode(req.params.eventId) });
}

export async function revokeAccessCode(req, res) {
  await venueAccess.revokeAccessCode(req.params.eventId);
  res.status(204).end();
}

export async function registrationsCsv(req, res) {
  const body = await adminReports.registrationsCsv({
    eventId: req.query.event_id,
    status: req.query.status,
  });
  res.set("Content-Type", "text/csv");
  res.set("Content-Disposition", 'attachment; filename="registrations.csv"');
  res.send(body);
}

// ── Payment settings ─────────────────────────────────────────

export async function settings(req, res) {
  res.json(await getAppSettings());
}

export async function updateSettings(req, res) {
  res.json(await applySettingsPatch(req.body || {}, req.user.email));
}

export async function uploadPaymentQr(req, res) {
  res.json(
    await savePaymentQr({
      file: req.file,
      extension: IMAGE_TYPES[req.file?.mimetype],
      actorEmail: req.user.email,
    })
  );
}

export async function deletePaymentQr(req, res) {
  res.json(await clearPaymentQr(req.user.email));
}

// ── Screenshot payment approvals ─────────────────────────────

export async function approvalQueue(req, res) {
  res.json(await approvals.pending());
}

export async function approvalProof(req, res) {
  const { buffer, contentType } = await approvals.proofImage(req.params.registrationId);
  res.set("Content-Type", contentType);
  res.send(buffer);
}

export async function decideApproval(req, res) {
  res.json(
    await approvals.decide({
      registrationId: req.params.registrationId,
      body: req.body || {},
      actorEmail: req.user.email,
    })
  );
}

// ── Venues ───────────────────────────────────────────────────

export async function listVenues(req, res) {
  res.json(await venues.listVenues());
}

export async function createVenue(req, res) {
  res.status(201).json(await venues.createVenue(req.body || {}));
}

export async function deleteVenue(req, res) {
  await venues.deleteVenue(req.params.venueId);
  res.status(204).end();
}

// ── People / role management ─────────────────────────────────

export async function listPeople(req, res) {
  res.json(await people.listPeople(req.query.role));
}

export async function lookupPerson(req, res) {
  res.json(await people.lookup(req.params.email));
}

export async function addPerson(req, res) {
  res.status(201).json(await people.addPerson({ body: req.body || {}, actorEmail: req.user.email }));
}

export async function setAssignments(req, res) {
  res.json(await people.setAssignments({ email: req.params.email, body: req.body || {} }));
}

export async function removePerson(req, res) {
  await people.removePerson({ email: req.params.email, actorEmail: req.user.email });
  res.status(204).end();
}
