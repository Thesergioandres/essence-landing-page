import Branch from "../database/models/Branch.js";
import Business from "../database/models/Business.js";
import GlobalSettings from "../database/models/GlobalSettings.js";
import Membership from "../database/models/Membership.js";

const LEGACY_DEFAULT_PLAN_KEYS = ["starter", "pro", "enterprise"];
const DEFAULT_PLAN_ID = "starter";
const PLAN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/;

const PLAN_STATUS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
};

const defaultPlans = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Para negocios en etapa inicial",
    monthlyPrice: 19,
    yearlyPrice: 190,
    currency: "USD",
    limits: { branches: 1, employees: 2, products: 50, dailySales: 50, weeklySales: 350 },
    features: { businessAssistant: false },
    featuresList: ["Panel base", "Inventario inicial", "Ventas esenciales"],
    status: PLAN_STATUS.ACTIVE,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Para equipos que escalan ventas",
    monthlyPrice: 49,
    yearlyPrice: 490,
    currency: "USD",
    limits: { branches: 3, employees: 10, products: 500, dailySales: 500, weeklySales: 3500 },
    features: { businessAssistant: false },
    featuresList: ["Multi-sede", "Gestión de equipo", "Reportes avanzados"],
    status: PLAN_STATUS.ACTIVE,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Para operaciones multi-sede avanzadas",
    monthlyPrice: 99,
    yearlyPrice: 990,
    currency: "USD",
    limits: { branches: 10, employees: 50, products: 5000, dailySales: 5000, weeklySales: 35000 },
    features: { businessAssistant: true },
    featuresList: [
      "Business Assistant",
      "Operación avanzada",
      "Automatización premium",
    ],
    status: PLAN_STATUS.ACTIVE,
  },
};

const titleizePlanId = (planId) =>
  String(planId || "plan")
    .split(/[_-]/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ") || "Plan";

const buildDynamicDefaultPlan = (planId) => ({
  id: planId,
  name: titleizePlanId(planId),
  description: "Plan personalizado",
  monthlyPrice: 0,
  yearlyPrice: 0,
  currency: "USD",
  limits: { branches: 1, employees: 1, products: 10, dailySales: 10, weeklySales: 70 },
  features: { businessAssistant: false },
  featuresList: [],
  status: PLAN_STATUS.ACTIVE,
});

const normalizePlanId = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized || !PLAN_ID_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
};

const normalizePlanStatus = (status) =>
  status === PLAN_STATUS.ARCHIVED ? PLAN_STATUS.ARCHIVED : PLAN_STATUS.ACTIVE;

const normalizePrice = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.max(0, Number(fallback) || 0);
  }
  return Math.max(0, numeric);
};

const normalizePositiveLimit = (value, fallback = 1) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.max(1, Number(fallback) || 1);
  }
  if (numeric === -1) return -1;
  return Math.max(1, Math.floor(numeric));
};

const normalizeCurrency = (currency, fallback = "USD") => {
  const normalized = String(currency || fallback)
    .trim()
    .toUpperCase()
    .slice(0, 10);
  return normalized || "USD";
};

