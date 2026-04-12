import mongoose from "mongoose";
import BusinessAssistantConfig from "../models/BusinessAssistantConfig.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import { aiService } from "../../services/ai.service.js";
import { AdvancedAnalyticsRepository } from "./AdvancedAnalyticsRepository.js";
import stockRepository from "./StockRepository.js";

const analyticsRepository = new AdvancedAnalyticsRepository();

export class BusinessAssistantRepository {
  buildInventoryMap(inventory = []) {
    return inventory.reduce((acc, item) => {
      const productId = item?.product?._id?.toString?.();
      if (!productId) return acc;
      const warehouse = Number(item.warehouse || 0);
      const branches = Number(item.branches || 0);
      const employees = Number(item.employees || 0);
      const systemTotal = Number(item.systemTotal || 0);
      const total = warehouse + branches + employees;
      const unassigned = systemTotal > 0 ? Math.max(systemTotal - total, 0) : 0;
      acc[productId] = {
        total,
        warehouse,
        branches,
        employees,
        unassigned,
      };
      return acc;
    }, {});
  }

  buildCategoryPriceStats(products = []) {
    const totals = new Map();
    products.forEach((product) => {
      const price = Number(product.clientPrice ?? product.suggestedPrice ?? 0);
      if (!price) return;
      const categoryId =
        typeof product.category === "string"
          ? product.category
          : product.category?._id?.toString?.();
      if (!categoryId) return;
      const current = totals.get(categoryId) || { sum: 0, count: 0 };
      totals.set(categoryId, {
        sum: current.sum + price,
        count: current.count + 1,
      });
    });

    const averages = new Map();
    totals.forEach((value, key) => {
      averages.set(key, value.count ? value.sum / value.count : 0);
    });
    return averages;
  }

  buildSalesSummary(sales = [], recentDate, prevDate) {
    const summary = new Map();

    const ensure = (productId) => {
      if (summary.has(productId)) return summary.get(productId);
      const payload = {
        recentUnits: 0,
        prevUnits: 0,
        recentRevenue: 0,
        recentProfit: 0,
        recentSalesCount: 0,
        horizonUnits: 0,
        horizonRevenue: 0,
        lastSaleDate: null,
      };
      summary.set(productId, payload);
      return payload;
    };

    sales.forEach((sale) => {
      const productId = sale.product?.toString?.();
      if (!productId) return;
      const saleDate = sale.saleDate ? new Date(sale.saleDate) : null;
      if (!saleDate || Number.isNaN(saleDate.getTime())) return;

      const payload = ensure(productId);
      if (!payload.lastSaleDate || saleDate > payload.lastSaleDate) {
        payload.lastSaleDate = saleDate;
      }

      const quantity = Number(sale.quantity || 0);
      const revenue = Number(sale.salePrice || 0) * quantity;
      const profit = Number.isFinite(sale.netProfit)
        ? Number(sale.netProfit || 0)
        : Number.isFinite(sale.totalProfit)
          ? Number(sale.totalProfit || 0)
          : revenue -
            (Number(sale.averageCostAtSale ?? sale.purchasePrice ?? 0) || 0) *
              quantity;

      payload.horizonUnits += quantity;
      payload.horizonRevenue += revenue;

      if (saleDate >= recentDate) {
        payload.recentUnits += quantity;
        payload.recentRevenue += revenue;
        payload.recentProfit += profit;
        payload.recentSalesCount += 1;
      } else if (saleDate >= prevDate && saleDate < recentDate) {
        payload.prevUnits += quantity;
      }
    });

    return summary;
  }

