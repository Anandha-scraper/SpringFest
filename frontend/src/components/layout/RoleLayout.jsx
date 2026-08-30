import { Outlet } from "react-router-dom";
import RoleSidebar from "./RoleSidebar.jsx";

/**
 * Standalone shell for every role dashboard (and the event-detail page): the
 * collapsible icon rail plus the child route's outlet — no marketing navbar or
 * footer. One component driven by ROLE_NAV rather than four near-identical
 * layouts. Pages own their own headings; the rail carries role identity.
 */
export default function RoleLayout({ role }) {
  return (
    <div className="role-shell">
      <RoleSidebar role={role} />
      <main className="role-main">
        <Outlet />
      </main>
    </div>
  );
}
