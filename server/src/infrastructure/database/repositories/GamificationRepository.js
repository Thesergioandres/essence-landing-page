import mongoose from "mongoose";
import EmployeeStats from "../models/EmployeeStats.js";
import GamificationConfig from "../models/GamificationConfig.js";
import Membership from "../models/Membership.js";
import PeriodWinner from "../models/PeriodWinner.js";
import Sale from "../models/Sale.js";
import { getEmployeeCommissionInfo } from "../../services/employeePricing.service.js";
import {
  applySaleGamification,
  computePointsForSale,
  resolveLevelForPoints,
} from "../../services/gamification.service.js";

export class GamificationRepository {
  async getBusinessEmployeeIds(businessId) {
    const memberships = await Membership.find({
      business: businessId,
      status: "active",
      role: { $in: ["employee"] },
    }).select("user");
    return memberships.map((m) => m.user);
  }

  async getAdjustedCommission(employeeId, businessId) {
    const info = await getEmployeeCommissionInfo(employeeId, businessId);
    return {
      position: info.position,
      bonusCommission: info.bonusCommission,
      periodStart: info.periodStart,
      periodEnd: info.periodEnd,
      totalEmployees: info.totalEmployees,
    };
  }

  async checkAndEvaluatePeriod(businessId) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const allowedEmployees =
      await this.getBusinessEmployeeIds(businessId);

    const config = await GamificationConfig.findOne();

    if (!config || !config.autoEvaluate) {
      return { message: "Auto-evaluación desactivada" };
    }

    const now = new Date();
    const startDate = config.currentPeriodStart || now;
    let periodDuration = 15;
    const cycleDuration = config?.cycle?.duration;

    if (cycleDuration === "infinite") {
      return { message: "Ciclo infinito: sin cierre automatico" };
    }

