import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import { ROLE_NAV, ROLE_TITLE } from "../../content/roles.js";

/**
 * Shared chrome for every role dashboard: heading, sidebar, and the child
 * route's outlet. One component driven by ROLE_NAV rather than four
 * near-identical layouts.
 */
export default function RoleLayout({ role }) {
  const { user } = useAuth();
  const nav = ROLE_NAV[role] || [];

  return (
    <div className="container page-pad admin">
      <div className="admin-head">
        <div>
          <span className="eyebrow">{ROLE_TITLE[role] || "Dashboard"}</span>
          <h1>{ROLE_TITLE[role]} Dashboard</h1>
          <p className="muted">
            Signed in as {user?.displayName || user?.email}
          </p>
        </div>
      </div>

      <div className="role-shell">
        <nav className="role-nav chips" aria-label={`${ROLE_TITLE[role]} sections`}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `chip ${isActive ? "active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="role-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
