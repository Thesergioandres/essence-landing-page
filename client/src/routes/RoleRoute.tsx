import { Navigate, useLocation } from "react-router-dom";
import { authService } from "../api/services.ts";

interface RoleRouteProps {
  children: JSX.Element;
  role: "admin" | "distribuidor";
}

export function RoleRoute({ children, role }: RoleRouteProps) {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const user = authService.getCurrentUser();

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== role) {
    // Redirect to appropriate dashboard
    if (user.role === "distribuidor") {
      return <Navigate to="/distributor/dashboard" replace />;
    } else if (user.role === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
