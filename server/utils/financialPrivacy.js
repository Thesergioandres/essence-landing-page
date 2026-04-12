import { isEmployeeRole } from "../src/utils/roleAliases.js";

const toRecord = (value) => (value && typeof value === "object" ? value : {});

export const SENSITIVE_COST_FIELD_NAMES = Object.freeze([
  "purchasePrice",
  "averageCost",
  "averageCostAtSale",
  "supplierId",
  "supplierPrice",
  "totalInventoryValue",
  "profit",
  "totalProfit",
  "totalGroupProfit",
  "netProfit",
  "unitCost",
  "cost",
  "totalCost",
  "investment",
]);

export const SENSITIVE_FINANCIAL_ZERO_FIELD_NAMES = Object.freeze([
  "totalRevenue",
  "adminProfit",
  "grossProfit",
  "realizedProfit",
  "pendingProfit",
]);

const SENSITIVE_COST_FIELD_SET = new Set(SENSITIVE_COST_FIELD_NAMES);
const SENSITIVE_FINANCIAL_ZERO_FIELD_SET = new Set(
  SENSITIVE_FINANCIAL_ZERO_FIELD_NAMES,
);

const hasHideFinancialFlag = (user, membership) => {
  const safeUser = toRecord(user);
  const safeMembership = toRecord(membership);
  const permissions = toRecord(safeMembership.permissions);
  const financialPermissions = toRecord(permissions.financial);
  const analyticsPermissions = toRecord(permissions.analytics);
  const salesPermissions = toRecord(permissions.sales);

  return Boolean(
    safeUser.HIDE_FINANCIAL_DATA === true ||
    safeUser.hideFinancialData === true ||
    safeMembership.HIDE_FINANCIAL_DATA === true ||
    safeMembership.hideFinancialData === true ||
    permissions.HIDE_FINANCIAL_DATA === true ||
    financialPermissions.HIDE_FINANCIAL_DATA === true ||
    financialPermissions.hideFinancialData === true ||
    analyticsPermissions.hideFinancialData === true ||
    salesPermissions.hideFinancialData === true,
  );
};

const isEmployeeRole = (role) => isEmployeeRole(role);

const readExplicitFinancialViewPermission = ({ user, membership } = {}) => {
  const membershipPermissions = toRecord(membership?.permissions);
  const userPermissions = toRecord(
    user?.modularPermissions || user?.permissions,
  );

  const candidates = [
    membershipPermissions?.financial?.view_costs,
    membershipPermissions?.financial?.viewCosts,
    membershipPermissions?.financial?.canViewCosts,
    membershipPermissions?.view_costs,
    userPermissions?.financial?.view_costs,
    userPermissions?.financial?.viewCosts,
    userPermissions?.financial?.canViewCosts,
    userPermissions?.view_costs,
    user?.canViewCosts,
    user?.CAN_VIEW_COSTS,
  ];

  const explicitValue = candidates.find((value) => typeof value === "boolean");
  return typeof explicitValue === "boolean" ? explicitValue : null;
};

export const canViewCostsByPermission = ({ user, membership } = {}) => {
  const safeUser = toRecord(user);
  const safeMembership = toRecord(membership);
  const effectiveRole = safeMembership.role || safeUser.role || "user";

  // GOD is the only role with default access.
  if (effectiveRole === "god") {
    return true;
  }

  const explicitPermission = readExplicitFinancialViewPermission({
    user: safeUser,
    membership: safeMembership,
  });

  if (typeof explicitPermission === "boolean") {
    return explicitPermission;
  }

  return false;
};

export const canCurrentRequestViewCosts = (req = {}) => {
  const user = toRecord(req.user);
  const membership = toRecord(req.membership);
  return canViewCostsByPermission({ user, membership });
};

export const resolveFinancialPrivacyContext = (req = {}) => {
  const user = toRecord(req.user);
  const membership = toRecord(req.membership);
  const effectiveRole = membership.role || user.role || "user";
  const currentUserId = String(user.id || user.userId || user._id || "");
  const canViewCosts = canViewCostsByPermission({ user, membership });

  const hideByPermission = canViewCosts !== true;
  const hideByRole = isEmployeeRole(effectiveRole);
  const hideByFlag = hasHideFinancialFlag(user, membership);

  const hideFinancialData = hideByFlag || hideByRole || hideByPermission;

  const scopeEmployeeId = hideByRole && currentUserId ? currentUserId : null;

  return {
    hideFinancialData,
    canViewCosts,
    effectiveRole,
    isEmployeeRole: hideByRole,
    currentUserId,
    scopeEmployeeId,
  };
};

export const sanitizeSaleForFinancialPrivacy = (sale = {}) => {
  const safeSale = { ...sale };

  const nullifyTopLevelFields = [
    "purchasePrice",
    "averageCost",
    "averageCostAtSale",
    "totalProfit",
    "totalGroupProfit",
    "netProfit",
    "profit",
    "supplierId",
  ];

  const zeroTopLevelFields = [
    "adminProfit",
    "totalRevenue",
    "grossProfit",
    "realizedProfit",
    "pendingProfit",
  ];

  for (const fieldName of nullifyTopLevelFields) {
    if (Object.prototype.hasOwnProperty.call(safeSale, fieldName)) {
      safeSale[fieldName] = null;
    }
  }

  for (const fieldName of zeroTopLevelFields) {
    if (Object.prototype.hasOwnProperty.call(safeSale, fieldName)) {
      safeSale[fieldName] = 0;
    }
  }

  if (safeSale.product && typeof safeSale.product === "object") {
    safeSale.product = { ...safeSale.product };

    const nullifyProductFields = [
      "purchasePrice",
      "averageCost",
      "supplierId",
      "profit",
    ];

    for (const fieldName of nullifyProductFields) {
      if (Object.prototype.hasOwnProperty.call(safeSale.product, fieldName)) {
        safeSale.product[fieldName] = null;
      }
    }
  }

  return safeSale;
};

export const sanitizeSalesStatsForFinancialPrivacy = (stats = {}) => ({
  totalSales: Number(stats.totalSales || 0),
  confirmedSales: Number(stats.confirmedSales || 0),
  pendingSales: Number(stats.pendingSales || 0),
  totalEmployeeProfit: Number(stats.totalEmployeeProfit || 0),
  myProfit: Number(stats.totalEmployeeProfit || 0),
});

export const sanitizeFinancialCostFieldsToNull = (
  payload,
  seen = new WeakSet(),
) => {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeFinancialCostFieldsToNull(item, seen));
  }

  if (typeof payload !== "object") {
    return payload;
  }

  if (Object.prototype.toString.call(payload) !== "[object Object]") {
    return payload;
  }

  if (seen.has(payload)) {
    return payload;
  }
  seen.add(payload);

  const sanitized = {};

  for (const [fieldName, value] of Object.entries(payload)) {
    if (SENSITIVE_COST_FIELD_SET.has(fieldName)) {
      sanitized[fieldName] = null;
      continue;
    }

    if (SENSITIVE_FINANCIAL_ZERO_FIELD_SET.has(fieldName)) {
      sanitized[fieldName] = 0;
      continue;
    }

    sanitized[fieldName] = sanitizeFinancialCostFieldsToNull(value, seen);
  }

  return sanitized;
};