    if (cycleDuration === "quarterly") periodDuration = 90;
    else if (cycleDuration === "annual") periodDuration = 365;
    else if (cycleDuration === "custom")
      periodDuration = config.cycle?.customDays || 30;
    else if (cycleDuration === "monthly") periodDuration = 30;
    else if (config.evaluationPeriod === "biweekly") periodDuration = 15;
    else if (config.evaluationPeriod === "monthly") periodDuration = 30;
    else if (config.evaluationPeriod === "weekly") periodDuration = 7;
    else if (config.evaluationPeriod === "custom")
      periodDuration = config.customPeriodDays || 15;

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + periodDuration);

    if (now < endDate) {
      return {
        message: "El período aún no ha terminado",
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        daysRemaining: Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)),
      };
    }

    const topEmployees = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startDate, $lte: endDate },
          paymentStatus: "confirmado",
          business: businessObjectId,
          // CRITICAL: Only include sales WITH a employee (exclude admin sales)
          employee: { $ne: null },
          ...(allowedEmployees.length
            ? { employee: { $in: allowedEmployees } }
            : {}),
        },
      },
      {
        $group: {
          _id: "$employee",
          totalSales: { $sum: 1 },
          totalUnits: { $sum: "$quantity" },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      { $sort: { totalRevenue: -1 } },
      { $limit: 3 },
    ]);

    if (topEmployees.length === 0) {
      config.currentPeriodStart = now;
      await config.save();
      return {
        message: "No hay ventas en el período, iniciando nuevo período",
        newPeriodStart: now,
      };
    }

    const winner = topEmployees[0];
    const bonuses = [
      config.topPerformerBonus || 50000,
      config.secondPlaceBonus || 0,
      config.thirdPlaceBonus || 0,
    ];

    const periodWinner = await PeriodWinner.create({
      business: businessObjectId,
      periodType: config.evaluationPeriod,
      startDate,
      endDate,
      winner: winner._id,
      winnerName: winner.employee.name,
      winnerEmail: winner.employee.email,
      totalSales: winner.totalSales,
      totalRevenue: winner.totalRevenue,
      totalProfit: winner.totalProfit,
      salesCount: winner.totalSales,
      bonusAmount: bonuses[0],
      topPerformers: topEmployees.map((dist, index) => ({
        employee: dist._id,
        position: index + 1,
        totalRevenue: dist.totalRevenue,
        salesCount: dist.totalSales,
        bonus: bonuses[index] || 0,
      })),
      notes: "Evaluación automática del sistema",
    });

    for (let i = 0; i < topEmployees.length; i++) {
      const dist = topEmployees[i];
      let stats = await EmployeeStats.findOne({ employee: dist._id });

      if (!stats) {
        stats = await EmployeeStats.create({ employee: dist._id });
      }

      stats.totalBonusEarned += bonuses[i] || 0;
      stats.pendingBonuses += bonuses[i] || 0;

      if (i === 0) {
        stats.periodWins += 1;
        stats.achievements.push({
          type: "top_performer",
          name: "Ganador del Periodo",
          description: `Primer lugar del ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}`,
          badge: "🏆",
          earnedAt: new Date(),
          value: bonuses[0],
        });
      }

      if (i < 3) {
        stats.topThreeFinishes += 1;
      }

      await stats.save();
    }

    config.currentPeriodStart = now;
    config.lastEvaluationDate = now;
    await config.save();

    await this.applyResetPolicy(businessId, config, allowedEmployees);

    return {
      message: "Período evaluado automáticamente",
      winner: periodWinner,
      newPeriodStart: now,
    };
  }

  async applyResetPolicy(businessId, config, allowedEmployees) {
    const policyType = config?.resetPolicy?.type || "reset";
    const carryPercent = Number(config?.resetPolicy?.carryPercent || 0);
    const levels = Array.isArray(config?.levels) ? config.levels : [];
    const sortedLevels = [...levels].sort(
      (a, b) => (a.minPoints || 0) - (b.minPoints || 0),
    );
    const lowestLevel = sortedLevels[0] || { id: 1, name: "Novato" };

    const filter = allowedEmployees?.length
      ? { employee: { $in: allowedEmployees } }
      : {};

    const statsList = await EmployeeStats.find(filter);

    for (const stats of statsList) {
      if (policyType === "carry") {
        stats.totalPoints = Math.round(
          (stats.totalPoints || 0) * (carryPercent / 100),
        );
        stats.currentMonthPoints = 0;
        const level = resolveLevelForPoints(levels, stats.totalPoints || 0);
        stats.currentLevel = level?.name || lowestLevel.name;
        stats.currentLevelId = level?.id || lowestLevel.id;
      } else if (policyType === "downlevel") {
        const currentLevel = resolveLevelForPoints(levels, stats.totalPoints);
        const currentIndex = sortedLevels.findIndex(
          (lvl) => lvl.id === currentLevel?.id,
        );
        const nextIndex = Math.max(0, currentIndex - 1);
        const nextLevel = sortedLevels[nextIndex] || lowestLevel;
        stats.currentLevel = nextLevel.name || lowestLevel.name;
        stats.currentLevelId = nextLevel.id || lowestLevel.id;
        stats.totalPoints = nextLevel.minPoints || 0;
        stats.currentMonthPoints = 0;
      } else {
        stats.totalPoints = 0;
        stats.currentMonthPoints = 0;
        stats.currentLevel = lowestLevel.name || "Novato";
        stats.currentLevelId = lowestLevel.id || 1;
      }

      await stats.save();
    }
  }

  async getConfig() {
    let config = await GamificationConfig.findOne();

    if (!config) {
      config = await GamificationConfig.create({
        generalRules: {
          pointsPerCurrencyUnit: 0.001,
          pointsPerSaleConfirmed: 10,
          penaltyPerDayLate: 5,
          pointsBase: "sale",
        },
        levels: [
          {
            id: 1,
            name: "Novato",
            minPoints: 0,
            benefits: { commissionBonus: 0, discountBonus: 0 },
          },
          {
            id: 2,
            name: "Pro",
            minPoints: 1000,
            benefits: { commissionBonus: 2.5, discountBonus: 0 },
          },
          {
            id: 3,
            name: "Leyenda",
            minPoints: 5000,
            benefits: { commissionBonus: 5, discountBonus: 0 },
          },
        ],
        activeMultipliers: [],
        cycle: { duration: "monthly", customDays: 30 },
        resetPolicy: { type: "reset", carryPercent: 0 },
        evaluationPeriod: "biweekly",
        customPeriodDays: 15,
        topPerformerBonus: 50000,
        secondPlaceBonus: 0,
        thirdPlaceBonus: 0,
        top1CommissionBonus: 5,
        top2CommissionBonus: 3,
        top3CommissionBonus: 2,
        baseCommissionPercentage: 20,
        autoEvaluate: true,
        currentPeriodStart: new Date(),
        salesTargets: [
          { level: "bronze", minAmount: 10000, bonus: 200, badge: "🥉" },
          { level: "silver", minAmount: 25000, bonus: 500, badge: "🥈" },
          { level: "gold", minAmount: 50000, bonus: 1000, badge: "🥇" },
          { level: "platinum", minAmount: 100000, bonus: 2500, badge: "💎" },
        ],
      });
    } else {
      let shouldSave = false;
      if (!config.generalRules) {
        config.generalRules = {
          pointsPerCurrencyUnit: 0.001,
          pointsPerSaleConfirmed: 10,
          penaltyPerDayLate: 5,
          pointsBase: "sale",
        };
        shouldSave = true;
      } else if (!config.generalRules.pointsBase) {
        config.generalRules.pointsBase = "sale";
        shouldSave = true;
      }
      if (!config.levels || config.levels.length === 0) {
        config.levels = [
          {
            id: 1,
            name: "Novato",
            minPoints: 0,
            benefits: { commissionBonus: 0, discountBonus: 0 },
          },
          {
            id: 2,
            name: "Pro",
            minPoints: 1000,
            benefits: { commissionBonus: 2.5, discountBonus: 0 },
          },
          {
            id: 3,
            name: "Leyenda",
            minPoints: 5000,
            benefits: { commissionBonus: 5, discountBonus: 0 },
          },
        ];
        shouldSave = true;
      }
      if (!config.activeMultipliers) {
        config.activeMultipliers = [];
        shouldSave = true;
      }
      if (!config.cycle) {
        config.cycle = { duration: "monthly", customDays: 30 };
        shouldSave = true;
      }
      if (!config.resetPolicy) {
        config.resetPolicy = { type: "reset", carryPercent: 0 };
        shouldSave = true;
      }
      if (typeof config.baseCommissionPercentage !== "number") {
        config.baseCommissionPercentage = 20;
        shouldSave = true;
      }
      if (shouldSave) {
        await config.save();
      }
    }

    return config;
  }

  async updateConfig(data) {
    let config = await GamificationConfig.findOne();

    if (!config) {
      config = await GamificationConfig.create(data);
    } else {
      Object.assign(config, data);
      await config.save();
    }

    return config;
  }

  async getRanking(businessId, params = {}) {
    const period = params?.period || "current";
    let startDate = params?.startDate;
    let endDate = params?.endDate;
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const allowedEmployees =
      await this.getBusinessEmployeeIds(businessId);
    const config = await GamificationConfig.findOne();

    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );

    if (period === "custom" && startDate && endDate) {
      startDate = new Date(startDate);
      endDate = new Date(endDate);
    } else if (period === "current") {
      const evalPeriod = config?.evaluationPeriod || "biweekly";
      let periodDays = 15;
      if (evalPeriod === "monthly") periodDays = 30;
      else if (evalPeriod === "weekly") periodDays = 7;
      else if (evalPeriod === "custom")
        periodDays = config?.customPeriodDays || 15;

      // Use persisted start if exists and is within reasonable range
      const persistedStart = config?.currentPeriodStart
        ? new Date(config.currentPeriodStart)
        : null;

      // If persisted start is in the future or too recent with no sales,
      // fall back to periodDays ago
      startDate =
        persistedStart && persistedStart <= now ? persistedStart : startOfMonth;
      endDate = now;
    } else if (period === "all") {
      // Show all-time ranking
      startDate = new Date(0);
      endDate = now;
    } else {
      // Default to last 30 days if period is unrecognized
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
    }

    // Build the employee filter - only filter by allowedEmployees if it has entries
    // Otherwise, just ensure employee is not null
    const normalizedAllowedEmployees = allowedEmployees.flatMap((id) => {
      if (id instanceof mongoose.Types.ObjectId) return [id, id.toString()];
      if (typeof id === "string" && mongoose.isValidObjectId(id)) {
        return [new mongoose.Types.ObjectId(id), id];
      }
      return [id];
    });
    const employeeFilter =
      normalizedAllowedEmployees.length > 0
        ? {
            employee: {
              $in: normalizedAllowedEmployees,
            },
          }
        : { employee: { $ne: null } };

    let ranking = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startDate, $lte: endDate },
          // 💰 CASH FLOW: Solo ventas confirmadas para ranking
          paymentStatus: "confirmado",
          business: businessObjectId,
          ...employeeFilter,
        },
      },
      {
        $group: {
          _id: "$employee",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      { $sort: { totalRevenue: -1 } },
    ]);

    // Fallback 1: If no results in current period, try start of month
    let usedFallback = false;
    if (ranking.length === 0 && period === "current") {
      const fallbackStart = startOfMonth;
      ranking = await Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: fallbackStart, $lte: now },
            paymentStatus: "confirmado",
            business: businessObjectId,
            ...employeeFilter,
          },
        },
        {
          $group: {
            _id: "$employee",
            totalSales: { $sum: 1 },
            totalUnits: { $sum: "$quantity" },
            totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
            totalProfit: { $sum: "$totalProfit" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "employee",
          },
        },
        { $unwind: "$employee" },
        { $sort: { totalRevenue: -1 } },
      ]);
      if (ranking.length > 0) {
        startDate = fallbackStart;
        usedFallback = true;
      }
    }

    // Fallback 2: If still empty, try last 90 days
    if (ranking.length === 0 && period === "current") {
      const fallbackStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      ranking = await Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: fallbackStart, $lte: now },
            paymentStatus: "confirmado",
            business: businessObjectId,
            ...employeeFilter,
          },
        },
        {
          $group: {
            _id: "$employee",
            totalSales: { $sum: 1 },
            totalUnits: { $sum: "$quantity" },
            totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
            totalProfit: { $sum: "$totalProfit" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "employee",
          },
        },
        { $unwind: "$employee" },
        { $sort: { totalRevenue: -1 } },
      ]);
      if (ranking.length > 0) {
        startDate = fallbackStart;
        usedFallback = true;
      }
    }

    const employeeIds = ranking
      .map((r) => r.employee?._id || r._id)
      .filter(Boolean);
    const statsList = employeeIds.length
      ? await EmployeeStats.find({ employee: { $in: employeeIds } })
          .select("employee totalPoints currentLevel periodWins")
          .lean()
      : [];
    const statsMap = new Map(
      statsList.map((stat) => [stat.employee.toString(), stat]),
    );

    return {
      rankings: ranking.map((r, index) => {
        const employeeId = (r.employee?._id || r._id)?.toString();
        const stats = employeeId ? statsMap.get(employeeId) : null;
        return {
          employeeId: r.employee?._id || r._id,
          employeeName: r.employee?.name || "Empleado",
          employeeEmail: r.employee?.email || "",
          totalSales: r.totalSales || 0,
          totalUnits: r.totalUnits || 0,
          totalRevenue: r.totalRevenue || 0,
          totalProfit: r.totalProfit || 0,
          position: index + 1,
          totalPoints: stats?.totalPoints || 0,
          currentLevel: stats?.currentLevel || "Novato",
          periodWins: stats?.periodWins || 0,
          profitPercentage:
            r.totalRevenue > 0 ? (r.totalProfit / r.totalRevenue) * 100 : 0,
        };
      }),
      period: {
        startDate,
        endDate,
        type: config?.evaluationPeriod || "biweekly",
      },
      config: {
        topPerformerBonus: config?.topPerformerBonus || 0,
        secondPlaceBonus: config?.secondPlaceBonus || 0,
        thirdPlaceBonus: config?.thirdPlaceBonus || 0,
        top1CommissionBonus: config?.top1CommissionBonus || 0,
        top2CommissionBonus: config?.top2CommissionBonus || 0,
        top3CommissionBonus: config?.top3CommissionBonus || 0,
        evaluationPeriod: config?.evaluationPeriod,
        customPeriodDays: config?.customPeriodDays,
        currentPeriodStart: config?.currentPeriodStart,
      },
      usedFallback,
    };
  }

  async getEmployeeStats(employeeId) {
    let stats = await EmployeeStats.findOne({ employee: employeeId });

    if (!stats) {
      stats = await EmployeeStats.create({ employee: employeeId });
    }

    const pendingSales = await Sale.find({
      employee: employeeId,
      paymentStatus: "confirmado",
      gamificationPointsApplied: { $ne: true },
    })
      .populate("product")
      .lean();

    if (pendingSales.length > 0) {
      for (const sale of pendingSales) {
        await applySaleGamification({
          businessId: sale.business,
          sale,
          product: sale.product || null,
        });
      }

      stats = await EmployeeStats.findOne({ employee: employeeId });
    }

    return stats;
  }

  async recalculatePoints(businessId, employeeId = null) {
    const config = await GamificationConfig.findOne().lean();
    if (!config) {
      return { updatedEmployees: 0, updatedSales: 0 };
    }

    const allowedEmployees = employeeId
      ? [employeeId]
      : await this.getBusinessEmployeeIds(businessId);

    const normalizedEmployees = allowedEmployees.map((id) =>
      id instanceof mongoose.Types.ObjectId
        ? id
        : new mongoose.Types.ObjectId(id),
    );

    const salesFilter = {
      business: new mongoose.Types.ObjectId(businessId),
      paymentStatus: "confirmado",
      employee: { $in: normalizedEmployees },
    };

    const sales = await Sale.find(salesFilter).populate("product").lean();

    const totals = new Map();
    for (const sale of sales) {
      const points = computePointsForSale(config, sale, sale.product);
      const employeeKey = sale.employee.toString();
      const current = totals.get(employeeKey) || 0;
      totals.set(employeeKey, current + points);

      await Sale.updateOne(
        { _id: sale._id },
        {
          $set: {
            gamificationPoints: points,
            gamificationPointsApplied: true,
          },
        },
      );
    }

    let updatedEmployees = 0;
    for (const employee of normalizedEmployees) {
      const employeeKey = employee.toString();
      const totalPoints = totals.get(employeeKey) || 0;
      let stats = await EmployeeStats.findOne({ employee });

      if (!stats) {
        stats = await EmployeeStats.create({ employee });
      }

      stats.totalPoints = totalPoints;
      stats.currentMonthPoints = totalPoints;

      const level = resolveLevelForPoints(config.levels, totalPoints);
      stats.currentLevel = level?.name || "Novato";
      stats.currentLevelId = level?.id || 1;

      await stats.save();
      updatedEmployees += 1;
    }

    return { updatedEmployees, updatedSales: sales.length };
  }

  async getWinners(businessId, { limit = 20, page = 1 } = {}) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const normalizedLimit = Math.max(1, parseInt(limit, 10) || 20);
    const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [winners, total] = await Promise.all([
      PeriodWinner.find({ business: businessObjectId })
        .sort({ endDate: -1 })
        .skip(skip)
        .limit(normalizedLimit)
        .lean(),
      PeriodWinner.countDocuments({ business: businessObjectId }),
    ]);

    return {
      winners,
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        pages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  async markBonusPaid(businessId, winnerId) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const winner = await PeriodWinner.findOne({
      _id: winnerId,
      business: businessObjectId,
    });

    if (!winner) {
      return null;
    }

    if (!winner.bonusPaid) {
      winner.bonusPaid = true;
      winner.bonusPaidAt = new Date();
      await winner.save();
    }

    return winner;
  }
}
