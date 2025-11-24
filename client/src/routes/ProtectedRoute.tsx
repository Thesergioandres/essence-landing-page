import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authService } from "../api/services.ts";

interface ProtectedRouteProps {
  children: ReactElement;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const user = authService.getCurrentUser();

  // If not authenticated, redirect to login
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // If specific roles are required, check if user has the right role
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      // Redirect to appropriate dashboard based on user's actual role
      const targetPath = user.role === "distribuidor" 
        ? "/distributor/dashboard" 
        : user.role === "admin" 
        ? "/admin/dashboard" 
        : "/";
      
      // Avoid redirect loop - only redirect if not already on target path
      if (location.pathname !== targetPath) {
        return <Navigate to={targetPath} replace />;
      }
    }
  }

  return children;
}
