"use client";

// ─────────────────────────────────────────────────────────────
//  Role config — presentation only.
//
//  Which role someone HAS is decided server-side: backend/auth/
//  roles.js resolves it from ADMIN_EMAILS (.env) and the Firestore
//  `roles` collection, and it arrives via GET /api/me. Nothing here
//  grants access; this file only says where each role goes and what
//  its sidebar looks like.
//
//  There is no `judge` role: it was folded into `volunteer`, who now
//  both checks people in and scores them at their venue.
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
  VOLUNTEER: "volunteer",
  PARTICIPANT: "participant",
};

// The backend applies the same fallback: not an admin or volunteer
// means participant.
export const DEFAULT_ROLE = ROLES.PARTICIPANT;

const HOME_FOR_ROLE = {
  [ROLES.ADMIN]: "/admin",
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
    { label: "Attendance", to: "/admin/attendance", icon: UserCheck },
    { label: "Events", to: "/admin/events", end: true, icon: CalendarDays },
    { label: "Add Roles", to: "/admin/roles", icon: UserPlus },
    { label: "Manage Roles", to: "/admin/allocations", icon: Users },
  ],
  // Check-in and scoring are one job now — the person staffing a venue
  // does both, so Scoring sits beside Check-in rather than under a
  // separate judge dashboard.
  [ROLES.VOLUNTEER]: [
    { label: "Overview", to: "/volunteer", end: true, icon: LayoutDashboard },
    { label: "Check-in", to: "/volunteer/check-in", icon: UserCheck },
    { label: "Roster", to: "/volunteer/tasks", icon: ListChecks },
    { label: "Scoring", to: "/volunteer/scoring", icon: Star },
  ],
  [ROLES.PARTICIPANT]: [
    { label: "Overview", to: "/participant", end: true, icon: LayoutDashboard },
    { label: "My Registrations", to: "/my-registrations", icon: Ticket },
    { label: "Schedule", to: "/participant/schedule", icon: CalendarDays },
  ],
};

export const ROLE_TITLE = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.VOLUNTEER]: "Volunteer",
  [ROLES.PARTICIPANT]: "Participant",
};
