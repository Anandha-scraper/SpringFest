import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import GlyphMatrix from "./components/GlyphMatrix.jsx";
import Layout from "./components/layout/Layout.jsx";
import ClickSpark from "./components/reactbits/ClickSpark.jsx";

// Route-level code splitting: each page becomes its own chunk, fetched only
// when its route is actually visited, instead of one bundle carrying every
// admin/judge/volunteer/participant page (and their deps, e.g. chart.js) up
// front for every anonymous landing-page visitor.
const Landing = lazy(() => import("./pages/Landing.jsx"));
const EventDetail = lazy(() => import("./pages/EventDetail.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const MyRegistrations = lazy(() => import("./pages/MyRegistrations.jsx"));
const Success = lazy(() => import("./pages/Success.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const EventParticipants = lazy(() => import("./pages/admin/EventParticipants.jsx"));
const Registrations = lazy(() => import("./pages/admin/Registrations.jsx"));
const ManageEvents = lazy(() => import("./pages/admin/ManageEvents.jsx"));
const AddRoles = lazy(() => import("./pages/admin/AddRoles.jsx"));
const ManageRoles = lazy(() => import("./pages/admin/ManageRoles.jsx"));

import RoleLayout from "./components/layout/RoleLayout.jsx";
import { ROLES } from "./content/roles.js";
const JudgeHome = lazy(() => import("./pages/roles/JudgeHome.jsx"));
const JudgeAssignments = lazy(() => import("./pages/roles/JudgeAssignments.jsx"));
const JudgeScoring = lazy(() => import("./pages/roles/JudgeScoring.jsx"));
const VolunteerHome = lazy(() => import("./pages/roles/VolunteerHome.jsx"));
const VolunteerTasks = lazy(() => import("./pages/roles/VolunteerTasks.jsx"));
const VolunteerCheckIn = lazy(() => import("./pages/roles/VolunteerCheckIn.jsx"));
const ParticipantHome = lazy(() => import("./pages/roles/ParticipantHome.jsx"));
const ParticipantSchedule = lazy(() => import("./pages/roles/ParticipantSchedule.jsx"));

import "./components/reactbits/PillNav.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/landing.css";
import "./styles/admin.css";
import "./styles/register-button.css";
import "./styles/sign-in-modal.css";
// Utilities only — preflight is off, so this can't touch the reset above.
import "./styles/tailwind.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* Site-wide animated backdrop, behind every route. */}
      <div className="app-bg" aria-hidden="true">
        <GlyphMatrix
          glyphs={"01·•+*/\\<>="}
          cellSize={16}
          mutationRate={0.035}
          interval={110}
          fadeBottom={0.55}
          color="#11224e"
        />
      </div>

      <AuthProvider>
      <BrowserRouter>
        <ClickSpark sparkColor="#f87b1b" sparkSize={9} sparkRadius={16} sparkCount={7} duration={420}>
          {/* One boundary for every route chunk — a lazy page's own load
              looks like the same spinner ProtectedRoute already shows while
              resolving auth, not a new loading UI. */}
          <Suspense fallback={<div className="spinner" />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/success" element={<Success />} />

              <Route
                path="/events/:id"
                element={
                  <ProtectedRoute>
                    <EventDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-registrations"
                element={
                  <ProtectedRoute>
                    <MyRegistrations />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* Full-bleed, no navbar/footer */}
            <Route path="/login" element={<Login />} />

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
              <Route path="events" element={<ManageEvents />} />
              <Route path="events/:id" element={<EventParticipants />} />
              <Route path="roles" element={<AddRoles />} />
              <Route path="allocations" element={<ManageRoles />} />
            </Route>

            <Route
              path="/judge"
              element={
                <ProtectedRoute roles={[ROLES.JUDGE]}>
                  <RoleLayout role={ROLES.JUDGE} />
                </ProtectedRoute>
              }
            >
              <Route index element={<JudgeHome />} />
              <Route path="assignments" element={<JudgeAssignments />} />
              <Route path="scoring" element={<JudgeScoring />} />
            </Route>

            <Route
              path="/volunteer"
              element={
                <ProtectedRoute roles={[ROLES.VOLUNTEER]}>
                  <RoleLayout role={ROLES.VOLUNTEER} />
                </ProtectedRoute>
              }
            >
              <Route index element={<VolunteerHome />} />
              <Route path="tasks" element={<VolunteerTasks />} />
              <Route path="check-in" element={<VolunteerCheckIn />} />
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
              <Route path="registrations" element={<MyRegistrations />} />
              <Route path="schedule" element={<ParticipantSchedule />} />
            </Route>
          </Routes>
          </Suspense>
        </ClickSpark>
      </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
