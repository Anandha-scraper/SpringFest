import { ROLE_ADMIN, resolveRoleAndAssignments } from "../auth/roles.js";
import { readCookie, verifySession } from "../auth/session.js";
import { getAuth } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";

/** Establish who is calling, then attach their role.
 *
 * Two accepted credentials, in this order:
 *
 *   1. `Authorization: Bearer <Firebase ID token>` — the browser holding a
 *      token and attaching it per request. Every client-side call still uses
 *      this and is unchanged.
 *   2. The `__session` cookie — a Firebase session cookie (auth/session.js).
 *      This is what makes server-side rendering possible: the Next.js server
 *      receives cookies on a navigation, but can never see a token held in
 *      browser memory.
 *
 * Whichever proves the identity, the rest is identical: the role is resolved
 * server-side on every request (see auth/roles.js) — one Firestore read, which
 * keeps role changes effective immediately. */
export async function currentUser(req, res, next) {
  const authorization = req.headers.authorization || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const cookie = bearer ? "" : readCookie(req);

  // Cheap check first: no credential at all is a 401 regardless of whether
  // Firebase is reachable.
  if (!bearer && !cookie) {
    return next(new ApiError(401, "Missing bearer token"));
  }

  let decoded;
  try {
    decoded = bearer ? await getAuth().verifyIdToken(bearer) : await verifySession(cookie);
  } catch {
    // Deliberately one message for both paths. Which credential was presented,
    // and whether it was malformed, expired or revoked, is not the caller's
    // business — and the client treats all of them the same way: sign in again.
    return next(new ApiError(401, "Invalid or expired token"));
  }

  const email = decoded.email || "";
  let role, assignments;
  try {
    ({ role, assignments } = await resolveRoleAndAssignments(email));
  } catch {
    // Failing closed: better a clear 503 than silently demoting a volunteer or
    // admin to participant because Firestore blinked.
    return next(new ApiError(503, "Role lookup unavailable, please retry"));
  }

  req.user = {
    uid: decoded.uid,
    email,
    name: decoded.name || "",
    picture: decoded.picture || "",
    role,
    is_admin: role === ROLE_ADMIN,
    venue_id: assignments.venue_id ?? "",
  };
  next();
}

/** Admins satisfy every role check — expressed once here so it can't drift
 * between routes. Chain after currentUser. */
export function requireRoles(...allowed) {
  return (req, res, next) => {
    if (req.user.role !== ROLE_ADMIN && !allowed.includes(req.user.role)) {
      return next(new ApiError(403, `Requires one of: ${allowed.join(", ")}`));
    }
    next();
  };
}

function adminOnly(req, res, next) {
  if (!req.user.is_admin) return next(new ApiError(403, "Admin access required"));
  next();
}

// Convenience middleware chains for `router.get(path, ...AdminUser, handler)`.
// Admins pass every role check (see requireRoles), so AdminUser is the strict
// one and the others admit admins too.
export const CurrentUser = [currentUser];
export const AdminUser = [currentUser, adminOnly];
// Volunteers run their venue end to end — check-in and scoring both. There is
// no separate judge chain any more; see services/evaluation.service.js.
export const VolunteerUser = [currentUser, requireRoles("volunteer")];
