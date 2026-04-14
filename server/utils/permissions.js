// Matriz de permisos por rol y helper para calcular permisos efectivos
const ALL_ACTIONS = { read: true, create: true, update: true, delete: true };

const ACTION_ALIASES = {
  view: "read",
  edit: "update",
  viewCosts: "view_costs",
};

const normalizeActionKey = (action) => {
  const rawAction = String(action || "").trim();
  if (!rawAction) return "";
  return ACTION_ALIASES[rawAction] || rawAction;
};

const normalizeModulePermissions = (modulePermissions = {}) => {
  if (!modulePermissions || typeof modulePermissions !== "object") {
    return {};
  }

  const normalized = {};
  for (const [actionKey, value] of Object.entries(modulePermissions)) {
    const normalizedAction = normalizeActionKey(actionKey);
    if (!normalizedAction) continue;
    normalized[normalizedAction] = value === true;
  }

  return normalized;
};

export const ROLE_DEFAULT_PERMISSIONS = {
  admin: {
    products: ALL_ACTIONS,
    inventory: ALL_ACTIONS,
    defectiveProducts: ALL_ACTIONS,
    sales: ALL_ACTIONS,
    promotions: ALL_ACTIONS,
    employees: ALL_ACTIONS,
    providers: ALL_ACTIONS,
    clients: ALL_ACTIONS,
    expenses: ALL_ACTIONS,
    analytics: { read: true, create: true, update: true, delete: true },
    config: ALL_ACTIONS,
    transfers: ALL_ACTIONS,
    credits: ALL_ACTIONS,
    financial: { view_costs: true },
  },
  employee: {
    products: { read: true },
    inventory: { read: true, update: true },
    defectiveProducts: {
      read: true,
      create: true,
      update: false,
      delete: false,
    },
    sales: { read: true, create: true },
    promotions: { read: true },
    employees: { read: true },
    providers: { read: false },
    clients: { read: true, create: false, update: false, delete: false },
    expenses: { read: false },
    analytics: { read: true },
    config: { read: false },
    transfers: { read: true, create: true },
    credits: { read: true, create: true, update: true, delete: false },
    financial: { view_costs: false },
  },
  viewer: {
    products: { read: true },
    inventory: { read: true },
    defectiveProducts: { read: true },
    sales: { read: true },
    promotions: { read: true },
    employees: { read: false },
    providers: { read: true },
    clients: { read: true },
    expenses: { read: true },
    analytics: { read: true },
    config: { read: false },
    transfers: { read: false },
    financial: { view_costs: false },
  },
};

const mergeModulePermissions = (base = {}, override = {}) => {
  const result = {};

  for (const [module, permissions] of Object.entries(base || {})) {
    result[module] = normalizeModulePermissions(permissions);
  }

  for (const [module, perms] of Object.entries(override || {})) {
    result[module] = {
      ...(result[module] || {}),
      ...normalizeModulePermissions(perms),
    };
  }

  return result;
};

export const buildEffectivePermissions = (membership) => {
  if (!membership) return {};
  const base = ROLE_DEFAULT_PERMISSIONS[membership.role] || {};
  const override = membership.permissions || {};
  return mergeModulePermissions(base, override);
};

export const isActionAllowed = (effectivePermissions, module, action) => {
  if (!module || !action) return false;
  const modulePerms = normalizeModulePermissions(
    effectivePermissions?.[module] || {},
  );
  if (!modulePerms) return false;
  const normalizedAction = normalizeActionKey(action);
  const value = modulePerms[normalizedAction];
  return value === true;
};
