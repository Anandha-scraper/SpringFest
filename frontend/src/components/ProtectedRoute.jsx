import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { homeForRole } from "../content/roles.js";

/**
 * `adminOnly` is the original guard and is unchanged. `roles` is the newer,
 * finer-grained one: an array of role names allowed through. Admins pass any
 * `roles` check. Someone with the wrong role is sent to their own dashboard
 * rather than the landing page.
 */
export default function ProtectedRoute({ children, adminOnly = false, roles }) {
  const { user, isAdmin, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="spinner" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

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
