/** Session cookies — the second way a caller can prove who they are.
 *
 * The original way, still fully supported, is `Authorization: Bearer <Firebase
 * ID token>`: the browser holds the token and attaches it to every fetch. That
 * works perfectly for a client-rendered app and not at all for a server-rendered
 * one, because the Next.js server has no way to get at a token living in the
 * browser's JS. A cookie it does get, on every navigation, automatically.
 *
 * So sign-in now also mints a Firebase *session cookie* (Admin SDK,
 * `createSessionCookie`) which the server can verify on its own. Nothing about
 * *what* an identity means changes — `auth/roles.js` still resolves the role,
 * still fails closed. This module only adds a second way to establish *who*.
 *
 * Named `__session` deliberately. Firebase's CDN layer strips every cookie
 * except one with exactly that name, and picking anything else produces a bug
 * that works locally and silently fails in production.
 *
 * CSRF: the cookie is `SameSite=Lax`, so a cross-site form post can't carry it,
 * and every mutation in this API is a POST/PUT/PATCH/DELETE (Lax only auto-sends
 * on top-level GET navigations). There is deliberately no hand-rolled CSRF token
 * — one more secret to get wrong for no gain over what the browser enforces.
 */
import { getAuth } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";

export const SESSION_COOKIE = "__session";

/** Five days. Long enough that a volunteer signing in on day one of the fest is
 * still signed in on day two, short enough that a stolen laptop stops working
 * the same week. Firebase allows 5 minutes to 2 weeks. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

/** How recently the user must have actually signed in for us to mint a cookie.
 * A long-lived cookie is a bigger prize than an hour-long ID token, so it is
 * only issued right after a real sign-in — not from a token that has been
 * sitting in a tab for 50 minutes. */
const MAX_AUTH_AGE_MS = 5 * 60 * 1000;

/** Secure is skipped only when explicitly running http locally. Chrome and
 * Firefox both treat http://localhost as a secure context and will store a
 * Secure cookie there, so this is really just an escape hatch. */
const isProd = () => process.env.NODE_ENV === "production";

/** Parse the Cookie header. Hand-rolled rather than adding cookie-parser: this
 * is the only cookie the API reads, and the codebase already prefers a few
 * lines over a dependency (see services/cache.js, components/ui/toast.jsx). */
export function readCookie(req, name = SESSION_COOKIE) {
  const header = req.headers.cookie;
  if (!header) return "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return "";
}

function serialize(value, maxAgeMs) {
  const bits = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (isProd()) bits.push("Secure");
  return bits.join("; ");
}

/** Exchange a freshly minted ID token for a session cookie. */
export async function createSession(idToken) {
  if (!idToken || typeof idToken !== "string") {
    throw new ApiError(400, "idToken is required");
  }

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken, true);
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }

  // auth_time is seconds since epoch, and is when the user actually
  // authenticated — not when this particular token was minted.
  const authAgeMs = Date.now() - (decoded.auth_time ?? 0) * 1000;
  if (authAgeMs > MAX_AUTH_AGE_MS) {
    throw new ApiError(401, "Please sign in again to continue");
  }

  const cookie = await getAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
  return { cookie, header: serialize(cookie, SESSION_MAX_AGE_MS), uid: decoded.uid };
}

/** Verify an incoming cookie. `checkRevoked` costs a lookup but is the only
 * thing that makes signing out on one device mean anything on another. */
export async function verifySession(cookie) {
  return getAuth().verifySessionCookie(cookie, true);
}

/** Clearing is Max-Age=0 with otherwise identical attributes — a browser only
 * replaces a cookie when path, domain and flags all match. */
export function clearedHeader() {
  return serialize("", 0);
}

/** Sign out everywhere: the refresh tokens behind every session cookie for this
 * uid stop verifying, so other devices drop on their next request. */
export async function revokeAllSessions(uid) {
  if (!uid) return;
  await getAuth().revokeRefreshTokens(uid);
}
