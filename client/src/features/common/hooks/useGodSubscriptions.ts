import { useCallback, useMemo, useState } from "react";
import type { PlanLimits } from "../../business/types/business.types";
import {
  globalSettingsService,
  type BusinessSubscriptionRow,
  type PublicPlan,
} from "../services";

// LOCKED_PLAN_IDS removed to allow full control

export type AccountStatus =
  | "active"
  | "pending"
  | "expired"
  | "suspended"
  | "paused";

export interface EditablePlanConfig extends PublicPlan {
  status: "active" | "archived";
  featuresList: string[];
}

export interface SubscriptionsSummary {
  total: number;
  byPlan: Record<string, number>;
  byStatus: Record<AccountStatus, number>;
}

const normalizePlanId = (value: unknown): string | null => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized || !/^[a-z0-9][a-z0-9_-]{1,31}$/.test(normalized)) {
    return null;
  }

  return normalized;
};

const normalizePrice = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.max(0, Number(fallback) || 0);
  }
  return Math.max(0, numeric);
};

const normalizePositiveLimit = (value: unknown, fallback = 1): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.max(1, Number(fallback) || 1);
  }
  return Math.max(1, Math.floor(numeric));
};

const normalizeCurrency = (value: unknown, fallback = "USD") => {
  const normalized = String(value || fallback)
    .trim()
    .toUpperCase()
    .slice(0, 10);

  return normalized || "USD";
};

const normalizeFeatureList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map(item => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 20)
  )];
};

const createPlanFallback = (planId: string): EditablePlanConfig => ({
  id: planId,
  name: planId
    .split(/[_-]/g)
    .filter(Boolean)
    .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ") || "Plan",
  description: "Plan personalizado",
  monthlyPrice: 0,
  yearlyPrice: 0,
  currency: "USD",
  status: "active",
  limits: {
    branches: 1,
    employees: 1,
  },
  features: {
    businessAssistant: false,
  },
  featuresList: [],
});

const normalizePlanConfig = (
  planId: string,
  value: Partial<EditablePlanConfig> | null | undefined,
): EditablePlanConfig => {
  const fallback = createPlanFallback(planId);
  const limits: Partial<PlanLimits> = value?.limits || {};

  return {
    ...fallback,
    ...value,
    id: planId,
    name: String(value?.name || fallback.name),
    description: String(value?.description || fallback.description || ""),
    monthlyPrice: normalizePrice(value?.monthlyPrice, fallback.monthlyPrice),
    yearlyPrice: normalizePrice(value?.yearlyPrice, fallback.yearlyPrice),
    currency: normalizeCurrency(value?.currency, fallback.currency),
    status: value?.status === "archived" ? "archived" : "active",
    limits: {
      branches: normalizePositiveLimit(limits.branches, fallback.limits.branches),
      employees: normalizePositiveLimit(
        limits.employees,
        fallback.limits.employees,
      ),
    },
    features: {
      businessAssistant:
        value?.features?.businessAssistant === true ||
        fallback.features.businessAssistant,
    },
    featuresList: normalizeFeatureList(value?.featuresList),
  };
};

const normalizePlanRecord = (
  plans: Record<string, PublicPlan> | undefined,
): Record<string, EditablePlanConfig> => {
  const entries = Object.entries(plans || {});
  const normalized = entries.reduce<Record<string, EditablePlanConfig>>(
    (acc, [rawPlanId, planValue]) => {
      const planId = normalizePlanId(rawPlanId || planValue?.id);
      if (!planId) return acc;

      acc[planId] = normalizePlanConfig(planId, planValue as EditablePlanConfig);
      return acc;
    },
    {},
  );

  if (Object.keys(normalized).length === 0) {
    normalized.starter = normalizePlanConfig("starter", {
      id: "starter",
      name: "Starter",
      description: "Plan base",
      monthlyPrice: 19,
      yearlyPrice: 190,
      currency: "USD",
      limits: { branches: 1, employees: 2 },
      features: { businessAssistant: false },
      status: "active",
      featuresList: ["Panel base", "Inventario inicial", "Ventas esenciales"],
    });
  }

  return normalized;
};

const resolveDefaultPlanId = (
  plans: Record<string, EditablePlanConfig>,
  requestedDefault: string | undefined,
) => {
  const activePlanIds = Object.values(plans)
    .filter(plan => plan.status !== "archived")
    .map(plan => plan.id);

  const normalizedRequested = normalizePlanId(requestedDefault);
  if (normalizedRequested && activePlanIds.includes(normalizedRequested)) {
    return normalizedRequested;
  }

  if (activePlanIds.includes("starter")) return "starter";
  if (activePlanIds.length > 0) return activePlanIds[0];

  const firstKnown = Object.keys(plans)[0];
  return firstKnown || "starter";
};

