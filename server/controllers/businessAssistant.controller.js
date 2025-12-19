import { getRedisClient } from "../config/redis.js";
import { getBusinessAssistantQueue } from "../jobs/businessAssistant.queue.js";
import { invalidateCache } from "../middleware/cache.middleware.js";
import BusinessAssistantConfig from "../models/BusinessAssistantConfig.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const safeDiv = (num, den) => {
  const n = Number(num) || 0;
  const d = Number(den) || 0;
  if (!d) return 0;
  return n / d;
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const clamp01 = (n) => clamp(n, 0, 1);

const severityFromDaysCover = (daysCover) => {
  if (daysCover === null || daysCover === undefined) return "info";
  const d = Number(daysCover);
  if (!Number.isFinite(d)) return "info";
  if (d <= 3) return "critical";
  if (d <= 7) return "high";
  if (d <= 14) return "medium";
  return "low";
};

const severityFromMarginPct = (marginPct) => {
  const m = Number(marginPct);
  if (!Number.isFinite(m)) return "info";
  if (m < 0) return "critical";
  if (m < 5) return "high";
  if (m < 15) return "medium";
  return "low";
};

const severityFromTrendPct = (trendPct) => {
  const t = Number(trendPct);
  if (!Number.isFinite(t)) return "info";
  if (t <= -60) return "high";
  if (t <= -30) return "medium";
  if (t >= 60) return "medium";
  if (t >= 30) return "low";
  return "info";
};

const buildColombiaSaleDateFilter = (startDateStr, endDateStr) => {
  if (!startDateStr && !endDateStr) return null;

  const saleDate = {};

  if (startDateStr) {
    const date = new Date(startDateStr);
    saleDate.$gte = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        5,
        0,
        0,
        0
      )
    );
  }

  if (endDateStr) {
    const date = new Date(endDateStr);
    saleDate.$lte = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1,
        4,
        59,
        59,
        999
      )
    );
  }

  return saleDate;
};

const pickPrimaryAction = (actions) => {
  if (!actions.length) return null;

  const priority = {
    buy_more_inventory: 1,
    pause_purchases: 2,
    decrease_price: 3,
    clearance: 3,
    run_promotion: 4,
    increase_price: 5,
    review_margin: 6,
    keep: 99,
  };

  return [...actions].sort((a, b) => {
    const pA = priority[a.action] ?? 50;
    const pB = priority[b.action] ?? 50;
    if (pA !== pB) return pA - pB;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  })[0];
};

const computeImpactScore = (impact) => {
  if (!impact) return 0;
  const revenue = Number(impact.revenueCop) || 0;
  const profit = Number(impact.profitCop) || 0;
  const inventory = Number(impact.inventoryValueCop) || 0;
  // ponderación simple: ingresos + oportunidad + 20% del inventario inmovilizado
  return revenue + profit + inventory * 0.2;
};

const calcPriceForMargin = (costCop, marginPct) => {
  const cost = Number(costCop) || 0;
  const m = Number(marginPct);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  if (!Number.isFinite(m)) return null;
  const margin = clamp(m / 100, 0, 0.95);
  const price = safeDiv(cost, 1 - margin);
  return price > 0 ? price : null;
};

const pickCurrentPriceCop = ({
  recentAvgPrice,
  clientPrice,
  suggestedPrice,
  distributorPrice,
}) => {
  const candidates = [
    clientPrice,
    suggestedPrice,
    distributorPrice,
    recentAvgPrice,
  ]
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  return candidates.length ? candidates[0] : null;
};

