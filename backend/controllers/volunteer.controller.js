/** HTTP layer for /api/volunteer — QR scan, the fest-entry mark, the
 * per-event check-in toggle, the volunteer's own dashboard, and (since the
 * judge role was folded in here) scoring and the judging queue.
 *
 * The check-in state machine is in services/checkin.service.js; the scoring
 * rules are in services/evaluation.service.js. Both halves are HTTP glue only.
 */
import * as checkin from "../services/checkin.service.js";
import * as evaluation from "../services/evaluation.service.js";
import { staffSubmissionFile } from "../services/submissionAccess.js";

// ── Check-in ─────────────────────────────────────────────────

export async function scan(req, res) {
  res.json(await checkin.scan({ token: req.body?.token, actor: req.user }));
}

export async function festCheckIn(req, res) {
  res.json(await checkin.festCheckIn({ actor: req.user, body: req.body || {} }));
}

export async function toggleCheckIn(req, res) {
  res.json(await checkin.toggle({ actor: req.user, body: req.body || {} }));
}

export async function summary(req, res) {
  res.json(await checkin.volunteerSummary({ user: req.user }));
}

export async function roster(req, res) {
  res.json(await checkin.volunteerRoster({ user: req.user }));
}

export async function submission(req, res) {
  const { buffer, filename } = await staffSubmissionFile({
    user: req.user,
    registrationId: req.params.registrationId,
  });
  res.set("Content-Disposition", `attachment; filename="${filename}"`);
  res.set("Content-Type", "application/octet-stream");
  res.send(buffer);
}

// ── Scoring ──────────────────────────────────────────────────

export async function events(req, res) {
  res.json(await evaluation.assignedEvents(req.user));
}

export async function participants(req, res) {
  res.json(await evaluation.eventParticipants({ user: req.user, eventId: req.params.eventId }));
}

export async function saveEvaluation(req, res) {
  res.json(
    await evaluation.saveEvaluation({
      user: req.user,
      eventId: req.params.eventId,
      registrationId: req.body?.registration_id,
      scores: req.body?.scores,
      note: req.body?.note,
    })
  );
}

export async function deleteEvaluation(req, res) {
  res.json(
    await evaluation.deleteEvaluation({
      user: req.user,
      eventId: req.params.eventId,
      registrationId: req.params.registrationId,
    })
  );
}

export async function getQueue(req, res) {
  res.json(await evaluation.getQueue({ user: req.user, eventId: req.params.eventId }));
}

export async function setQueue(req, res) {
  res.json(
    await evaluation.setQueue({
      user: req.user,
      eventId: req.params.eventId,
      current: req.body?.current ?? null,
      upcoming: req.body?.upcoming ?? [],
    })
  );
}
