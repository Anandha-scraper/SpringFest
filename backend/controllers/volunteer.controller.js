/** HTTP layer for /api/volunteer — QR scan and the per-member check-in
 * toggle. The state machine itself is in services/checkin.service.js. */
import * as checkin from "../services/checkin.service.js";

export async function scan(req, res) {
  res.json(await checkin.scan({ token: req.body?.token }));
}

export async function toggleCheckIn(req, res) {
  res.json(await checkin.toggle({ actorEmail: req.user.email, body: req.body || {} }));
}
