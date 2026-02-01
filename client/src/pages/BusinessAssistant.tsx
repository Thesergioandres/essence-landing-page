import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  businessAssistantService,
  creditService,
  promotionService,
} from "../api/services";
import { useFeatures } from "../components/FeatureSection";
import type {
  BusinessAssistantConfig,
  BusinessAssistantJobStatus,
  BusinessAssistantRecommendationAction,
  BusinessAssistantRecommendationItem,
  BusinessAssistantRecommendationsResponse,
  CreditMetrics,
} from "../types";

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
      return "bg-green-600/20 text-green-200 border border-green-500/30";
    case "pause_purchases":
      return "bg-yellow-600/20 text-yellow-200 border border-yellow-500/30";
    case "decrease_price":
      return "bg-pink-600/20 text-pink-200 border border-pink-500/30";
    case "increase_price":
      return "bg-purple-600/20 text-purple-200 border border-purple-500/30";
    case "run_promotion":
      return "bg-blue-600/20 text-blue-200 border border-blue-500/30";
    case "review_margin":
      return "bg-orange-600/20 text-orange-200 border border-orange-500/30";
    case "clearance":
      return "bg-red-600/20 text-red-200 border border-red-500/30";
    default:
      return "bg-gray-700/40 text-gray-200 border border-gray-600/40";
  }
};

