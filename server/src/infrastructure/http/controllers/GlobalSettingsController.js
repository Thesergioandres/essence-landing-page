import Business from "../../database/models/Business.js";
import User from "../../database/models/User.js";
import {
  buildBusinessLimitPayload,
  ensureGlobalSettings,
  getAssignableBusinessPlanIdsFromSettings,
  isBusinessPlanAssignable,
  listPublicPlans,
  resolvePlanCatalogFromSettings,
  sanitizePlanIdentifier,
} from "../../services/planLimits.service.js";

const PLAN_STATUSES = new Set(["active", "archived"]);
// Deletion control is now dynamic based on assignments

const toPlainObject = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  return typeof value.toObject === "function" ? value.toObject() : value;
};

const toPlanMap = (plansSource) => {
  if (plansSource instanceof Map) {
    return new Map(plansSource.entries());
  }

  const plain = toPlainObject(plansSource);
  if (!plain || typeof plain !== "object") {
    return new Map();
  }

  return new Map(Object.entries(plain));
};

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
  return Math.max(1, Math.floor(numeric));
};

const normalizeCurrency = (currency, fallback = "USD") => {
  const normalized = String(currency || fallback)
    .trim()
    .toUpperCase()
    .slice(0, 10);
  return normalized || "USD";
};

