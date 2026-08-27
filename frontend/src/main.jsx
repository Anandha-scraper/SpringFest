import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Layout from "./components/layout/Layout.jsx";
import ClickSpark from "./components/reactbits/ClickSpark.jsx";

import Landing from "./pages/Landing.jsx";
import Events from "./pages/Events.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import Login from "./pages/Login.jsx";
import MyRegistrations from "./pages/MyRegistrations.jsx";
import Success from "./pages/Success.jsx";
import NotFound from "./pages/NotFound.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import EventParticipants from "./pages/admin/EventParticipants.jsx";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/landing.css";
import "./styles/admin.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
      <BrowserRouter>
        <ClickSpark sparkColor="#f2789f" sparkSize={9} sparkRadius={16} sparkCount={7} duration={420}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/events" element={<Events />} />
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
              <Route
                path="/admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/events/:id"
                element={
                  <ProtectedRoute adminOnly>
                    <EventParticipants />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Route>

            {/* Full-bleed, no navbar/footer */}
            <Route path="/login" element={<Login />} />
          </Routes>
        </ClickSpark>
      </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
