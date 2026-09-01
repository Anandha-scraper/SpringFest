"use client";

import ProtectedRoute from "@/components/common/ProtectedRoute.jsx";
import RoleLayout from "@/components/layout/RoleLayout.jsx";
import { ROLES } from "@/content/roles.js";

export default function VolunteerLayout({ children }) {
  return (
    <ProtectedRoute roles={[ROLES.VOLUNTEER]}>
      <RoleLayout role={ROLES.VOLUNTEER}>{children}</RoleLayout>
    </ProtectedRoute>
  );
}