const buildPriceSuggestion = ({
  actionPct,
  currentPriceCop,
  purchasePriceCop,
  targetMarginPct,
  minMarginAfterDiscountPct,
}) => {
  const current = Number(currentPriceCop);
  const cost = Number(purchasePriceCop);

  if (!Number.isFinite(current) || current <= 0) return null;
  if (!Number.isFinite(cost) || cost <= 0) return null;

  const pct = Number(actionPct) || 0;
  const rawSuggested = current * (1 + pct / 100);

  const floorPrice = calcPriceForMargin(cost, minMarginAfterDiscountPct);
  const targetPrice = calcPriceForMargin(cost, targetMarginPct);

  const clampedSuggested =
    floorPrice !== null ? Math.max(rawSuggested, floorPrice) : rawSuggested;

  return {
    currentPriceCop: round2(current),
    suggestedPriceCop: round2(clampedSuggested),
    rawSuggestedPriceCop: round2(rawSuggested),
    floorPriceCop: floorPrice !== null ? round2(floorPrice) : null,
    targetPriceCop: targetPrice !== null ? round2(targetPrice) : null,
    targetMarginPct: Number.isFinite(Number(targetMarginPct))
      ? Number(targetMarginPct)
      : null,
    minMarginAfterDiscountPct: Number.isFinite(
      Number(minMarginAfterDiscountPct)
    )
      ? Number(minMarginAfterDiscountPct)
      : null,
    effectiveChangePct: round2(
      safeDiv(clampedSuggested - current, current) * 100
    ),
  };
};

let _configCache = null;
let _configCacheAt = 0;
const CONFIG_CACHE_MS = 30_000;

const getOrCreateBusinessAssistantConfig = async () => {
  const now = Date.now();
  if (_configCache && now - _configCacheAt < CONFIG_CACHE_MS)
    return _configCache;

  let config = await BusinessAssistantConfig.findOne();
  if (!config) {
    config = await BusinessAssistantConfig.create({});
  }

  _configCache = config;
  _configCacheAt = now;
  return config;
};

const parseNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const buildCacheKey = ({
  configUpdatedAtMs,
  horizonDays,
  recentDays,
  startDateStr,
  endDateStr,
}) => {
  return `cache:businessAssistant:recommendations:v${configUpdatedAtMs}:${horizonDays}:${recentDays}:${
    startDateStr || ""
  }:${endDateStr || ""}`;
};

