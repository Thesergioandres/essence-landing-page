import { CommissionPolicyService } from "../../domain/services/CommissionPolicyService.js";
import { resolveLevelForPoints } from "../../domain/services/GamificationRulesService.js";
import EmployeeStats from "../database/models/EmployeeStats.js";
import GamificationConfig from "../database/models/GamificationConfig.js";
import Sale from "../database/models/Sale.js";
import User from "../database/models/User.js";

const DEFAULT_BASE_COMMISSION =
  CommissionPolicyService.getDefaultBaseCommission();

export const getEmployeeCommissionInfo = async (
  employeeId,
  businessId = null,
) => {
  try {
    const user = await User.findById(employeeId)
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
        totalEmployees: 0,
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
        totalEmployees: 0,
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
          employee: { $exists: true, $ne: null },
          saleDate: { $gte: startDate, $lte: endDate },
          paymentStatus: "confirmado",
          ...(businessId ? { business: businessId } : {}),
        },
      },
      {
        $group: {
          _id: "$employee",
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
      rankings.findIndex((r) => r._id.toString() === employeeId.toString()) +
      1;

    const stats = await EmployeeStats.findOne({
      employee: employeeId,
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
      totalEmployees: rankings.length,
      isCommissionFixed: false,
      customCommissionRate: null,
    };
  } catch (error) {
    console.error("Error calculando comisión employee:", error);
    return {
      position: null,
      bonusCommission: 0,
      profitPercentage: DEFAULT_BASE_COMMISSION,
      periodStart: null,
      periodEnd: null,
      totalEmployees: 0,
      isCommissionFixed: false,
      customCommissionRate: null,
    };
  }
};

export const getEmployeeProfitPercentage = async (
  employeeId,
  businessId = null,
) => {
  try {
    const info = await getEmployeeCommissionInfo(employeeId, businessId);
    return info.profitPercentage;
  } catch (error) {
    console.error("Error calculando porcentaje employee:", error);
    return DEFAULT_BASE_COMMISSION;
  }
};

export const calculateEmployeePrice = async (
  purchasePrice,
  employeeId,
  businessId = null,
) => {
  const profitPercentage = await getEmployeeProfitPercentage(
    employeeId,
    businessId,
  );

  const employeePrice = purchasePrice / (1 - profitPercentage / 100);

  return Math.round(employeePrice);
};
