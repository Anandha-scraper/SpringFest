/** HTTP layer for /api/session — exchanging a Firebase ID token for a session
 * cookie, and giving it back. The rules live in auth/session.js. */
import { clearedHeader, createSession, revokeAllSessions } from "../auth/session.js";
import { claimUnclaimedRows } from "../services/accountLink.service.js";

/** Sign in: the browser has just completed the Google popup and hands over the
 * resulting ID token; we hand back a cookie the server can read on its own. */
export async function create(req, res) {
  const { header, uid, email, emailVerified } = await createSession(
    req.body?.id_token || req.body?.idToken
  );
  res.set("Set-Cookie", header);

  // Sign-in is the right moment to attach registrations an organiser entered
  // for this address before its owner had an account. It used to run on every
  // GET /api/me, which put a Firestore round trip on the hottest endpoint in
  // the app to answer a question that only changes when somebody signs in.
  //
  // Best-effort: a failure here must not fail the sign-in. Nothing depends on
  // it having run — `registrationLookup.matchMemberIndex` shows unclaimed rows
  // to their owner regardless, and `createOrResume` claims again before the
  // two checks that are actually uid-keyed.
  try {
    await claimUnclaimedRows({ uid, email, emailVerified });
  } catch (err) {
    console.warn("Could not attach unclaimed registrations:", err?.message || err);
  }
  // Nothing about the cookie is echoed in the body — it is HttpOnly precisely
  // so that no script, ours included, ever handles its value.
  res.status(201).json({ uid, signed_in: true });
}

/** Sign out. The cookie is cleared here and the refresh tokens behind it are
 * revoked, so any other device holding a session for this account drops on its
 * next request rather than staying live for the rest of the five days. */
export async function destroy(req, res) {
  await revokeAllSessions(req.user?.uid);
  res.set("Set-Cookie", clearedHeader());
  res.status(204).end();
}
