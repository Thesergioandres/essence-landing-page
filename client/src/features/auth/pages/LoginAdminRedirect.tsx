import { Navigate } from "react-router-dom";

/**
 * Legacy redirect - all login variants now use unified /login
 */
export default function LoginAdminRedirect() {
  return <Navigate to="/login" replace />;
}
