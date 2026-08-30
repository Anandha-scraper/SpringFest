import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext.jsx";
import { homeForRole } from "@/content/roles.js";
import SignInModal from "@/components/common/SignInModal.jsx";
import Loader from "@/components/common/Loader.jsx";

/**
 * `adminOnly` is the original guard and is unchanged. `roles` is the newer,
 * finer-grained one: an array of role names allowed through. Admins pass any
 * `roles` check. Someone with the wrong role is sent to their own dashboard
 * rather than the landing page.
 *
 * A signed-out visitor gets the Google sign-in modal in place — there is no
 * separate /login page. Signing in re-renders this guard on the same URL;
 * dismissing it sends them home.
 */
export default function ProtectedRoute({ children, adminOnly = false, roles }) {
  const { user, isAdmin, role, loading } = useAuth();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (loading) return <Loader />;

  if (!user) {
    if (dismissed) return <Navigate to="/" replace />;
    return <SignInModal open redirectOnSignIn={false} onClose={() => setDismissed(true)} />;
  }

  const denied = (adminOnly && !isAdmin) || (roles && !isAdmin && !roles.includes(role));
  if (denied) {
    // Send people to their own dashboard rather than the landing page — this is
    // the "not an admin, judge or volunteer means participant" rule in the UI.
    // Never redirect a page to itself, or a role whose own home is guarded
    // against it would ping-pong forever.
    const home = homeForRole(role);
    return <Navigate to={home === location.pathname ? "/" : home} replace />;
  }

  return children;
}
