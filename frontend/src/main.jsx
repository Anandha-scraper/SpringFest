import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import GlyphMatrix from "./components/GlyphMatrix.jsx";
import Layout from "./components/layout/Layout.jsx";
import ClickSpark from "./components/reactbits/ClickSpark.jsx";

import Landing from "./pages/Landing.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import Login from "./pages/Login.jsx";
import MyRegistrations from "./pages/MyRegistrations.jsx";
import Success from "./pages/Success.jsx";
import NotFound from "./pages/NotFound.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import EventParticipants from "./pages/admin/EventParticipants.jsx";
import Registrations from "./pages/admin/Registrations.jsx";
import ManageEvents from "./pages/admin/ManageEvents.jsx";
import AddRoles from "./pages/admin/AddRoles.jsx";
import ManageRoles from "./pages/admin/ManageRoles.jsx";

import RoleLayout from "./components/layout/RoleLayout.jsx";
import { ROLES } from "./content/roles.js";
import JudgeHome from "./pages/roles/JudgeHome.jsx";
import JudgeAssignments from "./pages/roles/JudgeAssignments.jsx";
import JudgeScoring from "./pages/roles/JudgeScoring.jsx";
import VolunteerHome from "./pages/roles/VolunteerHome.jsx";
import VolunteerTasks from "./pages/roles/VolunteerTasks.jsx";
import VolunteerCheckIn from "./pages/roles/VolunteerCheckIn.jsx";
import ParticipantHome from "./pages/roles/ParticipantHome.jsx";
import ParticipantSchedule from "./pages/roles/ParticipantSchedule.jsx";

import "./components/reactbits/PillNav.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/landing.css";
import "./styles/admin.css";
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
        </ClickSpark>
      </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
