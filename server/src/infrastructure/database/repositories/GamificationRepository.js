import mongoose from "mongoose";
import DistributorStats from "../../../../models/DistributorStats.js";
import GamificationConfig from "../../../../models/GamificationConfig.js";
import Membership from "../../../../models/Membership.js";
import PeriodWinner from "../../../../models/PeriodWinner.js";
import Sale from "../../../../models/Sale.js";
import { getDistributorCommissionInfo } from "../../../../utils/distributorPricing.js";

export class GamificationRepository {
  async getBusinessDistributorIds(businessId) {
    const memberships = await Membership.find({
      business: businessId,
      status: "active",
      role: { $in: ["distribuidor"] },
    }).select("user");
    return memberships.map((m) => m.user);
  }

  async getAdjustedCommission(distributorId, businessId) {
    const info = await getDistributorCommissionInfo(distributorId, businessId);
    return {
      position: info.position,
      bonusCommission: info.bonusCommission,
      periodStart: info.periodStart,
      periodEnd: info.periodEnd,
      totalDistributors: info.totalDistributors,
    };
  }

  async checkAndEvaluatePeriod(businessId) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const allowedDistributors =
      await this.getBusinessDistributorIds(businessId);

    const config = await GamificationConfig.findOne();

    if (!config || !config.autoEvaluate) {
      return { message: "Auto-evaluación desactivada" };
    }

    const now = new Date();
    const startDate = config.currentPeriodStart || now;
    let periodDuration = 15;

    if (config.evaluationPeriod === "biweekly") periodDuration = 15;
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

    const topDistributors = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startDate, $lte: endDate },
          paymentStatus: "confirmado",
          business: businessObjectId,
          ...(allowedDistributors.length
            ? { distributor: { $in: allowedDistributors } }
            : {}),
        },
      },
      {
        $group: {
          _id: "$distributor",
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
          as: "distributor",
        },
      },
      { $unwind: "$distributor" },
      { $sort: { totalRevenue: -1 } },
      { $limit: 3 },
    ]);

    if (topDistributors.length === 0) {
      config.currentPeriodStart = now;
      await config.save();
      return {
        message: "No hay ventas en el período, iniciando nuevo período",
        newPeriodStart: now,
      };
    }

    const winner = topDistributors[0];
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
      winnerName: winner.distributor.name,
      winnerEmail: winner.distributor.email,
      totalSales: winner.totalSales,
      totalRevenue: winner.totalRevenue,
      totalProfit: winner.totalProfit,
      salesCount: winner.totalSales,
      bonusAmount: bonuses[0],
      topPerformers: topDistributors.map((dist, index) => ({
        distributor: dist._id,
        position: index + 1,
        totalRevenue: dist.totalRevenue,
        salesCount: dist.totalSales,
        bonus: bonuses[index] || 0,
      })),
      notes: "Evaluación automática del sistema",
    });

    for (let i = 0; i < topDistributors.length; i++) {
      const dist = topDistributors[i];
      let stats = await DistributorStats.findOne({ distributor: dist._id });

      if (!stats) {
        stats = await DistributorStats.create({ distributor: dist._id });
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

    return {
      message: "Período evaluado automáticamente",
      winner: periodWinner,
      newPeriodStart: now,
    };
  }

  async getConfig() {
    let config = await GamificationConfig.findOne();

    if (!config) {
      config = await GamificationConfig.create({
        evaluationPeriod: "biweekly",
        customPeriodDays: 15,
        topPerformerBonus: 50000,
        secondPlaceBonus: 0,
        thirdPlaceBonus: 0,
        top1CommissionBonus: 5,
        top2CommissionBonus: 3,
        top3CommissionBonus: 2,
        autoEvaluate: true,
        currentPeriodStart: new Date(),
        salesTargets: [
          { level: "bronze", minAmount: 10000, bonus: 200, badge: "🥉" },
          { level: "silver", minAmount: 25000, bonus: 500, badge: "🥈" },
          { level: "gold", minAmount: 50000, bonus: 1000, badge: "🥇" },
          { level: "platinum", minAmount: 100000, bonus: 2500, badge: "💎" },
        ],
      });
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

  async getRanking(businessId, period = "current") {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const allowedDistributors =
      await this.getBusinessDistributorIds(businessId);
    const config = await GamificationConfig.findOne();

    let startDate, endDate;

    if (period === "current") {
      const now = new Date();
      const persistedStart = config?.currentPeriodStart
        ? new Date(config.currentPeriodStart)
        : null;

      const evalPeriod = config?.evaluationPeriod || "biweekly";
      let periodDays = 15;
      if (evalPeriod === "monthly") periodDays = 30;
      else if (evalPeriod === "weekly") periodDays = 7;
      else if (evalPeriod === "custom")
        periodDays = config?.customPeriodDays || 15;

      startDate =
        persistedStart ||
        new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
      endDate = now;
    }

    const ranking = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startDate, $lte: endDate },
          paymentStatus: "confirmado",
          business: businessObjectId,
          ...(allowedDistributors.length
            ? { distributor: { $in: allowedDistributors } }
            : {}),
        },
      },
      {
        $group: {
          _id: "$distributor",
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
          as: "distributor",
        },
      },
      { $unwind: "$distributor" },
      { $sort: { totalRevenue: -1 } },
    ]);

    return {
      ranking: ranking.map((r, index) => ({
        position: index + 1,
        distributor: r.distributor,
        totalSales: r.totalSales,
        totalRevenue: r.totalRevenue,
        totalProfit: r.totalProfit,
      })),
      periodStart: startDate,
      periodEnd: endDate,
    };
  }

  async getDistributorStats(distributorId) {
    let stats = await DistributorStats.findOne({ distributor: distributorId });

    if (!stats) {
      stats = await DistributorStats.create({ distributor: distributorId });
    }

    return stats;
  }
}