const normalizeFeatureList = (featuresList) => {
  if (!Array.isArray(featuresList)) return [];

  return [
    ...new Set(
      featuresList
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  ];
};

const toPlainPlan = (plan) => {
  if (!plan) return {};
  return typeof plan.toObject === "function" ? plan.toObject() : plan;
};

const getPlanEntries = (plansSource) => {
  const source = toPlainPlan(plansSource);

  if (!source) {
    return [];
  }

  if (source instanceof Map) {
    return Array.from(source.entries());
  }

  if (typeof source === "object") {
    return Object.entries(source);
  }

  return [];
};

const mergePlanWithDefaults = (planKey, plan) => {
  const defaults = defaultPlans[planKey] || buildDynamicDefaultPlan(planKey);
  const plainPlan = toPlainPlan(plan);

  return {
    ...defaults,
    ...plainPlan,
    id: planKey,
    name: String(plainPlan?.name || defaults.name || titleizePlanId(planKey)),
    description: String(plainPlan?.description || defaults.description || ""),
    monthlyPrice: normalizePrice(
      plainPlan?.monthlyPrice,
      defaults.monthlyPrice,
    ),
    yearlyPrice: normalizePrice(plainPlan?.yearlyPrice, defaults.yearlyPrice),
    currency: normalizeCurrency(plainPlan?.currency, defaults.currency),
    status: normalizePlanStatus(plainPlan?.status || defaults.status),
    featuresList: normalizeFeatureList(
      plainPlan?.featuresList || defaults.featuresList,
    ),
    limits: {
      ...defaults.limits,
      ...(plainPlan?.limits || {}),
      branches: normalizePositiveLimit(
        plainPlan?.limits?.branches,
        defaults.limits?.branches,
      ),
      employees: normalizePositiveLimit(
        plainPlan?.limits?.employees,
        defaults.limits?.employees,
      ),
      products: normalizePositiveLimit(
        plainPlan?.limits?.products,
        defaults.limits?.products,
      ),
      dailySales: normalizePositiveLimit(
        plainPlan?.limits?.dailySales,
        defaults.limits?.dailySales,
      ),
      weeklySales: normalizePositiveLimit(
        plainPlan?.limits?.weeklySales,
        defaults.limits?.weeklySales,
      ),
    },
    features: {
      ...defaults.features,
      ...(plainPlan?.features || {}),
      businessAssistant:
        plainPlan?.features?.businessAssistant === undefined
          ? defaults.features.businessAssistant
          : Boolean(plainPlan.features.businessAssistant),
    },
  };
};

const buildPlanCatalogFromSettings = (settings) => {
  const planEntryMap = new Map();

  for (const [rawPlanKey, planInput] of getPlanEntries(settings?.plans)) {
    const normalizedKey = normalizePlanId(rawPlanKey || planInput?.id);
    if (!normalizedKey) continue;
    planEntryMap.set(normalizedKey, planInput);
  }

  const catalog = {};

  for (const defaultPlanKey of LEGACY_DEFAULT_PLAN_KEYS) {
    const planInput = planEntryMap.get(defaultPlanKey);
    catalog[defaultPlanKey] = mergePlanWithDefaults(defaultPlanKey, planInput);
    planEntryMap.delete(defaultPlanKey);
  }

  for (const [planKey, planInput] of planEntryMap.entries()) {
    catalog[planKey] = mergePlanWithDefaults(planKey, planInput);
  }

  if (Object.keys(catalog).length === 0) {
    for (const defaultPlanKey of LEGACY_DEFAULT_PLAN_KEYS) {
      catalog[defaultPlanKey] = mergePlanWithDefaults(defaultPlanKey, null);
    }
  }

  return catalog;
};

const getActivePlanIds = (planCatalog) =>
  Object.values(planCatalog)
    .filter((plan) => plan.status !== PLAN_STATUS.ARCHIVED)
    .map((plan) => plan.id);

const resolveDefaultPlanId = (settings, planCatalog) => {
  const activePlanIds = getActivePlanIds(planCatalog);
  const configuredDefault = normalizePlanId(settings?.defaultPlan);

  if (configuredDefault && activePlanIds.includes(configuredDefault)) {
    return configuredDefault;
  }

  if (activePlanIds.includes(DEFAULT_PLAN_ID)) {
    return DEFAULT_PLAN_ID;
  }

  if (activePlanIds.length > 0) {
    return activePlanIds[0];
  }

  if (planCatalog[DEFAULT_PLAN_ID]) {
    return DEFAULT_PLAN_ID;
  }

  const firstPlanId = Object.keys(planCatalog)[0];
  return firstPlanId || DEFAULT_PLAN_ID;
};

const normalizePositiveInteger = (value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const normalized = Math.max(1, Math.floor(numeric));
  return normalized;
};

const normalizePlan = (plan, planCatalog, fallbackPlanId) => {
  const normalizedPlanId = normalizePlanId(plan);
  if (normalizedPlanId && planCatalog[normalizedPlanId]) {
    return normalizedPlanId;
  }
  return fallbackPlanId;
};

export const ensureGlobalSettings = async () => {
  let settings = await GlobalSettings.findOne({ key: "global" });
  if (!settings) {
    settings = await GlobalSettings.create({ key: "global" });
  }
  return settings;
};

export const resolvePlanCatalogFromSettings = (settings) =>
  buildPlanCatalogFromSettings(settings);

export const getAssignableBusinessPlanIdsFromSettings = (settings) => {
  const catalog = buildPlanCatalogFromSettings(settings);
  return getActivePlanIds(catalog);
};

export const getAssignableBusinessPlanIds = async () => {
  const settings = await ensureGlobalSettings();
  return getAssignableBusinessPlanIdsFromSettings(settings);
};

export const isBusinessPlanAssignable = async (planId) => {
  const normalizedPlanId = normalizePlanId(planId);
  if (!normalizedPlanId) {
    return false;
  }

  const assignablePlans = await getAssignableBusinessPlanIds();
  return assignablePlans.includes(normalizedPlanId);
};

export const resolvePlanForAssignment = async (planId) => {
  const settings = await ensureGlobalSettings();
  const planCatalog = buildPlanCatalogFromSettings(settings);
  const defaultPlanId = resolveDefaultPlanId(settings, planCatalog);
  const normalizedPlanId = normalizePlanId(planId);

  if (
    normalizedPlanId &&
    planCatalog[normalizedPlanId] &&
    planCatalog[normalizedPlanId].status !== PLAN_STATUS.ARCHIVED
  ) {
    return normalizedPlanId;
  }

  return defaultPlanId;
};

export const sanitizePlanIdentifier = normalizePlanId;
export const PLAN_IDENTIFIER_PATTERN = PLAN_ID_PATTERN;

export const resolveBusinessLimits = async (businessDocOrId) => {
  const settings = await ensureGlobalSettings();
  const planCatalog = buildPlanCatalogFromSettings(settings);
  const defaultPlanId = resolveDefaultPlanId(settings, planCatalog);

  const business =
    typeof businessDocOrId === "string"
      ? await Business.findById(businessDocOrId)
      : businessDocOrId;

  if (!business) {
    const fallbackPlan = planCatalog[defaultPlanId] || defaultPlans.starter;

    return {
      plan: fallbackPlan.id,
      limits: { ...fallbackPlan.limits },
      source: "default",
      planConfig: fallbackPlan,
      settings,
    };
  }

  const selectedPlan = normalizePlan(
    business.plan || settings.defaultPlan,
    planCatalog,
    defaultPlanId,
  );
  const planConfig =
    planCatalog[selectedPlan] ||
    planCatalog[defaultPlanId] ||
    defaultPlans[DEFAULT_PLAN_ID];
  const planLimits = planConfig?.limits || defaultPlans[DEFAULT_PLAN_ID].limits;

  const customBranches = normalizePositiveInteger(
    business.customLimits?.branches,
  );
  const customEmployees = normalizePositiveInteger(
    business.customLimits?.employees,
  );

  const limits = {
    branches: customBranches ?? planLimits.branches,
    employees: customEmployees ?? planLimits.employees,
  };

  return {
    plan: selectedPlan,
    limits,
    source:
      customBranches !== undefined || customEmployees !== undefined
        ? "custom"
        : "plan",
    planConfig,
    settings,
  };
};

export const getBusinessUsage = async (businessId) => {
  const [branches, employees] = await Promise.all([
    Branch.countDocuments({ business: businessId, isWarehouse: { $ne: true } }),
    Membership.countDocuments({
      business: businessId,
      role: "employee",
      status: "active",
    }),
  ]);

  return { branches, employees };
};

export const buildBusinessLimitPayload = async (businessDocOrId) => {
  const business =
    typeof businessDocOrId === "string"
      ? await Business.findById(businessDocOrId)
      : businessDocOrId;

  if (!business) {
    return null;
  }

  const [{ limits, plan, source, planConfig }, usage] = await Promise.all([
    resolveBusinessLimits(business),
    getBusinessUsage(business._id),
  ]);

  return {
    plan,
    source,
    limits,
    usage,
    remaining: {
      branches: Math.max(0, (limits.branches || 0) - usage.branches),
      employees: Math.max(0, (limits.employees || 0) - usage.employees),
    },
    planConfig,
  };
};

export const listPublicPlans = async () => {
  try {
    const settings = await ensureGlobalSettings();
    const planCatalog = buildPlanCatalogFromSettings(settings);
    const defaultPlanId = resolveDefaultPlanId(settings, planCatalog);

    return {
      maintenanceMode: Boolean(settings.maintenanceMode),
      defaultPlan: defaultPlanId,
      plans: planCatalog,
    };
  } catch (error) {
    console.error("[planLimits] Fallback listPublicPlans:", error?.message);
    const fallbackCatalog = buildPlanCatalogFromSettings({
      plans: defaultPlans,
    });
    return {
      maintenanceMode: false,
      defaultPlan: DEFAULT_PLAN_ID,
      plans: fallbackCatalog,
    };
  }
};

export const VALID_BUSINESS_PLANS = LEGACY_DEFAULT_PLAN_KEYS;