const normalizeFeaturesList = (featuresList) => {
  if (!Array.isArray(featuresList)) return [];
  return [
    ...new Set(
      featuresList
        .map((feature) => String(feature || "").trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  ];
};

const buildPlanUpdatePayload = (planId, planInput, existingPlan = {}) => {
  const plainExisting = toPlainObject(existingPlan) || {};

  const nextStatus =
    planInput.status !== undefined && PLAN_STATUSES.has(planInput.status)
      ? planInput.status
      : plainExisting.status || "active";

  const nextFeatures = {
    ...(plainExisting.features || { businessAssistant: false }),
    ...(planInput.features && typeof planInput.features === "object"
      ? {
          businessAssistant: Boolean(planInput.features.businessAssistant),
        }
      : {}),
  };

  const nextLimits = {
    ...(plainExisting.limits || { branches: 1, employees: 1 }),
    ...(planInput.limits && typeof planInput.limits === "object"
      ? {
          branches: normalizePositiveLimit(
            planInput.limits.branches,
            plainExisting.limits?.branches,
          ),
          employees: normalizePositiveLimit(
            planInput.limits.employees,
            plainExisting.limits?.employees,
          ),
        }
      : {}),
  };

  return {
    ...plainExisting,
    id: planId,
    name: String(planInput.name || plainExisting.name || planId),
    description: String(
      planInput.description || plainExisting.description || "",
    ),
    monthlyPrice: normalizePrice(
      planInput.monthlyPrice,
      plainExisting.monthlyPrice,
    ),
    yearlyPrice: normalizePrice(
      planInput.yearlyPrice,
      plainExisting.yearlyPrice,
    ),
    currency: normalizeCurrency(planInput.currency, plainExisting.currency),
    status: nextStatus,
    limits: nextLimits,
    features: nextFeatures,
    featuresList: normalizeFeaturesList(
      planInput.featuresList || plainExisting.featuresList,
    ),
  };
};

class GlobalSettingsController {
  async getPublic(req, res) {
    try {
      const data = await listPublicPlans();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getBusinessLimits(req, res) {
    try {
      const business = req.business;
      if (!business) {
        return res
          .status(400)
          .json({ success: false, message: "Falta contexto de negocio" });
      }

      const payload = await buildBusinessLimitPayload(business);
      return res.json({ success: true, data: payload });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async listBusinessSubscriptions(req, res) {
    try {
      const businesses = await Business.find({})
        .select("name status plan customLimits createdBy createdAt")
        .sort({ createdAt: -1 })
        .lean();

      const ownerIds = businesses
        .map((item) => item.createdBy)
        .filter(Boolean)
        .map((id) => id.toString());

      const owners = await User.find({ _id: { $in: ownerIds } })
        .select("name email status")
        .lean();

      const ownerMap = owners.reduce((acc, owner) => {
        acc[owner._id.toString()] = owner;
        return acc;
      }, {});

      const rows = await Promise.all(
        businesses.map(async (business) => {
          const limits = await buildBusinessLimitPayload(
            business._id.toString(),
          );
          return {
            _id: business._id,
            name: business.name,
            status: business.status,
            createdAt: business.createdAt,
            owner: ownerMap[business.createdBy?.toString()] || null,
            plan: sanitizePlanIdentifier(business.plan) || "starter",
            customLimits: business.customLimits || null,
            limits,
          };
        }),
      );

      return res.json({ success: true, data: rows });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateBusinessSubscription(req, res) {
    try {
      const { businessId } = req.params;
      const { plan, customLimits } = req.body || {};
      const normalizedPlanId = sanitizePlanIdentifier(plan);

      const business = await Business.findById(businessId);
      if (!business) {
        return res
          .status(404)
          .json({ success: false, message: "Negocio no encontrado" });
      }

      if (plan !== undefined) {
        if (!normalizedPlanId) {
          return res.status(400).json({
            success: false,
            message: `Identificador de plan inválido: "${plan}"`,
          });
        }

        const canAssignPlan = await isBusinessPlanAssignable(normalizedPlanId);
        if (!canAssignPlan) {
          return res.status(400).json({
            success: false,
            message: `El plan "${normalizedPlanId}" no existe o no está activo para asignación`,
          });
        }

        business.plan = normalizedPlanId;
      }

      if (customLimits !== undefined) {
        const branches = Number(customLimits?.branches);
        const employees = Number(customLimits?.employees);

        business.customLimits = {
          ...(Number.isFinite(branches) && branches > 0 ? { branches } : {}),
          ...(Number.isFinite(employees) && employees > 0 ? { employees } : {}),
        };

        if (
          !business.customLimits?.branches &&
          !business.customLimits?.employees
        ) {
          business.customLimits = undefined;
        }
      }

      await business.save();
      const limits = await buildBusinessLimitPayload(business);

      return res.json({
        success: true,
        message: "Suscripción actualizada",
        data: {
          _id: business._id,
          plan: business.plan,
          customLimits: business.customLimits || null,
          limits,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateGlobal(req, res) {
    try {
      const settings = await ensureGlobalSettings();
      const { maintenanceMode, defaultPlan, plans, removedPlanIds } =
        req.body || {};

      const plansMap = toPlanMap(settings.plans);

      if (maintenanceMode !== undefined) {
        settings.maintenanceMode = Boolean(maintenanceMode);
      }

      const nextDefaultPlan =
        defaultPlan !== undefined
          ? sanitizePlanIdentifier(defaultPlan)
          : sanitizePlanIdentifier(settings.defaultPlan);

      const safeRemovePlan = async (rawPlanId) => {
        const normalizedPlanId = sanitizePlanIdentifier(rawPlanId);
        if (!normalizedPlanId) {
          return { ok: false, status: 400, message: "Plan inválido" };
        }

        if (!plansMap.has(normalizedPlanId)) {
          return { ok: true };
        }

        // Allow deleting base plans if not assigned

        if (normalizedPlanId === nextDefaultPlan) {
          return {
            ok: false,
            status: 400,
            message: "No puedes eliminar el plan predeterminado",
          };
        }

        const assignedBusinesses = await Business.countDocuments({
          plan: normalizedPlanId,
        });

        if (assignedBusinesses > 0) {
          return {
            ok: false,
            status: 409,
            message:
              "No puedes eliminar un plan asignado a negocios. Archívalo primero.",
          };
        }

        plansMap.delete(normalizedPlanId);
        return { ok: true };
      };

      if (Array.isArray(removedPlanIds)) {
        for (const removedPlanId of removedPlanIds) {
          const removalResult = await safeRemovePlan(removedPlanId);
          if (!removalResult.ok) {
            return res.status(removalResult.status).json({
              success: false,
              message: removalResult.message,
            });
          }
        }
      }

      if (plans && typeof plans === "object") {
        const currentCatalog = resolvePlanCatalogFromSettings(settings);

        for (const [rawPlanId, planInput] of Object.entries(plans)) {
          if (!planInput || typeof planInput !== "object") continue;

          const normalizedPlanId = sanitizePlanIdentifier(
            rawPlanId || planInput.id,
          );
          if (!normalizedPlanId) {
            return res
              .status(400)
              .json({ success: false, message: "ID de plan inválido" });
          }

          if (planInput.deleted === true) {
            const removalResult = await safeRemovePlan(normalizedPlanId);
            if (!removalResult.ok) {
              return res.status(removalResult.status).json({
                success: false,
                message: removalResult.message,
              });
            }
            continue;
          }

          const basePlan = plansMap.get(normalizedPlanId)
            ? toPlainObject(plansMap.get(normalizedPlanId))
            : currentCatalog[normalizedPlanId];
          const nextPlan = buildPlanUpdatePayload(
            normalizedPlanId,
            planInput,
            basePlan,
          );

          plansMap.set(normalizedPlanId, nextPlan);
        }
      }

      const snapshotForValidation = {
        ...toPlainObject(settings),
        plans: plansMap,
        defaultPlan: nextDefaultPlan,
      };

      const assignablePlanIds = getAssignableBusinessPlanIdsFromSettings(
        snapshotForValidation,
      );

      if (!assignablePlanIds.length) {
        return res.status(400).json({
          success: false,
          message: "Debe existir al menos un plan activo",
        });
      }

      if (defaultPlan !== undefined) {
        if (!nextDefaultPlan || !assignablePlanIds.includes(nextDefaultPlan)) {
          return res
            .status(400)
            .json({ success: false, message: "defaultPlan inválido" });
        }

        settings.defaultPlan = nextDefaultPlan;
      } else {
        const currentDefaultPlan = sanitizePlanIdentifier(settings.defaultPlan);
        if (
          !currentDefaultPlan ||
          !assignablePlanIds.includes(currentDefaultPlan)
        ) {
          settings.defaultPlan = assignablePlanIds[0];
        }
      }

      settings.plans = plansMap;

      settings.updatedBy = req.user?._id;
      await settings.save();

      const data = await listPublicPlans();
      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new GlobalSettingsController();
