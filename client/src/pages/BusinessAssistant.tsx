import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { businessAssistantService } from "../api/services";
import type {
  BusinessAssistantConfig,
  BusinessAssistantJobStatus,
  BusinessAssistantRecommendationAction,
  BusinessAssistantRecommendationItem,
  BusinessAssistantRecommendationsResponse,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] =
    useState<BusinessAssistantRecommendationsResponse | null>(null);

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
      const actionable = Boolean(item.recommendation.primary);
      const matchesOnlyActionable = onlyActionable ? actionable : true;
      return matchesSearch && matchesAction && matchesOnlyActionable;
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
  }, [actionFilter, data?.recommendations, onlyActionable, search, sortBy]);

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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">Business Assistant</h1>
        <p className="mt-2 text-gray-300">
          Recomendaciones automáticas por producto basadas en datos reales
          (rotación, tendencia, margen y stock).
        </p>
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

      {/* Results */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-xl text-gray-200">Analizando productos…</div>
        </div>
      ) : (visibleRecommendations || []).length === 0 ? (
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
                    <p className="truncate text-lg font-semibold text-white">
                      {item.productName}
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      {item.categoryName ? `${item.categoryName} · ` : ""}
                      Stock bodega: {item.stock.warehouseStock} · Margen:{" "}
                      {item.metrics.recentMarginPct.toFixed(1)}%
                    </p>
                    {typeof item.recommendation.score?.impactScore ===
                      "number" && item.recommendation.score.impactScore > 0 ? (
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
                      <p className="font-medium text-white">
                        {item.productName}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {item.categoryName ? `${item.categoryName} · ` : ""}
                        Precio promedio:{" "}
                        {formatCurrencyCOP(item.metrics.recentAvgPrice)} · vs
                        categoría: {item.metrics.priceVsCategoryPct.toFixed(1)}%
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
    </div>
  );
}
