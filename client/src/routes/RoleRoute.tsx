import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { authService } from "../features/auth/services";
import { normalizeEmployeeRole } from "../shared/utils/roleAliases";

interface RoleRouteProps {
  children: ReactElement;
  role: "admin" | "employee";
}

export function RoleRoute({ children, role }: RoleRouteProps) {
  const user = authService.getCurrentUser();
  const normalizedUserRole = normalizeEmployeeRole(user?.role);

  // If no user, let ProtectedRoute handle it
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role and redirect to appropriate dashboard
  if (normalizedUserRole !== role) {
    if (normalizedUserRole === "employee") {
      return <Navigate to="/staff/dashboard" replace />;
    }
    if (normalizedUserRole === "admin") {
      return <Navigate to="/admin/analytics" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