export const generateBusinessAssistantRecommendations = async ({
  horizonDays,
  recentDays,
  startDate,
  endDate,
  redis,
  bypassCache = false,
} = {}) => {
  const config = await getOrCreateBusinessAssistantConfig();

  const effectiveHorizonDays = parseNumber(
    horizonDays,
    config.horizonDaysDefault || 90
  );
  const effectiveRecentDays = parseNumber(
    recentDays,
    config.recentDaysDefault || 30
  );

  const startDateStr = startDate || null;
  const endDateStr = endDate || null;

  const configUpdatedAtMs = config.updatedAt
    ? new Date(config.updatedAt).getTime()
    : 0;

  const cacheEnabled = Boolean(config.cacheEnabled);
  const ttlSeconds = parseNumber(config.cacheTtlSeconds, 300);

  const cacheKey = buildCacheKey({
    configUpdatedAtMs,
    horizonDays: effectiveHorizonDays,
    recentDays: effectiveRecentDays,
    startDateStr,
    endDateStr,
  });

  const canUseRedis = redis && cacheEnabled && ttlSeconds > 0;

  if (!bypassCache && canUseRedis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return {
        __meta: { cache: "HIT" },
        ...JSON.parse(cached),
      };
    }
  }

  const now = new Date();
  const horizonStart = new Date(now);
  horizonStart.setDate(now.getDate() - effectiveHorizonDays);

  const recentStart = new Date(now);
  recentStart.setDate(now.getDate() - effectiveRecentDays);

  const previousStart = new Date(now);
  previousStart.setDate(now.getDate() - effectiveRecentDays * 2);

  const explicitRange = buildColombiaSaleDateFilter(startDateStr, endDateStr);

  const matchSaleDate = explicitRange
    ? explicitRange
    : {
        $gte: horizonStart,
        $lte: now,
      };

  const salesAgg = await Sale.aggregate([
    {
      $match: {
        paymentStatus: "confirmado",
        saleDate: matchSaleDate,
      },
    },
    {
      $group: {
        _id: "$product",

        totalUnits: { $sum: "$quantity" },
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
        totalProfit: { $sum: "$totalProfit" },

        recentUnits: {
          $sum: {
            $cond: [{ $gte: ["$saleDate", recentStart] }, "$quantity", 0],
          },
        },
        recentSales: {
          $sum: { $cond: [{ $gte: ["$saleDate", recentStart] }, 1, 0] },
        },
        recentRevenue: {
          $sum: {
            $cond: [
              { $gte: ["$saleDate", recentStart] },
              { $multiply: ["$salePrice", "$quantity"] },
              0,
            ],
          },
        },
        recentProfit: {
          $sum: {
            $cond: [{ $gte: ["$saleDate", recentStart] }, "$totalProfit", 0],
          },
        },
        recentWeightedPriceSum: {
          $sum: {
            $cond: [
              { $gte: ["$saleDate", recentStart] },
              { $multiply: ["$salePrice", "$quantity"] },
              0,
            ],
          },
        },

        prevUnits: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$saleDate", previousStart] },
                  { $lt: ["$saleDate", recentStart] },
                ],
              },
              "$quantity",
              0,
            ],
          },
        },
        prevRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$saleDate", previousStart] },
                  { $lt: ["$saleDate", recentStart] },
                ],
              },
              { $multiply: ["$salePrice", "$quantity"] },
              0,
            ],
          },
        },
        prevProfit: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$saleDate", previousStart] },
                  { $lt: ["$saleDate", recentStart] },
                ],
              },
              "$totalProfit",
              0,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        productId: "$_id",
        productName: "$product.name",
        category: "$product.category",

        purchasePrice: "$product.purchasePrice",
        distributorPrice: "$product.distributorPrice",
        suggestedPrice: "$product.suggestedPrice",
        clientPrice: "$product.clientPrice",

        warehouseStock: "$product.warehouseStock",
        totalStock: "$product.totalStock",
        lowStockAlert: "$product.lowStockAlert",

        totalUnits: 1,
        totalSales: 1,
        totalRevenue: 1,
        totalProfit: 1,

        recentUnits: 1,
        recentSales: 1,
        recentRevenue: 1,
        recentProfit: 1,
        recentWeightedPriceSum: 1,

        prevUnits: 1,
        prevRevenue: 1,
        prevProfit: 1,
      },
    },
  ]);

  const allProducts = await Product.find({}).select(
    "name category purchasePrice distributorPrice suggestedPrice clientPrice warehouseStock totalStock lowStockAlert"
  );

  const categoryIds = Array.from(
    new Set(
      allProducts
        .map((p) => p.category)
        .filter(Boolean)
        .map((id) => String(id))
    )
  );
  const categories = categoryIds.length
    ? await Category.find({ _id: { $in: categoryIds } }).select("name")
    : [];
  const categoryNameById = new Map(
    (categories || []).map((c) => [String(c._id), c.name])
  );

  const byProductId = new Map();
  salesAgg.forEach((r) => {
    if (!r?.productId) return;
    byProductId.set(String(r.productId), r);
  });

  const productsUnified = allProducts.map((p) => {
    const id = String(p._id);
    const row = byProductId.get(id);
    if (row) return row;

    return {
      productId: p._id,
      productName: p.name,
      category: p.category,

      purchasePrice: p.purchasePrice,
      distributorPrice: p.distributorPrice,
      suggestedPrice: p.suggestedPrice,
      clientPrice: p.clientPrice,

      warehouseStock: p.warehouseStock,
      totalStock: p.totalStock,
      lowStockAlert: p.lowStockAlert,

      totalUnits: 0,
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,

      recentUnits: 0,
      recentSales: 0,
      recentRevenue: 0,
      recentProfit: 0,
      recentWeightedPriceSum: 0,

      prevUnits: 0,
      prevRevenue: 0,
      prevProfit: 0,
    };
  });

  const categoryStats = new Map();
  productsUnified.forEach((p) => {
    const categoryKey = p.category ? String(p.category) : "__no_category__";
    const units = Number(p.recentUnits) || 0;
    const revenue = Number(p.recentRevenue) || 0;
    if (!categoryStats.has(categoryKey)) {
      categoryStats.set(categoryKey, { units: 0, revenue: 0 });
    }
    const agg = categoryStats.get(categoryKey);
    agg.units += units;
    agg.revenue += revenue;
  });

  const categoryAvgPrice = new Map();
  for (const [key, agg] of categoryStats.entries()) {
    const avg = safeDiv(agg.revenue, agg.units);
    categoryAvgPrice.set(key, avg);
  }

  const daysCoverLowThreshold = parseNumber(config.daysCoverLowThreshold, 14);
  const buyTargetDays = parseNumber(config.buyTargetDays, 30);
  const lowRotationUnitsThreshold = parseNumber(
    config.lowRotationUnitsThreshold,
    1
  );
  const highStockMultiplier = parseNumber(config.highStockMultiplier, 2);
  const highStockMinUnits = parseNumber(config.highStockMinUnits, 10);

  const trendDropThresholdPct = parseNumber(config.trendDropThresholdPct, -20);
  const trendGrowthThresholdPct = parseNumber(
    config.trendGrowthThresholdPct,
    20
  );
  const minUnitsForGrowthStrategy = parseNumber(
    config.minUnitsForGrowthStrategy,
    10
  );

  const marginLowThresholdPct = parseNumber(config.marginLowThresholdPct, 15);

  const targetMarginPct = parseNumber(config.targetMarginPct, 25);
  const minMarginAfterDiscountPct = parseNumber(
    config.minMarginAfterDiscountPct,
    10
  );

  const priceHighVsCategoryThresholdPct = parseNumber(
    config.priceHighVsCategoryThresholdPct,
    10
  );
  const priceLowVsCategoryThresholdPct = parseNumber(
    config.priceLowVsCategoryThresholdPct,
    -10
  );

  const decreasePricePct = parseNumber(config.decreasePricePct, -5);
  const promotionDiscountPct = parseNumber(config.promotionDiscountPct, -10);
  const increasePricePct = parseNumber(config.increasePricePct, 5);

  // heurística adicional para liquidación cuando hay mucho stock y 0 ventas
  const clearanceDiscountPct = -20;

  const recommendations = productsUnified
    .map((p) => {
      const warehouseStock = Number(p.warehouseStock) || 0;
      const lowStockAlert = Number(p.lowStockAlert) || 0;

      const recentUnits = Number(p.recentUnits) || 0;
      const prevUnits = Number(p.prevUnits) || 0;
      const recentRevenue = Number(p.recentRevenue) || 0;
      const recentProfit = Number(p.recentProfit) || 0;

      const avgDailyUnits = safeDiv(recentUnits, effectiveRecentDays);
      const daysCover =
        avgDailyUnits > 0 ? safeDiv(warehouseStock, avgDailyUnits) : null;

      const recentAvgPrice = safeDiv(p.recentWeightedPriceSum, recentUnits);

      const recentMargin =
        recentRevenue > 0 ? safeDiv(recentProfit, recentRevenue) : 0;
      const unitsGrowth =
        prevUnits > 0
          ? safeDiv(recentUnits - prevUnits, prevUnits)
          : recentUnits > 0
          ? 1
          : 0;

      const categoryKey = p.category ? String(p.category) : "__no_category__";
      const categoryAvg = categoryAvgPrice.get(categoryKey) || 0;
      const priceVsCategory =
        categoryAvg > 0
          ? safeDiv(recentAvgPrice - categoryAvg, categoryAvg)
          : 0;

      const currentPriceCop = pickCurrentPriceCop({
        recentAvgPrice,
        clientPrice: p.clientPrice,
        suggestedPrice: p.suggestedPrice,
        distributorPrice: p.distributorPrice,
      });

      const justifications = [];
      const actions = [];

      const categoryName = p.category
        ? categoryNameById.get(String(p.category))
        : null;
      const inventoryValueCop = round2(
        (Number(p.purchasePrice) || 0) * warehouseStock
      );
      const avgUnitProfitCop =
        recentUnits > 0 ? round2(safeDiv(recentProfit, recentUnits)) : 0;

      // 1) Alta rotación -> comprar más inventario (incluye casos críticos)
      if (recentUnits > 0 && daysCover !== null) {
        // caso crítico: sin stock o cobertura muy baja
        if (
          warehouseStock <= 0 ||
          daysCover <= Math.max(3, daysCoverLowThreshold / 4)
        ) {
          const targetDays = buyTargetDays;
          const targetStock = Math.ceil(avgDailyUnits * targetDays);
          const suggestedQty = Math.max(targetStock - warehouseStock, 0);

          justifications.push(
            `Riesgo crítico de quiebre: stock bodega ${warehouseStock} y cobertura estimada ${round2(
              daysCover
            )} días.`
          );

          actions.push({
            action: "buy_more_inventory",
            title: "Reponer urgentemente",
            category: "inventario",
            severity: "critical",
            confidence: clamp01(0.92),
            suggestedQty,
            impact: {
              revenueCop: round2(
                avgDailyUnits *
                  recentAvgPrice *
                  Math.max(0, targetDays - daysCover)
              ),
              inventoryValueCop,
            },
            details: {
              targetDays,
              avgDailyUnits: round2(avgDailyUnits),
              daysCover: round2(daysCover),
            },
          });
        }

        if (
          daysCover < daysCoverLowThreshold &&
          warehouseStock <= Math.max(lowStockAlert * 1.5, 5)
        ) {
          const targetDays = buyTargetDays;
          const targetStock = Math.ceil(avgDailyUnits * targetDays);
          const suggestedQty = Math.max(targetStock - warehouseStock, 0);

          justifications.push(
            `Alta rotación: ${round2(
              avgDailyUnits
            )} uds/día en últimos ${effectiveRecentDays} días.`
          );
          justifications.push(
            `Cobertura estimada: ${round2(
              daysCover
            )} días con stock bodega actual (${warehouseStock}).`
          );

          actions.push({
            action: "buy_more_inventory",
            title: "Comprar más inventario",
            category: "inventario",
            severity: severityFromDaysCover(daysCover),
            confidence: clamp01(0.85),
            suggestedQty,
            impact: {
              // estimación simple de ingresos en riesgo si no repones
              revenueCop:
                daysCover !== null
                  ? round2(
                      Math.max(0, buyTargetDays - daysCover) *
                        avgDailyUnits *
                        recentAvgPrice
                    )
                  : 0,
              inventoryValueCop,
            },
            details: {
              targetDays,
              avgDailyUnits: round2(avgDailyUnits),
              daysCover: round2(daysCover),
            },
          });
        }
      }

      // 2) Baja rotación -> pausar compras / promos / bajar precio
      const highStock =
        warehouseStock > lowStockAlert * highStockMultiplier &&
        warehouseStock >= highStockMinUnits;
      const lowRotation = recentUnits <= lowRotationUnitsThreshold;

      if (lowRotation && highStock) {
        justifications.push(
          `Baja rotación: ${recentUnits} uds en últimos ${effectiveRecentDays} días con stock alto (${warehouseStock}).`
        );

        actions.push({
          action: "pause_purchases",
          title: "Pausar compras",
          category: "inventario",
          severity: warehouseStock >= highStockMinUnits * 3 ? "high" : "medium",
          confidence: clamp01(0.8),
          impact: { inventoryValueCop },
        });

        if (
          categoryAvg > 0 &&
          priceVsCategory * 100 > priceHighVsCategoryThresholdPct
        ) {
          justifications.push(
            `Precio relativo alto vs productos similares (categoría): +${round2(
              priceVsCategory * 100
            )}%.`
          );
          actions.push({
            action: "decrease_price",
            title: "Bajar precio",
            category: "precio",
            severity: "medium",
            confidence: clamp01(0.7),
            suggestedChangePct: decreasePricePct,
            details: {
              price: buildPriceSuggestion({
                actionPct: decreasePricePct,
                currentPriceCop,
                purchasePriceCop: p.purchasePrice,
                targetMarginPct,
                minMarginAfterDiscountPct,
              }),
            },
          });
        } else {
          actions.push({
            action: "run_promotion",
            title: "Hacer promoción",
            category: "precio",
            severity: "medium",
            confidence: clamp01(0.65),
            suggestedChangePct: promotionDiscountPct,
            details: {
              price: buildPriceSuggestion({
                actionPct: promotionDiscountPct,
                currentPriceCop,
                purchasePriceCop: p.purchasePrice,
                targetMarginPct,
                minMarginAfterDiscountPct,
              }),
            },
          });
        }

        // Si es 0 ventas y el stock es muy alto, proponer liquidación (más agresivo)
        if (recentUnits === 0 && warehouseStock >= highStockMinUnits * 4) {
          justifications.push(
            `Stock inmovilizado estimado: ${inventoryValueCop.toLocaleString(
              "es-CO"
            )} COP (precio compra x stock bodega).`
          );
          actions.push({
            action: "clearance",
            title: "Liquidación (desocupar inventario)",
            category: "precio",
            severity: "high",
            confidence: clamp01(0.7),
            suggestedChangePct: clearanceDiscountPct,
            impact: { inventoryValueCop },
            details: {
              price: buildPriceSuggestion({
                actionPct: clearanceDiscountPct,
                currentPriceCop,
                purchasePriceCop: p.purchasePrice,
                targetMarginPct,
                minMarginAfterDiscountPct,
              }),
            },
          });
        }
      }

      // 3) Tendencias: caída y stock -> promo
      if (
        !lowRotation &&
        unitsGrowth * 100 < trendDropThresholdPct &&
        warehouseStock > lowStockAlert
      ) {
        justifications.push(
          `Tendencia a la baja: ${round2(
            unitsGrowth * 100
          )}% vs periodo anterior (${effectiveRecentDays} días).`
        );
        actions.push({
          action: "run_promotion",
          title: "Activar promoción",
          category: "demanda",
          severity: severityFromTrendPct(unitsGrowth * 100),
          confidence: clamp01(0.7),
          suggestedChangePct: promotionDiscountPct,
          details: {
            price: buildPriceSuggestion({
              actionPct: promotionDiscountPct,
              currentPriceCop,
              purchasePriceCop: p.purchasePrice,
              targetMarginPct,
              minMarginAfterDiscountPct,
            }),
          },
        });

        // Si además está caro vs categoría, sugerir bajar precio (más directo que promo)
        if (
          categoryAvg > 0 &&
          priceVsCategory * 100 > priceHighVsCategoryThresholdPct
        ) {
          justifications.push(
            `Precio por encima de la categoría (+${round2(
              priceVsCategory * 100
            )}%) con demanda cayendo.`
          );
          actions.push({
            action: "decrease_price",
            title: "Bajar precio (corregir vs categoría)",
            category: "precio",
            severity: "high",
            confidence: clamp01(0.78),
            suggestedChangePct: Math.min(decreasePricePct, -7),
            impact: {
              inventoryValueCop,
            },
            details: {
              price: buildPriceSuggestion({
                actionPct: Math.min(decreasePricePct, -7),
                currentPriceCop,
                purchasePriceCop: p.purchasePrice,
                targetMarginPct,
                minMarginAfterDiscountPct,
              }),
            },
          });
        }
      }

      // 4) Margen bajo -> revisar precio/margen
      if (recentUnits > 0 && recentMargin * 100 < marginLowThresholdPct) {
        if (recentMargin * 100 < 0) {
          justifications.push(
            `Margen reciente negativo: ${(recentMargin * 100).toFixed(
              1
            )}% (estás perdiendo por unidad en promedio).`
          );
          actions.push({
            action: "review_margin",
            title: "Corregir margen (urgente)",
            category: "margen",
            severity: "critical",
            confidence: clamp01(0.9),
            impact: {
              profitCop: round2(Math.abs(recentProfit)),
            },
          });

          // Sugerir subir precio aunque no esté “barato” vs categoría
          actions.push({
            action: "increase_price",
            title: "Subir precio (recuperar margen)",
            category: "precio",
            severity: "high",
            confidence: clamp01(0.75),
            suggestedChangePct: Math.max(increasePricePct, 8),
            details: {
              price: buildPriceSuggestion({
                actionPct: Math.max(increasePricePct, 8),
                currentPriceCop,
                purchasePriceCop: p.purchasePrice,
                targetMarginPct,
                minMarginAfterDiscountPct,
              }),
            },
          });
        }

        justifications.push(
          `Margen reciente bajo: ${(recentMargin * 100).toFixed(
            1
          )}% en últimos ${effectiveRecentDays} días.`
        );
        actions.push({
          action: "review_margin",
          title: "Revisar margen (precio/costo)",
          category: "margen",
          severity: severityFromMarginPct(recentMargin * 100),
          confidence: clamp01(0.65),
          impact: {
            profitCop: round2(Math.max(0, recentRevenue - recentProfit)),
          },
        });

        if (
          categoryAvg > 0 &&
          priceVsCategory * 100 < priceLowVsCategoryThresholdPct
        ) {
          actions.push({
            action: "increase_price",
            title: "Subir precio",
            category: "precio",
            severity: "medium",
            confidence: clamp01(0.6),
            suggestedChangePct: increasePricePct,
            details: {
              price: buildPriceSuggestion({
                actionPct: increasePricePct,
                currentPriceCop,
                purchasePriceCop: p.purchasePrice,
                targetMarginPct,
                minMarginAfterDiscountPct,
              }),
            },
          });
        }
      }

      // 5) Alta rotación + precio bajo relativo -> subir precio (estratégico)
      if (
        recentUnits >= minUnitsForGrowthStrategy &&
        unitsGrowth * 100 >= trendGrowthThresholdPct &&
        categoryAvg > 0 &&
        priceVsCategory * 100 < priceLowVsCategoryThresholdPct
      ) {
        justifications.push(
          `Demanda creciente: +${round2(
            unitsGrowth * 100
          )}% vs periodo anterior.`
        );
        justifications.push(
          `Precio relativo bajo vs categoría: ${round2(
            priceVsCategory * 100
          )}%.`
        );
        actions.push({
          action: "increase_price",
          title: "Subir precio (prueba controlada)",
          category: "precio",
          severity: "low",
          confidence: clamp01(0.6),
          suggestedChangePct: increasePricePct,
          details: {
            price: buildPriceSuggestion({
              actionPct: increasePricePct,
              currentPriceCop,
              purchasePriceCop: p.purchasePrice,
              targetMarginPct,
              minMarginAfterDiscountPct,
            }),
          },
        });
      }

      if (actions.length === 0) {
        if (recentUnits === 0) {
          justifications.push(
            `Sin ventas confirmadas en la ventana analizada (${effectiveRecentDays} días).`
          );
          if (warehouseStock > lowStockAlert) {
            actions.push({
              action: "run_promotion",
              title: "Probar promoción",
              category: "demanda",
              severity:
                warehouseStock >= highStockMinUnits * 2 ? "medium" : "low",
              confidence: clamp01(0.55),
              suggestedChangePct: promotionDiscountPct,
              details: {
                price: buildPriceSuggestion({
                  actionPct: promotionDiscountPct,
                  currentPriceCop,
                  purchasePriceCop: p.purchasePrice,
                  targetMarginPct,
                  minMarginAfterDiscountPct,
                }),
              },
            });
            actions.push({
              action: "pause_purchases",
              title: "Pausar compras hasta validar demanda",
              category: "inventario",
              severity: "low",
              confidence: clamp01(0.55),
            });
          } else {
            actions.push({
              action: "keep",
              title: "Mantener (esperar más datos)",
              category: "operacion",
              severity: "info",
              confidence: clamp01(0.5),
            });
          }
        } else {
          actions.push({
            action: "keep",
            title: "Mantener estrategia",
            category: "operacion",
            severity: "info",
            confidence: clamp01(0.7),
          });
        }
      }

      const primary = pickPrimaryAction(actions);

      const actionImpactScores = actions.map((a) =>
        computeImpactScore(a.impact)
      );
      const impactScore = actionImpactScores.length
        ? Math.max(...actionImpactScores)
        : 0;

      return {
        productId: String(p.productId),
        productName: p.productName || "Producto",
        categoryId: p.category ? String(p.category) : null,
        categoryName: categoryName || null,
        stock: {
          warehouseStock,
          totalStock: Number(p.totalStock) || 0,
          lowStockAlert,
        },
        metrics: {
          recentDays: effectiveRecentDays,
          horizonDays: explicitRange ? null : effectiveHorizonDays,
          recentUnits,
          prevUnits,
          unitsGrowthPct: round2(unitsGrowth * 100),
          recentRevenue: round2(recentRevenue),
          recentProfit: round2(recentProfit),
          recentMarginPct: round2(recentMargin * 100),
          avgUnitProfitCop,
          avgDailyUnits: round2(avgDailyUnits),
          daysCover: daysCover === null ? null : round2(daysCover),
          recentAvgPrice: round2(recentAvgPrice),
          categoryAvgPrice: round2(categoryAvg),
          priceVsCategoryPct: round2(priceVsCategory * 100),
          inventoryValueCop,
        },
        recommendation: {
          primary,
          actions,
          justification: justifications,
          score: {
            impactScore: round2(impactScore),
          },
          notes:
            "El 'precio de mercado' se estima comparando con el precio promedio reciente de productos de la misma categoría (no incluye fuentes externas).",
        },
      };
    })
    .sort((a, b) => {
      const confA = a.recommendation.primary?.confidence ?? 0;
      const confB = b.recommendation.primary?.confidence ?? 0;
      return confB - confA;
    });

  const payload = {
    generatedAt: new Date().toISOString(),
    window: {
      horizonDays: explicitRange ? null : effectiveHorizonDays,
      recentDays: effectiveRecentDays,
      startDate: startDateStr || null,
      endDate: endDateStr || null,
    },
    recommendations,
  };

  if (!bypassCache && canUseRedis) {
    await redis.setex(cacheKey, ttlSeconds, JSON.stringify(payload));
  }

  return { __meta: { cache: "MISS" }, ...payload };
};