  buildAbcMap(products = [], salesSummary, thresholds = {}) {
    const list = products.map((product) => {
      const productId = product._id?.toString?.();
      const summary = productId ? salesSummary.get(productId) : null;
      return {
        productId,
        revenue: Number(summary?.horizonRevenue || summary?.recentRevenue || 0),
      };
    });

    const totalRevenue = list.reduce((sum, item) => sum + item.revenue, 0);
    const sorted = list.sort((a, b) => b.revenue - a.revenue);

    const abcMap = new Map();
    if (!totalRevenue) {
      sorted.forEach((item) => {
        if (item.productId) abcMap.set(item.productId, "C");
      });
      return abcMap;
    }

    const aThreshold = thresholds.abcClassAThreshold ?? 0.8;
    const bThreshold = thresholds.abcClassBThreshold ?? 0.95;
    let cumulative = 0;

    sorted.forEach((item) => {
      if (!item.productId) return;
      cumulative += item.revenue;
      const ratio = cumulative / totalRevenue;
      if (ratio <= aThreshold) {
        abcMap.set(item.productId, "A");
      } else if (ratio <= bThreshold) {
        abcMap.set(item.productId, "B");
      } else {
        abcMap.set(item.productId, "C");
      }
    });

    return abcMap;
  }

  resolveOverrides(config, productId, categoryId) {
    const productOverride =
      config.productOverrides?.find(
        (override) =>
          override.productId?.toString?.() === productId ||
          override.productId?.toString?.() === String(productId),
      ) || null;
    const categoryOverride =
      config.categoryOverrides?.find(
        (override) =>
          override.categoryId?.toString?.() === categoryId ||
          override.categoryId?.toString?.() === String(categoryId),
      ) || null;

    return {
      ...config,
      ...(categoryOverride || {}),
      ...(productOverride || {}),
    };
  }

  buildCacheKey(businessId, window) {
    return `ba:v3:${businessId}:${window.horizonDays}:${window.recentDays}:${
      window.startDate || ""
    }:${window.endDate || ""}`;
  }

  suggestPromotion(products, sales, options = {}) {
    const staleDays = options.staleDays ?? 45;
    const minStock = options.minStock ?? 8;
    const comboSize = options.comboSize ?? 3;
    const maxCombos = options.maxCombos ?? 6;
    const inventoryMap = options.inventoryMap || {};
    const salesSummary = options.salesSummary || new Map();
    const abcMap = options.abcMap || new Map();
    const categoryMap = options.categoryMap || new Map();
    const config = options.config || {};

    const now = new Date();
    const staleDate = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);
    const highStockMinUnits = config.highStockMinUnits ?? 10;
    const highStockMultiplier = config.highStockMultiplier ?? 2;
    const clearanceDiscount = Math.abs(config.clearanceDiscountPct ?? 20);
    const reactivationDiscount = Math.max(8, clearanceDiscount - 5);
    const crossSellDiscount = Math.max(6, reactivationDiscount - 3);

    const stats = products
      .map((product) => {
        const productId = product._id?.toString?.() || "";
        const summary = salesSummary.get(productId) || {};
        const stock = Number(
          inventoryMap[productId]?.total ?? product.totalStock ?? 0,
        );
        const price = Number(
          product.clientPrice ?? product.suggestedPrice ?? 0,
        );
        const cost = Number(product.averageCost || product.purchasePrice || 0);
        const marginPct = price > 0 ? ((price - cost) / price) * 100 : 0;
        const lastSaleDate = summary.lastSaleDate || null;
        const daysSinceSale = lastSaleDate
          ? Math.round(
              (now.getTime() - lastSaleDate.getTime()) / (24 * 60 * 60 * 1000),
            )
          : null;
        const categoryId =
          typeof product.category === "string"
            ? product.category
            : product.category?._id?.toString?.();

        return {
          product,
          productId,
          categoryId,
          categoryName: categoryId ? categoryMap.get(categoryId) : null,
          stock,
          price,
          marginPct,
          lastSaleDate,
          daysSinceSale,
          recentUnits: Number(summary.recentUnits || 0),
          recentRevenue: Number(summary.recentRevenue || 0),
          abcClass: abcMap.get(productId) || "C",
        };
      })
      .filter((item) => item.productId);

    const buildInsights = (items) => {
      const insights = [];
      items.forEach((item) => {
        const parts = [
          item.product.name,
          `Stock ${item.stock}`,
          item.daysSinceSale !== null
            ? `Ult venta ${item.daysSinceSale}d`
            : `Sin ventas`,
          `Clase ${item.abcClass}`,
        ];
        insights.push(parts.join(" · "));
      });
      return insights.slice(0, 4);
    };

