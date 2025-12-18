import { useEffect, useState } from "react";
import { analyticsService } from "../api/services";
import type {
  AnalyticsDashboard,
  Averages,
  DistributorProfit,
  FinancialSummary,
  MonthlyProfitData,
  ProductProfit,
  TimelineData,
} from "../types";

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyProfitData | null>(
    null
  );
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [productProfits, setProductProfits] = useState<ProductProfit[]>([]);
  const [distributorProfits, setDistributorProfits] = useState<
    DistributorProfit[]
  >([]);
  const [averages, setAverages] = useState<Averages | null>(null);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [financialSummary, setFinancialSummary] =
    useState<FinancialSummary | null>(null);

  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [distributorSearch, setDistributorSearch] = useState("");
  const [topLimit, setTopLimit] = useState(25);

  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  const [period, setPeriod] = useState<"day" | "week" | "month">("month");
  const [timelineDays, setTimelineDays] = useState(30);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [monthly, dash, products, distributors, avg, time, financial] =
        await Promise.all([
          analyticsService.getMonthlyProfit(),
          analyticsService.getAnalyticsDashboard(),
          analyticsService.getProfitByProduct(),
          analyticsService.getProfitByDistributor(),
          analyticsService.getAverages("month"),
          analyticsService.getSalesTimeline(30),
          analyticsService.getFinancialSummary(),
        ]);

      setMonthlyData(monthly);
      setDashboard(dash);
      setProductProfits(products);
      setDistributorProfits(distributors);
      setAverages(avg);
      setTimeline(time);
      setFinancialSummary(financial);
    } catch (error) {
      console.error("Error cargando analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateDateRange = (start: string, end: string) => {
    if (!start || !end) return true;
    return start <= end;
  };

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    const toInput = (d: Date) => d.toISOString().slice(0, 10);
    setDateRange({ startDate: toInput(start), endDate: toInput(end) });
  };

  const clearFilters = async () => {
    setFiltersError(null);
    setDateRange({ startDate: "", endDate: "" });
    setPeriod("month");
    setTimelineDays(30);
    setProductSearch("");
    setDistributorSearch("");
    setTopLimit(25);
    await loadAnalytics();
  };

  const applyFilters = async () => {
    try {
      setFiltersError(null);

      if (!validateDateRange(dateRange.startDate, dateRange.endDate)) {
        setFiltersError("La fecha inicio no puede ser mayor que la fecha fin.");
        return;
      }

      setLoading(true);
      const filters = {
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      };

      const [products, distributors, financial, avg, time] = await Promise.all([
        analyticsService.getProfitByProduct(filters),
        analyticsService.getProfitByDistributor(filters),
        analyticsService.getFinancialSummary(filters),
        analyticsService.getAverages(period, filters),
        analyticsService.getSalesTimeline({ days: timelineDays, ...filters }),
      ]);

      setProductProfits(products);
      setDistributorProfits(distributors);
      setFinancialSummary(financial);
      setAverages(avg);
      setTimeline(time);
    } catch (error) {
      console.error("Error aplicando filtros:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePeriod = async (newPeriod: "day" | "week" | "month") => {
    setPeriod(newPeriod);
    try {
      const filters = {
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      };
      const avg = await analyticsService.getAverages(newPeriod, filters);
      setAverages(avg);
    } catch (error) {
      console.error("Error actualizando período:", error);
    }
  };

  const updateTimeline = async (days: number) => {
    setTimelineDays(days);
    try {
      const filters = {
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      };
      const time = await analyticsService.getSalesTimeline({
        days,
        ...filters,
      });
      setTimeline(time);
    } catch (error) {
      console.error("Error actualizando timeline:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const normalizedIncludes = (haystack: string, needle: string) => {
    const h = (haystack || "").toLowerCase();
    const n = (needle || "").trim().toLowerCase();
    if (!n) return true;
    return h.includes(n);
  };

  const visibleProductProfits = productProfits
    .filter(p => normalizedIncludes(p.productName || "", productSearch))
    .slice(0, topLimit);

  const visibleDistributorProfits = distributorProfits
    .filter(d => normalizedIncludes(d.distributorName || "", distributorSearch))
    .slice(0, topLimit);

  const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);

    const escapeCell = (value: unknown) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // Escape RFC4180-ish
      if (/[\n\r",]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(h => escapeCell(row[h])).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${filename}_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-gray-200">Cargando analytics...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-4xl font-bold text-white">
        📊 Analytics y Reportes
      </h1>

      {/* Filtros de Fecha */}
      <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="mb-4 text-2xl font-semibold text-white">Filtros</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={e =>
                setDateRange({ ...dateRange, startDate: e.target.value })
              }
              className="w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Fecha Fin
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={e =>
                setDateRange({ ...dateRange, endDate: e.target.value })
              }
              className="w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Promedios
            </label>
            <select
              value={period}
              onChange={e => updatePeriod(e.target.value as any)}
              className="w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
            >
              <option value="day">Diario</option>
              <option value="week">Semanal</option>
              <option value="month">Mensual</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={applyFilters}
              className="w-full rounded-md bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
            >
              Aplicar Filtros
            </button>
            <button
              onClick={clearFilters}
              className="w-full rounded-md border border-gray-700 bg-gray-900/40 px-4 py-2 text-gray-100 hover:bg-gray-800"
            >
              Limpiar
            </button>
          </div>
        </div>

        {filtersError && (
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {filtersError}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setQuickRange(7)}
            className="rounded-md border border-gray-700 px-3 py-1 text-sm text-gray-200 hover:bg-gray-800"
          >
            Últimos 7 días
          </button>
          <button
            onClick={() => setQuickRange(30)}
            className="rounded-md border border-gray-700 px-3 py-1 text-sm text-gray-200 hover:bg-gray-800"
          >
            Últimos 30 días
          </button>
          <button
            onClick={() => setQuickRange(90)}
            className="rounded-md border border-gray-700 px-3 py-1 text-sm text-gray-200 hover:bg-gray-800"
          >
            Últimos 90 días
          </button>

          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-gray-300">Timeline</label>
            <select
              value={timelineDays}
              onChange={e => updateTimeline(parseInt(e.target.value, 10))}
              className="rounded-md border border-gray-700 bg-gray-900/40 px-3 py-1 text-sm text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
            >
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dashboard del Mes */}
      {dashboard && (
        <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-2xl font-semibold text-white">
            ⭐ Vista rápida (este mes)
          </h2>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <p className="text-sm text-gray-400">Ingresos</p>
              <p className="text-2xl font-bold text-blue-400">
                {formatCurrency(dashboard.monthlyTotals.totalRevenue)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <p className="text-sm text-gray-400">Ganancia</p>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(dashboard.monthlyTotals.totalProfit)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <p className="text-sm text-gray-400">Ventas</p>
              <p className="text-2xl font-bold text-purple-400">
                {dashboard.monthlyTotals.totalSales}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Top productos
                </h3>
                <button
                  onClick={() =>
                    exportToCSV(
                      (dashboard.topProducts || []).map(p => ({
                        name: p.name,
                        totalQuantity: p.totalQuantity,
                        totalProfit: p.totalProfit,
                      })),
                      "top_products_mes"
                    )
                  }
                  className="rounded-md border border-gray-700 px-3 py-1 text-sm text-gray-200 hover:bg-gray-800"
                >
                  CSV
                </button>
              </div>
              <div className="space-y-2">
                {(dashboard.topProducts || []).slice(0, 5).map(p => (
                  <div
                    key={p._id}
                    className="flex items-center justify-between rounded-md border border-gray-700/60 bg-gray-950/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-100">
                        {p.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.totalQuantity} unidades
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-green-300">
                      {formatCurrency(p.totalProfit)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Top distribuidores
                </h3>
                <button
                  onClick={() =>
                    exportToCSV(
                      (dashboard.topDistributors || []).map(d => ({
                        name: d.name,
                        totalSales: d.totalSales,
                        totalProfit: d.totalProfit,
                      })),
                      "top_distributors_mes"
                    )
                  }
                  className="rounded-md border border-gray-700 px-3 py-1 text-sm text-gray-200 hover:bg-gray-800"
                >
                  CSV
                </button>
              </div>
              <div className="space-y-2">
                {(dashboard.topDistributors || []).slice(0, 5).map(d => (
                  <div
                    key={d._id}
                    className="flex items-center justify-between rounded-md border border-gray-700/60 bg-gray-950/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-100">
                        {d.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {d.totalSales} ventas
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-purple-300">
                      {formatCurrency(d.totalProfit)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumen Mensual */}
      {monthlyData && (
        <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-2xl font-semibold text-white">
            📅 Resumen del Mes
          </h2>

          {/* Debug Info - TEMPORAL */}
          {import.meta.env.DEV && monthlyData._debug && (
            <div className="mb-4 rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
              <p className="font-bold text-yellow-300">
                🐛 DEBUG INFO (Backend):
              </p>
              <p className="text-yellow-200">
                Hora UTC:{" "}
                {new Date(monthlyData._debug.nowUTC).toLocaleString("es-CO")}
              </p>
              <p className="text-yellow-200">
                Hora Colombia:{" "}
                {new Date(monthlyData._debug.nowColombia).toLocaleString(
                  "es-CO"
                )}
              </p>
              <p className="text-yellow-200">
                Rango mes actual:{" "}
                {new Date(monthlyData._debug.startOfMonth).toLocaleDateString(
                  "es-CO"
                )}{" "}
                -{" "}
                {new Date(monthlyData._debug.endOfMonth).toLocaleDateString(
                  "es-CO"
                )}
              </p>
              <p className="text-yellow-200">
                Ventas encontradas mes actual:{" "}
                {monthlyData._debug.currentMonthSalesCount}
              </p>
              <p className="text-yellow-200">
                Ventas encontradas mes anterior:{" "}
                {monthlyData._debug.lastMonthSalesCount}
              </p>
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <p className="text-sm text-gray-400">Ganancia Total</p>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(monthlyData.currentMonth.totalProfit)}
              </p>
              <p
                className={`text-sm ${monthlyData.growthPercentage >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {formatPercent(monthlyData.growthPercentage)} vs mes anterior
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <p className="text-sm text-gray-400">Ingresos</p>
              <p className="text-2xl font-bold text-blue-400">
                {formatCurrency(monthlyData.currentMonth.revenue)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <p className="text-sm text-gray-400">Ventas</p>
              <p className="text-2xl font-bold text-purple-300">
                {monthlyData.currentMonth.salesCount}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <p className="text-sm text-gray-400">Ticket Promedio</p>
              <p className="text-2xl font-bold text-orange-300">
                {formatCurrency(monthlyData.averageTicket)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 text-gray-200 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-lg font-semibold text-white">
                Mes Actual
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Ganancia Admin:</span>
                  <span className="font-semibold">
                    {formatCurrency(monthlyData.currentMonth.adminProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Ganancia Distribuidores:</span>
                  <span className="font-semibold">
                    {formatCurrency(monthlyData.currentMonth.distributorProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Costos:</span>
                  <span className="font-semibold">
                    {formatCurrency(monthlyData.currentMonth.cost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Unidades Vendidas:</span>
                  <span className="font-semibold">
                    {monthlyData.currentMonth.unitsCount}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold text-white">
                Mes Anterior
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Ganancia Admin:</span>
                  <span className="font-semibold">
                    {formatCurrency(monthlyData.lastMonth.adminProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Ganancia Distribuidores:</span>
                  <span className="font-semibold">
                    {formatCurrency(monthlyData.lastMonth.distributorProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Costos:</span>
                  <span className="font-semibold">
                    {formatCurrency(monthlyData.lastMonth.cost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Unidades Vendidas:</span>
                  <span className="font-semibold">
                    {monthlyData.lastMonth.unitsCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumen Financiero */}
      {financialSummary && (
        <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-2xl font-semibold text-white">
            💰 Resumen Financiero
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
              <p className="text-sm text-gray-400">Ingresos Totales</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(financialSummary.totalRevenue)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
              <p className="text-sm text-gray-400">Costos Totales</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(financialSummary.totalCost)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
              <p className="text-sm text-gray-400">Ganancia Total</p>
              <p className="text-xl font-bold text-green-400">
                {formatCurrency(financialSummary.totalProfit)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
              <p className="text-sm text-gray-400">Margen de Ganancia</p>
              <p className="text-xl font-bold text-white">
                {financialSummary.profitMargin.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
              <p className="text-sm text-gray-400">Ganancia Admin</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(financialSummary.totalAdminProfit)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
              <p className="text-sm text-gray-400">Ganancia Distribuidores</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(financialSummary.totalDistributorProfit)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
              <p className="text-sm text-gray-400">Productos Defectuosos</p>
              <p className="text-xl font-bold text-red-400">
                {financialSummary.defectiveUnits}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
              <p className="text-sm text-gray-400">Tasa de Defectuosos</p>
              <p className="text-xl font-bold text-white">
                {financialSummary.defectiveRate.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Promedios */}
      {averages && (
        <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">📈 Promedios</h2>
            <div className="flex gap-2">
              <button
                onClick={() => updatePeriod("day")}
                className={`rounded-md px-4 py-2 ${
                  period === "day"
                    ? "bg-purple-600 text-white"
                    : "border border-gray-700 text-gray-200 hover:bg-gray-800"
                }`}
              >
                Día
              </button>
              <button
                onClick={() => updatePeriod("week")}
                className={`rounded-md px-4 py-2 ${
                  period === "week"
                    ? "bg-purple-600 text-white"
                    : "border border-gray-700 text-gray-200 hover:bg-gray-800"
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => updatePeriod("month")}
                className={`rounded-md px-4 py-2 ${
                  period === "month"
                    ? "bg-purple-600 text-white"
                    : "border border-gray-700 text-gray-200 hover:bg-gray-800"
                }`}
              >
                Mes
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <p className="text-sm text-gray-400">Ingresos / Día</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(averages.averageRevenuePerDay)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <p className="text-sm text-gray-400">Ganancia / Día</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(averages.averageProfitPerDay)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <p className="text-sm text-gray-400">Ventas / Día</p>
              <p className="text-xl font-bold text-white">
                {averages.averageSalesPerDay.toFixed(1)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <p className="text-sm text-gray-400">Unidades / Día</p>
              <p className="text-xl font-bold text-white">
                {averages.averageUnitsPerDay.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ganancia por Producto */}
      <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">
            🏆 Ganancia por Producto
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={topLimit}
              onChange={e => setTopLimit(parseInt(e.target.value, 10))}
              className="rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
            >
              <option value={10}>Top 10</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
            </select>
            <button
              onClick={() =>
                exportToCSV(
                  visibleProductProfits.map(p => ({
                    Producto: p.productName,
                    Cantidad: p.totalQuantity,
                    Ventas: p.totalSales,
                    Ingresos: p.totalRevenue,
                    Ganancia: p.totalProfit,
                    Margen: `${p.profitMargin.toFixed(2)}%`,
                  })),
                  "ganancia_por_producto"
                )
              }
              className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="mb-4">
          <input
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-gray-100 placeholder:text-gray-500 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
          />
          <p className="mt-2 text-sm text-gray-400">
            Mostrando {visibleProductProfits.length} de {productProfits.length}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50 text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-right">Ventas</th>
                <th className="px-4 py-3 text-right">Ingresos</th>
                <th className="px-4 py-3 text-right">Ganancia</th>
                <th className="px-4 py-3 text-right">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-gray-200">
              {visibleProductProfits.map(product => (
                <tr key={product.productId} className="hover:bg-gray-900/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.productImage && (
                        <img
                          src={product.productImage.url}
                          alt={product.productName}
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                      <span className="font-medium text-gray-200">
                        {product.productName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {product.totalQuantity}
                  </td>
                  <td className="px-4 py-3 text-right">{product.totalSales}</td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(product.totalRevenue)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-400">
                    {formatCurrency(product.totalProfit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {product.profitMargin.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ganancia por Distribuidor */}
      <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">
            👥 Ganancia por Distribuidor
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={topLimit}
              onChange={e => setTopLimit(parseInt(e.target.value, 10))}
              className="rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
            >
              <option value={10}>Top 10</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
            </select>
            <button
              onClick={() =>
                exportToCSV(
                  visibleDistributorProfits.map(d => ({
                    Distribuidor: d.distributorName,
                    Email: d.distributorEmail,
                    Ventas: d.totalSales,
                    Ingresos: d.totalRevenue,
                    "Ganancia Admin": d.totalAdminProfit,
                    "Ganancia Distribuidor": d.totalDistributorProfit,
                    "Venta Promedio": d.averageSale,
                  })),
                  "ganancia_por_distribuidor"
                )
              }
              className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="mb-4">
          <input
            value={distributorSearch}
            onChange={e => setDistributorSearch(e.target.value)}
            placeholder="Buscar distribuidor…"
            className="w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-gray-100 placeholder:text-gray-500 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
          />
          <p className="mt-2 text-sm text-gray-400">
            Mostrando {visibleDistributorProfits.length} de{" "}
            {distributorProfits.length}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50 text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left">Distribuidor</th>
                <th className="px-4 py-3 text-right">Ventas</th>
                <th className="px-4 py-3 text-right">Ingresos</th>
                <th className="px-4 py-3 text-right">Ganancia Admin</th>
                <th className="px-4 py-3 text-right">Ganancia Dist.</th>
                <th className="px-4 py-3 text-right">Venta Prom.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-gray-200">
              {visibleDistributorProfits.map(distributor => (
                <tr
                  key={distributor.distributorId}
                  className="hover:bg-gray-900/30"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-200">
                        {distributor.distributorName}
                      </p>
                      <p className="text-sm text-gray-400">
                        {distributor.distributorEmail}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {distributor.totalSales}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(distributor.totalRevenue)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-400">
                    {formatCurrency(distributor.totalAdminProfit)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-400">
                    {formatCurrency(distributor.totalDistributorProfit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(distributor.averageSale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline de Ventas */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">
            📅 Timeline de Ventas
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => updateTimeline(7)}
              className={`rounded-md px-4 py-2 ${timelineDays === 7 ? "bg-purple-600 text-white" : "border border-gray-700 text-gray-200 hover:bg-gray-800"}`}
            >
              7 días
            </button>
            <button
              onClick={() => updateTimeline(30)}
              className={`rounded-md px-4 py-2 ${timelineDays === 30 ? "bg-purple-600 text-white" : "border border-gray-700 text-gray-200 hover:bg-gray-800"}`}
            >
              30 días
            </button>
            <button
              onClick={() => updateTimeline(90)}
              className={`rounded-md px-4 py-2 ${timelineDays === 90 ? "bg-purple-600 text-white" : "border border-gray-700 text-gray-200 hover:bg-gray-800"}`}
            >
              90 días
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50 text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-right">Ventas</th>
                <th className="px-4 py-3 text-right">Unidades</th>
                <th className="px-4 py-3 text-right">Ingresos</th>
                <th className="px-4 py-3 text-right">Costos</th>
                <th className="px-4 py-3 text-right">Ganancia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-gray-200">
              {timeline.map(day => (
                <tr key={day.date} className="hover:bg-gray-900/30">
                  <td className="px-4 py-3">
                    {new Date(day.date).toLocaleDateString("es-MX")}
                  </td>
                  <td className="px-4 py-3 text-right">{day.sales}</td>
                  <td className="px-4 py-3 text-right">{day.units}</td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(day.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(day.cost)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-400">
                    {formatCurrency(day.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
