/** Staff access to a team's uploaded submission file.
 *
 * Participants download their own submission through me.service.js. This is the
 * organiser side: an admin, a judge assigned to the event, or the volunteer
 * covering that event's venue can open the file to show it "on the board".
 * Same streaming posture as everywhere else — the bucket stays private and the
 * bytes go out through an authenticated route.
 */
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { downloadBuffer } from "./storage.js";

/** The single event held at this volunteer's assigned venue, or "" if they
 * have no venue or the venue backs no event. A venue backs at most one event
 * (enforced on event write), so this is unambiguous. */
export async function resolveVolunteerEventId(user) {
  if (!user?.venue_id) return "";
  const snap = await getDb()
    .collection("events")
    .where("venue_id", "==", user.venue_id)
    .limit(1)
    .get();
  return snap.empty ? "" : snap.docs[0].id;
}

/** True when `user` may act on `eventId` as staff: admin, an assigned judge,
 * or the venue's volunteer. */
export async function staffCanAccessEvent(user, eventId) {
  if (user?.is_admin) return true;
  if (user?.role === "judge") return (user.event_ids || []).includes(eventId);
  if (user?.role === "volunteer") return (await resolveVolunteerEventId(user)) === eventId;
  return false;
}

export async function staffSubmissionFile({ user, registrationId }) {
  const doc = await getDb().collection("registrations").doc(registrationId).get();
  if (!doc.exists) throw new ApiError(404, "Registration not found");
  const row = doc.data() ?? {};

  if (!(await staffCanAccessEvent(user, row.event_id || ""))) {
    throw new ApiError(403, "You're not assigned to this event.");
  }
  if (!row.submission_path) throw new ApiError(404, "No file has been uploaded yet");

  return {
    buffer: await downloadBuffer(row.submission_path),
    filename: `${registrationId}.${row.submission_ext || "bin"}`,
  };
}
