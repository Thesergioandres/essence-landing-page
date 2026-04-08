import { useMemo } from "react";
import { useBusiness } from "../../../context/BusinessContext";
import { authService } from "../services";
import type { Membership, User } from "../types/auth.types";

type LooseModulePermissions = Record<string, unknown>;
type LoosePermissions = Record<string, LooseModulePermissions>;

const resolveMembershipForBusiness = (
  memberships: Membership[],
  businessId: string | null
) => {
  if (!Array.isArray(memberships) || memberships.length === 0) {
    return null;
  }

  return (
    memberships.find(
      membership =>
        membership.status === "active" &&
        membership.business?._id === businessId
    ) || (memberships.length === 1 ? memberships[0] : null)
  );
};

const hasFinancialPrivacyFlag = (
  user: (User & { [key: string]: unknown }) | null,
  membership: (Membership & { [key: string]: unknown }) | null
) => {
  const permissions = ((membership?.permissions as
    | LoosePermissions
    | undefined) || {}) as Record<string, unknown>;

  const financialPermissions =
    (permissions.financial as Record<string, unknown> | undefined) || {};
  const analyticsPermissions =
    (permissions.analytics as Record<string, unknown> | undefined) || {};
  const salesPermissions =
    (permissions.sales as Record<string, unknown> | undefined) || {};

  return Boolean(
    user?.HIDE_FINANCIAL_DATA === true ||
    user?.hideFinancialData === true ||
    user?.hideFinancials === true ||
    membership?.HIDE_FINANCIAL_DATA === true ||
    membership?.hideFinancialData === true ||
    permissions.HIDE_FINANCIAL_DATA === true ||
    financialPermissions.HIDE_FINANCIAL_DATA === true ||
    financialPermissions.hideFinancialData === true ||
    analyticsPermissions.hideFinancialData === true ||
    salesPermissions.hideFinancialData === true
  );
};

const resolveCanViewCosts = (
  user: (User & { [key: string]: unknown }) | null,
  membership: (Membership & { [key: string]: unknown }) | null,
  effectiveRole: string
) => {
  const role = String(effectiveRole || "user");

  if (role === "god" || role === "super_admin") {
    return true;
  }

  const membershipPermissions = ((membership?.permissions as
    | LoosePermissions
    | undefined) || {}) as Record<string, unknown>;
  const membershipFinancial =
    (membershipPermissions.financial as Record<string, unknown> | undefined) ||
    {};

  if (typeof membershipFinancial.view_costs === "boolean") {
    return membershipFinancial.view_costs;
  }
  if (typeof membershipFinancial.viewCosts === "boolean") {
    return membershipFinancial.viewCosts;
  }

  const userPermissions = ((user?.modularPermissions as
    | LoosePermissions
    | undefined) || {}) as Record<string, unknown>;
  const userFinancial =
    (userPermissions.financial as Record<string, unknown> | undefined) || {};

  if (typeof userFinancial.view_costs === "boolean") {
    return userFinancial.view_costs;
  }
  if (typeof userFinancial.viewCosts === "boolean") {
    return userFinancial.viewCosts;
  }

  return role === "admin";
};

export function useFinancialPrivacy() {
  const { businessId, memberships } = useBusiness();

  return useMemo(() => {
    const user =
      (authService.getCurrentUser() as
        | (User & { [key: string]: unknown })
        | null) || null;

    const membership = resolveMembershipForBusiness(
      memberships || [],
      businessId
    ) as (Membership & { [key: string]: unknown }) | null;

    const effectiveRole = membership?.role || user?.role || "user";
    const isDistributorRole = effectiveRole === "distribuidor";
    const currentUserId = String(user?._id || user?.id || "");

    const canViewCosts = resolveCanViewCosts(user, membership, effectiveRole);

    const hideFinancialData =
      hasFinancialPrivacyFlag(user, membership) ||
      isDistributorRole ||
      !canViewCosts;

    return {
      user,
      membership,
      currentUserId,
      scopeDistributorId:
        isDistributorRole && currentUserId ? currentUserId : "",
      effectiveRole,
      isDistributorRole,
      canViewCosts,
      hideFinancialData,
    };
  }, [businessId, memberships]);
}
