import { CommissionPolicyService } from "../../domain/services/CommissionPolicyService.js";
import { resolveLevelForPoints } from "../../domain/services/GamificationRulesService.js";
import DistributorStats from "../database/models/DistributorStats.js";
import GamificationConfig from "../database/models/GamificationConfig.js";
import Sale from "../database/models/Sale.js";
import User from "../database/models/User.js";

const DEFAULT_BASE_COMMISSION =
  CommissionPolicyService.getDefaultBaseCommission();

export const getDistributorCommissionInfo = async (
  distributorId,
  businessId = null,
) => {
  try {
    const user = await User.findById(distributorId)
      .select("fixedCommissionOnly isCommissionFixed customCommissionRate")
      .lean();

    const isCommissionFixed = Boolean(
      user?.isCommissionFixed || user?.fixedCommissionOnly,
    );

    if (isCommissionFixed) {
      const normalizedFixedRate =
        CommissionPolicyService.normalizeCommissionRate(
          user?.customCommissionRate,
          DEFAULT_BASE_COMMISSION,
        );

      return {
        position: null,
        bonusCommission: 0,
        profitPercentage: normalizedFixedRate,
        periodStart: null,
        periodEnd: null,
        totalDistributors: 0,
        isCommissionFixed: true,
        customCommissionRate: normalizedFixedRate,
      };
    }

    const config = await GamificationConfig.findOne();

    if (!config) {
      return {
        position: null,
        bonusCommission: 0,
        profitPercentage: DEFAULT_BASE_COMMISSION,
        periodStart: null,
        periodEnd: null,
        totalDistributors: 0,
      };
    }

    const baseCommissionPercentage =
      CommissionPolicyService.normalizeCommissionRate(
        config.baseCommissionPercentage,
        DEFAULT_BASE_COMMISSION,
      );

    const { startDate, endDate } =
      CommissionPolicyService.getEvaluationPeriodRange(config);

    const minAdminProfitForRanking =
      typeof config.minAdminProfitForRanking === "number"
        ? config.minAdminProfitForRanking
        : 0;

    const pipeline = [
      {
        $match: {
          distributor: { $exists: true, $ne: null },
          saleDate: { $gte: startDate, $lte: endDate },
          paymentStatus: "confirmado",
          ...(businessId ? { business: businessId } : {}),
        },
      },
      {
        $group: {
          _id: "$distributor",
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalAdminProfit: { $sum: "$adminProfit" },
        },
      },
    ];

    if (minAdminProfitForRanking > 0) {
      pipeline.push({
        $match: { totalAdminProfit: { $gte: minAdminProfitForRanking } },
      });
    }

    pipeline.push({ $sort: { totalRevenue: -1 } });

    const rankings = await Sale.aggregate(pipeline);

    const position =
      rankings.findIndex((r) => r._id.toString() === distributorId.toString()) +
      1;

    const stats = await DistributorStats.findOne({
      distributor: distributorId,
    }).lean();
    const level = resolveLevelForPoints(
      config?.levels,
      stats?.totalPoints || 0,
    );
    const bonusCommission = level?.benefits?.commissionBonus || 0;

    return {
      position: position || null,
      bonusCommission,
      profitPercentage: baseCommissionPercentage + bonusCommission,
      level: level?.name || null,
      periodStart: startDate,
      periodEnd: endDate,
      totalDistributors: rankings.length,
      isCommissionFixed: false,
      customCommissionRate: null,
    };
  } catch (error) {
    console.error("Error calculando comisión distribuidor:", error);
    return {
      position: null,
      bonusCommission: 0,
      profitPercentage: DEFAULT_BASE_COMMISSION,
      periodStart: null,
      periodEnd: null,
      totalDistributors: 0,
      isCommissionFixed: false,
      customCommissionRate: null,
    };
  }
};

export const getDistributorProfitPercentage = async (
  distributorId,
  businessId = null,
) => {
  try {
    const info = await getDistributorCommissionInfo(distributorId, businessId);
    return info.profitPercentage;
  } catch (error) {
    console.error("Error calculando porcentaje distribuidor:", error);
    return DEFAULT_BASE_COMMISSION;
  }
};

export const calculateDistributorPrice = async (
  purchasePrice,
  distributorId,
  businessId = null,
) => {
  const profitPercentage = await getDistributorProfitPercentage(
    distributorId,
    businessId,
  );

  const distributorPrice = purchasePrice / (1 - profitPercentage / 100);

  return Math.round(distributorPrice);
};
