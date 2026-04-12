import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useBusiness } from "../context/BusinessContext";
import { authService } from "../features/auth/services";
import { useSession } from "../hooks/useSession";
import { normalizeEmployeeRole } from "../shared/utils/roleAliases";

interface ProtectedRouteProps {
  children: ReactElement;
  allowedRoles?: string[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const { user: sessionUser, loading } = useSession();
  const { businessId: activeBusinessId, hydrating: businessHydrating } =
    useBusiness();
  const user = sessionUser || authService.getCurrentUser();

  const activeMembershipRole =
    user?.memberships?.find(membership => {
      const membershipBusinessId =
        typeof membership.business === "string"
          ? membership.business
          : membership.business?._id;

      if (!activeBusinessId || !membershipBusinessId) {
        return false;
      }

      return (
        membershipBusinessId === activeBusinessId &&
        membership.status === "active"
      );
    })?.role || null;

  const effectiveRole = normalizeEmployeeRole(
    activeMembershipRole || user?.role
  );

  const operativoAdminToEmployeeMap: Record<string, string> = {
    "/admin/stock-management": "/staff/operativo/stock-management",
    "/admin/global-inventory": "/staff/operativo/global-inventory",
    "/admin/branches": "/staff/operativo/branches",
    "/admin/inventory-entries": "/staff/operativo/inventory-entries",
    "/admin/transfer-history": "/staff/operativo/transfer-history",
    "/admin/sales": "/staff/operativo/sales",
    "/admin/analytics": "/staff/operativo/analytics",
    "/admin/expenses": "/staff/operativo/expenses",
    "/admin/team": "/staff/operativo/team",
  };

  const employeeAdminPrefixRedirects: Array<{
    prefix: string;
    target: string;
  }> = [
    { prefix: "/admin/products", target: "/staff/products" },
    { prefix: "/admin/add-product", target: "/staff/products" },
    { prefix: "/admin/employees", target: "/staff/operativo/team" },
    { prefix: "/admin/credits", target: "/staff/credits" },
    { prefix: "/admin/register-sale", target: "/staff/register-sale" },
    {
      prefix: "/admin/register-promotion",
      target: "/staff/register-promotion",
    },
  ];

  if (effectiveRole === "employee") {
    const employeeOperativoTarget =
      operativoAdminToEmployeeMap[location.pathname];

    if (employeeOperativoTarget) {
      return <Navigate to={employeeOperativoTarget} replace />;
    }

    const prefixMatch = employeeAdminPrefixRedirects.find(({ prefix }) =>
      location.pathname.startsWith(prefix)
    );

    if (prefixMatch) {
      return <Navigate to={prefixMatch.target} replace />;
    }
  }

  const waitingForContext = Boolean(token && (loading || businessHydrating));
  if (waitingForContext) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-gray-200">
          Validando sesión y negocio...
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Si el usuario está pending, solo permitir acceso a account-hold
  if (user.status === "pending") {
    return (
      <Navigate
        to="/account-hold"
        replace
        state={{ from: location, reason: "pending" }}
      />
    );
  }

  const isExpired =
    user.subscriptionExpiresAt &&
    new Date(user.subscriptionExpiresAt) < new Date();

  const normalizedUserRole = normalizeEmployeeRole(user.role);

  if (normalizedUserRole !== "god" && (user.status !== "active" || isExpired)) {
    const reason = isExpired ? "expired" : user.status;
    return (
      <Navigate to="/account-hold" replace state={{ from: location, reason }} />
    );
  }

  // If specific roles are required, check if user has the right role
  if (allowedRoles && allowedRoles.length > 0) {
    if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
      // Redirect to appropriate dashboard based on user's actual role
      const targetPath =
        effectiveRole === "employee"
          ? "/staff/dashboard"
          : effectiveRole === "admin" || effectiveRole === "super_admin"
            ? "/admin/analytics"
            : effectiveRole === "god"
              ? "/admin/analytics"
              : "/";

      // Avoid redirect loop - only redirect if not already on target path
      if (location.pathname !== targetPath) {
        return <Navigate to={targetPath} replace />;
      }
    }
  }

  return children;
}
