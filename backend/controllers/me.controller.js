/** HTTP layer for /api/me — the signed-in user's own data. The three
 * file routes write bytes; me.service.js decided they were allowed to. */
import * as me from "../services/me.service.js";

export async function profile(req, res) {
  res.json(await me.profile(req.user));
}

export async function paymentQr(req, res) {
  const { buffer, contentType } = await me.paymentQr();
  res.set("Content-Type", contentType);
  res.send(buffer);
}

export async function registrations(req, res) {
  res.json(await me.myRegistrations(req.user));
}

export async function submission(req, res) {
  const { buffer, filename } = await me.submissionFile(req.user, req.params.registrationId);
  res.set("Content-Disposition", `attachment; filename="${filename}"`);
  res.set("Content-Type", "application/octet-stream");
  res.send(buffer);
}

export async function badge(req, res) {
  res.set("Content-Type", "image/png");
  res.send(await me.badgePng(req.user));
}

export async function schedule(req, res) {
  res.json(await me.schedule());
}