const normalizeCustomLimits = (
  customLimits: Partial<PlanLimits> | null | undefined,
): Partial<PlanLimits> | undefined => {
  const branches = Number(customLimits?.branches);
  const employees = Number(customLimits?.employees);

  const normalized: Partial<PlanLimits> = {
    ...(Number.isFinite(branches) && branches > 0
      ? { branches: Math.floor(branches) }
      : {}),
    ...(Number.isFinite(employees) && employees > 0
      ? { employees: Math.floor(employees) }
      : {}),
  };

  return Object.keys(normalized).length ? normalized : undefined;
};

const serializePlanConfigs = (planConfigs: Record<string, EditablePlanConfig>) => {
  const sortedPlanIds = Object.keys(planConfigs).sort();
  const ordered = sortedPlanIds.map(planId => {
    const plan = planConfigs[planId];
    return {
      ...plan,
      limits: {
        branches: plan.limits.branches,
        employees: plan.limits.employees,
      },
      features: {
        businessAssistant: Boolean(plan.features.businessAssistant),
      },
      featuresList: [...plan.featuresList].sort(),
    };
  });

  return JSON.stringify(ordered);
};

const serializeCustomLimits = (
  customLimits: Partial<PlanLimits> | null | undefined,
): string => JSON.stringify(normalizeCustomLimits(customLimits) || {});

