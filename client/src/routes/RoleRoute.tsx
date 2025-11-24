import { Navigate } from "react-router-dom";
import { authService } from "../api/services.ts";

interface RoleRouteProps {
  children: JSX.Element;
  role: "admin" | "distribuidor";
}

export function RoleRoute({ children, role }: RoleRouteProps) {
  const user = authService.getCurrentUser();

  // If no user, let ProtectedRoute handle it
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role and redirect to appropriate dashboard
  if (user.role !== role) {
    if (user.role === "distribuidor") {
      return <Navigate to="/distributor/dashboard" replace />;
    }
    if (user.role === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
