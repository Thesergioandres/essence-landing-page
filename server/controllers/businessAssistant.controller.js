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

// @desc    Generar recomendaciones por producto basadas en datos históricos
// @route   GET /api/business-assistant/recommendations
// @access  Private/Admin
export const getBusinessAssistantRecommendations = async (req, res) => {
  try {
    const horizonDays = Number(req.query.horizonDays) || 90;
    const recentDays = Number(req.query.recentDays) || 30;

    const startDateStr = req.query.startDate;
    const endDateStr = req.query.endDate;

    const now = new Date();
    const horizonStart = new Date(now);
    horizonStart.setDate(now.getDate() - horizonDays);

    const recentStart = new Date(now);
    recentStart.setDate(now.getDate() - recentDays);

    const previousStart = new Date(now);
    previousStart.setDate(now.getDate() - recentDays * 2);

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

    // Asegurar que productos sin ventas también aparezcan con recomendación
    const allProducts = await Product.find({}).select(
      "name category purchasePrice distributorPrice suggestedPrice clientPrice warehouseStock totalStock lowStockAlert"
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

    // Proxy de “precio de mercado”: promedio de precio vendido reciente por categoría
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

    const recommendations = productsUnified
      .map((p) => {
        const warehouseStock = Number(p.warehouseStock) || 0;
        const lowStockAlert = Number(p.lowStockAlert) || 0;

        const recentUnits = Number(p.recentUnits) || 0;
        const prevUnits = Number(p.prevUnits) || 0;
        const recentRevenue = Number(p.recentRevenue) || 0;
        const recentProfit = Number(p.recentProfit) || 0;

        const avgDailyUnits = safeDiv(recentUnits, recentDays);
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

        const justifications = [];
        const actions = [];

        // 1) Alta rotación -> comprar más inventario
        if (recentUnits > 0 && daysCover !== null) {
          if (
            daysCover < 14 &&
            warehouseStock <= Math.max(lowStockAlert * 1.5, 5)
          ) {
            const targetDays = 30;
            const targetStock = Math.ceil(avgDailyUnits * targetDays);
            const suggestedQty = Math.max(targetStock - warehouseStock, 0);

            justifications.push(
              `Alta rotación: ${round2(
                avgDailyUnits
              )} uds/día en últimos ${recentDays} días.`
            );
            justifications.push(
              `Cobertura estimada: ${round2(
                daysCover
              )} días con stock bodega actual (${warehouseStock}).`
            );

            actions.push({
              action: "buy_more_inventory",
              title: "Comprar más inventario",
              confidence: clamp(0.85, 0, 1),
              suggestedQty,
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
          warehouseStock > lowStockAlert * 2 && warehouseStock >= 10;
        const lowRotation = recentUnits <= 1;

        if (lowRotation && highStock) {
          justifications.push(
            `Baja rotación: ${recentUnits} uds en últimos ${recentDays} días con stock alto (${warehouseStock}).`
          );

          actions.push({
            action: "pause_purchases",
            title: "Pausar compras",
            confidence: clamp(0.8, 0, 1),
          });

          if (categoryAvg > 0 && priceVsCategory > 0.1) {
            justifications.push(
              `Precio relativo alto vs productos similares (categoría): +${round2(
                priceVsCategory * 100
              )}%.`
            );
            actions.push({
              action: "decrease_price",
              title: "Bajar precio",
              confidence: clamp(0.7, 0, 1),
              suggestedChangePct: -5,
            });
          } else {
            actions.push({
              action: "run_promotion",
              title: "Hacer promoción",
              confidence: clamp(0.65, 0, 1),
              suggestedChangePct: -10,
            });
          }
        }

        // 3) Tendencias: caída y stock -> promo
        if (
          !lowRotation &&
          unitsGrowth < -0.2 &&
          warehouseStock > lowStockAlert
        ) {
          justifications.push(
            `Tendencia a la baja: ${round2(
              unitsGrowth * 100
            )}% vs periodo anterior (${recentDays} días).`
          );
          actions.push({
            action: "run_promotion",
            title: "Activar promoción",
            confidence: clamp(0.7, 0, 1),
            suggestedChangePct: -10,
          });
        }

        // 4) Margen bajo -> revisar precio/margen
        if (recentUnits > 0 && recentMargin > 0 && recentMargin < 0.15) {
          justifications.push(
            `Margen reciente bajo: ${(recentMargin * 100).toFixed(
              1
            )}% en últimos ${recentDays} días.`
          );
          actions.push({
            action: "review_margin",
            title: "Revisar margen (precio/costo)",
            confidence: clamp(0.65, 0, 1),
          });

          if (categoryAvg > 0 && priceVsCategory < -0.1) {
            actions.push({
              action: "increase_price",
              title: "Subir precio",
              confidence: clamp(0.6, 0, 1),
              suggestedChangePct: 5,
            });
          }
        }

        // 5) Alta rotación + precio bajo relativo -> subir precio (estratégico)
        if (
          recentUnits >= 10 &&
          unitsGrowth >= 0.2 &&
          categoryAvg > 0 &&
          priceVsCategory < -0.1
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
            confidence: clamp(0.6, 0, 1),
            suggestedChangePct: 5,
          });
        }

        if (actions.length === 0) {
          if (recentUnits === 0) {
            justifications.push(
              `Sin ventas confirmadas en la ventana analizada (${recentDays} días).`
            );
            if (warehouseStock > lowStockAlert) {
              actions.push({
                action: "run_promotion",
                title: "Probar promoción",
                confidence: clamp(0.55, 0, 1),
                suggestedChangePct: -10,
              });
              actions.push({
                action: "pause_purchases",
                title: "Pausar compras hasta validar demanda",
                confidence: clamp(0.55, 0, 1),
              });
            } else {
              actions.push({
                action: "keep",
                title: "Mantener (esperar más datos)",
                confidence: clamp(0.5, 0, 1),
              });
            }
          } else {
            actions.push({
              action: "keep",
              title: "Mantener estrategia",
              confidence: clamp(0.7, 0, 1),
            });
          }
        }

        const primary = pickPrimaryAction(actions);

        return {
          productId: String(p.productId),
          productName: p.productName || "Producto",
          categoryId: p.category ? String(p.category) : null,
          stock: {
            warehouseStock,
            totalStock: Number(p.totalStock) || 0,
            lowStockAlert,
          },
          metrics: {
            recentDays,
            horizonDays: explicitRange ? null : horizonDays,
            recentUnits,
            prevUnits,
            unitsGrowthPct: round2(unitsGrowth * 100),
            recentRevenue: round2(recentRevenue),
            recentProfit: round2(recentProfit),
            recentMarginPct: round2(recentMargin * 100),
            avgDailyUnits: round2(avgDailyUnits),
            daysCover: daysCover === null ? null : round2(daysCover),
            recentAvgPrice: round2(recentAvgPrice),
            categoryAvgPrice: round2(categoryAvg),
            priceVsCategoryPct: round2(priceVsCategory * 100),
          },
          recommendation: {
            primary,
            actions,
            justification: justifications,
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

    res.json({
      generatedAt: new Date().toISOString(),
      window: {
        horizonDays: explicitRange ? null : horizonDays,
        recentDays,
        startDate: startDateStr || null,
        endDate: endDateStr || null,
      },
      recommendations,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
