import {
  computePointsForSale,
  resolveLevelForPoints,
} from "../../domain/services/GamificationRulesService.js";
import DistributorStats from "../database/models/DistributorStats.js";
import GamificationConfig from "../database/models/GamificationConfig.js";
import Sale from "../database/models/Sale.js";

export { computePointsForSale, resolveLevelForPoints };

export const getCommissionBonusForDistributor = async (distributorId) => {
  const config = await GamificationConfig.findOne().lean();
  const stats = await DistributorStats.findOne({ distributor: distributorId });
  const points = stats?.totalPoints || 0;
  const level = resolveLevelForPoints(config?.levels, points);

  return {
    level,
    bonusCommission: level?.benefits?.commissionBonus || 0,
  };
};

export const applySaleGamification = async ({ businessId, sale, product }) => {
  if (!sale?.distributor) return null;

  const config = await GamificationConfig.findOne().lean();
  if (!config) return null;

  if (sale.gamificationPointsApplied) return null;

  const points = computePointsForSale(config, sale, product);

  const stats =
    (await DistributorStats.findOne({ distributor: sale.distributor })) ||
    (await DistributorStats.create({ distributor: sale.distributor }));

  stats.totalPoints = (stats.totalPoints || 0) + points;
  stats.currentMonthPoints = (stats.currentMonthPoints || 0) + points;

  const level = resolveLevelForPoints(config.levels, stats.totalPoints);
  stats.currentLevel = level?.name || stats.currentLevel || "Novato";
  stats.currentLevelId = level?.id || stats.currentLevelId || 1;

  await stats.save();
  await Sale.updateOne(
    { _id: sale._id },
    {
      $set: {
        gamificationPoints: points,
        gamificationLevel: level?.name || "",
        gamificationPointsApplied: true,
      },
    },
  );

  return { points, level };
};

export const rollbackSaleGamification = async ({ sale }) => {
  if (!sale?.distributor) return null;
  if (!sale.gamificationPointsApplied) return null;

  const points = Math.max(0, Number(sale.gamificationPoints || 0));
  if (!points) return null;

  const config = await GamificationConfig.findOne().lean();
  const stats = await DistributorStats.findOne({
    distributor: sale.distributor,
  });
  if (!stats) return null;

  stats.totalPoints = Math.max(0, (stats.totalPoints || 0) - points);
  stats.currentMonthPoints = Math.max(
    0,
    (stats.currentMonthPoints || 0) - points,
  );

  const level = resolveLevelForPoints(config?.levels, stats.totalPoints);
  stats.currentLevel = level?.name || "Novato";
  stats.currentLevelId = level?.id || 1;

  await stats.save();
  return { points, level };
};
