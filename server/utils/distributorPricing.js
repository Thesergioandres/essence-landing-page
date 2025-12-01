import Sale from "../models/Sale.js";
import GamificationConfig from "../models/GamificationConfig.js";

/**
 * Calcula el porcentaje de ganancia del distribuidor según su posición en el ranking
 * @param {String} distributorId - ID del distribuidor
 * @returns {Promise<Number>} - Porcentaje de ganancia (20, 21, 23, o 25)
 */
export const getDistributorProfitPercentage = async (distributorId) => {
  try {
    const config = await GamificationConfig.findOne();
    
    if (!config) {
      return 20; // Porcentaje base si no hay configuración
    }

    // Obtener período actual
    const now = new Date();
    let startDate, endDate;

    if (config.evaluationPeriod === "biweekly") {
      startDate = config.currentPeriodStart || now;
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 15);
    } else if (config.evaluationPeriod === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (config.evaluationPeriod === "weekly") {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59);
    } else {
      // Por defecto, mes actual
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Calcular ranking actual
    const rankings = await Sale.aggregate([
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
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    // Encontrar posición del distribuidor
    const position = rankings.findIndex(
      (r) => r._id.toString() === distributorId.toString()
    ) + 1;

    // Asignar porcentaje según posición
    if (position === 1) return 25; // 🥇 +5% sobre base de 20%
    if (position === 2) return 23; // 🥈 +3% sobre base de 20%
    if (position === 3) return 21; // 🥉 +1% sobre base de 20%
    
    return 20; // Resto mantiene el 20% base
  } catch (error) {
    console.error("Error calculando porcentaje distribuidor:", error);
    return 20; // En caso de error, retornar base
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
