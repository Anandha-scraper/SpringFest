// ─────────────────────────────────────────────────────────────
//  Role config — presentation only.
//
//  Which role someone HAS is decided server-side: backend/app/
//  services/roles.py resolves it from ADMIN_EMAILS (.env) and the
//  Firestore `roles` collection, and it arrives via GET /api/me.
//  Nothing here grants access; this file only says where each role
//  goes and what its sidebar looks like.
// ─────────────────────────────────────────────────────────────

export const ROLES = {
  ADMIN: "admin",
  JUDGE: "judge",
  VOLUNTEER: "volunteer",
  PARTICIPANT: "participant",
};

// The backend applies the same fallback: not an admin, judge or
// volunteer means participant.
export const DEFAULT_ROLE = ROLES.PARTICIPANT;

export const HOME_FOR_ROLE = {
  [ROLES.ADMIN]: "/admin",
  [ROLES.JUDGE]: "/judge",
  [ROLES.VOLUNTEER]: "/volunteer",
  [ROLES.PARTICIPANT]: "/participant",
};

export const homeForRole = (role) => HOME_FOR_ROLE[role] ?? "/";

// Sidebar nav per role. `end` marks the index route so NavLink doesn't
// stay active on every child path.
export const ROLE_NAV = {
  [ROLES.ADMIN]: [
    { label: "Overview", to: "/admin", end: true },
    { label: "Manage People", to: "/admin/people" },
  ],
  [ROLES.JUDGE]: [
    { label: "Overview", to: "/judge", end: true },
    { label: "Assignments", to: "/judge/assignments" },
    { label: "Scoring", to: "/judge/scoring" },
  ],
  [ROLES.VOLUNTEER]: [
    { label: "Overview", to: "/volunteer", end: true },
    { label: "Tasks", to: "/volunteer/tasks" },
    { label: "Check-in", to: "/volunteer/check-in" },
  ],
  [ROLES.PARTICIPANT]: [
    { label: "Overview", to: "/participant", end: true },
    { label: "My Registrations", to: "/participant/registrations" },
    { label: "Schedule", to: "/participant/schedule" },
  ],
};

export const ROLE_TITLE = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.JUDGE]: "Judge",
  [ROLES.VOLUNTEER]: "Volunteer",
  [ROLES.PARTICIPANT]: "Participant",
};