const severityClasses = (severity?: string) => {
  switch (severity) {
    case "critical":
      return "bg-red-600/20 text-red-200 border border-red-500/30";
    case "high":
      return "bg-orange-600/20 text-orange-200 border border-orange-500/30";
    case "medium":
      return "bg-yellow-600/20 text-yellow-200 border border-yellow-500/30";
    case "low":
      return "bg-green-600/20 text-green-200 border border-green-500/30";
    case "info":
    default:
      return "bg-gray-700/40 text-gray-200 border border-gray-600/40";
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

  // --- STATE PROJECT CEO (Estratega Virtual) ---
  const [analystQuestion, setAnalystQuestion] = useState("");
  const [analystLoading, setAnalystLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analystError, setAnalystError] = useState<string | null>(null);
  const [lastAnalysisDate, setLastAnalysisDate] = useState<string | null>(null);

  // Filtro ABC
  const [abcFilter, setAbcFilter] = useState<"ALL" | "A" | "B" | "C">("ALL");

  // Estado para creación de promos desde AI
  const [creatingPromoIdx, setCreatingPromoIdx] = useState<number | null>(null);
  const [promoSuccessMsg, setPromoSuccessMsg] = useState<string | null>(null);

  // Handler para crear promo desde sugerencia AI
  const handleCreatePromoFromAI = async (
    promo: { title: string; description: string; products: string[] },
    idx: number
  ) => {
    try {
      setCreatingPromoIdx(idx);
      setPromoSuccessMsg(null);

      // Obtener precios de los productos del backend (ya están en recommendations)
      const productPrices: { id: string; price: number }[] = [];
      for (const productId of promo.products) {
        const rec = data?.recommendations?.find(r => r.productId === productId);
        if (rec) {
          productPrices.push({
            id: productId,
            price: rec.metrics.recentAvgPrice || 0,
          });
        }
      }

      // Calcular precio combo con 15% descuento
      const totalPrice = productPrices.reduce((sum, p) => sum + p.price, 0);
      const promoPrice = Math.round(totalPrice * 0.85);

      await promotionService.createFromAI({
        name: promo.title.replace("📦 ", "").replace("🔥 ", ""),
        items: promo.products.map(productId => ({ productId, qty: 1 })),
        price: promoPrice,
        justification: promo.description,
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

  // Cargar memoria del CEO al iniciar
  useEffect(() => {
    const loadMemory = async () => {
      try {
        const res = await businessAssistantService.getLatestAnalysis();
        if (res.success && res.analysis) {
          setAnalysisResult(res.analysis);
          setLastAnalysisDate(res.lastUpdated);
        }
      } catch {
        // Silenciosamente fallar si no hay memoria (es normal la primera vez)
        console.log("No previous CEO memory found.");
      }
    };
    loadMemory();
  }, []);

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

      const q = customQuestion || analystQuestion;
      const res = await businessAssistantService.getStrategicAnalysis(q);

      if (res.success && res.analysis) {
        setAnalysisResult(res.analysis);
        setLastAnalysisDate(new Date().toISOString()); // Set current date
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

  // Métricas adicionales para contexto
  const [creditMetrics, setCreditMetrics] = useState<CreditMetrics | null>(
    null
  );

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
        const response = await businessAssistantService.getRecommendations(
          buildParams(opts)
        );
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
      setConfig(cfg);
      setConfigDraft({
        horizonDaysDefault: cfg.horizonDaysDefault,
        recentDaysDefault: cfg.recentDaysDefault,
        cacheEnabled: cfg.cacheEnabled,
        cacheTtlSeconds: cfg.cacheTtlSeconds,
        targetMarginPct: cfg.targetMarginPct,
        minMarginAfterDiscountPct: cfg.minMarginAfterDiscountPct,
      });

      if (!windowTouched) {
        setHorizonDays(String(cfg.horizonDaysDefault ?? ""));
        setRecentDays(String(cfg.recentDaysDefault ?? ""));
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
      });
      setConfig(updated);
      setConfigDraft({
        horizonDaysDefault: updated.horizonDaysDefault,
        recentDaysDefault: updated.recentDaysDefault,
        cacheEnabled: updated.cacheEnabled,
        cacheTtlSeconds: updated.cacheTtlSeconds,
        targetMarginPct: updated.targetMarginPct,
        minMarginAfterDiscountPct: updated.minMarginAfterDiscountPct,
      });
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
      const created = await businessAssistantService.createRecommendationsJob(
        buildParams({ force: 0 })
      );
      const status = await businessAssistantService.getRecommendationsJob(
        created.jobId
      );
      setJob(status);
    } catch (e: any) {
      setJobError(
        e?.response?.data?.message || "No se pudo crear el job en background"
      );
    } finally {
      setJobLoading(false);
    }
  }, [buildParams]);

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const status =
        await businessAssistantService.getRecommendationsJob(jobId);
      setJob(status);

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
    const raw = data?.recommendations || [];
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
          return b.stock.warehouseStock - a.stock.warehouseStock;
        case "confidence_desc":
        default:
          return (bPrimary?.confidence ?? -1) - (aPrimary?.confidence ?? -1);
      }
    });
  }, [
    actionFilter,
    data?.recommendations,
    onlyActionable,
    search,
    sortBy,
    abcFilter,
  ]);

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

  const renderImpactLine = (
    primary: BusinessAssistantRecommendationAction | null
  ) => {
    if (!primary?.impact) return null;
    const revenue = primary.impact.revenueCop;
    const profit = primary.impact.profitCop;
    const inventory = primary.impact.inventoryValueCop;

    const parts: string[] = [];
    if (typeof revenue === "number" && revenue > 0) {
      parts.push(`Ingresos en riesgo: ${formatCompactCOP(revenue)}`);
    }
    if (typeof profit === "number" && profit > 0) {
      parts.push(`Oportunidad: ${formatCompactCOP(profit)}`);
    }
    if (typeof inventory === "number" && inventory > 0) {
      parts.push(`Inventario: ${formatCompactCOP(inventory)}`);
    }

    if (!parts.length) return null;

    return <p className="mt-2 text-xs text-gray-300">{parts.join(" · ")}</p>;
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
    <div className="space-y-6 overflow-hidden">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">Business Assistant</h1>
        <p className="mt-2 text-gray-300">
          Recomendaciones automáticas por producto basadas en datos reales
          (rotación, tendencia, margen y stock).
        </p>
        {/* Indicadores de módulos activos */}
        <div className="mt-3 flex flex-wrap gap-2">
          {features.inventory && (
            <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-300">
              📦 Inventario
            </span>
          )}
          {features.credits && (
            <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-medium text-orange-300">
              💳 Créditos
            </span>
          )}
          {features.distributors && (
            <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-300">
              👥 Distribuidores
            </span>
          )}
          {features.promotions && (
            <span className="rounded-full bg-pink-500/20 px-3 py-1 text-xs font-medium text-pink-300">
              🎉 Promociones
            </span>
          )}
          {features.gamification && (
            <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-medium text-yellow-300">
              🏆 Gamificación
            </span>
          )}
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
                  {formatCurrencyCOP(creditMetrics.total.totalPaidAmount || 0)}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* SECCIÓN 2: ESTRATEGA VIRTUAL (PROJECT CEO) */}
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-900/20 p-6 shadow-2xl md:p-8">
        {/* Decorative background element */}
        <div className="pointer-events-none absolute right-0 top-0 -mr-10 -mt-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl"></div>

        <div className="relative z-10">
          <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white">
                <span className="text-3xl text-indigo-400">✨</span>
                Estratega Virtual (CEO)
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
                Soy tu consultor de inteligencia artificial. Analizo tus ventas,
                inventario, gastos y deudas en tiempo real para darte
                recomendaciones estratégicas de alto impacto.
              </p>
              {lastAnalysisDate && (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
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
              className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:scale-105 hover:bg-indigo-700 active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
            >
              <span className="mr-2 text-lg">🚀</span>
              {analystLoading ? "Analizando..." : "Generar Análisis Diario"}
              <div className="absolute inset-0 -z-10 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {/* Chat Input */}
            {/* Chat Input */}
            <div className="group relative">
              <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 opacity-30 blur transition duration-500 group-hover:opacity-100"></div>
              <div className="relative flex rounded-lg bg-gray-900">
                <input
                  type="text"
                  placeholder="Pregúntale a tu estratega (ej: ¿Por qué bajó mi margen este mes?)"
                  className="w-full bg-transparent px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none"
                  value={analystQuestion}
                  onChange={e => setAnalystQuestion(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleGenerateAnalysis()}
                  disabled={analystLoading}
                />
                <button
                  onClick={() => handleGenerateAnalysis()}
                  disabled={!analystQuestion.trim() || analystLoading}
                  className="cursor-pointer px-4 text-indigo-400 transition-colors hover:text-indigo-300 disabled:opacity-50"
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

            {/* Response Area */}
            <div className="min-h-[120px] rounded-xl border border-gray-800/50 bg-gray-950/50 p-6 shadow-inner">
              {analystLoading ? (
                <div className="flex flex-col items-center justify-center space-y-4 py-8">
                  <div className="relative">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500/30 border-t-indigo-500"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400"></span>
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
                <div className="prose prose-invert prose-indigo prose-headings:text-white prose-p:text-gray-100 prose-strong:text-white prose-li:text-gray-100 prose-em:text-gray-200 prose-td:text-gray-200 prose-th:text-white prose-blockquote:text-gray-200 prose-a:text-indigo-400 hover:prose-a:text-indigo-300 max-w-none text-white">
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

      <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
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
            <p className="mb-3 text-sm font-semibold text-gray-200">Filtros</p>
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
            <h2 className="text-lg font-semibold text-white">Configuración</h2>
            <p className="mt-1 text-sm text-gray-400">
              Defaults y caché del módulo (admin).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchConfig}
              disabled={configLoading}
              className="rounded-md border border-gray-600/50 bg-gray-900/30 px-4 py-2 text-gray-200 hover:bg-gray-900/50 disabled:opacity-60"
            >
              {configLoading ? "Cargando…" : "Recargar"}
            </button>
            <button
              onClick={saveConfig}
              disabled={configSaving || !configDraft}
              className="rounded-md bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-60"
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
            <span className="text-xs text-gray-400">Horizon default</span>
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
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400">Recent default</span>
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
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400">TTL caché (s)</span>
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
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400">Margen objetivo (%)</span>
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
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400">
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
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-200">
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

        {config?.updatedAt ? (
          <p className="mt-3 text-xs text-gray-500">
            Última actualización:{" "}
            {new Date(config.updatedAt).toLocaleString("es-CO")}
          </p>
        ) : null}
      </div>

      {/* Promotions Section */}
      {data?.promotions && data.promotions.length > 0 && (
        <div className="mb-8 rounded-xl border border-indigo-500/30 bg-indigo-900/10 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            💡 Sugerencias de Marketing{" "}
            <span className="text-xs font-normal text-indigo-300">
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
            {data.promotions.map((promo, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-indigo-500/20 bg-gray-900/40 p-4 shadow-sm transition-transform hover:scale-[1.02]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      promo.type === "combo"
                        ? "bg-purple-500/20 text-purple-300"
                        : "bg-orange-500/20 text-orange-300"
                    }`}
                  >
                    {promo.type}
                  </span>
                </div>
                <h3 className="font-medium text-white">{promo.title}</h3>
                <p className="mt-1 text-sm text-gray-400">
                  {promo.description}
                </p>
                <button
                  type="button"
                  onClick={() => handleCreatePromoFromAI(promo, idx)}
                  disabled={creatingPromoIdx !== null}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingPromoIdx === idx ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Creando...
                    </>
                  ) : (
                    <>⚡ Crear esta Promo</>
                  )}
                </button>
              </div>
            ))}
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
                  ? "border-gray-500 bg-gray-700 text-white"
                  : "border-gray-700 bg-gray-800/50 text-gray-400 hover:bg-gray-800"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setAbcFilter("A")}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                abcFilter === "A"
                  ? "border-green-500 bg-green-500/20 text-green-300"
                  : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-green-500/30 hover:text-green-400"
              }`}
            >
              🟢 Clase A (Top)
            </button>
            <button
              onClick={() => setAbcFilter("B")}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                abcFilter === "B"
                  ? "border-yellow-500 bg-yellow-500/20 text-yellow-300"
                  : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-yellow-500/30 hover:text-yellow-400"
              }`}
            >
              🟡 Clase B
            </button>
            <button
              onClick={() => setAbcFilter("C")}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                abcFilter === "C"
                  ? "border-gray-500 bg-gray-500/20 text-gray-300"
                  : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-500/30 hover:text-gray-300"
              }`}
            >
              ⚪ Clase C
            </button>
          </div>

          {(visibleRecommendations || []).length === 0 ? (
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 text-gray-300">
              No hay recomendaciones para mostrar.
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-4 md:hidden">
                {(visibleRecommendations || []).map(item => (
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
                          {item.categoryName ? `${item.categoryName} · ` : ""}
                          Stock bodega: {item.stock.warehouseStock} · Margen:{" "}
                          {item.metrics.recentMarginPct.toFixed(1)}%
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
                          {item.metrics.recentUnits}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
                        <p className="text-xs text-gray-400">Tendencia</p>
                        <p
                          className={`text-sm font-semibold ${
                            item.metrics.unitsGrowthPct >= 0
                              ? "text-green-300"
                              : "text-red-300"
                          }`}
                        >
                          {item.metrics.unitsGrowthPct >= 0 ? "+" : ""}
                          {item.metrics.unitsGrowthPct.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {item.recommendation.primary?.suggestedQty ? (
                      <p className="mt-3 text-sm text-green-200">
                        Sugerencia: comprar{" "}
                        {item.recommendation.primary.suggestedQty} unidades.
                      </p>
                    ) : null}
                    {typeof item.recommendation.primary?.suggestedChangePct ===
                    "number" ? (
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
                        {(item.recommendation.justification || [])
                          .slice(0, 4)
                          .map((j, idx) => (
                            <li key={idx}>{j}</li>
                          ))}
                      </ul>
                    </div>
                  </div>
                ))}
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
                    {(visibleRecommendations || []).map(item => (
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
                            {item.categoryName ? `${item.categoryName} · ` : ""}
                            Precio promedio:{" "}
                            {formatCurrencyCOP(item.metrics.recentAvgPrice)} ·
                            vs categoría:{" "}
                            {item.metrics.priceVsCategoryPct.toFixed(1)}%
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
                            {item.stock.warehouseStock}
                          </p>
                          <p className="text-xs text-gray-400">
                            Alerta: {item.stock.lowStockAlert}
                            {item.metrics.daysCover !== null
                              ? ` · Cobertura: ${item.metrics.daysCover}d`
                              : ""}
                          </p>
                          {item.recommendation.primary?.suggestedQty ? (
                            <p className="mt-1 text-xs text-green-200">
                              +{item.recommendation.primary.suggestedQty} uds
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {item.metrics.recentUnits}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            item.metrics.unitsGrowthPct >= 0
                              ? "text-green-300"
                              : "text-red-300"
                          }`}
                        >
                          {item.metrics.unitsGrowthPct >= 0 ? "+" : ""}
                          {item.metrics.unitsGrowthPct.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold">
                            {item.metrics.recentMarginPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold">
                            {formatCurrencyCOP(item.metrics.recentRevenue)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
                            {(item.recommendation.justification || [])
                              .slice(0, 3)
                              .map((j, idx) => (
                                <li key={idx}>{j}</li>
                              ))}
                          </ul>
                          {typeof item.recommendation.primary
                            ?.suggestedChangePct === "number" ? (
                            <p className="mt-2 text-xs text-blue-200">
                              Sugerencia: ajuste de precio{" "}
                              {item.recommendation.primary.suggestedChangePct}%.
                            </p>
                          ) : null}

                          {renderPriceLine(item.recommendation.primary)}

                          {renderImpactLine(item.recommendation.primary)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data?.window && (
                <p className="mt-4 text-sm text-gray-400">
                  Nota:{" "}
                  {data.recommendations[0]?.recommendation.notes ||
                    "Las recomendaciones se basan en ventas confirmadas y stock actual."}
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
