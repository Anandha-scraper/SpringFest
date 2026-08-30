/** HTTP layer for /api/volunteer — QR scan, the fest-entry mark, the
 * per-event check-in toggle, and the volunteer's own dashboard. The state
 * machine itself is in services/checkin.service.js. */
import * as checkin from "../services/checkin.service.js";
import { staffSubmissionFile } from "../services/submissionAccess.js";

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
