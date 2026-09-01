"use client";

import ProtectedRoute from "@/components/common/ProtectedRoute.jsx";
import RoleLayout from "@/components/layout/RoleLayout.jsx";
import { ROLES } from "@/content/roles.js";

export default function EventDetailLayout({ children }) {
  return (
    <ProtectedRoute>
      <RoleLayout role={ROLES.PARTICIPANT}>{children}</RoleLayout>
    </ProtectedRoute>
  );
}