    const buildComboPromo = ({
      strategy,
      items,
      discountPct,
      priority,
      reason,
      titlePrefix,
    }) => {
      const names = items.map((item) => item.product.name).join(" + ");
      return {
        type: "combo",
        title: `Combo irresistible: ${names}`,
        description: `Oferta limitada: llévate este combo y ahorra ${discountPct}%. ¡Ideal para regalar o recargar!`,
        products: items.map((item) => item.productId),
        strategy,
        priority,
        discountPct,
        reason,
        insights: buildInsights(items),
      };
    };

    const staleItems = stats.filter((item) => {
      if (item.stock < minStock) return false;
      if (!item.lastSaleDate) return true;
      return item.lastSaleDate < staleDate;
    });

    const overstockItems = staleItems.filter((item) => {
      if (item.stock < highStockMinUnits) return false;
      const demandGuard = Math.max(1, item.recentUnits || 0);
      return item.stock >= demandGuard * highStockMultiplier;
    });

    const topSellers = stats
      .filter(
        (item) =>
          item.recentUnits >= (config.minRecentUnitsForDemandSignal ?? 5),
      )
      .sort((a, b) => b.recentUnits - a.recentUnits)
      .slice(0, 6);

    const promos = [];

    const buildGroups = (items, groupSize, maxCount) => {
      const groups = [];
      for (let i = 0; i < items.length; i += groupSize) {
        const group = items.slice(i, i + groupSize);
        if (group.length < 2) break;
        groups.push(group);
        if (groups.length >= maxCount) break;
      }
      return groups;
    };

    buildGroups(overstockItems, comboSize, 2).forEach((group) => {
      promos.push(
        buildComboPromo({
          strategy: "clearance",
          items: group,
          discountPct: clearanceDiscount,
          priority: "high",
          reason: `Stock alto sin rotacion en ${staleDays} dias`,
          titlePrefix: "Liquidacion inteligente",
        }),
      );
    });

    buildGroups(staleItems, comboSize, 2).forEach((group) => {
      promos.push(
        buildComboPromo({
          strategy: "reactivation",
          items: group,
          discountPct: reactivationDiscount,
          priority: "medium",
          reason: `Reactivar productos sin ventas recientes`,
          titlePrefix: "Combo reactivacion",
        }),
      );
    });

    if (topSellers.length > 0 && staleItems.length > 0) {
      const crossSellPairs = staleItems.slice(0, 3).map((stale) => {
        const partner =
          topSellers.find((seller) => seller.categoryId !== stale.categoryId) ||
          topSellers[0];
        return [stale, partner];
      });

      crossSellPairs.forEach((group) => {
        promos.push(
          buildComboPromo({
            strategy: "cross_sell",
            items: group,
            discountPct: crossSellDiscount,
            priority: "medium",
            reason: "Arrastre con top sellers para mover stock lento",
            titlePrefix: "Combo arrastre",
          }),
        );
      });
    }

    if (topSellers.length > 0 && promos.length < maxCombos) {
      topSellers.slice(0, 2).forEach((item) => {
        const helpers = stats
          .filter(
            (candidate) =>
              candidate.categoryId === item.categoryId &&
              candidate.productId !== item.productId,
          )
          .slice(0, 1);
        const group = helpers.length ? [item, ...helpers] : [item];
        if (group.length < 2) return;
        promos.push(
          buildComboPromo({
            strategy: "volume",
            items: group,
            discountPct: reactivationDiscount,
            priority: "low",
            reason: "Descuento por volumen para impulsar ticket promedio",
            titlePrefix: "Combo volumen",
          }),
        );
      });
    }

