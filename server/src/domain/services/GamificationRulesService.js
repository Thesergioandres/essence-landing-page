const DEFAULT_LEVELS = [
  { id: 1, name: "Novato", minPoints: 0, benefits: { commissionBonus: 0 } },
  { id: 2, name: "Pro", minPoints: 1000, benefits: { commissionBonus: 2.5 } },
  { id: 3, name: "Leyenda", minPoints: 5000, benefits: { commissionBonus: 5 } },
];

const ensureLevels = (levels) =>
  Array.isArray(levels) && levels.length > 0 ? levels : DEFAULT_LEVELS;

const sortLevels = (levels) =>
  [...levels].sort((a, b) => (a.minPoints || 0) - (b.minPoints || 0));

const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const matchesMultiplier = (multiplier, product, saleDate) => {
  if (!multiplier?.active) return false;
  const targetType = multiplier.targetType || "all";

  if (multiplier.type === "weekend" || targetType === "weekend") {
    return isWeekend(saleDate || new Date());
  }

  if (targetType === "all") return true;

  if (targetType === "product") {
    return product?._id?.toString() === String(multiplier.targetId || "");
  }

  if (targetType === "category") {
    return product?.category?.toString() === String(multiplier.targetId || "");
  }

  return false;
};

export const resolveLevelForPoints = (levels, points) => {
  const sorted = sortLevels(ensureLevels(levels));
  let current = sorted[0];
  for (const level of sorted) {
    if ((points || 0) >= (level.minPoints || 0)) {
      current = level;
    }
  }
  return current;
};

export const computePointsForSale = (config, sale, product) => {
  const rules = config?.generalRules || {};
  const pointsPerCurrencyUnit = Number(rules.pointsPerCurrencyUnit || 0);
  const pointsPerSaleConfirmed = Number(rules.pointsPerSaleConfirmed || 0);
  const pointsBase = rules.pointsBase || "sale";

  const saleAmount =
    sale.actualPayment !== null && sale.actualPayment !== undefined
      ? Number(sale.actualPayment || 0)
      : (sale.salePrice || 0) * (sale.quantity || 0);

  let pointsAmount = saleAmount;
  if (pointsBase === "commission") {
    const distributorProfit = Number(sale.distributorProfit || 0);
    if (distributorProfit > 0) {
      pointsAmount = distributorProfit;
    } else if (sale.distributorProfitPercentage) {
      pointsAmount =
        saleAmount * (Number(sale.distributorProfitPercentage) / 100);
    }
  }

  let points = pointsAmount * pointsPerCurrencyUnit + pointsPerSaleConfirmed;

  const multipliers = Array.isArray(config?.activeMultipliers)
    ? config.activeMultipliers
    : [];

  let multiplierValue = 1;
  for (const multiplier of multipliers) {
    if (matchesMultiplier(multiplier, product, sale.saleDate)) {
      const value = Number(multiplier.value || 1);
      if (value > 0) {
        multiplierValue *= value;
      }
    }
  }

  points *= multiplierValue;
  return Math.max(0, Math.round(points));
};
