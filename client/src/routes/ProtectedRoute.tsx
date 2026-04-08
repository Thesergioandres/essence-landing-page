import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authService } from "../features/auth/services";
import { useSession } from "../hooks/useSession";

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
  const selectedBusinessId = localStorage.getItem("businessId");
  const { user: sessionUser, loading } = useSession();
  const user = sessionUser || authService.getCurrentUser();

  const activeMembershipRole =
    user?.memberships?.find(membership => {
      const membershipBusinessId =
        typeof membership.business === "string"
          ? membership.business
          : membership.business?._id;

      if (!selectedBusinessId || !membershipBusinessId) {
        return false;
      }

      return (
        membershipBusinessId === selectedBusinessId &&
        membership.status === "active"
      );
    })?.role || null;

  const effectiveRole = activeMembershipRole || user?.role;

  const operativoAdminToDistributorMap: Record<string, string> = {
    "/admin/stock-management": "/distributor/operativo/stock-management",
    "/admin/global-inventory": "/distributor/operativo/global-inventory",
    "/admin/branches": "/distributor/operativo/branches",
    "/admin/inventory-entries": "/distributor/operativo/inventory-entries",
    "/admin/transfer-history": "/distributor/operativo/transfer-history",
    "/admin/sales": "/distributor/operativo/sales",
    "/admin/analytics": "/distributor/operativo/analytics",
    "/admin/expenses": "/distributor/operativo/expenses",
    "/admin/team": "/distributor/operativo/team",
  };

  const distributorAdminPrefixRedirects: Array<{
    prefix: string;
    target: string;
  }> = [
    { prefix: "/admin/products", target: "/distributor/products" },
    { prefix: "/admin/add-product", target: "/distributor/products" },
    { prefix: "/admin/distributors", target: "/distributor/operativo/team" },
    { prefix: "/admin/credits", target: "/distributor/credits" },
    { prefix: "/admin/register-sale", target: "/distributor/register-sale" },
    {
      prefix: "/admin/register-promotion",
      target: "/distributor/register-promotion",
    },
  ];

  if (effectiveRole === "distribuidor") {
    const distributorOperativoTarget =
      operativoAdminToDistributorMap[location.pathname];

    if (distributorOperativoTarget) {
      return <Navigate to={distributorOperativoTarget} replace />;
    }

    const prefixMatch = distributorAdminPrefixRedirects.find(({ prefix }) =>
      location.pathname.startsWith(prefix)
    );

    if (prefixMatch) {
      return <Navigate to={prefixMatch.target} replace />;
    }
  }

  if (loading && token && user) {
    return children;
  }

  if (loading && (!token || !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-gray-200">
          Validando sesión...
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

  if (user.role !== "god" && (user.status !== "active" || isExpired)) {
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
        effectiveRole === "distribuidor"
          ? "/distributor/dashboard"
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
