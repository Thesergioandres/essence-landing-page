import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useFeatures } from "../../../components/FeatureSection";
import { businessAssistantService } from "../../business/services";
import { creditService } from "../../credits/services";
import type { CreditMetrics } from "../../credits/types/credit.types";
import {
  categoryService,
  productService,
  stockService,
} from "../../inventory/services/inventory.service";
import type { Category, Product } from "../../inventory/types/product.types";
import { promotionService } from "../../settings/services";
import type {
  BusinessAssistantConfig,
  BusinessAssistantJobStatus,
  BusinessAssistantPromotion,
  BusinessAssistantRecommendationAction,
  BusinessAssistantRecommendationItem,
  BusinessAssistantRecommendationsResponse,
} from "../types/business.types";

const formatCurrencyCOP = (value: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
};

const badgeClasses = (action: string) => {
  switch (action) {
    case "buy_more_inventory":
      return "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30";
    case "pause_purchases":
      return "bg-amber-500/20 text-amber-200 border border-amber-400/30";
    case "decrease_price":
      return "bg-rose-500/20 text-rose-200 border border-rose-400/30";
    case "increase_price":
      return "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30";
    case "run_promotion":
      return "bg-sky-500/20 text-sky-200 border border-sky-400/30";
    case "review_margin":
      return "bg-orange-500/20 text-orange-200 border border-orange-400/30";
    case "clearance":
      return "bg-red-500/20 text-red-200 border border-red-400/30";
    default:
      return "bg-slate-700/40 text-slate-200 border border-slate-600/40";
  }
};

const severityClasses = (severity?: string) => {
  switch (severity) {
    case "critical":
      return "bg-red-500/20 text-red-200 border border-red-400/30";
    case "high":
      return "bg-orange-500/20 text-orange-200 border border-orange-400/30";
    case "medium":
      return "bg-amber-500/20 text-amber-200 border border-amber-400/30";
    case "low":
      return "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30";
    case "info":
    default:
      return "bg-slate-700/40 text-slate-200 border border-slate-600/40";
  }
};

const categoryLabel = (category?: string) => {
  switch (category) {
    case "inventario":
      return "Inventario";
    case "precio":
      return "Precio";
    case "margen":
      return "Margen";
    case "demanda":
      return "Demanda";
    case "operacion":
      return "Operación";
    default:
      return null;
  }
};

const actionLabel = (action: string) => {
  switch (action) {
    case "buy_more_inventory":
      return "Comprar más inventario";
    case "pause_purchases":
      return "Pausar compras";
    case "decrease_price":
      return "Bajar precio";
    case "increase_price":
      return "Subir precio";
    case "run_promotion":
      return "Hacer promoción";
    case "review_margin":
      return "Revisar margen";
    case "clearance":
      return "Liquidación";
    default:
      return "Mantener";
  }
};

const formatCompactCOP = (value: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(Number(value) || 0);
};

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const average = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const isEmptyStrategicAnalysis = (analysis: any) => {
  if (!analysis) return true;
  const hasArrayValues = (arr: any) => Array.isArray(arr) && arr.length > 0;
  const hasMetrics = Boolean(
    analysis.keyMetrics &&
    (analysis.keyMetrics.healthScore ||
      analysis.keyMetrics.growthRate ||
      analysis.keyMetrics.profitTrend)
  );

  return !(
    hasArrayValues(analysis.strengths) ||
    hasArrayValues(analysis.weaknesses) ||
    hasArrayValues(analysis.opportunities) ||
    hasArrayValues(analysis.threats) ||
    hasArrayValues(analysis.recommendations) ||
    hasMetrics
  );
};

