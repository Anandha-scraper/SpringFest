// ─────────────────────────────────────────────────────────────
//  Role config — presentation only.
//
//  Which role someone HAS is decided server-side: backend/src/
//  services/roles.js resolves it from ADMIN_EMAILS (.env) and the
//  Firestore `roles` collection, and it arrives via GET /api/me.
//  Nothing here grants access; this file only says where each role
//  goes and what its sidebar looks like.
// ─────────────────────────────────────────────────────────────

import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  UserPlus,
  Users,
  ListChecks,
  Star,
  UserCheck,
  Ticket,
  CreditCard,
  BadgeCheck,
} from "lucide-react";

export const ROLES = {
  ADMIN: "admin",
  JUDGE: "judge",
  VOLUNTEER: "volunteer",
  PARTICIPANT: "participant",
};

// The backend applies the same fallback: not an admin, judge or
// volunteer means participant.
export const DEFAULT_ROLE = ROLES.PARTICIPANT;

const HOME_FOR_ROLE = {
  [ROLES.ADMIN]: "/admin",
  [ROLES.JUDGE]: "/judge",
  [ROLES.VOLUNTEER]: "/volunteer",
  [ROLES.PARTICIPANT]: "/participant",
};

export const homeForRole = (role) => HOME_FOR_ROLE[role] ?? "/";

// Sidebar nav per role. `end` marks the index route so NavLink doesn't
// stay active on every child path. `icon` is a lucide-react component,
// shown beside the label and alone when the sidebar is collapsed.
export const ROLE_NAV = {
  [ROLES.ADMIN]: [
    { label: "Overview", to: "/admin", end: true, icon: LayoutDashboard },
    { label: "Registrations", to: "/admin/registrations", icon: ClipboardList },
    { label: "Payment", to: "/admin/payment", icon: CreditCard },
    { label: "Approvals", to: "/admin/approvals", icon: BadgeCheck },
    { label: "Events", to: "/admin/events", end: true, icon: CalendarDays },
    { label: "Add Roles", to: "/admin/roles", icon: UserPlus },
    { label: "Manage Roles", to: "/admin/allocations", icon: Users },
  ],
  [ROLES.JUDGE]: [
    { label: "Overview", to: "/judge", end: true, icon: LayoutDashboard },
    { label: "Queue", to: "/judge/queue", icon: ListChecks },
    { label: "Scoring", to: "/judge/scoring", icon: Star },
  ],
  [ROLES.VOLUNTEER]: [
    { label: "Overview", to: "/volunteer", end: true, icon: LayoutDashboard },
    { label: "Check-in", to: "/volunteer/check-in", icon: UserCheck },
    { label: "Roster", to: "/volunteer/tasks", icon: ListChecks },
  ],
  [ROLES.PARTICIPANT]: [
    { label: "Overview", to: "/participant", end: true, icon: LayoutDashboard },
    { label: "My Registrations", to: "/my-registrations", icon: Ticket },
    { label: "Schedule", to: "/participant/schedule", icon: CalendarDays },
  ],
};

export const ROLE_TITLE = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.JUDGE]: "Judge",
  [ROLES.VOLUNTEER]: "Volunteer",
  [ROLES.PARTICIPANT]: "Participant",
};
