/**
 * Gamification Controller
 * Handles gamification config, rankings, and employee points.
 */

import { GamificationService } from "../../../domain/services/GamificationService.js";
import EmployeePoints from "../../database/models/EmployeePoints.js";
import GamificationConfig from "../../database/models/GamificationConfig.js";
import Membership from "../../database/models/Membership.js";
import PeriodWinner from "../../database/models/PeriodWinner.js";
import User from "../../database/models/User.js";

/**
 * GET /api/v2/gamification/config
 * Get gamification config for the current business.
 */
export async function getConfig(req, res) {
  try {
    const businessId = req.businessId;

    let config = await GamificationConfig.findOne({
      business: businessId,
    }).lean();

    if (!config) {
      // Return defaults (not persisted until admin saves)
      config = {
        enabled: false,
        pointsRatio: { amountPerPoint: 1000, currency: "COP" },
        cycle: { duration: "biweekly", currentPeriodStart: null, currentPeriodEnd: null },
        tiers: GamificationService.getDefaultTiers(),
        productMultipliers: [],
      };
    }

    return res.json({ success: true, data: config });
  } catch (error) {
    console.error("❌ [GAMIFICATION] getConfig error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * PUT /api/v2/gamification/config
 * Create or update gamification config.
 */
export async function updateConfig(req, res) {
  try {
    const businessId = req.businessId;
    const { enabled, pointsRatio, cycle, tiers, productMultipliers } = req.body;

    const updateData = {};

    if (typeof enabled === "boolean") {
      updateData.enabled = enabled;
    }

    if (pointsRatio) {
      updateData["pointsRatio.amountPerPoint"] =
        Number(pointsRatio.amountPerPoint) || 1000;
      if (pointsRatio.currency) {
        updateData["pointsRatio.currency"] = pointsRatio.currency;
      }
    }

    if (cycle?.duration) {
      updateData["cycle.duration"] = cycle.duration;
    }

    if (Array.isArray(tiers) && tiers.length > 0) {
      updateData.tiers = tiers.map((tier) => ({
        name: tier.name || "Sin nombre",
        minPoints: Math.max(0, Number(tier.minPoints) || 0),
        bonusPercentage: Math.max(0, Math.min(20, Number(tier.bonusPercentage) || 0)),
      }));
    }

    if (Array.isArray(productMultipliers)) {
      updateData.productMultipliers = productMultipliers;
    }

    const config = await GamificationConfig.findOneAndUpdate(
      { business: businessId },
      { $set: updateData },
      { upsert: true, new: true, runValidators: true },
    );

    // Initialize period boundaries if enabling for the first time
    if (config.enabled && !config.cycle?.currentPeriodStart) {
      const { start, end } = GamificationService.initializePeriod(
        config.cycle?.duration || "biweekly",
      );
      config.cycle.currentPeriodStart = start;
      config.cycle.currentPeriodEnd = end;
      await config.save();
    }

    return res.json({ success: true, data: config });
  } catch (error) {
    console.error("❌ [GAMIFICATION] updateConfig error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/v2/gamification/ranking
 * Get current period ranking for the business.
 */
export async function getRanking(req, res) {
  try {
    const businessId = req.businessId;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const config = await GamificationConfig.findOne({
      business: businessId,
      enabled: true,
    }).lean();

    if (!config) {
      return res.json({
        success: true,
        data: {
          enabled: false,
          ranking: [],
          period: null,
        },
      });
    }

    // Get all employees with points, sorted by currentPoints desc
    const ranking = await EmployeePoints.find({ business: businessId })
      .sort({ currentPoints: -1 })
      .limit(limit)
      .populate("employee", "name email")
      .lean();

    // Enrich with tier info
    const enrichedRanking = ranking.map((entry, index) => {
      const tierResult = GamificationService.resolveTier(
        entry.currentPoints,
        config.tiers,
      );

      return {
        position: index + 1,
        employeeId: entry.employee?._id || entry.employee,
        employeeName: entry.employee?.name || "Empleado",
        employeeEmail: entry.employee?.email || "",
        currentPoints: entry.currentPoints,
        tier: tierResult.tier,
        nextTier: tierResult.nextTier,
        pointsToNextTier: tierResult.pointsToNextTier,
        bonusPercentage: tierResult.bonusPercentage,
      };
    });

    return res.json({
      success: true,
      data: {
        enabled: true,
        ranking: enrichedRanking,
        period: {
          start: config.cycle?.currentPeriodStart,
          end: config.cycle?.currentPeriodEnd,
          duration: config.cycle?.duration,
        },
        tiers: config.tiers,
      },
    });
  } catch (error) {
    console.error("❌ [GAMIFICATION] getRanking error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/v2/gamification/my-points
 * Get current user's points, tier, and progress.
 */
export async function getMyPoints(req, res) {
  try {
    const businessId = req.businessId;
    const userId = req.user.id;

    const config = await GamificationConfig.findOne({
      business: businessId,
      enabled: true,
    }).lean();

    if (!config) {
      return res.json({
        success: true,
        data: { enabled: false },
      });
    }

    const employeePoints = await EmployeePoints.findOne({
      employee: userId,
      business: businessId,
    }).lean();

    const currentPoints = employeePoints?.currentPoints || 0;
    const tierResult = GamificationService.resolveTier(
      currentPoints,
      config.tiers,
    );

    // Check eligibility
    const membership = await Membership.findOne({
      business: businessId,
      user: userId,
      status: "active",
    })
      .select("eligibleForGamificationBonus")
      .lean();

    const isEligible = membership?.eligibleForGamificationBonus !== false;

    // Recent history (last 20 entries)
    const recentHistory = (employeePoints?.history || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    // Get position in ranking
    const higherCount = await EmployeePoints.countDocuments({
      business: businessId,
      currentPoints: { $gt: currentPoints },
    });
    const rankPosition = higherCount + 1;

    return res.json({
      success: true,
      data: {
        enabled: true,
        currentPoints,
        tier: tierResult.tier,
        nextTier: tierResult.nextTier,
        pointsToNextTier: tierResult.pointsToNextTier,
        bonusPercentage: isEligible ? tierResult.bonusPercentage : 0,
        isEligibleForBonus: isEligible,
        rankPosition,
        recentHistory,
        period: {
          start: config.cycle?.currentPeriodStart,
          end: config.cycle?.currentPeriodEnd,
          duration: config.cycle?.duration,
        },
      },
    });
  } catch (error) {
    console.error("❌ [GAMIFICATION] getMyPoints error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/v2/gamification/history
 * Get consolidated period winners history.
 */
export async function getPeriodHistory(req, res) {
  try {
    const businessId = req.businessId;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const page = Math.max(1, Number(req.query.page) || 1);

    const winners = await PeriodWinner.find({ business: businessId })
      .sort({ endDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("winner", "name email")
      .populate("topPerformers.employee", "name email")
      .lean();

    const total = await PeriodWinner.countDocuments({ business: businessId });

    return res.json({
      success: true,
      data: {
        winners,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("❌ [GAMIFICATION] getPeriodHistory error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/v2/gamification/consolidate
 * Force consolidation of current period (super_admin/god only).
 */
export async function forceConsolidate(req, res) {
  try {
    const businessId = req.businessId;

    const config = await GamificationConfig.findOne({
      business: businessId,
      enabled: true,
    });

    if (!config) {
      return res.status(400).json({
        success: false,
        message: "Gamificación no está habilitada",
      });
    }

    // Get top performers
    const topEmployees = await EmployeePoints.find({ business: businessId })
      .sort({ currentPoints: -1 })
      .limit(3)
      .populate("employee", "name email")
      .lean();

    if (topEmployees.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No hay empleados con puntos en el periodo actual",
      });
    }

    const winner = topEmployees[0];
    const totalPointsForPeriod = topEmployees.reduce(
      (sum, emp) => sum + (emp.currentPoints || 0),
      0,
    );

    // Create PeriodWinner record
    const periodWinner = await PeriodWinner.create({
      periodType: config.cycle?.duration || "biweekly",
      business: businessId,
      startDate: config.cycle?.currentPeriodStart || new Date(),
      endDate: config.cycle?.currentPeriodEnd || new Date(),
      winner: winner.employee?._id || winner.employee,
      winnerName: winner.employee?.name || "Empleado",
      winnerEmail: winner.employee?.email || "",
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,
      salesCount: 0,
      bonusAmount: 0,
      totalPointsForPeriod,
      topPerformers: topEmployees.map((emp, idx) => {
        const tierResult = GamificationService.resolveTier(
          emp.currentPoints,
          config.tiers,
        );
        return {
          employee: emp.employee?._id || emp.employee,
          position: idx + 1,
          totalRevenue: 0,
          salesCount: 0,
          bonus: 0,
          totalPoints: emp.currentPoints,
          tierReached: tierResult.tier?.name || "Sin tier",
        };
      }),
      notes: `Consolidación ${req.body?.manual ? "manual" : "automática"} del periodo`,
    });

    // Reset all employee points for this business
    await EmployeePoints.updateMany(
      { business: businessId },
      {
        $set: {
          currentPoints: 0,
          currentTier: { name: null, bonusPercentage: 0 },
          periodResetAt: new Date(),
        },
        $push: {
          history: {
            $each: [
              {
                type: "reset",
                points: 0,
                description: `Periodo consolidado. Ganador: ${winner.employee?.name || "N/A"}`,
                createdAt: new Date(),
              },
            ],
            $slice: -500,
          },
        },
      },
    );

    // Advance period
    const { start, end } = GamificationService.computeNextPeriod(
      config.cycle?.duration || "biweekly",
      config.cycle?.currentPeriodEnd || new Date(),
    );
    config.cycle.currentPeriodStart = start;
    config.cycle.currentPeriodEnd = end;
    await config.save();

    return res.json({
      success: true,
      message: "Periodo consolidado exitosamente",
      data: periodWinner,
    });
  } catch (error) {
    console.error("❌ [GAMIFICATION] forceConsolidate error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
