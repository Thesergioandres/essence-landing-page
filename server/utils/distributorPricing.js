import DistributorStats from "../models/DistributorStats.js";
import GamificationConfig from "../models/GamificationConfig.js";
import Sale from "../src/infrastructure/database/models/Sale.js";
import User from "../src/infrastructure/database/models/User.js";
import { resolveLevelForPoints } from "./gamificationEngine.js";

const DEFAULT_BASE_COMMISSION = 20;

const getPeriodRange = (config) => {
  const now = new Date();
  let startDate;
  let endDate;

  const cycle = config?.cycle?.duration;
  if (cycle === "quarterly") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    endDate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
  } else if (cycle === "annual") {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (cycle === "custom" && config?.cycle?.customDays) {
    startDate = new Date(
      now.getTime() - config.cycle.customDays * 24 * 60 * 60 * 1000,
    );
    endDate = now;
  } else if (config?.evaluationPeriod === "biweekly") {
    startDate = config.currentPeriodStart || now;
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 15);
  } else if (config?.evaluationPeriod === "weekly") {
    const dayOfWeek = now.getDay();
    startDate = new Date(now);
    startDate.setDate(now.getDate() - dayOfWeek);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else if (config?.evaluationPeriod === "monthly") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
  } else {
    // Por defecto, mes actual
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
  }

  return { startDate, endDate };
};

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
    const fixedRate = Number(user?.customCommissionRate);
    const normalizedFixedRate = Number.isFinite(fixedRate)
      ? Math.max(0, Math.min(95, fixedRate))
      : DEFAULT_BASE_COMMISSION;

    if (isCommissionFixed) {
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
      typeof config.baseCommissionPercentage === "number"
        ? config.baseCommissionPercentage
        : DEFAULT_BASE_COMMISSION;

    const { startDate, endDate } = getPeriodRange(config);

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
    });
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

/**
 * Calcula el porcentaje de ganancia del distribuidor según su posición en el ranking
 * @param {String} distributorId - ID del distribuidor
 * @returns {Promise<Number>} - Porcentaje de ganancia (20, 21, 23, o 25)
 */
export const getDistributorProfitPercentage = async (
  distributorId,
  businessId = null,
) => {
  try {
    const info = await getDistributorCommissionInfo(distributorId, businessId);
    return info.profitPercentage;
  } catch (error) {
    console.error("Error calculando porcentaje distribuidor:", error);
    return DEFAULT_BASE_COMMISSION; // En caso de error, retornar base
  }
};

/**
 * Calcula el precio de venta para el distribuidor según su ranking
 * Formula: purchasePrice / (1 - profitPercentage/100)
 * @param {Number} purchasePrice - Precio de compra del producto
 * @param {String} distributorId - ID del distribuidor
 * @returns {Promise<Number>} - Precio de venta para distribuidor
 */
export const calculateDistributorPrice = async (
  purchasePrice,
  distributorId,
  businessId = null,
) => {
  const profitPercentage = await getDistributorProfitPercentage(
    distributorId,
    businessId,
  );

  // Calcular precio para que el distribuidor gane exactamente su porcentaje
  // Si el distribuidor gana X% del precio de venta:
  // Precio de venta = Precio compra / (1 - X/100)
  const distributorPrice = purchasePrice / (1 - profitPercentage / 100);

  return Math.round(distributorPrice); // Redondear a entero
};
