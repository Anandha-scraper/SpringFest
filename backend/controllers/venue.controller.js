/** HTTP layer for /api/venue — the code-gated, unauthenticated view. No
 * `req.user` anywhere in this file; the access code is the only credential.
 * Rules live in services/venueAccess.service.js. */
import * as venueAccess from "../services/venueAccess.service.js";

export async function access(req, res) {
  res.json(await venueAccess.venueView(req.body?.code));
}

export async function submission(req, res) {
  const { buffer, filename, contentType } = await venueAccess.venueSubmissionFile({
    code: req.body?.code,
    registrationId: req.body?.registration_id,
  });
  // Same posture as every other submission download in this app (Part 3):
  // the client saves it via a real <a download>, so the file is always
  // correctly named and typed regardless of what a browser would or
  // wouldn't render inline — most submissions are PPT/DOC, which nothing
  // can preview in a tab anyway.
  res.set("Content-Disposition", `attachment; filename="${filename}"`);
  res.set("Content-Type", contentType);
  res.send(buffer);
}
