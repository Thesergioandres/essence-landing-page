import Business from "../../database/models/Business.js";
import User from "../../database/models/User.js";
import {
  buildBusinessLimitPayload,
  ensureGlobalSettings,
  listPublicPlans,
  VALID_BUSINESS_PLANS,
} from "../../services/planLimits.service.js";

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
            plan: business.plan || "starter",
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

      const business = await Business.findById(businessId);
      if (!business) {
        return res
          .status(404)
          .json({ success: false, message: "Negocio no encontrado" });
      }

      if (plan !== undefined) {
        if (!VALID_BUSINESS_PLANS.includes(plan)) {
          return res
            .status(400)
            .json({ success: false, message: "Plan inválido" });
        }
        business.plan = plan;
      }

      if (customLimits !== undefined) {
        const branches = Number(customLimits?.branches);
        const distributors = Number(customLimits?.distributors);

        business.customLimits = {
          ...(Number.isFinite(branches) && branches > 0 ? { branches } : {}),
          ...(Number.isFinite(distributors) && distributors > 0
            ? { distributors }
            : {}),
        };

        if (
          !business.customLimits?.branches &&
          !business.customLimits?.distributors
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
      const { maintenanceMode, defaultPlan, plans } = req.body || {};

      if (maintenanceMode !== undefined) {
        settings.maintenanceMode = Boolean(maintenanceMode);
      }

      if (defaultPlan !== undefined) {
        if (!VALID_BUSINESS_PLANS.includes(defaultPlan)) {
          return res
            .status(400)
            .json({ success: false, message: "defaultPlan inválido" });
        }
        settings.defaultPlan = defaultPlan;
      }

      if (plans && typeof plans === "object") {
        for (const planKey of VALID_BUSINESS_PLANS) {
          const planInput = plans[planKey];
          if (!planInput || typeof planInput !== "object") continue;

          const targetPlan = settings.plans[planKey];
          if (planInput.name !== undefined) targetPlan.name = planInput.name;
          if (planInput.description !== undefined)
            targetPlan.description = planInput.description;
          if (planInput.monthlyPrice !== undefined)
            targetPlan.monthlyPrice = Number(planInput.monthlyPrice) || 0;
          if (planInput.yearlyPrice !== undefined)
            targetPlan.yearlyPrice = Number(planInput.yearlyPrice) || 0;
          if (planInput.currency !== undefined)
            targetPlan.currency = String(planInput.currency || "USD");

          if (planInput.features && typeof planInput.features === "object") {
            if (planInput.features.businessAssistant !== undefined) {
              if (!targetPlan.features) {
                targetPlan.features = { businessAssistant: false };
              }
              targetPlan.features.businessAssistant = Boolean(
                planInput.features.businessAssistant,
              );
            }
          }

          if (planInput.limits && typeof planInput.limits === "object") {
            if (planInput.limits.branches !== undefined) {
              targetPlan.limits.branches = Math.max(
                1,
                Number(planInput.limits.branches) || 1,
              );
            }
            if (planInput.limits.distributors !== undefined) {
              targetPlan.limits.distributors = Math.max(
                1,
                Number(planInput.limits.distributors) || 1,
              );
            }
          }
        }
      }

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