export function useGodSubscriptions() {
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionAction, setSubscriptionAction] = useState<string | null>(null);
  const [subscriptionRows, setSubscriptionRows] = useState<BusinessSubscriptionRow[]>([]);
  const [initialSubscriptionRows, setInitialSubscriptionRows] = useState<
    BusinessSubscriptionRow[]
  >([]);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [initialMaintenanceMode, setInitialMaintenanceMode] = useState(false);

  const [defaultPlan, setDefaultPlan] = useState("starter");
  const [initialDefaultPlan, setInitialDefaultPlan] = useState("starter");

  const [planConfigs, setPlanConfigs] = useState<Record<string, EditablePlanConfig>>({
    starter: createPlanFallback("starter"),
  });
  const [initialPlanConfigs, setInitialPlanConfigs] = useState<
    Record<string, EditablePlanConfig>
  >({
    starter: createPlanFallback("starter"),
  });

  const [removedPlanIds, setRemovedPlanIds] = useState<string[]>([]);

  const loadSubscriptions = useCallback(async () => {
    setSubscriptionsLoading(true);

    try {
      const [rows, settings] = await Promise.all([
        globalSettingsService.listBusinessSubscriptions(),
        globalSettingsService.getPublicSettings(),
      ]);

      const normalizedPlans = normalizePlanRecord(settings.plans);
      const normalizedDefault = resolveDefaultPlanId(
        normalizedPlans,
        settings.defaultPlan,
      );

      const normalizedRows = (rows || []).map(row => {
        const normalizedPlanId =
          normalizePlanId(row.plan) ||
          normalizePlanId(settings.defaultPlan) ||
          normalizedDefault;

        if (!normalizedPlans[normalizedPlanId]) {
          normalizedPlans[normalizedPlanId] = normalizePlanConfig(
            normalizedPlanId,
            {
              ...createPlanFallback(normalizedPlanId),
              status: "archived",
            },
          );
        }

        return {
          ...row,
          plan: normalizedPlanId,
          customLimits: normalizeCustomLimits(row.customLimits),
        };
      });

      setSubscriptionRows(normalizedRows);
      setInitialSubscriptionRows(normalizedRows);

      setMaintenanceMode(Boolean(settings.maintenanceMode));
      setInitialMaintenanceMode(Boolean(settings.maintenanceMode));

      setPlanConfigs(normalizedPlans);
      setInitialPlanConfigs(normalizedPlans);

      const recalculatedDefault = resolveDefaultPlanId(
        normalizedPlans,
        normalizedDefault,
      );

      setDefaultPlan(recalculatedDefault);
      setInitialDefaultPlan(recalculatedDefault);

      setRemovedPlanIds([]);
    } finally {
      setSubscriptionsLoading(false);
    }
  }, []);

  const activePlans = useMemo(
    () => Object.values(planConfigs).filter(plan => plan.status !== "archived"),
    [planConfigs],
  );

  const subscriptionSummary = useMemo<SubscriptionsSummary>(() => {
    const byPlan = Object.keys(planConfigs).reduce<Record<string, number>>(
      (acc, planId) => ({ ...acc, [planId]: 0 }),
      {},
    );

    const byStatus: Record<AccountStatus, number> = {
      active: 0,
      pending: 0,
      expired: 0,
      suspended: 0,
      paused: 0,
    };

    subscriptionRows.forEach(row => {
      byPlan[row.plan] = (byPlan[row.plan] || 0) + 1;
      const status = (row.status || "pending") as AccountStatus;
      byStatus[status] = (byStatus[status] || 0) + 1;
    });

    return {
      total: subscriptionRows.length,
      byPlan,
      byStatus,
    };
  }, [planConfigs, subscriptionRows]);

  const isGlobalSettingsDirty = useMemo(() => {
    return (
      maintenanceMode !== initialMaintenanceMode ||
      defaultPlan !== initialDefaultPlan ||
      serializePlanConfigs(planConfigs) !== serializePlanConfigs(initialPlanConfigs) ||
      removedPlanIds.length > 0
    );
  }, [
    defaultPlan,
    initialDefaultPlan,
    initialMaintenanceMode,
    initialPlanConfigs,
    maintenanceMode,
    planConfigs,
    removedPlanIds.length,
  ]);

  const isRowDirty = useCallback(
    (row: BusinessSubscriptionRow) => {
      const original = initialSubscriptionRows.find(item => item._id === row._id);
      if (!original) return true;

      return (
        original.plan !== row.plan ||
        serializeCustomLimits(original.customLimits) !==
          serializeCustomLimits(row.customLimits)
      );
    },
    [initialSubscriptionRows],
  );

  const setRowDraft = useCallback(
    (businessId: string, updater: (current: BusinessSubscriptionRow) => BusinessSubscriptionRow) => {
      setSubscriptionRows(prev =>
        prev.map(row => (row._id === businessId ? updater(row) : row)),
      );
    },
    [],
  );

  const updatePlanConfig = useCallback(
    (
      planId: string,
      updater:
        | Partial<EditablePlanConfig>
        | ((current: EditablePlanConfig) => Partial<EditablePlanConfig>),
    ) => {
      const normalizedPlanId = normalizePlanId(planId);
      if (!normalizedPlanId) return;

      setPlanConfigs(prev => {
        const currentPlan = prev[normalizedPlanId];
        if (!currentPlan) return prev;

        const patch =
          typeof updater === "function" ? updater(currentPlan) : updater;

        const nextPlan = normalizePlanConfig(normalizedPlanId, {
          ...currentPlan,
          ...patch,
          limits: {
            ...currentPlan.limits,
            ...(patch.limits || {}),
          },
          features: {
            ...currentPlan.features,
            ...(patch.features || {}),
          },
        });

        return {
          ...prev,
          [normalizedPlanId]: nextPlan,
        };
      });
    },
    [],
  );

  const createPlan = useCallback(() => {
    let index = Object.keys(planConfigs).length + 1;
    let planId = `custom-${index}`;

    while (planConfigs[planId]) {
      index += 1;
      planId = `custom-${index}`;
    }

    setPlanConfigs(prev => ({
      ...prev,
      [planId]: normalizePlanConfig(planId, {
        ...createPlanFallback(planId),
        name: "Nuevo plan",
      }),
    }));

    setRemovedPlanIds(prev => prev.filter(id => id !== planId));
    return planId;
  }, [planConfigs]);

  const archivePlan = useCallback(
    (planId: string) => {
      const normalizedPlanId = normalizePlanId(planId);
      if (!normalizedPlanId || !planConfigs[normalizedPlanId]) {
        return { ok: false, message: "Plan inválido" };
      }

      updatePlanConfig(normalizedPlanId, { status: "archived" });

      if (defaultPlan === normalizedPlanId) {
        const nextDefault = resolveDefaultPlanId(
          {
            ...planConfigs,
            [normalizedPlanId]: {
              ...planConfigs[normalizedPlanId],
              status: "archived",
            },
          },
          defaultPlan,
        );
        setDefaultPlan(nextDefault);
      }

      return { ok: true };
    },
    [defaultPlan, planConfigs, updatePlanConfig],
  );

  const deletePlan = useCallback(
    (planId: string) => {
      const normalizedPlanId = normalizePlanId(planId);
      if (!normalizedPlanId || !planConfigs[normalizedPlanId]) {
        return { ok: false, message: "Plan inválido" };
      }

      // Allow deleting base plans if not assigned

      if ((subscriptionSummary.byPlan[normalizedPlanId] || 0) > 0) {
        return {
          ok: false,
          message:
            "No puedes eliminar un plan con negocios asignados. Archívalo primero.",
        };
      }

      setPlanConfigs(prev => {
        const next = { ...prev };
        delete next[normalizedPlanId];
        return next;
      });

      if (initialPlanConfigs[normalizedPlanId]) {
        setRemovedPlanIds(prev =>
          prev.includes(normalizedPlanId)
            ? prev
            : [...prev, normalizedPlanId],
        );
      }

      if (defaultPlan === normalizedPlanId) {
        const nextPlans = { ...planConfigs };
        delete nextPlans[normalizedPlanId];
        setDefaultPlan(resolveDefaultPlanId(nextPlans, defaultPlan));
      }

      return { ok: true };
    },
    [
      defaultPlan,
      initialPlanConfigs,
      planConfigs,
      subscriptionSummary.byPlan,
    ],
  );

  const setPlanAsDefault = useCallback(
    (planId: string) => {
      const normalizedPlanId = normalizePlanId(planId);
      if (!normalizedPlanId) return false;

      const targetPlan = planConfigs[normalizedPlanId];
      if (!targetPlan || targetPlan.status === "archived") return false;

      setDefaultPlan(normalizedPlanId);
      return true;
    },
    [planConfigs],
  );

  const resetGlobalDraft = useCallback(() => {
    setMaintenanceMode(initialMaintenanceMode);
    setDefaultPlan(initialDefaultPlan);
    setPlanConfigs(initialPlanConfigs);
    setRemovedPlanIds([]);
  }, [initialDefaultPlan, initialMaintenanceMode, initialPlanConfigs]);

  const saveGlobalPlans = useCallback(async () => {
    setSubscriptionAction("global-settings");

    try {
      const payloadPlans = Object.values(planConfigs).reduce<
        Record<string, Partial<EditablePlanConfig>>
      >((acc, plan) => {
        acc[plan.id] = {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          currency: plan.currency,
          status: plan.status,
          limits: {
            branches: plan.limits.branches,
            employees: plan.limits.employees,
          },
          features: {
            businessAssistant: plan.features.businessAssistant,
          },
          featuresList: [...plan.featuresList],
        };
        return acc;
      }, {});

      await globalSettingsService.updateGlobalSettings({
        maintenanceMode,
        defaultPlan,
        plans: payloadPlans,
        removedPlanIds,
      });

      await loadSubscriptions();
    } finally {
      setSubscriptionAction(null);
    }
  }, [defaultPlan, loadSubscriptions, maintenanceMode, planConfigs, removedPlanIds]);

  const updateBusinessPlan = useCallback(
    async (row: BusinessSubscriptionRow) => {
      setSubscriptionAction(`subscription-${row._id}`);

      try {
        await globalSettingsService.updateBusinessSubscription(row._id, {
          plan: row.plan,
          customLimits: normalizeCustomLimits(row.customLimits),
        });

        await loadSubscriptions();
      } finally {
        setSubscriptionAction(null);
      }
    },
    [loadSubscriptions],
  );

  const getEffectiveLimits = useCallback(
    (row: BusinessSubscriptionRow): PlanLimits => {
      const planLimits = planConfigs[row.plan]?.limits || {
        branches: row.limits?.limits?.branches || 1,
        employees: row.limits?.limits?.employees || 1,
      };

      return {
        branches:
          row.customLimits?.branches && row.customLimits.branches > 0
            ? row.customLimits.branches
            : planLimits.branches,
        employees:
          row.customLimits?.employees && row.customLimits.employees > 0
            ? row.customLimits.employees
            : planLimits.employees,
      };
    },
    [planConfigs],
  );

  const getPlanOptionsForRow = useCallback(
    (rowPlanId?: string) => {
      const options = [...activePlans];
      if (
        rowPlanId &&
        planConfigs[rowPlanId] &&
        !options.some(plan => plan.id === rowPlanId)
      ) {
        options.push(planConfigs[rowPlanId]);
      }

      return options;
    },
    [activePlans, planConfigs],
  );

  return {
    subscriptionsLoading,
    subscriptionAction,
    subscriptionRows,
    setSubscriptionRows,
    initialSubscriptionRows,
    setRowDraft,

    maintenanceMode,
    setMaintenanceMode,

    defaultPlan,
    setPlanAsDefault,

    planConfigs,
    activePlans,

    removedPlanIds,

    subscriptionSummary,
    isGlobalSettingsDirty,
    isRowDirty,

    createPlan,
    updatePlanConfig,
    archivePlan,
    deletePlan,

    loadSubscriptions,
    saveGlobalPlans,
    updateBusinessPlan,
    resetGlobalDraft,

    getEffectiveLimits,
    getPlanOptionsForRow,
  };
}
