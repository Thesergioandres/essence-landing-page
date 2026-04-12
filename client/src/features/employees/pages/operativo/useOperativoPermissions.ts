import { useBusiness } from "../../../../context/BusinessContext";

export function useOperativoPermissions() {
  const { businessId, memberships } = useBusiness();

  const activeMemberships = memberships.filter(
    membership => membership.status === "active"
  );

  const currentMembership =
    activeMemberships.find(
      membership => membership.business?._id === businessId
    ) ?? (activeMemberships.length === 1 ? activeMemberships[0] : null);

  const hasPermission = (module: string, action: string) =>
    currentMembership?.permissions?.[module]?.[action] === true;

  return {
    hasPermission,
    canManageStock:
      hasPermission("inventory", "update") ||
      hasPermission("inventory", "create"),
    canViewInventory: hasPermission("inventory", "read"),
    canViewTransferHistory: hasPermission("transfers", "read"),
    canManageSales: hasPermission("sales", "update"),
    canViewAnalytics: hasPermission("analytics", "read"),
    canViewExpenses: hasPermission("expenses", "read"),
    canManageTeam: hasPermission("config", "update"),
    canViewPromotions: hasPermission("promotions", "read"),
    canViewProviders: hasPermission("inventory", "read"),
    canViewCustomers: hasPermission("clients", "read"),
  };
}
