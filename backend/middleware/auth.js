import { ROLE_ADMIN, resolveRoleAndAssignments } from "../auth/roles.js";
import { getAuth } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";

/** Verify the Firebase ID token from the Authorization: Bearer <token>
 * header and attach the caller's role.
 *
 * The role is resolved server-side on every request (see auth/roles.js)
 * — one Firestore read, which keeps role changes effective immediately. */
export async function currentUser(req, res, next) {
  const authorization = req.headers.authorization || "";
  // Cheap check first: a missing header is a 401 regardless of whether
  // Firebase is reachable.
  if (!authorization.startsWith("Bearer ")) {
    return next(new ApiError(401, "Missing bearer token"));
  }
  const token = authorization.slice(7);

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }

  const email = decoded.email || "";
  let role, assignments;
  try {
    ({ role, assignments } = await resolveRoleAndAssignments(email));
  } catch {
    // Failing closed: better a clear 503 than silently demoting a judge or
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
    event_ids: assignments.event_ids ?? [],
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
export const VolunteerUser = [currentUser, requireRoles("volunteer")];
export const JudgeUser = [currentUser, requireRoles("judge")];
