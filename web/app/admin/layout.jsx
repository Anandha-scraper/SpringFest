"use client";

import ProtectedRoute from "@/components/common/ProtectedRoute.jsx";
import RoleLayout from "@/components/layout/RoleLayout.jsx";
import { ROLES } from "@/content/roles.js";

export default function AdminLayout({ children }) {
  return (
    <ProtectedRoute adminOnly>
      <RoleLayout role={ROLES.ADMIN}>{children}</RoleLayout>
    </ProtectedRoute>
  );
}
