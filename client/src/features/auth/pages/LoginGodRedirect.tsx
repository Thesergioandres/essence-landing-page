import { Navigate } from "react-router-dom";

/**
 * Legacy redirect - all login variants now use unified /login
 */
export default function LoginGodRedirect() {
  return <Navigate to="/login" replace />;
}
