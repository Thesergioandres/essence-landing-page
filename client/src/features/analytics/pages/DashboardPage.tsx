import {
  BarChart3,
  Calendar,
  DollarSign,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import LoadingSpinner from "../../../shared/components/ui/LoadingSpinner";
import { useDashboardStats } from "../hooks/useDashboardStats";

export default function DashboardPage() {
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">(
    "month"
  );

  // Convert period to date range logic could be here or in hook,
  // but for now, we rely on the hook accepting "period" if backend supports it
  // or we pass raw dates.
  // GetDashboardStatsUseCase uses "startDateStr", "endDateStr".
  // Let's calculate dates here to be safe and explicit.

  const getDates = (p: string) => {
    const end = new Date();
    const start = new Date();
    if (p === "today") start.setHours(0, 0, 0, 0);
    if (p === "week") start.setDate(start.getDate() - 7);
    if (p === "month") start.setMonth(start.getMonth() - 1);
    if (p === "year") start.setFullYear(start.getFullYear() - 1);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  };

  const { stats, loading, error, setFilters } = useDashboardStats(
    getDates(period)
  );

  const handlePeriodChange = (
    newPeriod: "today" | "week" | "month" | "year"
  ) => {
    setPeriod(newPeriod);
    setFilters(getDates(newPeriod));
  };

  if (loading)
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" message="Calculando estadísticas..." />
      </div>
    );
  if (error)
    return (
      <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-6 text-red-500">
        {error}
      </div>
    );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
            <BarChart3 className="h-8 w-8 text-purple-500" /> Dashboard
          </h1>
          <p className="mt-1 text-gray-400">
            Resumen ejecutivo del negocio (V2)
          </p>
        </div>

        <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-1">
          {(["today", "week", "month", "year"] as const).map(p => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                period === p
                  ? "bg-purple-600 text-white shadow"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {p === "today"
                ? "Hoy"
                : p === "week"
                  ? "Semana"
                  : p === "month"
                    ? "Mes"
                    : "Año"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-700/50 bg-gray-800/40 p-5 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-lg bg-green-500/20 p-2 text-green-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-gray-400">
              Ingresos Totales
            </span>
          </div>
          <p className="text-2xl font-bold text-white">
            ${stats.totalRevenue?.toLocaleString() || 0}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gray-800/40 p-5 backdrop-blur-sm">
          <div className="absolute right-0 top-0 -mr-4 -mt-4 h-16 w-16 rounded-full bg-purple-500/10 blur-xl"></div>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/20 p-2 text-purple-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-gray-400">
              Ganancia Neta
            </span>
          </div>
          <p className="text-2xl font-bold text-white">
            ${stats.totalNetProfit?.toLocaleString() || 0}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-700/50 bg-gray-800/40 p-5 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-gray-400">Ventas</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {stats.totalSalesCount || 0}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-700/50 bg-gray-800/40 p-5 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-lg bg-orange-500/20 p-2 text-orange-400">
              <Calendar className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-gray-400">
              Ticket Promedio
            </span>
          </div>
          <p className="text-2xl font-bold text-white">
            ${stats.averageTicket?.toLocaleString() || 0}
          </p>
        </div>
      </div>

      {/* Chart Section Placeholder */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="min-h-[300px] rounded-2xl border border-gray-700/50 bg-gray-800/40 p-6">
          <h3 className="mb-6 text-lg font-semibold text-white">
            Tendencia de Ventas
          </h3>
          {/* Here we would wrap chart library. For now, simple visualization or placeholder */}
          {stats.salesTimeline ? (
            <div className="mt-8 flex h-40 items-end gap-2">
              {/* Simple CSS Bar representation if library not available or complex */}
              {stats.salesTimeline.map((point: any, i: number) => (
                <div
                  key={i}
                  className="group relative flex-1 rounded-t-sm bg-purple-600/50 hover:bg-purple-500"
                  style={{
                    height: `${Math.min(100, (point.value / 100000) * 100)}%`,
                  }}
                >
                  <div className="absolute bottom-full z-10 mb-2 hidden rounded bg-black p-1 text-xs text-white group-hover:block">
                    ${point.value}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              No hay datos suficientes para graficar
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-700/50 bg-gray-800/40 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Productos Top
          </h3>
          <div className="space-y-4">
            {stats.topProducts?.map((prod: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-gray-900/30 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-gray-500">
                    #{i + 1}
                  </span>
                  <span className="font-medium text-white">{prod.name}</span>
                </div>
                <span className="font-bold text-purple-400">
                  ${prod.revenue?.toLocaleString()}
                </span>
              </div>
            ))}
            {(!stats.topProducts || stats.topProducts.length === 0) && (
              <p className="py-8 text-center text-gray-500">
                No hay productos top
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