const formatAnalysisMarkdown = (raw: any) => {
  if (!raw) return "";

  let analysis = raw;
  if (typeof raw === "string") {
    try {
      analysis = JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  const strengths = Array.isArray(analysis.strengths) ? analysis.strengths : [];
  const weaknesses = Array.isArray(analysis.weaknesses)
    ? analysis.weaknesses
    : [];
  const opportunities = Array.isArray(analysis.opportunities)
    ? analysis.opportunities
    : [];
  const threats = Array.isArray(analysis.threats) ? analysis.threats : [];
  const recommendations = Array.isArray(analysis.recommendations)
    ? analysis.recommendations
    : [];
  const metrics = analysis.keyMetrics || {};
  const summary = analysis.summary ? String(analysis.summary) : null;

  const lines = [
    "### Resumen Ejecutivo",
    "",
    summary ? `> ${summary}` : "",
    "",
    "**Indicadores clave**",
    `- Salud del negocio: ${metrics.healthScore ?? 0}`,
    `- Crecimiento: ${metrics.growthRate ?? 0}%`,
    `- Tendencia de ganancia: ${metrics.profitTrend ?? "stable"}`,
    "",
    "**Fortalezas**",
    strengths.length
      ? strengths.map((item: string) => `- ${item}`).join("\n")
      : "- Aun sin señales claras. Registra ventas e inventario para detectar fortalezas.",
    "",
    "**Debilidades**",
    weaknesses.length
      ? weaknesses.map((item: string) => `- ${item}`).join("\n")
      : "- No se detectan debilidades por ahora. Mantener seguimiento diario.",
    "",
    "**Oportunidades**",
    opportunities.length
      ? opportunities.map((item: string) => `- ${item}`).join("\n")
      : "- Aun no hay oportunidades destacadas. Alimenta el sistema con mas ventas.",
    "",
    "**Riesgos**",
    threats.length
      ? threats.map((item: string) => `- ${item}`).join("\n")
      : "- Sin riesgos criticos detectados. Continuar monitoreo.",
    "",
    "**Recomendaciones**",
    recommendations.length
      ? recommendations.map((item: string) => `- ${item}`).join("\n")
      : "- Aun no hay recomendaciones. Verifica stock, costos y ventas recientes.",
  ].filter(Boolean);

  return lines.join("\n");
};

const baseRecommendations: BusinessAssistantRecommendationItem[] = [
  {
    productId: "base-review-costs",
    productName: "Revision de costos",
    categoryId: null,
    categoryName: "Base",
    abcClass: "C",
    stock: {
      warehouseStock: 0,
      totalStock: 0,
      lowStockAlert: 0,
    },
    metrics: {
      recentDays: 0,
      horizonDays: null,
      recentUnits: 0,
      prevUnits: 0,
      unitsGrowthPct: 0,
      recentRevenue: 0,
      recentProfit: 0,
      recentMarginPct: 0,
      avgDailyUnits: 0,
      daysCover: null,
      recentAvgPrice: 0,
      categoryAvgPrice: 0,
      priceVsCategoryPct: 0,
    },
    recommendation: {
      primary: {
        action: "review_margin",
        title: "Revision de costos",
        confidence: 0.5,
        category: "margen",
        severity: "info",
      },
      actions: [],
      justification: [
        "Actualiza costos y margenes para asegurar precios sostenibles.",
      ],
    },
  },
  {
    productId: "base-first-promo",
    productName: "Guia de primera promo",
    categoryId: null,
    categoryName: "Base",
    abcClass: "C",
    stock: {
      warehouseStock: 0,
      totalStock: 0,
      lowStockAlert: 0,
    },
    metrics: {
      recentDays: 0,
      horizonDays: null,
      recentUnits: 0,
      prevUnits: 0,
      unitsGrowthPct: 0,
      recentRevenue: 0,
      recentProfit: 0,
      recentMarginPct: 0,
      avgDailyUnits: 0,
      daysCover: null,
      recentAvgPrice: 0,
      categoryAvgPrice: 0,
      priceVsCategoryPct: 0,
    },
    recommendation: {
      primary: {
        action: "run_promotion",
        title: "Guia de primera promo",
        confidence: 0.45,
        category: "demanda",
        severity: "info",
      },
      actions: [],
      justification: [
        "Crea una promo simple para reactivar la demanda y medir respuesta.",
      ],
    },
  },
  {
    productId: "base-stock-optimization",
    productName: "Optimizacion de stock",
    categoryId: null,
    categoryName: "Base",
    abcClass: "C",
    stock: {
      warehouseStock: 0,
      totalStock: 0,
      lowStockAlert: 0,
    },
    metrics: {
      recentDays: 0,
      horizonDays: null,
      recentUnits: 0,
      prevUnits: 0,
      unitsGrowthPct: 0,
      recentRevenue: 0,
      recentProfit: 0,
      recentMarginPct: 0,
      avgDailyUnits: 0,
      daysCover: null,
      recentAvgPrice: 0,
      categoryAvgPrice: 0,
      priceVsCategoryPct: 0,
    },
    recommendation: {
      primary: {
        action: "buy_more_inventory",
        title: "Optimizacion de stock",
        confidence: 0.4,
        category: "inventario",
        severity: "info",
      },
      actions: [],
      justification: [
        "Revisa rotacion y ajusta niveles de stock para evitar quiebres.",
      ],
    },
  },
];

export default function BusinessAssistant() {
  // Feature flags
  const features = useFeatures([
    "credits",
    "distributors",
    "inventory",
    "promotions",
    "expenses",
    "gamification",
  ]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] =
    useState<BusinessAssistantRecommendationsResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [globalInventory, setGlobalInventory] = useState<
    Record<
      string,
      {
        total: number;
        warehouse: number;
        branches: number;
        distributors: number;
        unassigned: number;
      }
    >
  >({});
  const navigate = useNavigate();

  // --- STATE PROJECT CEO (Estratega Virtual) ---
  const [analystQuestion, setAnalystQuestion] = useState("");
  const [analystLoading, setAnalystLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analystError, setAnalystError] = useState<string | null>(null);
  const [lastAnalysisDate, setLastAnalysisDate] = useState<string | null>(null);

  // Métricas adicionales para contexto
  const [creditMetrics, setCreditMetrics] = useState<CreditMetrics | null>(
    null
  );

  const buildLocalStrategicAnalysis = useCallback(
    (
      recommendations: BusinessAssistantRecommendationItem[] = [],
      credit: CreditMetrics | null
    ) => {
      const primaryActions = recommendations
        .map(item => item.recommendation.primary)
        .filter(Boolean) as BusinessAssistantRecommendationAction[];

      const actionCounts = primaryActions.reduce<Record<string, number>>(
        (acc, action) => {
          const key = action.action || "none";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        {}
      );

      const confidenceValues = primaryActions
        .map(action => action.confidence ?? 0)
        .filter(value => Number.isFinite(value));
      const avgConfidence = average(confidenceValues);

      const growthValues = recommendations
        .map(item => item.metrics?.unitsGrowthPct)
        .filter(value => Number.isFinite(value) && value !== 0) as number[];
      const avgGrowth = average(growthValues);

      const marginValues = recommendations
        .map(item => item.metrics?.recentMarginPct)
        .filter(value => Number.isFinite(value) && value !== 0) as number[];
      const avgMargin = average(marginValues);

      const overdueCount = credit?.overdue?.count || 0;
      const recoveryRate = Number(credit?.recoveryRate || 0);

      const lowStockCount = actionCounts["buy_more_inventory"] || 0;
      const pauseCount = actionCounts["pause_purchases"] || 0;
      const priceDownCount = actionCounts["decrease_price"] || 0;
      const promoCount = actionCounts["run_promotion"] || 0;

      const baseScore = 62 + avgConfidence * 25;
      const stockPenalty = Math.min(18, lowStockCount * 3);
      const creditPenalty = overdueCount > 0 ? 8 : 0;
      const recoveryBonus = recoveryRate >= 70 ? 6 : recoveryRate >= 50 ? 3 : 0;
      const healthScore = clampNumber(
        Math.round(baseScore - stockPenalty - creditPenalty + recoveryBonus),
        0,
        100
      );

      const profitTrend =
        avgMargin >= 25 ? "up" : avgMargin <= 10 ? "down" : "stable";

      const strengths = [] as string[];
      if (avgConfidence >= 0.7) {
        strengths.push("Recomendaciones con alta confianza disponibles.");
      }
      if (recoveryRate >= 70) {
        strengths.push("Buena recuperacion de cartera (>=70%).");
      }
      if (pauseCount === 0 && lowStockCount === 0) {
        strengths.push("Inventario estable sin alertas criticas.");
      }

      const weaknesses = [] as string[];
      if (lowStockCount > 0) {
        weaknesses.push(`Stock bajo en ${lowStockCount} productos clave.`);
      }
      if (priceDownCount > 0) {
        weaknesses.push("Presion en precios: revisar estrategias de margen.");
      }
      if (overdueCount > 0) {
        weaknesses.push(`Cartera vencida: ${overdueCount} creditos en riesgo.`);
      }

      const opportunities = [] as string[];
      if (promoCount > 0) {
        opportunities.push(
          "Promociones listas para activar y acelerar ventas."
        );
      }
      if (avgGrowth > 0) {
        opportunities.push("Productos con crecimiento positivo sostenido.");
      }

      const threats = [] as string[];
      if (lowStockCount > 3) {
        threats.push("Riesgo de quiebre por bajo stock en varios productos.");
      }
      if (overdueCount > 5) {
        threats.push("Cartera vencida alta puede impactar flujo de caja.");
      }

      const recommendationsText = [] as string[];
      if (lowStockCount > 0) {
        recommendationsText.push("Priorizar reposicion de inventario critico.");
      }
      if (promoCount > 0) {
        recommendationsText.push("Lanzar promociones sugeridas esta semana.");
      }
      if (priceDownCount > 0) {
        recommendationsText.push("Ajustar precios con foco en margen minimo.");
      }
      if (overdueCount > 0) {
        recommendationsText.push("Refuerzo de cobro a clientes con mora.");
      }

      const summary =
        recommendations.length > 0
          ? `Se analizaron ${recommendations.length} productos. ` +
            `Acciones prioritarias: ${lowStockCount} con stock bajo, ` +
            `${priceDownCount} con ajuste de precio y ${promoCount} con promo sugerida.`
          : "No hay recomendaciones suficientes para generar un resumen detallado.";

      return {
        analysis: {
          summary,
          strengths,
          weaknesses,
          opportunities,
          threats,
          keyMetrics: {
            healthScore,
            growthRate: Math.round(avgGrowth * 10) / 10,
            profitTrend,
            customerSatisfaction: undefined,
          },
          recommendations: recommendationsText,
        },
        generatedAt: new Date().toISOString(),
      };
    },
    []
  );

  // Filtro ABC
  const [abcFilter, setAbcFilter] = useState<"ALL" | "A" | "B" | "C">("ALL");

  // Estado para creación de promos desde AI
  const [creatingPromoIdx, setCreatingPromoIdx] = useState<number | null>(null);
  const [promoSuccessMsg, setPromoSuccessMsg] = useState<string | null>(null);
  const [selectedPromoIdx, setSelectedPromoIdx] = useState(0);
  const productMap = useMemo(
    () => new Map(products.map(product => [product._id, product])),
    [products]
  );

  useEffect(() => {
    const total = data?.promotions?.length || 0;
    if (!total) return;
    if (selectedPromoIdx >= total) {
      setSelectedPromoIdx(0);
    }
  }, [data?.promotions?.length, selectedPromoIdx]);

  // Handler para crear promo desde sugerencia AI
  const handleCreatePromoFromAI = async (
    promo: BusinessAssistantPromotion,
    idx: number
  ) => {
    try {
      setCreatingPromoIdx(idx);
      setPromoSuccessMsg(null);

      // Obtener precios de los productos del backend (ya están en recommendations)
      const productPrices: { id: string; price: number }[] = [];
      const distributorPrices: { id: string; price: number }[] = [];
      const recMap = new Map(
        (data?.recommendations || []).map(rec => [rec.productId, rec])
      );
      for (const productId of promo.products) {
        const rec = recMap.get(productId);
        const product = productMap.get(productId);
        const price =
          rec?.metrics.recentAvgPrice ||
          product?.clientPrice ||
          product?.suggestedPrice ||
          0;
        const distributorPrice =
          product?.distributorPrice || product?.clientPrice || price || 0;
        if (!price) continue;
        productPrices.push({ id: productId, price });
        distributorPrices.push({ id: productId, price: distributorPrice });
      }

      if (productPrices.length === 0) {
        throw new Error("No hay precios disponibles para calcular la promo");
      }

      // Calcular precio combo con descuento sugerido
      const totalPrice = productPrices.reduce((sum, p) => sum + p.price, 0);
      const totalDistributorPrice = distributorPrices.reduce(
        (sum, p) => sum + p.price,
        0
      );
      const discountPct = clampNumber(promo.discountPct ?? 15, 0, 90);
      const promoPrice = Math.max(
        0,
        Math.round(totalPrice * (1 - discountPct / 100))
      );
      const promoDistributorPrice = Math.max(
        0,
        Math.round(totalDistributorPrice * (1 - discountPct / 100))
      );

      const comboItems = productPrices.map(item => ({
        product: item.id,
        quantity: 1,
        unitPrice: item.price,
      }));

      await promotionService.create({
        name: promo.title.replace("📦 ", "").replace("🔥 ", ""),
        type: "combo",
        description: promo.description,
        comboItems,
        promotionPrice: promoPrice,
        distributorPrice: promoDistributorPrice,
        originalPrice: Math.round(totalPrice),
        discount: {
          type: "percentage",
          value: discountPct,
        },
        applicableProducts: promo.products,
      });

      setPromoSuccessMsg(
        `✅ Promoción "${promo.title}" creada y activa en catálogo`
      );
      setTimeout(() => setPromoSuccessMsg(null), 5000);
    } catch (err: unknown) {
      console.error("Error creating promo:", err);
      setPromoSuccessMsg(`❌ Error: ${(err as Error).message}`);
    } finally {
      setCreatingPromoIdx(null);
    }
  };

  const handleOpenPromoModal = useCallback(() => {
    const promos = data?.promotions || [];
    const promo = promos[selectedPromoIdx] || promos[0];
    if (!promo) return;
    const cleanName = promo.title.replace("📦 ", "").replace("🔥 ", "").trim();

    navigate("/admin/promotions", {
      state: {
        prefillPromotion: {
          name: cleanName || "Promo sugerida",
          description: promo.description || "",
          type: promo.type || "combo",
          products: promo.products || [],
        },
      },
    });
  }, [data?.promotions, navigate, selectedPromoIdx]);

  const effectiveRecommendations = useMemo(() => {
    const recs = data?.recommendations || [];
    const recsByProduct = new Map(recs.map(item => [item.productId, item]));

    const categoryTotals = new Map<string, { sum: number; count: number }>();
    products.forEach(product => {
      const price = product.clientPrice ?? product.suggestedPrice ?? 0;
      if (!price) return;
      const categoryId =
        typeof product.category === "string"
          ? product.category
          : product.category?._id;
      if (!categoryId) return;
      const current = categoryTotals.get(categoryId) || { sum: 0, count: 0 };
      categoryTotals.set(categoryId, {
        sum: current.sum + price,
        count: current.count + 1,
      });
    });

    const getCategoryAvgPrice = (categoryId?: string | null) => {
      if (!categoryId) return 0;
      const stats = categoryTotals.get(categoryId);
      if (!stats || stats.count === 0) return 0;
      return stats.sum / stats.count;
    };

    const productRecommendations = products.map(product => {
      const existing = recsByProduct.get(product._id);
      if (existing) {
        const categoryName =
          existing.categoryName ||
          (typeof product.category === "object"
            ? product.category?.name
            : null);
        const categoryId =
          existing.categoryId ||
          (typeof product.category === "string"
            ? product.category
            : product.category?._id || null);
        const inventorySnapshot = globalInventory[String(product._id)];
        const totalStock =
          inventorySnapshot?.total ??
          product.totalStock ??
          existing.stock.totalStock ??
          existing.stock.warehouseStock;
        const warehouseStock =
          inventorySnapshot?.warehouse ??
          product.warehouseStock ??
          existing.stock.warehouseStock;
        const branchesStock =
          inventorySnapshot?.branches ?? existing.stock.branchesStock ?? 0;
        const distributorsStock =
          inventorySnapshot?.distributors ??
          existing.stock.distributorsStock ??
          0;
        const unassignedStock =
          inventorySnapshot?.unassigned ?? existing.stock.unassignedStock ?? 0;
        const lowStockAlert =
          product.lowStockAlert ?? existing.stock.lowStockAlert;

        return {
          ...existing,
          categoryName,
          categoryId,
          stock: {
            ...existing.stock,
            totalStock,
            warehouseStock,
            branchesStock,
            distributorsStock,
            unassignedStock,
            lowStockAlert,
          },
        } as BusinessAssistantRecommendationItem;
      }

      const categoryName =
        typeof product.category === "object"
          ? product.category?.name
          : undefined;
      const categoryId =
        typeof product.category === "string"
          ? product.category
          : product.category?._id || null;
      const inventorySnapshot = globalInventory[String(product._id)];
      const totalStock = inventorySnapshot?.total ?? product.totalStock ?? 0;
      const warehouseStock =
        inventorySnapshot?.warehouse ?? product.warehouseStock ?? 0;
      const branchesStock = inventorySnapshot?.branches ?? 0;
      const distributorsStock = inventorySnapshot?.distributors ?? 0;
      const unassignedStock = inventorySnapshot?.unassigned ?? 0;
      const price = product.clientPrice ?? product.suggestedPrice ?? 0;
      const cost = product.averageCost || product.purchasePrice || 0;
      const marginPct = price > 0 ? ((price - cost) / price) * 100 : 0;
      const categoryAvgPrice = getCategoryAvgPrice(categoryId);
      const priceVsCategoryPct =
        categoryAvgPrice > 0
          ? ((price - categoryAvgPrice) / categoryAvgPrice) * 100
          : 0;

      return {
        productId: product._id,
        productName: product.name,
        categoryId,
        categoryName: categoryName || null,
        abcClass: "C",
        stock: {
          warehouseStock,
          branchesStock,
          distributorsStock,
          unassignedStock,
          totalStock,
          lowStockAlert: product.lowStockAlert ?? 0,
        },
        metrics: {
          recentDays: data?.window?.recentDays ?? 0,
          horizonDays: data?.window?.horizonDays ?? null,
          recentUnits: 0,
          prevUnits: 0,
          unitsGrowthPct: 0,
          recentRevenue: 0,
          recentProfit: 0,
          recentMarginPct: marginPct,
          avgDailyUnits: 0,
          daysCover: null,
          recentAvgPrice: price,
          categoryAvgPrice,
          priceVsCategoryPct,
          inventoryValueCop: cost * totalStock,
        },
        recommendation: {
          primary: {
            action: "keep",
            title: "Sin accion sugerida",
            confidence: 0,
            category: "operacion",
            severity: "info",
          },
          actions: [],
          justification: [
            "No hay recomendacion automatica para este producto.",
          ],
        },
      } as BusinessAssistantRecommendationItem;
    });

    if (productRecommendations.length > 0) return productRecommendations;
    if (recs.length > 0) return recs;
    return baseRecommendations;
  }, [data?.recommendations, data?.window, products, globalInventory]);

  // Cargar memoria del CEO al iniciar
  useEffect(() => {
    const loadMemory = async () => {
      try {
        const res = await businessAssistantService.getLatestAnalysis();
        if (res.analysis) {
          const analysis = isEmptyStrategicAnalysis(res.analysis)
            ? buildLocalStrategicAnalysis(
                effectiveRecommendations,
                creditMetrics
              ).analysis
            : res.analysis;
          setAnalysisResult(formatAnalysisMarkdown(analysis));
          setLastAnalysisDate(
            new Date(
              res.analysis.createdAt || new Date().toISOString()
            ).toISOString()
          );
        }
      } catch {
        // Silenciosamente fallar si no hay memoria (es normal la primera vez)
        console.log("No previous CEO memory found.");
      }
    };
    loadMemory();
  }, [buildLocalStrategicAnalysis, creditMetrics, effectiveRecommendations]);

  const getAbcBadgeColor = (abcClass?: string) => {
    switch (abcClass) {
      case "A":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      case "B":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "C":
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const handleGenerateAnalysis = async (customQuestion?: string) => {
    try {
      setAnalystLoading(true);
      setAnalystError(null);
      setAnalysisResult(null);
      setLastAnalysisDate(null); // Reset date on new generation

      if (customQuestion && customQuestion.trim()) {
        setAnalystQuestion(customQuestion);
      }

      const res = await businessAssistantService.getStrategicAnalysis();

      if (res.analysis) {
        const analysis = isEmptyStrategicAnalysis(res.analysis)
          ? buildLocalStrategicAnalysis(effectiveRecommendations, creditMetrics)
              .analysis
          : res.analysis;
        setAnalysisResult(formatAnalysisMarkdown(analysis));
        setLastAnalysisDate(
          new Date(res.generatedAt || new Date().toISOString()).toISOString()
        );
      } else {
        setAnalystError("No se recibió un análisis válido.");
      }
    } catch (e: any) {
      setAnalystError(
        e?.message || "Error al conectar con el Estratega Virtual."
      );
    } finally {
      setAnalystLoading(false);
    }
  };

  const [config, setConfig] = useState<BusinessAssistantConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  const [job, setJob] = useState<BusinessAssistantJobStatus | null>(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<
    | "all"
    | "buy_more_inventory"
    | "pause_purchases"
    | "decrease_price"
    | "increase_price"
    | "run_promotion"
    | "review_margin"
    | "clearance"
    | "none"
  >("all");
  const [onlyActionable, setOnlyActionable] = useState(false);
  const [sortBy, setSortBy] = useState<
    | "confidence_desc"
    | "impact_desc"
    | "revenue_desc"
    | "units_desc"
    | "margin_desc"
    | "stock_desc"
  >("confidence_desc");

  const [windowTouched, setWindowTouched] = useState(false);
  const [recentDays, setRecentDays] = useState<string>("");
  const [horizonDays, setHorizonDays] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [force, setForce] = useState(false);

  const [configDraft, setConfigDraft] = useState<Pick<
    BusinessAssistantConfig,
    | "horizonDaysDefault"
    | "recentDaysDefault"
    | "cacheEnabled"
    | "cacheTtlSeconds"
    | "targetMarginPct"
    | "minMarginAfterDiscountPct"
    | "daysCoverLowThreshold"
    | "buyTargetDays"
    | "marginLowThresholdPct"
    | "priceHighVsCategoryThresholdPct"
    | "priceLowVsCategoryThresholdPct"
    | "newProductGraceDays"
    | "minRecentUnitsForPriceChange"
    | "minRecentUnitsForDemandSignal"
    | "priceElasticity"
    | "clearanceDiscountPct"
    | "categoryOverrides"
    | "productOverrides"
  > | null>(null);

  const pollRef = useRef<number | null>(null);

  const buildParams = useCallback(
    (overrides?: { force?: 1 | 0 }) => {
      const horizonNum =
        horizonDays.trim() === "" ? undefined : Number(horizonDays);
      const recentNum =
        recentDays.trim() === "" ? undefined : Number(recentDays);
      return {
        horizonDays:
          typeof horizonNum === "number" && Number.isFinite(horizonNum)
            ? horizonNum
            : undefined,
        recentDays:
          typeof recentNum === "number" && Number.isFinite(recentNum)
            ? recentNum
            : undefined,
        startDate: startDate.trim() ? startDate : undefined,
        endDate: endDate.trim() ? endDate : undefined,
        force: overrides?.force ?? (force ? 1 : 0),
      };
    },
    [endDate, force, horizonDays, recentDays, startDate]
  );

  const fetchRecommendations = useCallback(
    async (opts?: { force?: 1 | 0 }) => {
      try {
        setError(null);
        setLoading(true);
        const response = await (
          businessAssistantService.getRecommendations as any
        )(buildParams(opts));
        setData(response);
      } catch (e: any) {
        setError(
          e?.response?.data?.message || "No se pudieron cargar recomendaciones"
        );
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [buildParams]
  );

  const fetchConfig = useCallback(async () => {
    try {
      setConfigError(null);
      setConfigLoading(true);
      const cfg = await businessAssistantService.getConfig();
      setConfig(cfg as any);
      setConfigDraft({
        horizonDaysDefault: cfg.horizonDaysDefault ?? 90,
        recentDaysDefault: cfg.recentDaysDefault ?? 30,
        cacheEnabled: cfg.cacheEnabled ?? true,
        cacheTtlSeconds: cfg.cacheTtlSeconds ?? 300,
        targetMarginPct: cfg.targetMarginPct ?? 25,
        minMarginAfterDiscountPct: cfg.minMarginAfterDiscountPct ?? 10,
        daysCoverLowThreshold: cfg.daysCoverLowThreshold ?? 14,
        buyTargetDays: cfg.buyTargetDays ?? 30,
        marginLowThresholdPct: cfg.marginLowThresholdPct ?? 15,
        priceHighVsCategoryThresholdPct:
          cfg.priceHighVsCategoryThresholdPct ?? 10,
        priceLowVsCategoryThresholdPct:
          cfg.priceLowVsCategoryThresholdPct ?? -10,
        newProductGraceDays: cfg.newProductGraceDays ?? 14,
        minRecentUnitsForPriceChange: cfg.minRecentUnitsForPriceChange ?? 3,
        minRecentUnitsForDemandSignal: cfg.minRecentUnitsForDemandSignal ?? 5,
        priceElasticity: cfg.priceElasticity ?? 0.25,
        clearanceDiscountPct: cfg.clearanceDiscountPct ?? -20,
        categoryOverrides: cfg.categoryOverrides ?? [],
        productOverrides: cfg.productOverrides ?? [],
      });

      if (!windowTouched) {
        setHorizonDays(String(cfg.horizonDaysDefault ?? 90));
        setRecentDays(String(cfg.recentDaysDefault ?? 30));
      }
    } catch (e: any) {
      setConfigError(
        e?.response?.data?.message || "No se pudo cargar la configuración"
      );
      setConfig(null);
      setConfigDraft(null);
    } finally {
      setConfigLoading(false);
    }
  }, [windowTouched]);

  const saveConfig = useCallback(async () => {
    if (!configDraft) return;
    try {
      setConfigError(null);
      setConfigSaving(true);
      const updated = await businessAssistantService.updateConfig({
        horizonDaysDefault: Number(configDraft.horizonDaysDefault),
        recentDaysDefault: Number(configDraft.recentDaysDefault),
        cacheEnabled: Boolean(configDraft.cacheEnabled),
        cacheTtlSeconds: Number(configDraft.cacheTtlSeconds),
        targetMarginPct: Number(configDraft.targetMarginPct),
        minMarginAfterDiscountPct: Number(
          configDraft.minMarginAfterDiscountPct
        ),
        daysCoverLowThreshold: Number(configDraft.daysCoverLowThreshold),
        buyTargetDays: Number(configDraft.buyTargetDays),
        marginLowThresholdPct: Number(configDraft.marginLowThresholdPct),
        priceHighVsCategoryThresholdPct: Number(
          configDraft.priceHighVsCategoryThresholdPct
        ),
        priceLowVsCategoryThresholdPct: Number(
          configDraft.priceLowVsCategoryThresholdPct
        ),
        newProductGraceDays: Number(configDraft.newProductGraceDays),
        minRecentUnitsForPriceChange: Number(
          configDraft.minRecentUnitsForPriceChange
        ),
        minRecentUnitsForDemandSignal: Number(
          configDraft.minRecentUnitsForDemandSignal
        ),
        priceElasticity: Number(configDraft.priceElasticity),
        clearanceDiscountPct: Number(configDraft.clearanceDiscountPct),
        categoryOverrides: (configDraft.categoryOverrides || []).filter(
          override => override.categoryId
        ),
        productOverrides: (configDraft.productOverrides || []).filter(
          override => override.productId
        ),
      });
      setConfig(updated as any);
      // Keep the same draft values after save
    } catch (e: any) {
      setConfigError(
        e?.response?.data?.message || "No se pudo guardar la configuración"
      );
    } finally {
      setConfigSaving(false);
    }
  }, [configDraft]);

  const createJob = useCallback(async () => {
    try {
      setJobError(null);
      setJobLoading(true);
      const created = await businessAssistantService.createRecommendationsJob();
      const status = await businessAssistantService.getRecommendationsJob(
        created.jobId
      );
      setJob(status as any);
    } catch (e: any) {
      setJobError(
        e?.response?.data?.message || "No se pudo crear el job en background"
      );
    } finally {
      setJobLoading(false);
    }
  }, []);

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const status =
        await businessAssistantService.getRecommendationsJob(jobId);
      setJob(status as any);

      if (status.status === "completed" && status.result) {
        setData(status.result);
      }
      if (status.status === "completed" || status.status === "failed") {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch (e: any) {
      setJobError(e?.response?.data?.message || "No se pudo consultar el job");
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await productService.getAll({ limit: 5000 });
        const list = Array.isArray(response) ? response : response.data || [];
        setProducts(list as Product[]);
      } catch (error) {
        console.error("Error loading products:", error);
        setProducts([]);
      }
    };
    loadProducts();
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const list = await categoryService.getAll();
        setCategories(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error("Error loading categories:", error);
        setCategories([]);
      }
    };
    loadCategories();
  }, []);

  const updateCategoryOverride = (
    index: number,
    patch: Partial<
      NonNullable<BusinessAssistantConfig["categoryOverrides"]>[number]
    >
  ) => {
    setConfigDraft(prev => {
      if (!prev) return prev;
      const overrides = [...(prev.categoryOverrides || [])];
      overrides[index] = { ...overrides[index], ...patch };
      return { ...prev, categoryOverrides: overrides };
    });
  };

  const updateProductOverride = (
    index: number,
    patch: Partial<
      NonNullable<BusinessAssistantConfig["productOverrides"]>[number]
    >
  ) => {
    setConfigDraft(prev => {
      if (!prev) return prev;
      const overrides = [...(prev.productOverrides || [])];
      overrides[index] = { ...overrides[index], ...patch };
      return { ...prev, productOverrides: overrides };
    });
  };

  const removeCategoryOverride = (index: number) => {
    setConfigDraft(prev => {
      if (!prev) return prev;
      const overrides = [...(prev.categoryOverrides || [])];
      overrides.splice(index, 1);
      return { ...prev, categoryOverrides: overrides };
    });
  };

  const removeProductOverride = (index: number) => {
    setConfigDraft(prev => {
      if (!prev) return prev;
      const overrides = [...(prev.productOverrides || [])];
      overrides.splice(index, 1);
      return { ...prev, productOverrides: overrides };
    });
  };

  const addCategoryOverride = () => {
    setConfigDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        categoryOverrides: [
          ...(prev.categoryOverrides || []),
          {
            categoryId: "",
            targetMarginPct: undefined,
            daysCoverLowThreshold: undefined,
            buyTargetDays: undefined,
            priceHighVsCategoryThresholdPct: undefined,
            priceLowVsCategoryThresholdPct: undefined,
          },
        ],
      };
    });
  };

  const addProductOverride = () => {
    setConfigDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        productOverrides: [
          ...(prev.productOverrides || []),
          {
            productId: "",
            targetMarginPct: undefined,
            daysCoverLowThreshold: undefined,
            buyTargetDays: undefined,
            priceHighVsCategoryThresholdPct: undefined,
            priceLowVsCategoryThresholdPct: undefined,
          },
        ],
      };
    });
  };

  useEffect(() => {
    const loadGlobalInventory = async () => {
      try {
        const res = await stockService.getGlobalInventory();
        const inventory = Array.isArray(res.inventory) ? res.inventory : [];
        const mapped = inventory.reduce<
          Record<
            string,
            {
              total: number;
              warehouse: number;
              branches: number;
              distributors: number;
              unassigned: number;
            }
          >
        >((acc, item: any) => {
          const productId = item.product?._id || item.product?.id;
          if (!productId) return acc;

          const branchDetails = Array.isArray(item.branchDetails)
            ? item.branchDetails
            : [];
          const filteredBranchDetails = branchDetails.filter(
            (detail: { name?: string }) =>
              String(detail?.name || "")
                .trim()
                .toLowerCase() !== "bodega"
          );
          const branchesFromDetails = filteredBranchDetails.reduce(
            (sum: number, detail: { quantity?: number }) =>
              sum + (detail.quantity || 0),
            0
          );
          const branches =
            branchDetails.length > 0 ? branchesFromDetails : item.branches || 0;

          const warehouse = item.warehouse || 0;
          const distributors = item.distributors || 0;
          const total = warehouse + branches + distributors;
          const systemTotal = item.systemTotal || 0;
          const unassigned = systemTotal - total;

          acc[String(productId)] = {
            total,
            warehouse,
            branches,
            distributors,
            unassigned,
          };
          return acc;
        }, {});

        setGlobalInventory(mapped);
      } catch (error) {
        console.error("Error loading global inventory:", error);
        setGlobalInventory({});
      }
    };

    loadGlobalInventory();
  }, []);

  // Cargar métricas adicionales de créditos para contexto
  useEffect(() => {
    const loadAdditionalInsights = async () => {
      try {
        const promises: Promise<any>[] = [];

        if (features.credits) {
          promises.push(
            creditService.getMetrics().catch(() => ({ metrics: null }))
          );
        } else {
          promises.push(Promise.resolve({ metrics: null }));
        }

        const [creditData] = await Promise.all(promises);

        if (creditData?.metrics) {
          setCreditMetrics(creditData.metrics);
        }
      } catch (error) {
        console.error("Error loading additional insights:", error);
      }
    };

    loadAdditionalInsights();
  }, [features.credits]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (!job?.jobId) return;
    if (pollRef.current) return;
    if (job.status === "completed" || job.status === "failed") return;

    pollRef.current = window.setInterval(() => {
      pollJob(job.jobId);
    }, 2000);

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [job?.jobId, job?.status, pollJob]);

  const visibleRecommendations = useMemo(() => {
    const raw = effectiveRecommendations || [];
    const q = search.trim().toLowerCase();

    const filtered = raw.filter(item => {
      const primaryAction = item.recommendation.primary?.action ?? "none";
      const matchesSearch = q
        ? item.productName.toLowerCase().includes(q)
        : true;
      const matchesAction =
        actionFilter === "all" ? true : primaryAction === actionFilter;
      const matchesOnlyActionable = onlyActionable
        ? (item.recommendation.primary?.confidence || 0) > 0.6
        : true;

      const matchesAbc = abcFilter === "ALL" || item.abcClass === abcFilter;

      return (
        matchesSearch && matchesAction && matchesOnlyActionable && matchesAbc
      );
    });

    return [...filtered].sort((a, b) => {
      const aPrimary = a.recommendation.primary;
      const bPrimary = b.recommendation.primary;
      const aImpact = a.recommendation.score?.impactScore ?? 0;
      const bImpact = b.recommendation.score?.impactScore ?? 0;

      switch (sortBy) {
        case "impact_desc":
          return bImpact - aImpact;
        case "revenue_desc":
          return b.metrics.recentRevenue - a.metrics.recentRevenue;
        case "units_desc":
          return b.metrics.recentUnits - a.metrics.recentUnits;
        case "margin_desc":
          return b.metrics.recentMarginPct - a.metrics.recentMarginPct;
        case "stock_desc":
          return b.stock.totalStock - a.stock.totalStock;
        case "confidence_desc":
        default:
          return (bPrimary?.confidence ?? -1) - (aPrimary?.confidence ?? -1);
      }
    });
  }, [
    actionFilter,
    effectiveRecommendations,
    onlyActionable,
    search,
    sortBy,
    abcFilter,
  ]);

  const assistantStats = useMemo(() => {
    const recs = effectiveRecommendations || [];
    const primary = recs
      .map(item => item.recommendation.primary)
      .filter(Boolean) as BusinessAssistantRecommendationAction[];
    const avgConfidence = average(
      primary
        .map(action => action.confidence ?? 0)
        .filter(value => Number.isFinite(value))
    );

    const actionable = primary.filter(
      action => (action.confidence ?? 0) >= 0.6
    ).length;
    const lowStock = primary.filter(
      action => action.action === "buy_more_inventory"
    ).length;
    const priceAdjust = primary.filter(action =>
      ["increase_price", "decrease_price"].includes(action.action)
    ).length;

    return {
      total: recs.length,
      actionable,
      lowStock,
      priceAdjust,
      avgConfidence: avgConfidence ? Math.round(avgConfidence * 100) : 0,
    };
  }, [effectiveRecommendations]);

  const actionPlan = useMemo(() => {
    const recs = effectiveRecommendations || [];
    const primary = recs
      .map(item => item.recommendation.primary)
      .filter(Boolean) as BusinessAssistantRecommendationAction[];
    const counts = primary.reduce<Record<string, number>>((acc, item) => {
      const key = item.action || "none";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const lowStock = counts["buy_more_inventory"] || 0;
    const pricing =
      (counts["increase_price"] || 0) + (counts["decrease_price"] || 0);
    const promotions = counts["run_promotion"] || 0;
    const marginReview = counts["review_margin"] || 0;
    const overdue = creditMetrics?.overdue?.count || 0;

    const plan: string[] = [];
    if (lowStock > 0) {
      plan.push(`Reponer stock critico en ${lowStock} productos.`);
    }
    if (pricing > 0) {
      plan.push(`Revisar precios en ${pricing} productos con alertas.`);
    }
    if (marginReview > 0) {
      plan.push(`Ajustar margen en ${marginReview} referencias sensibles.`);
    }
    if (promotions > 0) {
      plan.push(`Activar ${promotions} promociones sugeridas.`);
    }
    if (overdue > 0) {
      plan.push(`Contactar ${overdue} clientes con credito vencido.`);
    }

    return plan.length > 0
      ? plan
      : ["No hay acciones urgentes. Mantener monitoreo diario."];
  }, [creditMetrics?.overdue?.count, effectiveRecommendations]);

  const criticalItems = useMemo(() => {
    const recs = effectiveRecommendations || [];
    const scored = recs.map(item => {
      const primary = item.recommendation.primary;
      let score = 0;

      if (primary?.action === "buy_more_inventory") score += 5;
      if (primary?.action === "review_margin") score += 4;
      if (primary?.action === "decrease_price") score += 3;
      if ((item.metrics?.recentMarginPct ?? 100) < 10) score += 4;
      if ((item.metrics?.unitsGrowthPct ?? 0) < -10) score += 3;
      if ((item.stock?.totalStock ?? 0) <= (item.stock?.lowStockAlert ?? 0)) {
        score += 3;
      }
      if ((primary?.confidence ?? 0) >= 0.7) score += 1;

      return { item, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ item, score }) => ({ item, score }));
  }, [effectiveRecommendations]);

  const smartAlerts = useMemo(() => {
    const alerts: Array<{ title: string; detail: string; tone: string }> = [];
    const lowStock = (effectiveRecommendations || []).filter(
      item => item.recommendation.primary?.action === "buy_more_inventory"
    ).length;
    const pricing = (effectiveRecommendations || []).filter(item =>
      ["increase_price", "decrease_price"].includes(
        item.recommendation.primary?.action || ""
      )
    ).length;
    const overdue = creditMetrics?.overdue?.count || 0;

    if (lowStock > 0) {
      alerts.push({
        title: "Stock critico",
        detail: `${lowStock} productos requieren reposicion inmediata.`,
        tone: "bg-red-900/20 border-red-700/40 text-red-200",
      });
    }

    if (pricing > 0) {
      alerts.push({
        title: "Alertas de precio",
        detail: `${pricing} productos con ajuste recomendado.`,
        tone: "bg-yellow-900/20 border-yellow-700/40 text-yellow-200",
      });
    }

    if (overdue > 0) {
      alerts.push({
        title: "Cartera vencida",
        detail: `${overdue} creditos con riesgo de mora.`,
        tone: "bg-orange-900/20 border-orange-700/40 text-orange-200",
      });
    }

    return alerts;
  }, [creditMetrics?.overdue?.count, effectiveRecommendations]);

  const renderPrimary = (item: BusinessAssistantRecommendationItem) => {
    const primary = item.recommendation.primary;
    if (!primary) {
      return (
        <span className="inline-flex items-center rounded-full border border-gray-600/40 bg-gray-700/40 px-2 py-1 text-xs text-gray-200">
          Sin acción
        </span>
      );
    }

    const label = actionLabel(primary.action);

    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs ${badgeClasses(
            primary.action
          )}`}
        >
          <span className="font-semibold">{label}</span>
          {typeof primary.confidence === "number" && (
            <span className="text-[11px] text-gray-200/80">
              {(primary.confidence * 100).toFixed(0)}%
            </span>
          )}
        </span>

        {primary.severity ? (
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] ${severityClasses(
              primary.severity
            )}`}
            title="Severidad"
          >
            {String(primary.severity).toUpperCase()}
          </span>
        ) : null}

        {categoryLabel(primary.category) ? (
          <span
            className="inline-flex items-center rounded-full border border-gray-600/40 bg-gray-900/30 px-2 py-1 text-[11px] text-gray-200"
            title="Tipo de sugerencia"
          >
            {categoryLabel(primary.category)}
          </span>
        ) : null}
      </span>
    );
  };

  const hasSalesSignal = (item: BusinessAssistantRecommendationItem) => {
    return (
      (item.recommendation.primary?.confidence || 0) > 0 ||
      item.metrics.recentUnits > 0 ||
      item.metrics.recentRevenue > 0 ||
      (item.metrics.recentSalesCount || 0) > 0
    );
  };

  const formatPctOrDash = (value: number, showDash: boolean) => {
    if (showDash) return "—";
    return `${value.toFixed(1)}%`;
  };

  const getJustificationLines = (item: BusinessAssistantRecommendationItem) => {
    const lines = [...(item.recommendation.justification || [])].filter(
      Boolean
    );
    const showSales = hasSalesSignal(item);
    const showPrice = item.metrics.recentAvgPrice > 0;
    const showCategoryAvg = item.metrics.categoryAvgPrice > 0;
    const inventorySnapshot = globalInventory[String(item.productId)];

    if (inventorySnapshot) {
      lines.push(
        `Stock total: ${inventorySnapshot.total} (Bodega ${inventorySnapshot.warehouse} · Sedes ${inventorySnapshot.branches} · Distribuidores ${inventorySnapshot.distributors})`
      );
      if (inventorySnapshot.unassigned > 0) {
        lines.push(`Sin asignar: ${inventorySnapshot.unassigned}`);
      }
    } else {
      const branches = item.stock.branchesStock ?? 0;
      const distributors = item.stock.distributorsStock ?? 0;
      lines.push(
        `Stock total: ${item.stock.totalStock} (Bodega ${item.stock.warehouseStock} · Sedes ${branches} · Distribuidores ${distributors})`
      );
      if ((item.stock.unassignedStock || 0) > 0) {
        lines.push(`Sin asignar: ${item.stock.unassignedStock}`);
      }
    }

    if (showPrice) {
      const margin = formatPctOrDash(item.metrics.recentMarginPct, false);
      lines.push(
        `Precio promedio: ${formatCurrencyCOP(item.metrics.recentAvgPrice)} · Margen: ${margin}`
      );
    } else {
      lines.push("Precio y margen sin datos recientes.");
    }

    if (showCategoryAvg) {
      lines.push(
        `vs categoría: ${formatPctOrDash(item.metrics.priceVsCategoryPct, false)}`
      );
    } else {
      lines.push("Sin referencia de precio por categoría.");
    }

    if (showSales) {
      lines.push(
        `Ventas ${item.metrics.recentDays}d: ${item.metrics.recentUnits} uds · Ingresos: ${formatCurrencyCOP(item.metrics.recentRevenue)}`
      );
    } else {
      lines.push(`Sin ventas confirmadas en ${item.metrics.recentDays}d.`);
    }

    if (
      item.metrics.daysSinceLastSale !== null &&
      item.metrics.daysSinceLastSale !== undefined
    ) {
      lines.push(`Dias sin venta: ${item.metrics.daysSinceLastSale}`);
    }

    if (item.metrics.daysCover !== null) {
      lines.push(`Cobertura estimada: ${item.metrics.daysCover} dias.`);
    }

    return lines.filter(Boolean);
  };

  const renderImpactLine = (
    primary: BusinessAssistantRecommendationAction | null
  ) => {
    if (!primary?.impact) return null;
    const revenue = primary.impact.revenueCop;
    const profit = primary.impact.profitCop;
    const inventory = primary.impact.inventoryValueCop;

    const parts: string[] = [];
    if (typeof revenue === "number" && revenue > 0) {
      parts.push(`Ingresos estimados: ${formatCompactCOP(revenue)}`);
    }
    if (typeof profit === "number" && profit > 0) {
      parts.push(`Impacto utilidad: ${formatCompactCOP(profit)}`);
    }
    if (typeof inventory === "number" && inventory > 0) {
      parts.push(`Inversion: ${formatCompactCOP(inventory)}`);
    }

    if (!parts.length) return null;

    return <p className="mt-2 text-xs text-gray-300">{parts.join(" · ")}</p>;
  };

  const renderActionButtons = (item: BusinessAssistantRecommendationItem) => {
    const action = item.recommendation.primary?.action;
    const buttons: Array<{
      label: string;
      onClick: () => void;
      tone: "primary" | "secondary";
    }> = [];

    if (action === "buy_more_inventory") {
      buttons.push({
        label: "Registrar entrada",
        onClick: () => navigate("/admin/inventory-entries"),
        tone: "primary",
      });
    }

    if (action === "run_promotion" || action === "clearance") {
      buttons.push({
        label: "Abrir promociones",
        onClick: () => navigate("/admin/promotions"),
        tone: "primary",
      });
    }

    if (
      action === "increase_price" ||
      action === "decrease_price" ||
      action === "review_margin"
    ) {
      buttons.push({
        label: "Editar producto",
        onClick: () => navigate(`/admin/products/${item.productId}/edit`),
        tone: "primary",
      });
    }

    if (action === "pause_purchases") {
      buttons.push({
        label: "Ver inventario",
        onClick: () => navigate("/admin/global-inventory"),
        tone: "secondary",
      });
    }

    buttons.push({
      label: "Ver detalle",
      onClick: () => navigate(`/admin/products/${item.productId}`),
      tone: "secondary",
    });

    if (!buttons.length) return null;

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {buttons.map(button => (
          <button
            key={button.label}
            type="button"
            onClick={button.onClick}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              button.tone === "primary"
                ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-inset ring-cyan-400/40 hover:bg-cyan-500/30"
                : "bg-slate-700/40 text-slate-200 ring-1 ring-inset ring-slate-500/40 hover:bg-slate-600/50"
            }`}
          >
            {button.label}
          </button>
        ))}
      </div>
    );
  };

  const renderPriceLine = (
    primary: BusinessAssistantRecommendationAction | null
  ) => {
    const price = primary?.details?.price;
    if (!price) return null;

    const current = price.currentPriceCop;
    const suggested = price.suggestedPriceCop;
    if (typeof current !== "number" || typeof suggested !== "number")
      return null;

    const parts: string[] = [
      `Precio: ${formatCurrencyCOP(current)} → ${formatCurrencyCOP(suggested)}`,
    ];

    if (typeof price.effectiveChangePct === "number") {
      const sign = price.effectiveChangePct >= 0 ? "+" : "";
      parts.push(`(${sign}${price.effectiveChangePct.toFixed(1)}%)`);
    }

    if (typeof price.floorPriceCop === "number" && price.floorPriceCop > 0) {
      parts.push(`Piso: ${formatCompactCOP(price.floorPriceCop)}`);
    }

    if (typeof price.targetMarginPct === "number") {
      parts.push(`Margen obj: ${price.targetMarginPct.toFixed(0)}%`);
    }

    return <p className="mt-2 text-xs text-gray-300">{parts.join(" · ")}</p>;
  };

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-[radial-gradient(120%_100%_at_0%_0%,#10324A_0%,#0B1220_55%,#080B10_100%)] p-6 shadow-2xl md:p-10"
      style={{
        fontFamily: '"Space Grotesk","Satoshi","Segoe UI",sans-serif',
      }}
    >
      <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="relative space-y-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            ⚡ Panel de inteligencia comercial
          </div>
          <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">
            Business Assistant
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300 md:text-base">
            Recomendaciones accionables por producto con señales de demanda,
            margen real, cobertura de inventario y comparativos por categoría.
          </p>
          {/* Indicadores de módulos activos */}
          <div className="mt-4 flex flex-wrap gap-2">
            {features.inventory && (
              <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-200">
                📦 Inventario
              </span>
            )}
            {features.credits && (
              <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-200">
                💳 Créditos
              </span>
            )}
            {features.distributors && (
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200">
                👥 Distribuidores
              </span>
            )}
            {features.promotions && (
              <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-medium text-sky-200">
                🎯 Promociones
              </span>
            )}
            {features.gamification && (
              <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-medium text-orange-200">
                🏆 Gamificación
              </span>
            )}
          </div>
        </div>

        {/* Estado del asistente */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 shadow-lg shadow-cyan-500/10">
            <p className="text-xs text-cyan-200/80">Productos analizados</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {assistantStats.total}
            </p>
            <p className="text-xs text-slate-300">
              Ventana: {data?.window?.recentDays ?? 0}d /{" "}
              {data?.window?.horizonDays ?? 0}d
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-lg shadow-emerald-500/10">
            <p className="text-xs text-emerald-200/80">
              Acciones con prioridad
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {assistantStats.actionable}
            </p>
            <p className="text-xs text-slate-300">
              Confianza media: {assistantStats.avgConfidence}%
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-lg shadow-amber-500/10">
            <p className="text-xs text-amber-200/80">Alertas de stock</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {assistantStats.lowStock}
            </p>
            <p className="text-xs text-slate-300">Revisar reposiciones hoy</p>
          </div>
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 shadow-lg shadow-sky-500/10">
            <p className="text-xs text-sky-200/80">Ajustes de precio</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {assistantStats.priceAdjust}
            </p>
            <p className="text-xs text-slate-300">Optimizar margen y demanda</p>
          </div>
        </div>

        {/* Resumen de insights del negocio */}
        {features.credits && creditMetrics && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.credits && creditMetrics && (
              <>
                <div className="rounded-xl border border-orange-700/40 bg-orange-900/20 p-4">
                  <p className="text-xs text-orange-300/80">💳 Por cobrar</p>
                  <p className="mt-1 text-xl font-bold text-orange-300">
                    {formatCurrencyCOP(
                      creditMetrics.total.totalRemainingAmount || 0
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {creditMetrics.total.totalCredits || 0} créditos activos
                  </p>
                </div>
                {(creditMetrics.overdue.count || 0) > 0 && (
                  <div className="rounded-xl border border-red-700/40 bg-red-900/20 p-4">
                    <p className="text-xs text-red-300/80">⚠️ Vencidos</p>
                    <p className="mt-1 text-xl font-bold text-red-400">
                      {creditMetrics.overdue.count}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatCurrencyCOP(creditMetrics.overdue.amount || 0)} en
                      riesgo
                    </p>
                  </div>
                )}
                <div className="rounded-xl border border-green-700/40 bg-green-900/20 p-4">
                  <p className="text-xs text-green-300/80">
                    📈 Tasa recuperación
                  </p>
                  <p
                    className={`mt-1 text-xl font-bold ${Number(creditMetrics.recoveryRate || 0) >= 70 ? "text-green-400" : Number(creditMetrics.recoveryRate || 0) >= 50 ? "text-yellow-400" : "text-red-400"}`}
                  >
                    {creditMetrics.recoveryRate || 0}%
                  </p>
                  <p className="text-xs text-gray-400">
                    Cobrado:{" "}
                    {formatCurrencyCOP(
                      creditMetrics.total.totalPaidAmount || 0
                    )}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* SECCIÓN 2: ESTRATEGA VIRTUAL (PROJECT CEO) */}
        <div className="bg-linear-to-br relative mb-10 overflow-hidden rounded-2xl border border-cyan-500/30 from-gray-950 via-slate-900 to-cyan-900/20 p-6 shadow-2xl md:p-8">
          {/* Decorative background element */}
          <div className="pointer-events-none absolute right-0 top-0 -mr-10 -mt-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"></div>

          <div className="relative z-10">
            <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h2 className="flex items-center gap-3 text-2xl font-bold text-white">
                  <span className="text-3xl text-cyan-300">✨</span>
                  Estratega Virtual (CEO)
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
                  Soy tu consultor de inteligencia artificial. Analizo tus
                  ventas, inventario, gastos y deudas en tiempo real para darte
                  recomendaciones estratégicas de alto impacto.
                </p>
                {lastAnalysisDate && (
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200 ring-1 ring-inset ring-cyan-500/30">
                    <span>📅</span>
                    Última actualización:{" "}
                    {new Date(lastAnalysisDate).toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                )}
              </div>
              <button
                onClick={() =>
                  handleGenerateAnalysis(
                    "Dame un Resumen Ejecutivo del estado del negocio hoy"
                  )
                }
                disabled={analystLoading}
                className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-cyan-600 px-6 py-3 font-medium text-white shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:scale-105 hover:bg-cyan-700 active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
              >
                <span className="mr-2 text-lg">🚀</span>
                {analystLoading ? "Analizando..." : "Generar Análisis Diario"}
                <div className="bg-linear-to-r absolute inset-0 -z-10 -translate-x-full from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-gray-300">
              {[
                "Resumen rapido de ventas e inventario",
                "Cuales son los riesgos de esta semana",
                "Acciones prioritarias para margen",
                "Que productos requieren reposicion",
              ].map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setAnalystQuestion(prompt);
                    handleGenerateAnalysis(prompt);
                  }}
                  disabled={analystLoading}
                  className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              {/* Chat Input */}
              {/* Chat Input */}
              <div className="group relative">
                <div className="bg-linear-to-r absolute -inset-0.5 rounded-lg from-cyan-500 to-amber-400 opacity-30 blur transition duration-500 group-hover:opacity-100"></div>
                <div className="relative flex rounded-lg bg-gray-900">
                  <input
                    type="text"
                    placeholder="Pregúntale a tu estratega (ej: ¿Por qué bajó mi margen este mes?)"
                    className="w-full bg-transparent px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none"
                    value={analystQuestion}
                    onChange={e => setAnalystQuestion(e.target.value)}
                    onKeyDown={e =>
                      e.key === "Enter" && handleGenerateAnalysis()
                    }
                    disabled={analystLoading}
                  />
                  <button
                    onClick={() => handleGenerateAnalysis()}
                    disabled={!analystQuestion.trim() || analystLoading}
                    className="cursor-pointer px-4 text-cyan-300 transition-colors hover:text-cyan-200 disabled:opacity-50"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-6 w-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {features.promotions && (data?.promotions?.length || 0) > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={String(selectedPromoIdx)}
                    onChange={e => setSelectedPromoIdx(Number(e.target.value))}
                    className="rounded-lg border border-cyan-500/30 bg-gray-950 px-3 py-2 text-xs font-semibold text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  >
                    {data?.promotions?.map((promo, index) => (
                      <option key={`${promo.title}-${index}`} value={index}>
                        {promo.title?.replace("📦 ", "").replace("🔥 ", "") ||
                          `Promo ${index + 1}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleOpenPromoModal}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                  >
                    ⚡ Abrir promo sugerida
                  </button>
                </div>
              )}

              {/* Response Area */}
              <div className="min-h-[120px] rounded-xl border border-gray-800/50 bg-gray-950/50 p-6 shadow-inner">
                {analystLoading ? (
                  <div className="flex flex-col items-center justify-center space-y-4 py-8">
                    <div className="relative">
                      <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500/30 border-t-cyan-500"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400"></span>
                      </div>
                    </div>
                    <p className="animate-pulse text-sm text-gray-400">
                      Consultando datos financieros en tiempo real...
                    </p>
                  </div>
                ) : analystError ? (
                  <div className="flex items-center gap-3 rounded-lg border border-red-900/20 bg-red-900/10 p-4 text-red-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-6 w-6 shrink-0"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                      />
                    </svg>
                    <p>{analystError}</p>
                  </div>
                ) : analysisResult ? (
                  <div className="prose prose-invert prose-cyan prose-headings:text-white prose-p:text-gray-100 prose-strong:text-white prose-li:text-gray-100 prose-em:text-gray-200 prose-td:text-gray-200 prose-th:text-white prose-blockquote:text-gray-200 prose-a:text-cyan-300 hover:prose-a:text-cyan-200 max-w-none text-white">
                    <ReactMarkdown>{analysisResult}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="mb-3 h-12 w-12 opacity-20"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21l-.394-.433a2.25 2.25 0 00-1.423-1.423L13.5 18l1.183-.394a2.25 2.25 0 001.423-1.423l.394-.433.394.433a2.25 2.25 0 001.423 1.423L20.5 18l-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                      />
                    </svg>
                    <p>Esperando tu consulta estratégica...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Plan del dia y alertas inteligentes */}
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-emerald-600/30 bg-emerald-900/10 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Plan del dia</h3>
              <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                Acciones
              </span>
            </div>
            <ul className="space-y-2 text-sm text-emerald-100">
              {actionPlan.map((item, index) => (
                <li key={`${item}-${index}`} className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/40 text-[10px]">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-purple-600/30 bg-purple-900/10 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Ranking critico
              </h3>
              <span className="rounded-full bg-purple-500/20 px-2 py-1 text-[11px] font-semibold text-purple-200">
                Top 5
              </span>
            </div>
            {criticalItems.length === 0 ? (
              <p className="text-sm text-purple-100">
                No hay productos en riesgo en este momento.
              </p>
            ) : (
              <div className="space-y-3 text-sm text-purple-100">
                {criticalItems.map(({ item, score }) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between rounded-lg border border-purple-500/20 bg-gray-900/30 px-3 py-2"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {item.productName}
                      </p>
                      <p className="text-xs text-purple-200/80">
                        Stock: {item.stock.warehouseStock} · Margen:{" "}
                        {item.metrics.recentMarginPct.toFixed(1)}%
                      </p>
                    </div>
                    <span className="rounded-full bg-purple-500/20 px-2 py-1 text-[11px] text-purple-200">
                      Score {score}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-sky-600/30 bg-sky-900/10 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Alertas inteligentes
              </h3>
              <span className="rounded-full bg-sky-500/20 px-2 py-1 text-[11px] font-semibold text-sky-200">
                Hoy
              </span>
            </div>
            {smartAlerts.length === 0 ? (
              <p className="text-sm text-sky-100">Sin alertas criticas hoy.</p>
            ) : (
              <div className="space-y-3">
                {smartAlerts.map(alert => (
                  <div
                    key={alert.title}
                    className={`rounded-lg border px-3 py-2 text-sm ${alert.tone}`}
                  >
                    <p className="font-semibold">{alert.title}</p>
                    <p className="text-xs text-gray-100/80">{alert.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="text-sm text-gray-400">
              {data?.generatedAt ? (
                <span>
                  Generado: {new Date(data.generatedAt).toLocaleString("es-CO")}
                </span>
              ) : (
                <span>Generando recomendaciones…</span>
              )}
              {data?.window ? (
                <div className="mt-1 text-xs text-gray-500">
                  Ventana: {data.window.recentDays}d (reciente)
                  {data.window.horizonDays !== null
                    ? ` · ${data.window.horizonDays}d (horizonte)`
                    : ""}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                onClick={() => fetchRecommendations()}
                disabled={loading}
                className="rounded-md bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-60"
              >
                {loading ? "Cargando…" : "Actualizar"}
              </button>
              <button
                onClick={() => fetchRecommendations({ force: 1 })}
                disabled={loading}
                className="rounded-md border border-gray-600/50 bg-gray-900/30 px-4 py-2 text-gray-200 hover:bg-gray-900/50 disabled:opacity-60"
                title="Ignora la caché y recalcula en el backend"
              >
                Forzar recálculo
              </button>
              <button
                onClick={createJob}
                disabled={jobLoading}
                className="rounded-md border border-gray-600/50 bg-gray-900/30 px-4 py-2 text-gray-200 hover:bg-gray-900/50 disabled:opacity-60"
                title="Útil para catálogos grandes (procesa en background)"
              >
                {jobLoading ? "Creando job…" : "Generar en background"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-200">
                Filtros
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-gray-400">Buscar producto</span>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Ej: Shampoo, Crema…"
                    className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-gray-400">Acción</span>
                  <select
                    value={actionFilter}
                    onChange={e =>
                      setActionFilter(e.target.value as typeof actionFilter)
                    }
                    className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 outline-none"
                  >
                    <option value="all">Todas</option>
                    <option value="buy_more_inventory">
                      Comprar más inventario
                    </option>
                    <option value="pause_purchases">Pausar compras</option>
                    <option value="decrease_price">Bajar precio</option>
                    <option value="increase_price">Subir precio</option>
                    <option value="run_promotion">Hacer promoción</option>
                    <option value="review_margin">Revisar margen</option>
                    <option value="clearance">Liquidación</option>
                    <option value="none">Sin acción</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={onlyActionable}
                    onChange={e => setOnlyActionable(e.target.checked)}
                  />
                  Solo con acción
                </label>

                <label className="block">
                  <span className="text-xs text-gray-400">Ordenar por</span>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 outline-none"
                  >
                    <option value="confidence_desc">Confianza (desc)</option>
                    <option value="impact_desc">Impacto (desc)</option>
                    <option value="revenue_desc">Ingresos (desc)</option>
                    <option value="units_desc">Unidades (desc)</option>
                    <option value="margin_desc">Margen (desc)</option>
                    <option value="stock_desc">Stock (desc)</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-200">
                Ventana de análisis
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-gray-400">Recent days</span>
                  <input
                    value={recentDays}
                    onChange={e => {
                      setWindowTouched(true);
                      setRecentDays(e.target.value);
                    }}
                    inputMode="numeric"
                    className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-400">Horizon days</span>
                  <input
                    value={horizonDays}
                    onChange={e => {
                      setWindowTouched(true);
                      setHorizonDays(e.target.value);
                    }}
                    inputMode="numeric"
                    className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-400">Desde</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => {
                      setWindowTouched(true);
                      setStartDate(e.target.value);
                    }}
                    className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-400">Hasta</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => {
                      setWindowTouched(true);
                      setEndDate(e.target.value);
                    }}
                    className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 outline-none"
                  />
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={e => setForce(e.target.checked)}
                  />
                  Ignorar caché (force)
                </label>

                <div className="text-xs text-gray-500">
                  Si defines fechas, dominan sobre días.
                </div>
              </div>
            </div>
          </div>

          {(jobError || job) && (
            <div className="mt-4 rounded-md border border-gray-700 bg-gray-900/20 p-3 text-sm text-gray-200">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-semibold">Job:</span>{" "}
                  {job?.jobId ? job.jobId : "—"} ·{" "}
                  <span className="font-semibold">Estado:</span>{" "}
                  {job?.status || "—"}
                </div>
                {job?.jobId ? (
                  <button
                    onClick={() => pollJob(job.jobId)}
                    className="rounded-md border border-gray-600/50 bg-gray-900/30 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-900/50"
                  >
                    Actualizar estado
                  </button>
                ) : null}
              </div>
              {job?.status === "failed" && job.failedReason ? (
                <div className="mt-2 text-xs text-red-200">
                  {job.failedReason}
                </div>
              ) : null}
              {jobError ? (
                <div className="mt-2 text-xs text-red-200">{jobError}</div>
              ) : null}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Configuración
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Parametros base, cache y señales que ajustan las decisiones.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchConfig}
                disabled={configLoading}
                className="rounded-md border border-slate-600/50 bg-slate-950/40 px-4 py-2 text-slate-200 hover:bg-slate-900/60 disabled:opacity-60"
              >
                {configLoading ? "Cargando…" : "Recargar"}
              </button>
              <button
                onClick={saveConfig}
                disabled={configSaving || !configDraft}
                className="rounded-md bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {configSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>

          {configError ? (
            <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {configError}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="block">
              <span className="text-xs text-slate-300">Horizon default</span>
              <input
                value={configDraft?.horizonDaysDefault ?? ""}
                onChange={e =>
                  setConfigDraft(prev =>
                    prev
                      ? { ...prev, horizonDaysDefault: Number(e.target.value) }
                      : prev
                  )
                }
                inputMode="numeric"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Recent default</span>
              <input
                value={configDraft?.recentDaysDefault ?? ""}
                onChange={e =>
                  setConfigDraft(prev =>
                    prev
                      ? { ...prev, recentDaysDefault: Number(e.target.value) }
                      : prev
                  )
                }
                inputMode="numeric"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">TTL caché (s)</span>
              <input
                value={configDraft?.cacheTtlSeconds ?? ""}
                onChange={e =>
                  setConfigDraft(prev =>
                    prev
                      ? { ...prev, cacheTtlSeconds: Number(e.target.value) }
                      : prev
                  )
                }
                inputMode="numeric"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">
                Margen objetivo (%)
              </span>
              <input
                value={configDraft?.targetMarginPct ?? ""}
                onChange={e =>
                  setConfigDraft(prev =>
                    prev
                      ? { ...prev, targetMarginPct: Number(e.target.value) }
                      : prev
                  )
                }
                inputMode="numeric"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">
                Margen mínimo post-desc (%)
              </span>
              <input
                value={configDraft?.minMarginAfterDiscountPct ?? ""}
                onChange={e =>
                  setConfigDraft(prev =>
                    prev
                      ? {
                          ...prev,
                          minMarginAfterDiscountPct: Number(e.target.value),
                        }
                      : prev
                  )
                }
                inputMode="numeric"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={Boolean(configDraft?.cacheEnabled)}
                onChange={e =>
                  setConfigDraft(prev =>
                    prev ? { ...prev, cacheEnabled: e.target.checked } : prev
                  )
                }
              />
              Caché habilitada
            </label>
          </div>

          <div className="mt-6 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold text-white">
              Ajustes avanzados
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Ajusta señales de demanda, inventario y precios para tu negocio.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="text-xs text-slate-300">
                  Cobertura baja (días)
                </span>
                <input
                  value={configDraft?.daysCoverLowThreshold ?? ""}
                  onChange={e =>
                    setConfigDraft(prev =>
                      prev
                        ? {
                            ...prev,
                            daysCoverLowThreshold: Number(e.target.value),
                          }
                        : prev
                    )
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-300">
                  Objetivo compra (días)
                </span>
                <input
                  value={configDraft?.buyTargetDays ?? ""}
                  onChange={e =>
                    setConfigDraft(prev =>
                      prev
                        ? { ...prev, buyTargetDays: Number(e.target.value) }
                        : prev
                    )
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-300">Margen bajo (%)</span>
                <input
                  value={configDraft?.marginLowThresholdPct ?? ""}
                  onChange={e =>
                    setConfigDraft(prev =>
                      prev
                        ? {
                            ...prev,
                            marginLowThresholdPct: Number(e.target.value),
                          }
                        : prev
                    )
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-300">
                  Elasticidad precio
                </span>
                <input
                  value={configDraft?.priceElasticity ?? ""}
                  onChange={e =>
                    setConfigDraft(prev =>
                      prev
                        ? { ...prev, priceElasticity: Number(e.target.value) }
                        : prev
                    )
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-300">
                  Precio alto vs categoría (%)
                </span>
                <input
                  value={configDraft?.priceHighVsCategoryThresholdPct ?? ""}
                  onChange={e =>
                    setConfigDraft(prev =>
                      prev
                        ? {
                            ...prev,
                            priceHighVsCategoryThresholdPct: Number(
                              e.target.value
                            ),
                          }
                        : prev
                    )
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-300">
                  Precio bajo vs categoría (%)
                </span>
                <input
                  value={configDraft?.priceLowVsCategoryThresholdPct ?? ""}
                  onChange={e =>
                    setConfigDraft(prev =>
                      prev
                        ? {
                            ...prev,
                            priceLowVsCategoryThresholdPct: Number(
                              e.target.value
                            ),
                          }
                        : prev
                    )
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-300">
                  Dias gracia producto nuevo
                </span>
                <input
                  value={configDraft?.newProductGraceDays ?? ""}
                  onChange={e =>
                    setConfigDraft(prev =>
                      prev
                        ? {
                            ...prev,
                            newProductGraceDays: Number(e.target.value),
                          }
                        : prev
                    )
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-300">
                  Min uds para precio
                </span>
                <input
                  value={configDraft?.minRecentUnitsForPriceChange ?? ""}
                  onChange={e =>
                    setConfigDraft(prev =>
                      prev
                        ? {
                            ...prev,
                            minRecentUnitsForPriceChange: Number(
                              e.target.value
                            ),
                          }
                        : prev
                    )
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-300">
                  Min uds para demanda
                </span>
                <input
                  value={configDraft?.minRecentUnitsForDemandSignal ?? ""}
                  onChange={e =>
                    setConfigDraft(prev =>
                      prev
                        ? {
                            ...prev,
                            minRecentUnitsForDemandSignal: Number(
                              e.target.value
                            ),
                          }
                        : prev
                    )
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-300">
                  Descuento liquidacion (%)
                </span>
                <input
                  value={configDraft?.clearanceDiscountPct ?? ""}
                  onChange={e =>
                    setConfigDraft(prev =>
                      prev
                        ? {
                            ...prev,
                            clearanceDiscountPct: Number(e.target.value),
                          }
                        : prev
                    )
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </label>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Overrides por categoria
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Ajusta reglas para categorias especificas.
                </p>
              </div>
              <button
                type="button"
                onClick={addCategoryOverride}
                className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-100 ring-1 ring-inset ring-cyan-400/40 hover:bg-cyan-500/30"
              >
                + Agregar categoria
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {(configDraft?.categoryOverrides || []).length === 0 ? (
                <p className="text-xs text-slate-500">
                  No hay overrides por categoria.
                </p>
              ) : (
                (configDraft?.categoryOverrides || []).map(
                  (override, index) => (
                    <div
                      key={`${override.categoryId || "new"}-${index}`}
                      className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3"
                    >
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                        <label className="md:col-span-2">
                          <span className="text-xs text-slate-300">
                            Categoria
                          </span>
                          <select
                            value={override.categoryId || ""}
                            onChange={e =>
                              updateCategoryOverride(index, {
                                categoryId: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                          >
                            <option value="">Seleccionar</option>
                            {categories.map(category => (
                              <option key={category._id} value={category._id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className="text-xs text-slate-300">
                            Margen obj (%)
                          </span>
                          <input
                            value={override.targetMarginPct ?? ""}
                            onChange={e =>
                              updateCategoryOverride(index, {
                                targetMarginPct: Number(e.target.value),
                              })
                            }
                            inputMode="numeric"
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                          />
                        </label>
                        <label>
                          <span className="text-xs text-slate-300">
                            Cobertura baja
                          </span>
                          <input
                            value={override.daysCoverLowThreshold ?? ""}
                            onChange={e =>
                              updateCategoryOverride(index, {
                                daysCoverLowThreshold: Number(e.target.value),
                              })
                            }
                            inputMode="numeric"
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                          />
                        </label>
                        <label>
                          <span className="text-xs text-slate-300">
                            Compra dias
                          </span>
                          <input
                            value={override.buyTargetDays ?? ""}
                            onChange={e =>
                              updateCategoryOverride(index, {
                                buyTargetDays: Number(e.target.value),
                              })
                            }
                            inputMode="numeric"
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                          />
                        </label>
                        <label>
                          <span className="text-xs text-slate-300">
                            Precio alto %
                          </span>
                          <input
                            value={
                              override.priceHighVsCategoryThresholdPct ?? ""
                            }
                            onChange={e =>
                              updateCategoryOverride(index, {
                                priceHighVsCategoryThresholdPct: Number(
                                  e.target.value
                                ),
                              })
                            }
                            inputMode="numeric"
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                          />
                        </label>
                        <label>
                          <span className="text-xs text-slate-300">
                            Precio bajo %
                          </span>
                          <input
                            value={
                              override.priceLowVsCategoryThresholdPct ?? ""
                            }
                            onChange={e =>
                              updateCategoryOverride(index, {
                                priceLowVsCategoryThresholdPct: Number(
                                  e.target.value
                                ),
                              })
                            }
                            inputMode="numeric"
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                          />
                        </label>
                      </div>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => removeCategoryOverride(index)}
                          className="text-xs font-semibold text-rose-200 hover:text-rose-100"
                        >
                          Eliminar override
                        </button>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Overrides por producto
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Ajusta reglas para productos puntuales.
                </p>
              </div>
              <button
                type="button"
                onClick={addProductOverride}
                className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/40 hover:bg-amber-500/30"
              >
                + Agregar producto
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {(configDraft?.productOverrides || []).length === 0 ? (
                <p className="text-xs text-slate-500">
                  No hay overrides por producto.
                </p>
              ) : (
                (configDraft?.productOverrides || []).map((override, index) => (
                  <div
                    key={`${override.productId || "new"}-${index}`}
                    className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3"
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                      <label className="md:col-span-2">
                        <span className="text-xs text-slate-300">Producto</span>
                        <select
                          value={override.productId || ""}
                          onChange={e =>
                            updateProductOverride(index, {
                              productId: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                        >
                          <option value="">Seleccionar</option>
                          {products.map(product => (
                            <option key={product._id} value={product._id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="text-xs text-slate-300">
                          Margen obj (%)
                        </span>
                        <input
                          value={override.targetMarginPct ?? ""}
                          onChange={e =>
                            updateProductOverride(index, {
                              targetMarginPct: Number(e.target.value),
                            })
                          }
                          inputMode="numeric"
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                        />
                      </label>
                      <label>
                        <span className="text-xs text-slate-300">
                          Cobertura baja
                        </span>
                        <input
                          value={override.daysCoverLowThreshold ?? ""}
                          onChange={e =>
                            updateProductOverride(index, {
                              daysCoverLowThreshold: Number(e.target.value),
                            })
                          }
                          inputMode="numeric"
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                        />
                      </label>
                      <label>
                        <span className="text-xs text-slate-300">
                          Compra dias
                        </span>
                        <input
                          value={override.buyTargetDays ?? ""}
                          onChange={e =>
                            updateProductOverride(index, {
                              buyTargetDays: Number(e.target.value),
                            })
                          }
                          inputMode="numeric"
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                        />
                      </label>
                      <label>
                        <span className="text-xs text-slate-300">
                          Precio alto %
                        </span>
                        <input
                          value={override.priceHighVsCategoryThresholdPct ?? ""}
                          onChange={e =>
                            updateProductOverride(index, {
                              priceHighVsCategoryThresholdPct: Number(
                                e.target.value
                              ),
                            })
                          }
                          inputMode="numeric"
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                        />
                      </label>
                      <label>
                        <span className="text-xs text-slate-300">
                          Precio bajo %
                        </span>
                        <input
                          value={override.priceLowVsCategoryThresholdPct ?? ""}
                          onChange={e =>
                            updateProductOverride(index, {
                              priceLowVsCategoryThresholdPct: Number(
                                e.target.value
                              ),
                            })
                          }
                          inputMode="numeric"
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                        />
                      </label>
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => removeProductOverride(index)}
                        className="text-xs font-semibold text-rose-200 hover:text-rose-100"
                      >
                        Eliminar override
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {config?.updatedAt ? (
            <p className="mt-3 text-xs text-slate-500">
              Última actualización:{" "}
              {new Date(config.updatedAt).toLocaleString("es-CO")}
            </p>
          ) : null}
        </div>

        {/* Promotions Section */}
        {data?.promotions && data.promotions.length > 0 && (
          <div className="mb-8 rounded-2xl border border-cyan-500/30 bg-cyan-900/10 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              💡 Sugerencias de Marketing{" "}
              <span className="text-xs font-normal text-cyan-200">
                (Generadas por IA)
              </span>
            </h2>

            {/* Success/Error Message */}
            {promoSuccessMsg && (
              <div
                className={`mt-3 rounded-lg px-4 py-2 text-sm ${
                  promoSuccessMsg.startsWith("✅")
                    ? "border border-green-500/30 bg-green-500/20 text-green-300"
                    : "border border-red-500/30 bg-red-500/20 text-red-300"
                }`}
              >
                {promoSuccessMsg}
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {data.promotions.map((promo, idx) => {
                const promoProducts = (promo.products || [])
                  .map(productId => productMap.get(productId))
                  .filter(Boolean);
                const totalClientPrice = promoProducts.reduce((sum, item) => {
                  const price = item?.clientPrice ?? item?.suggestedPrice ?? 0;
                  return sum + (Number(price) || 0);
                }, 0);
                const totalDistributorPrice = promoProducts.reduce(
                  (sum, item) => {
                    const price =
                      item?.distributorPrice ??
                      item?.clientPrice ??
                      item?.suggestedPrice ??
                      0;
                    return sum + (Number(price) || 0);
                  },
                  0
                );
                const totalCost = promoProducts.reduce((sum, item) => {
                  const cost = item?.averageCost ?? item?.purchasePrice ?? 0;
                  return sum + (Number(cost) || 0);
                }, 0);
                const discountPct = clampNumber(promo.discountPct ?? 0, 0, 90);
                const suggestedClientPrice = Math.max(
                  0,
                  Math.round(totalClientPrice * (1 - discountPct / 100))
                );
                const suggestedDistributorPrice = Math.max(
                  0,
                  Math.round(totalDistributorPrice * (1 - discountPct / 100))
                );
                const clientMarginPct = totalClientPrice
                  ? ((totalClientPrice - totalCost) / totalClientPrice) * 100
                  : 0;
                const distributorMarginPct = totalDistributorPrice
                  ? ((totalDistributorPrice - totalCost) /
                      totalDistributorPrice) *
                    100
                  : 0;
                const promoClientMarginPct = suggestedClientPrice
                  ? ((suggestedClientPrice - totalCost) /
                      suggestedClientPrice) *
                    100
                  : 0;
                const promoDistributorMarginPct = suggestedDistributorPrice
                  ? ((suggestedDistributorPrice - totalCost) /
                      suggestedDistributorPrice) *
                    100
                  : 0;
                const clientSavings = Math.max(
                  0,
                  totalClientPrice - suggestedClientPrice
                );

                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-cyan-500/20 bg-slate-900/50 p-4 shadow-sm transition-transform hover:scale-[1.02]"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                        {promo.type}
                      </span>
                      {promo.strategy && (
                        <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                          {promo.strategy.replace("_", " ")}
                        </span>
                      )}
                      {promo.priority && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            promo.priority === "high"
                              ? "bg-rose-500/20 text-rose-200"
                              : promo.priority === "medium"
                                ? "bg-amber-500/20 text-amber-200"
                                : "bg-emerald-500/20 text-emerald-200"
                          }`}
                        >
                          {promo.priority}
                        </span>
                      )}
                      {typeof promo.discountPct === "number" && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                          -{promo.discountPct}%
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-white">{promo.title}</h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {promo.reason || promo.description}
                    </p>
                    {promo.insights && promo.insights.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-300">
                        {promo.insights.slice(0, 3).map((line, lineIdx) => (
                          <li key={`${line}-${lineIdx}`}>{line}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-xs text-slate-200">
                      <div className="flex flex-wrap gap-2">
                        <span>
                          Cliente: {formatCurrencyCOP(totalClientPrice)}
                        </span>
                        <span>
                          Distribuidor:{" "}
                          {formatCurrencyCOP(totalDistributorPrice)}
                        </span>
                        <span>Compra: {formatCurrencyCOP(totalCost)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-slate-300">
                        <span>
                          Margen cliente: {clientMarginPct.toFixed(1)}%
                        </span>
                        <span>
                          Margen distrib: {distributorMarginPct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-slate-300">
                        <span>
                          Precio promo:{" "}
                          {formatCurrencyCOP(suggestedClientPrice)}
                        </span>
                        <span>
                          Promo distrib:{" "}
                          {formatCurrencyCOP(suggestedDistributorPrice)}
                        </span>
                        <span>
                          Margen promo: {promoClientMarginPct.toFixed(1)}%
                        </span>
                        <span>
                          Margen promo distrib:{" "}
                          {promoDistributorMarginPct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-1 text-slate-300">
                        Ahorro cliente: {formatCurrencyCOP(clientSavings)}
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">
                      Productos: {promo.products?.length || 0}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCreatePromoFromAI(promo, idx)}
                      disabled={creatingPromoIdx !== null}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingPromoIdx === idx ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Creando...
                        </>
                      ) : (
                        <>⚡ Crear promo optimizada</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="text-xl text-gray-200">Analizando productos…</div>
          </div>
        ) : (
          <>
            {/* ABC Filter UI */}
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setAbcFilter("ALL")}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  abcFilter === "ALL"
                    ? "border-slate-500 bg-slate-700 text-white"
                    : "border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setAbcFilter("A")}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  abcFilter === "A"
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                    : "border-slate-700 bg-slate-900/40 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-200"
                }`}
              >
                🟢 Clase A (Top)
              </button>
              <button
                onClick={() => setAbcFilter("B")}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  abcFilter === "B"
                    ? "border-amber-500 bg-amber-500/20 text-amber-200"
                    : "border-slate-700 bg-slate-900/40 text-slate-300 hover:border-amber-500/40 hover:text-amber-200"
                }`}
              >
                🟡 Clase B
              </button>
              <button
                onClick={() => setAbcFilter("C")}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  abcFilter === "C"
                    ? "border-slate-500 bg-slate-500/20 text-slate-200"
                    : "border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500/40 hover:text-slate-200"
                }`}
              >
                ⚪ Clase C
              </button>
            </div>

            {(visibleRecommendations || []).length === 0 ? (
              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 text-gray-300">
                <p className="text-base font-semibold text-white">
                  No hay recomendaciones para mostrar por ahora.
                </p>
                <p className="mt-2 text-sm text-gray-400">
                  Para generar insights automaticos, registra ventas, stock y
                  costos recientes.
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-400">
                  <li>Confirma ventas recientes con estado confirmado.</li>
                  <li>Actualiza stock de bodega y distribuidores.</li>
                  <li>Revisa precios y costos promedio.</li>
                </ul>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-4 md:hidden">
                  {(visibleRecommendations || []).map(item => {
                    const showSales = hasSalesSignal(item);
                    const showPrice = item.metrics.recentAvgPrice > 0;
                    return (
                      <div
                        key={item.productId}
                        className="rounded-xl border border-gray-700 bg-gray-800/50 p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-lg font-semibold text-white">
                                {item.productName}
                              </p>
                              {item.abcClass && (
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getAbcBadgeColor(
                                    item.abcClass
                                  )}`}
                                >
                                  Clase {item.abcClass}
                                  {item.abcClass === "A" && " - Top Seller 🏆"}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-gray-400">
                              {item.categoryName
                                ? `${item.categoryName} · `
                                : ""}
                              Stock total: {item.stock.totalStock} · Bodega:{" "}
                              {item.stock.warehouseStock} · Sedes:{" "}
                              {item.stock.branchesStock ?? 0} · Dist:{" "}
                              {item.stock.distributorsStock ?? 0} · Margen:{" "}
                              {formatPctOrDash(
                                item.metrics.recentMarginPct,
                                !showPrice
                              )}
                            </p>
                            {typeof item.recommendation.score?.impactScore ===
                              "number" &&
                            item.recommendation.score.impactScore > 0 ? (
                              <p className="mt-1 text-xs text-gray-500">
                                Impacto score:{" "}
                                {Math.round(
                                  item.recommendation.score.impactScore
                                ).toLocaleString("es-CO")}
                              </p>
                            ) : null}
                          </div>
                          {renderPrimary(item)}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
                            <p className="text-xs text-gray-400">
                              Unidades ({item.metrics.recentDays}d)
                            </p>
                            <p className="text-sm font-semibold text-white">
                              {showSales ? item.metrics.recentUnits : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
                            <p className="text-xs text-gray-400">Tendencia</p>
                            <p
                              className={`text-sm font-semibold ${
                                !showSales
                                  ? "text-gray-400"
                                  : item.metrics.unitsGrowthPct >= 0
                                    ? "text-green-300"
                                    : "text-red-300"
                              }`}
                            >
                              {showSales
                                ? `${item.metrics.unitsGrowthPct >= 0 ? "+" : ""}${item.metrics.unitsGrowthPct.toFixed(1)}%`
                                : "—"}
                            </p>
                          </div>
                        </div>

                        {item.recommendation.primary?.suggestedQty ? (
                          <p className="mt-3 text-sm text-green-200">
                            Sugerencia: comprar{" "}
                            {item.recommendation.primary.suggestedQty} unidades.
                          </p>
                        ) : null}
                        {typeof item.recommendation.primary
                          ?.suggestedChangePct === "number" ? (
                          <p className="mt-3 text-sm text-blue-200">
                            Sugerencia: ajuste de precio{" "}
                            {item.recommendation.primary.suggestedChangePct}%.
                          </p>
                        ) : null}

                        {renderPriceLine(item.recommendation.primary)}

                        {renderImpactLine(item.recommendation.primary)}

                        <div className="mt-4">
                          <p className="text-sm font-semibold text-gray-200">
                            Justificación
                          </p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-300">
                            {getJustificationLines(item)
                              .slice(0, 5)
                              .map((j, idx) => (
                                <li key={idx}>{j}</li>
                              ))}
                          </ul>
                          {renderActionButtons(item)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-x-auto rounded-xl border border-gray-700 bg-gray-800/50 md:block">
                  <table className="w-full">
                    <thead className="bg-gray-900/50 text-gray-300">
                      <tr>
                        <th className="px-4 py-3 text-left">Producto</th>
                        <th className="px-4 py-3 text-left">Acción</th>
                        <th className="px-4 py-3 text-right">Stock</th>
                        <th className="px-4 py-3 text-right">Unidades</th>
                        <th className="px-4 py-3 text-right">Tendencia</th>
                        <th className="px-4 py-3 text-right">Margen</th>
                        <th className="px-4 py-3 text-right">Ingresos</th>
                        <th className="px-4 py-3 text-left">Justificación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 text-gray-200">
                      {(visibleRecommendations || []).map(item => {
                        const showSales = hasSalesSignal(item);
                        const showCategoryAvg =
                          item.metrics.categoryAvgPrice > 0;
                        const showPrice = item.metrics.recentAvgPrice > 0;
                        return (
                          <tr
                            key={item.productId}
                            className="align-top hover:bg-gray-900/30"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white">
                                  {item.productName}
                                </p>
                                {item.abcClass && (
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getAbcBadgeColor(
                                      item.abcClass
                                    )}`}
                                  >
                                    {item.abcClass}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-gray-400">
                                {item.categoryName
                                  ? `${item.categoryName} · `
                                  : ""}
                                Precio promedio:{" "}
                                {showPrice
                                  ? formatCurrencyCOP(
                                      item.metrics.recentAvgPrice
                                    )
                                  : "—"}{" "}
                                · vs categoría:{" "}
                                {formatPctOrDash(
                                  item.metrics.priceVsCategoryPct,
                                  !showCategoryAvg
                                )}
                              </p>
                              {typeof item.recommendation.score?.impactScore ===
                                "number" &&
                              item.recommendation.score.impactScore > 0 ? (
                                <p className="mt-1 text-xs text-gray-500">
                                  Impacto score:{" "}
                                  {Math.round(
                                    item.recommendation.score.impactScore
                                  ).toLocaleString("es-CO")}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">{renderPrimary(item)}</td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-semibold">
                                {item.stock.totalStock}
                              </p>
                              <p className="text-xs text-gray-400">
                                Bodega: {item.stock.warehouseStock} · Sedes:{" "}
                                {item.stock.branchesStock ?? 0} · Dist:{" "}
                                {item.stock.distributorsStock ?? 0} · Alerta:{" "}
                                {item.stock.lowStockAlert}
                                {item.metrics.daysCover !== null
                                  ? ` · Cobertura: ${item.metrics.daysCover}d`
                                  : ""}
                              </p>
                              {item.recommendation.primary?.suggestedQty ? (
                                <p className="mt-1 text-xs text-green-200">
                                  +{item.recommendation.primary.suggestedQty}{" "}
                                  uds
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {showSales ? item.metrics.recentUnits : "—"}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-semibold ${
                                !showSales
                                  ? "text-gray-400"
                                  : item.metrics.unitsGrowthPct >= 0
                                    ? "text-green-300"
                                    : "text-red-300"
                              }`}
                            >
                              {showSales
                                ? `${item.metrics.unitsGrowthPct >= 0 ? "+" : ""}${item.metrics.unitsGrowthPct.toFixed(1)}%`
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold">
                                {formatPctOrDash(
                                  item.metrics.recentMarginPct,
                                  !showPrice
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold">
                                {showSales
                                  ? formatCurrencyCOP(
                                      item.metrics.recentRevenue
                                    )
                                  : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
                                {getJustificationLines(item)
                                  .slice(0, 4)
                                  .map((j, idx) => (
                                    <li key={idx}>{j}</li>
                                  ))}
                              </ul>
                              {typeof item.recommendation.primary
                                ?.suggestedChangePct === "number" ? (
                                <p className="mt-2 text-xs text-blue-200">
                                  Sugerencia: ajuste de precio{" "}
                                  {
                                    item.recommendation.primary
                                      .suggestedChangePct
                                  }
                                  %.
                                </p>
                              ) : null}

                              {renderPriceLine(item.recommendation.primary)}

                              {renderImpactLine(item.recommendation.primary)}

                              {renderActionButtons(item)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {data?.window && (
                  <p className="mt-4 text-sm text-gray-400">
                    Nota:{" "}
                    {data.recommendations[0]?.recommendation?.notes ||
                      "Las recomendaciones se basan en ventas confirmadas y stock actual."}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
