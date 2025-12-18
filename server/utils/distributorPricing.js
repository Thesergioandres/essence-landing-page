import Sale from "../models/Sale.js";
import GamificationConfig from "../models/GamificationConfig.js";

const BASE_PROFIT_PERCENTAGE = 20;

const getPeriodRange = (config) => {
  const now = new Date();
  let startDate;
  let endDate;

  if (config?.evaluationPeriod === "biweekly") {
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
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    // Por defecto, mes actual
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { startDate, endDate };
};

export const getDistributorCommissionInfo = async (distributorId) => {
  try {
    const config = await GamificationConfig.findOne();

    if (!config) {
      return {
        position: null,
        bonusCommission: 0,
        profitPercentage: BASE_PROFIT_PERCENTAGE,
        periodStart: null,
        periodEnd: null,
        totalDistributors: 0,
      };
    }

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

    let bonusCommission = 0;
    if (position === 1) bonusCommission = config.top1CommissionBonus || 0;
    else if (position === 2) bonusCommission = config.top2CommissionBonus || 0;
    else if (position === 3) bonusCommission = config.top3CommissionBonus || 0;

    return {
      position: position || null,
      bonusCommission,
      profitPercentage: BASE_PROFIT_PERCENTAGE + bonusCommission,
      periodStart: startDate,
      periodEnd: endDate,
      totalDistributors: rankings.length,
    };
  } catch (error) {
    console.error("Error calculando comisión distribuidor:", error);
    return {
      position: null,
      bonusCommission: 0,
      profitPercentage: BASE_PROFIT_PERCENTAGE,
      periodStart: null,
      periodEnd: null,
      totalDistributors: 0,
    };
  }
};

/**
 * Calcula el porcentaje de ganancia del distribuidor según su posición en el ranking
 * @param {String} distributorId - ID del distribuidor
 * @returns {Promise<Number>} - Porcentaje de ganancia (20, 21, 23, o 25)
 */
export const getDistributorProfitPercentage = async (distributorId) => {
  try {
    const info = await getDistributorCommissionInfo(distributorId);
    return info.profitPercentage;
  } catch (error) {
    console.error("Error calculando porcentaje distribuidor:", error);
    return BASE_PROFIT_PERCENTAGE; // En caso de error, retornar base
  }
};

/**
 * Calcula el precio de venta para el distribuidor según su ranking
 * Formula: purchasePrice / (1 - profitPercentage/100)
 * @param {Number} purchasePrice - Precio de compra del producto
 * @param {String} distributorId - ID del distribuidor
 * @returns {Promise<Number>} - Precio de venta para distribuidor
 */
export const calculateDistributorPrice = async (purchasePrice, distributorId) => {
  const profitPercentage = await getDistributorProfitPercentage(distributorId);
  
  // Calcular precio para que el distribuidor gane exactamente su porcentaje
  // Si el distribuidor gana X% del precio de venta:
  // Precio de venta = Precio compra / (1 - X/100)
  const distributorPrice = purchasePrice / (1 - profitPercentage / 100);
  
  return Math.round(distributorPrice); // Redondear a entero
};