// @desc    Obtener o crear configuración del Business Assistant
// @route   GET /api/business-assistant/config
// @access  Private/Admin
export const getBusinessAssistantConfig = async (req, res) => {
  try {
    const config = await getOrCreateBusinessAssistantConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Actualizar configuración del Business Assistant
// @route   PUT /api/business-assistant/config
// @access  Private/Admin
export const updateBusinessAssistantConfig = async (req, res) => {
  try {
    let config = await BusinessAssistantConfig.findOne();
    if (!config) {
      config = await BusinessAssistantConfig.create(req.body || {});
    } else {
      Object.assign(config, req.body || {});
      await config.save();
    }

    _configCache = null;
    _configCacheAt = 0;

    await invalidateCache("cache:businessAssistant:*");

    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Crear job de recomendaciones (background)
// @route   POST /api/business-assistant/recommendations/jobs
// @access  Private/Admin
export const createBusinessAssistantRecommendationsJob = async (req, res) => {
  try {
    const queue = getBusinessAssistantQueue();
    if (!queue) {
      return res.status(400).json({
        message:
          "Background processing requiere REDIS_URL configurado (BullMQ necesita Redis).",
      });
    }

    const params = {
      horizonDays: req.body?.horizonDays,
      recentDays: req.body?.recentDays,
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
    };

    const job = await queue.add(
      "generate-recommendations",
      { params },
      {
        jobId: undefined,
      }
    );

    res.status(202).json({ jobId: job.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Consultar estado/resultado de job de recomendaciones
// @route   GET /api/business-assistant/recommendations/jobs/:id
// @access  Private/Admin
export const getBusinessAssistantRecommendationsJob = async (req, res) => {
  try {
    const queue = getBusinessAssistantQueue();
    if (!queue) {
      return res.status(400).json({
        message:
          "Background processing requiere REDIS_URL configurado (BullMQ necesita Redis).",
      });
    }

    const job = await queue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Job no encontrado" });
    }

    const state = await job.getState();
    const progress = job.progress;

    const response = {
      jobId: job.id,
      status: state,
      progress,
      result: state === "completed" ? job.returnvalue : null,
      failedReason: state === "failed" ? job.failedReason : null,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generar recomendaciones por producto basadas en datos históricos
// @route   GET /api/business-assistant/recommendations
// @access  Private/Admin
export const getBusinessAssistantRecommendations = async (req, res) => {
  try {
    const redis = getRedisClient();
    const force = String(req.query.force || "0") === "1";

    const result = await generateBusinessAssistantRecommendations({
      horizonDays: req.query.horizonDays,
      recentDays: req.query.recentDays,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      redis,
      bypassCache: force,
    });

    if (result?.__meta?.cache) {
      res.set("X-Cache", result.__meta.cache);
    }

    // no exponer meta interna en la UI por defecto
    const { __meta, ...payload } = result;
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
