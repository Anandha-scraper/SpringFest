/** HTTP layer for /api/judge — the judging dashboard. All rules live in
 * services/judge.service.js; the submission stream reuses the shared staff
 * file-access check. */
import * as judge from "../services/judge.service.js";
import { staffSubmissionFile } from "../services/submissionAccess.js";

export async function events(req, res) {
  res.json(await judge.assignedEvents(req.user));
}

export async function participants(req, res) {
  res.json(await judge.eventParticipants({ user: req.user, eventId: req.params.eventId }));
}

export async function saveEvaluation(req, res) {
  res.json(
    await judge.saveEvaluation({
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
    await judge.deleteEvaluation({
      user: req.user,
      eventId: req.params.eventId,
      registrationId: req.params.registrationId,
    })
  );
}

export async function getQueue(req, res) {
  res.json(await judge.getQueue({ user: req.user, eventId: req.params.eventId }));
}

export async function setQueue(req, res) {
  res.json(
    await judge.setQueue({
      user: req.user,
      eventId: req.params.eventId,
      current: req.body?.current ?? null,
      upcoming: req.body?.upcoming ?? [],
    })
  );
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
