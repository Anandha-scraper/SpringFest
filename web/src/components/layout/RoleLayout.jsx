"use client";

import "@/styles/pages/admin/shared.css";
import RoleSidebar from "@/components/layout/RoleSidebar.jsx";
import PageBoundary from "@/components/common/PageBoundary.jsx";

/**
 * Standalone shell for every role dashboard (and the event-detail page): the
 * collapsible icon rail plus the page content — no marketing navbar or footer.
 * One component driven by ROLE_NAV rather than four near-identical layouts.
 * Pages own their own headings; the rail carries role identity.
 *
 * `<Outlet />` became `children`, the App Router's equivalent — each
 * app/<role>/layout.jsx renders this around its own segment.
 */
export default function RoleLayout({ role, children }) {
  return (
    <div className="role-shell">
      <RoleSidebar role={role} />
      <main className="role-main">
        <PageBoundary>{children}</PageBoundary>
      </main>
    </div>
  );
}
