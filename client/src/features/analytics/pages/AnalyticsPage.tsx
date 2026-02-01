import { useCallback, useEffect, useMemo, useState } from "react";
import AnalyticsCharts from "../../../components/analytics/AnalyticsCharts";
import ProfitHistoryTable from "../../../components/analytics/ProfitHistoryTable";
import { analyticsService } from "../../analytics/services";
import type { MonthlyProfitData } from "../../../types";

const toISO = (d: Date) => d.toISOString().slice(0, 10);

const currency = (n: number | undefined) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"charts" | "history">("charts");

  const [monthly, setMonthly] = useState<MonthlyProfitData | null>(null);

  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return { startDate: toISO(start), endDate: toISO(end) };
  });

  const filters = useMemo(
    () => ({
      ...(dateRange.startDate && { startDate: dateRange.startDate }),
      ...(dateRange.endDate && { endDate: dateRange.endDate }),
    }),
    [dateRange]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Solo cargamos la data mensual para las tarjetas superiores
      const monthlyRes = await analyticsService.getMonthlyProfit(filters);
      setMonthly(monthlyRes);
    } catch (err: any) {
      console.error("Error cargando analytics", err);
      setError(err?.message || "No se pudo cargar analytics");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setDateRange({ startDate: toISO(start), endDate: toISO(end) });
  };

  return (
    <div className="animate-fade-in space-y-6 overflow-hidden p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-purple-300/70">
            Centro Financiero
          </p>
          <h1 className="text-3xl font-bold text-white">Resultados</h1>
          <p className="text-sm text-gray-400">
            Visión unificada de ventas, gastos y utilidades.
          </p>
        </div>

        {/* Date Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setQuickRange(30)}
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 hover:border-purple-400 hover:text-white"
          >
            30 días
          </button>
          <button
            onClick={() => setQuickRange(90)}
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 hover:border-purple-400 hover:text-white"
          >
            Trimestre
          </button>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={e =>
              setDateRange({ ...dateRange, startDate: e.target.value })
            }
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <span className="text-gray-500">-</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={e =>
              setDateRange({ ...dateRange, endDate: e.target.value })
            }
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <button
            onClick={loadData}
            className="ml-2 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-500"
          >
            ↻
          </button>
        </div>
      </div>

      {/* KPI Cards (P&L) */}
      <div
        className={`grid grid-cols-1 gap-4 transition-opacity lg:grid-cols-4 ${loading ? "opacity-50" : ""}`}
      >
        <StatCard
          title="Ingresos Totales"
          subtitle="Facturación bruta"
          value={currency(monthly?.currentMonth?.revenue || 0)}
          tone="neutral"
        />
        <StatCard
          title="Margen Bruto"
          subtitle="Ventas - Costos"
          value={currency(monthly?.currentMonth?.totalProfit || 0)}
          tone="positive"
        />
        <StatCard
          title="Gastos Operativos"
          subtitle="Recurrentes (OPEX)"
          value={currency(monthly?.currentMonth?.totalOPEX || 0)}
          tone="negative"
        />
        <StatCard
          title="Dinero en la Calle"
          subtitle="Cuentas por Cobrar"
          value={currency((monthly as any)?.accountsReceivable || 0)}
          tone="neutral"
        />
      </div>

      {/* EBIT Highlights */}
      <div className="group relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center shadow-lg">
        <div className="bg-linear-to-r absolute inset-x-0 top-0 h-1 from-transparent via-purple-500/50 to-transparent opacity-50" />
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
          Utilidad Neta Operativa (EBIT)
        </h3>
        <div
          className={`text-4xl font-extrabold tracking-tight md:text-5xl ${(monthly?.currentMonth?.netOperationProfit || 0) >= 0 ? "text-emerald-400" : "text-red-500"}`}
        >
          {currency(monthly?.currentMonth?.netOperationProfit || 0)}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-gray-500 opacity-80">
          <span>
            Margen {currency(monthly?.currentMonth?.totalProfit || 0)}
          </span>
          <span>-</span>
          <span>Gastos {currency(monthly?.currentMonth?.totalOPEX || 0)}</span>
          <span>=</span>
          <span
            className={
              (monthly?.currentMonth?.netOperationProfit || 0) >= 0
                ? "text-emerald-400"
                : "text-red-400"
            }
          >
            Resultado
          </span>
        </div>
      </div>

      {error && (
        <p className="rounded border border-red-900/50 bg-red-900/10 p-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* TABS Navigation */}
      <div className="border-b border-gray-800">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("charts")}
            className={`
                whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium
                ${
                  activeTab === "charts"
                    ? "border-purple-500 text-purple-400"
                    : "border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300"
                }
              `}
          >
            📊 Visión Gráfica
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`
                whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium
                ${
                  activeTab === "history"
                    ? "border-purple-500 text-purple-400"
                    : "border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300"
                }
              `}
          >
            📅 Histórico Detallado
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === "charts" ? (
          <AnalyticsCharts dateRange={dateRange} />
        ) : (
          <ProfitHistoryTable dateRange={dateRange} />
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  tone = "neutral",
}: {
  title: string;
  value: string;
  subtitle?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
        ? "text-red-400"
        : "text-white";

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-4 shadow-sm transition hover:border-gray-700">
      <p className="text-xs uppercase tracking-wide text-gray-400">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}
