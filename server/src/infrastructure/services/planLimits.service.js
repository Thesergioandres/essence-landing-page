import Branch from "../database/models/Branch.js";
import Business from "../database/models/Business.js";
import GlobalSettings from "../database/models/GlobalSettings.js";
import Membership from "../database/models/Membership.js";

const VALID_PLANS = ["starter", "pro", "enterprise"];

const defaultPlans = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Para negocios en etapa inicial",
    monthlyPrice: 19,
    yearlyPrice: 190,
    currency: "USD",
    limits: { branches: 1, distributors: 2 },
    features: { businessAssistant: false },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Para equipos que escalan ventas",
    monthlyPrice: 49,
    yearlyPrice: 490,
    currency: "USD",
    limits: { branches: 3, distributors: 10 },
    features: { businessAssistant: false },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Para operaciones multi-sede avanzadas",
    monthlyPrice: 99,
    yearlyPrice: 990,
    currency: "USD",
    limits: { branches: 10, distributors: 50 },
    features: { businessAssistant: true },
  },
};

const toPlainPlan = (plan) => {
  if (!plan) return {};
  return typeof plan.toObject === "function" ? plan.toObject() : plan;
};

const mergePlanWithDefaults = (planKey, plan) => {
  const defaults = defaultPlans[planKey];
  const plainPlan = toPlainPlan(plan);

  return {
    ...defaults,
    ...plainPlan,
    limits: {
      ...defaults.limits,
      ...(plainPlan?.limits || {}),
    },
    features: {
      ...defaults.features,
      ...(plainPlan?.features || {}),
    },
  };
};

const normalizePositiveInteger = (value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const normalized = Math.max(1, Math.floor(numeric));
  return normalized;
};

const normalizePlan = (plan) => {
  if (!plan || typeof plan !== "string") return "starter";
  return VALID_PLANS.includes(plan) ? plan : "starter";
};

export const ensureGlobalSettings = async () => {
  let settings = await GlobalSettings.findOne({ key: "global" });
  if (!settings) {
    settings = await GlobalSettings.create({ key: "global" });
  }
  return settings;
};

export const resolveBusinessLimits = async (businessDocOrId) => {
  const settings = await ensureGlobalSettings();

  const business =
    typeof businessDocOrId === "string"
      ? await Business.findById(businessDocOrId)
      : businessDocOrId;

  if (!business) {
    return {
      plan: settings.defaultPlan || "starter",
      limits: { ...defaultPlans.starter.limits },
      source: "default",
      planConfig: defaultPlans.starter,
      settings,
    };
  }

  const selectedPlan = normalizePlan(business.plan || settings.defaultPlan);
  const planConfig = mergePlanWithDefaults(
    selectedPlan,
    settings.plans?.[selectedPlan],
  );
  const planLimits = planConfig?.limits || defaultPlans[selectedPlan].limits;

  const customBranches = normalizePositiveInteger(
    business.customLimits?.branches,
  );
  const customDistributors = normalizePositiveInteger(
    business.customLimits?.distributors,
  );

  const limits = {
    branches: customBranches ?? planLimits.branches,
    distributors: customDistributors ?? planLimits.distributors,
  };

  return {
    plan: selectedPlan,
    limits,
    source:
      customBranches !== undefined || customDistributors !== undefined
        ? "custom"
        : "plan",
    planConfig,
    settings,
  };
};

export const getBusinessUsage = async (businessId) => {
  const [branches, distributors] = await Promise.all([
    Branch.countDocuments({ business: businessId, isWarehouse: { $ne: true } }),
    Membership.countDocuments({
      business: businessId,
      role: "employee",
      status: "active",
    }),
  ]);

  return { branches, distributors };
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
      distributors: Math.max(
        0,
        (limits.distributors || 0) - usage.distributors,
      ),
    },
    planConfig,
  };
};

export const listPublicPlans = async () => {
  try {
    const settings = await ensureGlobalSettings();
    return {
      maintenanceMode: Boolean(settings.maintenanceMode),
      defaultPlan: settings.defaultPlan || "starter",
      plans: {
        starter: mergePlanWithDefaults("starter", settings.plans?.starter),
        pro: mergePlanWithDefaults("pro", settings.plans?.pro),
        enterprise: mergePlanWithDefaults(
          "enterprise",
          settings.plans?.enterprise,
        ),
      },
    };
  } catch (error) {
    console.error("[planLimits] Fallback listPublicPlans:", error?.message);
    return {
      maintenanceMode: false,
      defaultPlan: "starter",
      plans: {
        starter: { ...defaultPlans.starter },
        pro: { ...defaultPlans.pro },
        enterprise: { ...defaultPlans.enterprise },
      },
    };
  }
};

export const VALID_BUSINESS_PLANS = VALID_PLANS;