    return promos.slice(0, maxCombos);
  }

  async getOrCreateConfig(businessId) {
    if (!businessId) {
      return BusinessAssistantConfig.findOne({
        $or: [{ business: { $exists: false } }, { business: null }],
      });
    }

    const existing = await BusinessAssistantConfig.findOne({
      business: businessId,
    });
    if (existing) return existing;

    const fallback = await BusinessAssistantConfig.findOne({
      $or: [{ business: { $exists: false } }, { business: null }],
    });

    const payload = fallback ? fallback.toObject() : {};
    delete payload._id;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.__v;

    const config = await BusinessAssistantConfig.findOneAndUpdate(
      { business: businessId },
      { $setOnInsert: { ...payload, business: businessId } },
      { new: true, upsert: true },
    );

    return config;
  }

  async generateRecommendations(businessId, params = {}) {
    if (!businessId) {
      throw new Error("Falta el negocio para generar recomendaciones");
    }

    const businessObjectId = new mongoose.Types.ObjectId(String(businessId));
    const config = await this.getOrCreateConfig(businessId);

    const horizonDays = params.horizonDays || config.horizonDaysDefault || 90;
    const recentDays = params.recentDays || config.recentDaysDefault || 30;

    const now = new Date();
    const horizonDate = new Date(
      now.getTime() - horizonDays * 24 * 60 * 60 * 1000,
    );
    const recentDate = new Date(
      now.getTime() - recentDays * 24 * 60 * 60 * 1000,
    );
    const prevDate = new Date(
      now.getTime() - recentDays * 2 * 24 * 60 * 60 * 1000,
    );

    const window = {
      horizonDays,
      recentDays,
      startDate: params.startDate || null,
      endDate: params.endDate || null,
    };

    const cacheKey = this.buildCacheKey(businessId, window);
    const bypassCache = Boolean(params.bypassCache || params.force);
    const redis = params.redis || null;

    if (config.cacheEnabled && !bypassCache) {
      try {
        if (redis) {
          const cached = await redis.get(cacheKey);
          if (cached) return JSON.parse(cached);
        }
      } catch {
        // Ignorar fallas de cache
      }
    }

    const [products, sales, categories, financialKPIs, inventory] =
      await Promise.all([
        Product.find({
          business: businessObjectId,
          isDeleted: { $ne: true },
        }).lean(),
        Sale.find({
          business: businessObjectId,
          saleDate: { $gte: horizonDate },
          paymentStatus: "confirmado",
        }).lean(),
        Category.find({ business: businessObjectId }).lean(),
        analyticsRepository
          .getFinancialKPIs(businessId, params.startDate, params.endDate)
          .catch(() => null),
        stockRepository.getGlobalInventory(businessId).catch(() => []),
      ]);

    const inventoryMap = this.buildInventoryMap(inventory);
    const categoryPriceStats = this.buildCategoryPriceStats(products);
    const salesSummary = this.buildSalesSummary(sales, recentDate, prevDate);
    const abcMap = this.buildAbcMap(products, salesSummary, config);
    const categoryMap = new Map(
      categories.map((category) => [category._id.toString(), category.name]),
    );

    const netProfitRange =
      typeof financialKPIs?.range?.netProfit === "number"
        ? financialKPIs.range.netProfit
        : 0;
    const allowInvestment = netProfitRange > 0;

    const recommendations = products.map((product) => {
      const productId = product._id.toString();
      const categoryId =
        typeof product.category === "string"
          ? product.category
          : product.category?._id?.toString?.() || null;
      const categoryName = categoryId ? categoryMap.get(categoryId) : null;
      const cfg = this.resolveOverrides(config, productId, categoryId);

      const summary = salesSummary.get(productId) || {
        recentUnits: 0,
        prevUnits: 0,
        recentRevenue: 0,
        recentProfit: 0,
        recentSalesCount: 0,
        lastSaleDate: null,
      };

      const inventorySnapshot = inventoryMap[productId] || {
        total: product.totalStock || 0,
        warehouse: product.warehouseStock || 0,
        branches: 0,
        employees: 0,
        unassigned: 0,
      };

      const currentPrice = Number(
        product.clientPrice ?? product.suggestedPrice ?? 0,
      );
      const costBasis = Number(
        product.averageCost || product.purchasePrice || 0,
      );

      const avgDailyUnits =
        recentDays > 0 ? summary.recentUnits / recentDays : 0;
      const daysCover =
        avgDailyUnits > 0
          ? Math.round(inventorySnapshot.total / avgDailyUnits)
          : null;

      const recentMarginPct =
        summary.recentRevenue > 0
          ? (summary.recentProfit / summary.recentRevenue) * 100
          : currentPrice > 0
            ? ((currentPrice - costBasis) / currentPrice) * 100
            : 0;

      const categoryAvgPrice = categoryId
        ? categoryPriceStats.get(categoryId) || 0
        : 0;
      const priceVsCategoryPct =
        categoryAvgPrice > 0
          ? ((currentPrice - categoryAvgPrice) / categoryAvgPrice) * 100
          : 0;

      const prevUnits = summary.prevUnits || 0;
      const unitsGrowthPct =
        prevUnits > 0
          ? ((summary.recentUnits - prevUnits) / prevUnits) * 100
          : summary.recentUnits > 0
            ? 100
            : 0;

      const createdAt = product.createdAt ? new Date(product.createdAt) : null;
      const isNewProduct =
        createdAt &&
        config.newProductGraceDays > 0 &&
        now.getTime() - createdAt.getTime() <
          config.newProductGraceDays * 24 * 60 * 60 * 1000;

      const hasDemandSignal =
        summary.recentUnits >= cfg.minRecentUnitsForDemandSignal;
      const hasPriceSignal =
        summary.recentUnits >= cfg.minRecentUnitsForPriceChange;

      const candidates = [];
      const pushCandidate = (payload) => {
        candidates.push(payload);
      };

      if (
        daysCover !== null &&
        daysCover <= cfg.daysCoverLowThreshold &&
        summary.recentUnits > 0
      ) {
        const targetUnits = Math.ceil(avgDailyUnits * cfg.buyTargetDays);
        const suggestedQty = Math.max(0, targetUnits - inventorySnapshot.total);
        const severity =
          daysCover <= Math.max(3, Math.floor(cfg.daysCoverLowThreshold / 2))
            ? "critical"
            : "high";
        pushCandidate({
          action: allowInvestment ? "buy_more_inventory" : "pause_purchases",
          severity,
          category: "inventario",
          confidence: 0.82,
          suggestedQty: allowInvestment ? suggestedQty : undefined,
          targetDays: cfg.buyTargetDays,
          avgDailyUnits,
        });
      }

      if (!isNewProduct && inventorySnapshot.total >= cfg.highStockMinUnits) {
        if (summary.recentUnits <= cfg.lowRotationUnitsThreshold) {
          pushCandidate({
            action: "clearance",
            severity: "high",
            category: "inventario",
            confidence: 0.74,
            suggestedChangePct: cfg.clearanceDiscountPct,
          });
        } else if (summary.recentUnits <= cfg.minRecentUnitsForDemandSignal) {
          pushCandidate({
            action: "run_promotion",
            severity: "medium",
            category: "demanda",
            confidence: 0.64,
            suggestedChangePct: cfg.promotionDiscountPct,
          });
        }
      }

      if (recentMarginPct > 0 && recentMarginPct < cfg.marginLowThresholdPct) {
        pushCandidate({
          action: "review_margin",
          severity: "high",
          category: "margen",
          confidence: 0.76,
        });
      }

      if (hasPriceSignal && currentPrice > 0) {
        if (
          priceVsCategoryPct <= cfg.priceLowVsCategoryThresholdPct &&
          hasDemandSignal
        ) {
          pushCandidate({
            action: "increase_price",
            severity: "medium",
            category: "precio",
            confidence: 0.68,
            suggestedChangePct: cfg.increasePricePct,
          });
        }

        if (
          priceVsCategoryPct >= cfg.priceHighVsCategoryThresholdPct &&
          !hasDemandSignal
        ) {
          pushCandidate({
            action: "decrease_price",
            severity: "medium",
            category: "precio",
            confidence: 0.62,
            suggestedChangePct: cfg.decreasePricePct,
          });
        }
      }

      const severityScore = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
        info: 0,
      };

      const scored = candidates.map((candidate) => ({
        ...candidate,
        _score:
          (severityScore[candidate.severity] || 0) * 10 +
          (candidate.confidence || 0) * 5,
      }));

      scored.sort((a, b) => b._score - a._score);

      const primary = scored[0]
        ? {
            action: scored[0].action,
            title: scored[0].action,
            confidence: scored[0].confidence,
            category: scored[0].category,
            severity: scored[0].severity,
            suggestedQty: scored[0].suggestedQty,
            suggestedChangePct: scored[0].suggestedChangePct,
          }
        : {
            action: "keep",
            title: "Mantener",
            confidence: 0.4,
            category: "operacion",
            severity: "info",
          };

      const priceChangePct = primary.suggestedChangePct || 0;
      const rawSuggestedPrice = currentPrice
        ? currentPrice * (1 + priceChangePct / 100)
        : 0;
      const targetMargin = cfg.targetMarginPct || 0;
      const floorPrice =
        targetMargin > 0 && costBasis > 0
          ? Math.round(costBasis / (1 - targetMargin / 100))
          : 0;
      const suggestedPrice =
        rawSuggestedPrice && floorPrice
          ? Math.round(Math.max(rawSuggestedPrice, floorPrice))
          : rawSuggestedPrice
            ? Math.round(rawSuggestedPrice)
            : 0;

      const profitPerUnit = currentPrice > 0 ? currentPrice - costBasis : 0;
      const newProfitPerUnit =
        suggestedPrice > 0 ? suggestedPrice - costBasis : 0;
      const elasticity = Number(cfg.priceElasticity || 0);
      const demandMultiplier = 1 - elasticity * (priceChangePct / 100);
      const adjustedUnits = Math.max(
        0,
        Math.round(summary.recentUnits * demandMultiplier),
      );
      const profitDelta =
        hasPriceSignal && suggestedPrice > 0
          ? newProfitPerUnit * adjustedUnits -
            profitPerUnit * summary.recentUnits
          : 0;

      const inventoryValue = costBasis * inventorySnapshot.total;

      const justification = [
        `Stock total ${inventorySnapshot.total} (Bodega ${inventorySnapshot.warehouse} · Sedes ${inventorySnapshot.branches} · Empleados ${inventorySnapshot.employees})`,
        summary.recentUnits > 0
          ? `Ventas ${recentDays}d: ${summary.recentUnits} uds · Tendencia ${unitsGrowthPct >= 0 ? "+" : ""}${unitsGrowthPct.toFixed(1)}%`
          : `Sin ventas confirmadas en ${recentDays}d`,
        currentPrice > 0
          ? `Precio actual: ${currentPrice.toLocaleString("es-CO")} · Margen ${recentMarginPct.toFixed(1)}%`
          : "Precio actual no definido",
        categoryAvgPrice > 0
          ? `vs categoría: ${priceVsCategoryPct.toFixed(1)}%`
          : "Sin referencia de precio por categoría",
      ];

      if (daysCover !== null) {
        justification.push(`Cobertura estimada: ${daysCover} días.`);
      }

      if (summary.lastSaleDate) {
        const daysSince = Math.round(
          (now.getTime() - summary.lastSaleDate.getTime()) /
            (24 * 60 * 60 * 1000),
        );
        justification.push(`Última venta hace ${daysSince} días.`);
      }

      return {
        productId,
        productName: product.name,
        categoryId,
        categoryName,
        abcClass: abcMap.get(productId) || "C",
        stock: {
          warehouseStock: inventorySnapshot.warehouse,
          branchesStock: inventorySnapshot.branches,
          employeesStock: inventorySnapshot.employees,
          unassignedStock: inventorySnapshot.unassigned,
          totalStock: inventorySnapshot.total,
          lowStockAlert: product.lowStockAlert ?? 0,
        },
        metrics: {
          recentDays,
          horizonDays,
          recentUnits: summary.recentUnits,
          prevUnits,
          unitsGrowthPct,
          recentRevenue: summary.recentRevenue,
          recentProfit: summary.recentProfit,
          recentMarginPct,
          avgUnitProfitCop:
            summary.recentUnits > 0
              ? summary.recentProfit / summary.recentUnits
              : 0,
          avgDailyUnits,
          daysCover,
          recentAvgPrice:
            summary.recentUnits > 0
              ? summary.recentRevenue / summary.recentUnits
              : currentPrice,
          categoryAvgPrice,
          priceVsCategoryPct,
          inventoryValueCop: inventoryValue,
          lastSaleDate: summary.lastSaleDate
            ? summary.lastSaleDate.toISOString()
            : null,
          daysSinceLastSale: summary.lastSaleDate
            ? Math.round(
                (now.getTime() - summary.lastSaleDate.getTime()) /
                  (24 * 60 * 60 * 1000),
              )
            : null,
          recentSalesCount: summary.recentSalesCount,
        },
        recommendation: {
          primary: {
            ...primary,
            title: primary.action,
            impact: {
              revenueCop:
                primary.action === "buy_more_inventory"
                  ? summary.recentRevenue
                  : 0,
              profitCop: profitDelta > 0 ? profitDelta : 0,
              inventoryValueCop:
                primary.action === "buy_more_inventory"
                  ? costBasis * (primary.suggestedQty || 0)
                  : 0,
            },
            details: {
              price: currentPrice
                ? {
                    currentPriceCop: currentPrice,
                    suggestedPriceCop: suggestedPrice || undefined,
                    floorPriceCop: floorPrice || undefined,
                    targetMarginPct: targetMargin || undefined,
                    effectiveChangePct:
                      typeof primary.suggestedChangePct === "number"
                        ? primary.suggestedChangePct
                        : undefined,
                  }
                : undefined,
              targetDays: primary.targetDays || undefined,
              avgDailyUnits: avgDailyUnits || undefined,
              daysCover: daysCover || undefined,
            },
          },
          actions: scored.slice(1, 3).map((candidate) => ({
            action: candidate.action,
            title: candidate.action,
            confidence: candidate.confidence,
            category: candidate.category,
            severity: candidate.severity,
            suggestedQty: candidate.suggestedQty,
            suggestedChangePct: candidate.suggestedChangePct,
          })),
          justification,
          score: {
            impactScore:
              Math.round(
                Math.abs(summary.recentRevenue || 0) / 1000 +
                  Math.abs(summary.recentProfit || 0) / 1000,
              ) || 0,
          },
          notes:
            primary.action === "keep"
              ? "Sin accion automatica. Ajusta con base en margen y demanda."
              : "Recomendacion generada con ventas e inventario recientes.",
        },
      };
    });

    const promotions = this.suggestPromotion(products, sales, {
      staleDays: 45,
      minStock: 8,
      comboSize: 3,
      inventoryMap,
      salesSummary,
      abcMap,
      categoryMap,
      config,
    });

    const payload = {
      generatedAt: now.toISOString(),
      window,
      recommendations,
      promotions,
      metadata: {
        productsAnalyzed: products.length,
        salesAnalyzed: sales.length,
        netProfitRange,
      },
    };

    if (config.cacheEnabled && !bypassCache) {
      try {
        if (redis) {
          await redis.setex(
            cacheKey,
            config.cacheTtlSeconds || 300,
            JSON.stringify(payload),
          );
        }
      } catch {
        // Ignorar fallas de cache
      }
    }

    return payload;
  }

  async updateConfig(businessId, data) {
    let config = await BusinessAssistantConfig.findOne({
      business: businessId,
    });

    if (!config) {
      config = await BusinessAssistantConfig.create({
        ...data,
        business: businessId,
      });
    } else {
      Object.assign(config, data);
      await config.save();
    }

    return config;
  }

  async askAssistant(businessId, question) {
    if (!aiService || !aiService.generateAssistantResponse) {
      throw new Error("AI Service no disponible");
    }

    const businessObjectId = new mongoose.Types.ObjectId(String(businessId));

    const [products, sales, inventory] = await Promise.all([
      Product.find({
        business: businessObjectId,
        isDeleted: { $ne: true },
      })
        .limit(50)
        .lean(),
      Sale.find({ business: businessObjectId })
        .sort({ saleDate: -1 })
        .limit(100)
        .lean(),
      stockRepository.getGlobalInventory(businessId).catch(() => []),
    ]);

    const inventoryMap = this.buildInventoryMap(inventory);
    const salesSummary = this.buildSalesSummary(
      sales,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    );

    const context = {
      totalProducts: products.length,
      totalSales: sales.length,
      topProducts: products.slice(0, 5).map((p) => ({
        name: p.name,
        stock: inventoryMap[p._id?.toString?.()]?.total ?? p.totalStock ?? 0,
        recentUnits: salesSummary.get(p._id?.toString?.())?.recentUnits || 0,
      })),
    };

    const response = await aiService.generateAssistantResponse(
      question,
      context,
    );
    return response;
  }
}
