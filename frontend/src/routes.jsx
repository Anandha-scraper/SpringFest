import { lazy } from "react";
import { Routes, Route } from "react-router-dom";

import ProtectedRoute from "@/components/common/ProtectedRoute.jsx";
import Layout from "@/components/layout/Layout.jsx";
import RoleLayout from "@/components/layout/RoleLayout.jsx";
import { ROLES } from "@/content/roles.js";

// Route-level code splitting: each page becomes its own chunk, fetched only
// when its route is actually visited, instead of one bundle carrying every
// admin/volunteer/participant page (and their deps, e.g. chart.js) up
// front for every anonymous landing-page visitor.
const Landing = lazy(() => import("@/pages/Landing.jsx"));
const EventDetail = lazy(() => import("@/pages/EventDetail.jsx"));
const MyRegistrations = lazy(() => import("@/pages/MyRegistrations.jsx"));
const NotFound = lazy(() => import("@/pages/NotFound.jsx"));

const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard.jsx"));
const EventParticipants = lazy(() => import("@/pages/admin/EventParticipants.jsx"));
const Registrations = lazy(() => import("@/pages/admin/Registrations.jsx"));
const ManageEvents = lazy(() => import("@/pages/admin/ManageEvents.jsx"));
const AddRoles = lazy(() => import("@/pages/admin/AddRoles.jsx"));
const ManageRoles = lazy(() => import("@/pages/admin/ManageRoles.jsx"));
const PaymentSettings = lazy(() => import("@/pages/admin/PaymentSettings.jsx"));
const Approvals = lazy(() => import("@/pages/admin/Approvals.jsx"));

const VolunteerHome = lazy(() => import("@/pages/roles/VolunteerHome.jsx"));
const VolunteerRoster = lazy(() => import("@/pages/roles/VolunteerRoster.jsx"));
const VolunteerCheckIn = lazy(() => import("@/pages/roles/VolunteerCheckIn.jsx"));
const VolunteerScoring = lazy(() => import("@/pages/roles/VolunteerScoring.jsx"));
const ParticipantHome = lazy(() => import("@/pages/roles/ParticipantHome.jsx"));
const ParticipantSchedule = lazy(() => import("@/pages/roles/ParticipantSchedule.jsx"));

/** Every route in the app. Two shells: `Layout` is the marketing chrome
 * (navbar + footer), `RoleLayout` is the dashboard chrome (sidebar rail +
 * outlet) — which the event-detail page uses too, so registering feels like
 * part of the dashboard rather than the landing site. */
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* The one registrations page — dashboard shell, like event detail, so
          the sidebar carries the navigation instead of the marketing pill
          nav. The outcome of a registration is a popup on the event page,
          not a route of its own. */}
      <Route
        path="/my-registrations"
        element={
          <ProtectedRoute>
            <RoleLayout role={ROLES.PARTICIPANT} />
          </ProtectedRoute>
        }
      >
        <Route index element={<MyRegistrations />} />
      </Route>

      {/* Event detail + registration — sidebar shell (like the role
          dashboards) rather than the marketing navbar/footer. */}
      <Route
        path="/events/:id"
        element={
          <ProtectedRoute>
            <RoleLayout role={ROLES.PARTICIPANT} />
          </ProtectedRoute>
        }
      >
        <Route index element={<EventDetail />} />
      </Route>

      {/* ── Role dashboards. Each parent renders RoleLayout (heading
           + sidebar + outlet); children are the sections. ───────── */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <RoleLayout role={ROLES.ADMIN} />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="registrations" element={<Registrations />} />
        <Route path="payment" element={<PaymentSettings />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="events" element={<ManageEvents />} />
        <Route path="events/:id" element={<EventParticipants />} />
        <Route path="roles" element={<AddRoles />} />
        <Route path="allocations" element={<ManageRoles />} />
      </Route>

      {/* Scoring lives here, not under a /judge branch: the volunteer
          covering a venue both checks teams in and scores them. */}
      <Route
        path="/volunteer"
        element={
          <ProtectedRoute roles={[ROLES.VOLUNTEER]}>
            <RoleLayout role={ROLES.VOLUNTEER} />
          </ProtectedRoute>
        }
      >
        <Route index element={<VolunteerHome />} />
        <Route path="check-in" element={<VolunteerCheckIn />} />
        <Route path="tasks" element={<VolunteerRoster />} />
        <Route path="scoring" element={<VolunteerScoring />} />
      </Route>

      <Route
        path="/participant"
        element={
          <ProtectedRoute roles={[ROLES.PARTICIPANT]}>
            <RoleLayout role={ROLES.PARTICIPANT} />
          </ProtectedRoute>
        }
      >
        <Route index element={<ParticipantHome />} />
        <Route path="schedule" element={<ParticipantSchedule />} />
      </Route>
    </Routes>
  );
}
