import { useEffect, useMemo, useState } from "react";
import { analyticsService } from "../../features/analytics/services";
import type {
  EmployeeProfit,
  TimelineData,
} from "../../features/analytics/types/analytics.types";
import type { ProductProfit } from "../../features/inventory/types/product.types";

interface AnalyticsChartsProps {
  dateRange: { startDate: string; endDate: string };
  hideFinancialData?: boolean;
}

const currency = (n: number | undefined) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);

const formatPeriodLabel = (period: string) => {
  const parsed = new Date(period);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("es-CO", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }
  return period;
};

export default function AnalyticsCharts({
  dateRange,
  hideFinancialData = false,
}: AnalyticsChartsProps) {
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [products, setProducts] = useState<ProductProfit[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfit[]>([]);

  const [period, setPeriod] = useState<"day" | "week" | "month">("month");
  const [timelineDays, setTimelineDays] = useState(30);
  const [topLimit, setTopLimit] = useState(15);
  const [productSearch, setProductSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const filters = useMemo(
    () => ({
      ...(dateRange.startDate && { startDate: dateRange.startDate }),
      ...(dateRange.endDate && { endDate: dateRange.endDate }),
    }),
    [dateRange]
  );

  useEffect(() => {
    const loadCharts = async () => {
      try {
        setLoading(true);
        const [prodRes, distRes, timeRes] = await Promise.all([
          analyticsService.getProfitByProduct(filters),
          analyticsService.getProfitByEmployee(filters),
          analyticsService.getSalesTimeline({
            days: timelineDays,
            ...filters,
          } as any),
        ]);
        setProducts((prodRes as any).products || prodRes);
        setEmployees((distRes as any).employees || distRes);
        setTimeline((timeRes as any).timeline || timeRes);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    void loadCharts();
  }, [filters, timelineDays]);

  const visibleProducts = useMemo(
    () =>
      products
        .filter(p =>
          (p.productName || "")
            .toLowerCase()
            .includes(productSearch.toLowerCase())
        )
        .slice(0, topLimit)
        .map(p => ({
          name: p.productName || "Sin nombre",
          profit: (p as any).profit ?? p.totalProfit ?? 0,
          revenue: (p as any).revenue ?? p.totalRevenue ?? 0,
          count: p.totalSales ?? 0,
        })),
    [products, productSearch, topLimit]
  );

  const visibleEmployees = useMemo(
    () =>
      employees
        .filter(d =>
          (d.employeeName || "")
            .toLowerCase()
            .includes(employeeSearch.toLowerCase())
        )
        .slice(0, topLimit)
        .map(d => ({
          name: d.employeeName || "Sin nombre",
          profit: (d as any).profit ?? d.totalAdminProfit ?? d.totalProfit ?? 0,
          revenue: (d as any).revenue ?? d.totalRevenue ?? 0,
          count: d.totalSales ?? 0,
        })),
    [employees, employeeSearch, topLimit]
  );

  // Totales para el Timeline Header
  const timelineTotals = useMemo(
    () =>
      timeline.reduce(
        (acc, item) => {
          acc.revenue += item.revenue || 0;
          acc.profit += item.profit || 0;
          const sales =
            (item as any).ordersCount ??
            (item as any).salesCount ??
            (item as any).sales ??
            item?.sales ??
            0;
          acc.salesCount += sales;
          return acc;
        },
        { revenue: 0, profit: 0, salesCount: 0 }
      ),
    [timeline]
  );

  const timelineMaxRevenue = useMemo(
    () => Math.max(1, ...timeline.map(t => t.revenue || 0)),
    [timeline]
  );

  const timelineMaxProfit = useMemo(
    () => Math.max(1, ...timeline.map(t => t.profit || 0)),
    [timeline]
  );

  const timelineMaxSales = useMemo(
    () =>
      Math.max(
        1,
        ...timeline.map(item =>
          Number(
            (item as any).ordersCount ??
              (item as any).salesCount ??
              (item as any).sales ??
              0
          )
        )
      ),
    [timeline]
  );

  return (
    <div className="space-y-6">
      {/* Controles del Gráfico (Periodo / Días) - Si queremos que sean específicos de esta vista */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">
            Agrupación
          </label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as any)}
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          >
            <option value="day">Diario</option>
            <option value="week">Semanal</option>
            <option value="month">Mensual</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">
            Días Timeline
          </label>
          <select
            value={timelineDays}
            onChange={e => setTimelineDays(Number(e.target.value))}
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          >
            {[15, 30, 60, 90, 180].map(n => (
              <option key={n} value={n}>
                {n} días
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {hideFinancialData ? "Volumen de Ventas" : "Evolución Financiera"}
            </h2>
            <p className="text-sm text-gray-400">
              {hideFinancialData
                ? "Solo volumen individual de ventas"
                : "Ingresos vs Utilidad Neta"}
            </p>
          </div>
          {!loading && timeline.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2 text-xs text-gray-300">
              {hideFinancialData ? (
                <span className="rounded-full border border-gray-700 bg-gray-950 px-3 py-1">
                  Ventas {timelineTotals.salesCount.toLocaleString()}
                </span>
              ) : (
                <>
                  <span className="rounded-full border border-gray-700 bg-gray-950 px-3 py-1">
                    Ingresos {currency(timelineTotals.revenue)}
                  </span>
                  <span className="rounded-full border border-gray-700 bg-gray-950 px-3 py-1">
                    Ganancia {currency(timelineTotals.profit)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="space-y-3">
          {loading && (
            <div className="py-8 text-center text-gray-500">
              Cargando gráfico...
            </div>
          )}
          {!loading && timeline.length === 0 && (
            <p className="text-sm text-gray-400">Sin datos en este rango.</p>
          )}
          {!loading &&
            timeline.map((item, idx) => {
              const salesCount =
                (item as any).ordersCount ??
                (item as any).salesCount ??
                (item as any).sales ??
                0;
              const label = formatPeriodLabel(
                (item as any).period || (item as any).date || ""
              );

              const revenue = item.revenue || 0;
              const profit = item.profit || 0;

              const revenuePercent = Math.min(
                100,
                Math.round(((revenue || 0) / timelineMaxRevenue) * 100)
              );
              const profitPercent = Math.min(
                100,
                Math.round(((profit || 0) / timelineMaxProfit) * 100)
              );
              const salesPercent = Math.min(
                100,
                Math.round(((salesCount || 0) / timelineMaxSales) * 100)
              );

              return (
                <div
                  key={`${label}-${idx}`}
                  className="bg-linear-to-r group relative overflow-hidden rounded-xl border border-gray-800 from-gray-950/80 via-gray-900/80 to-gray-950/40 p-4 shadow-sm"
                >
                  <div className="bg-linear-to-r absolute inset-x-0 top-0 h-1 from-purple-500/60 via-blue-500/60 to-emerald-500/60 opacity-70" />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-semibold text-white">
                      {label || "Sin fecha"}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                      <span className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1">
                        {salesCount} ventas
                      </span>
                    </div>
                  </div>

                  {hideFinancialData ? (
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <MetricBar
                        label="Ventas"
                        value={`${salesCount.toLocaleString()} ventas`}
                        percent={salesPercent}
                        color="indigo"
                      />
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <MetricBar
                        label="Ingresos"
                        value={currency(revenue)}
                        percent={revenuePercent}
                        color="indigo"
                      />
                      <MetricBar
                        label="Ganancia Operativa"
                        value={currency(profit)}
                        percent={profitPercent}
                        color="green"
                      />
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankingTable
          title="Top Productos"
          subtitle={
            hideFinancialData
              ? "Por volumen de ventas"
              : "Por ganancia generada"
          }
          rows={visibleProducts.map(p => ({
            name: p.name,
            profit: currency(p.profit || 0),
            revenue: currency(p.revenue || 0),
            count: p.count || 0,
          }))}
          search={productSearch}
          onSearch={setProductSearch}
          topLimit={topLimit}
          onTopChange={setTopLimit}
          hideFinancialData={hideFinancialData}
        />

        <RankingTable
          title="Top Employees"
          subtitle={
            hideFinancialData ? "Por volumen de ventas" : "Por ganancia"
          }
          rows={visibleEmployees.map(d => ({
            name: d.name,
            profit: currency(d.profit || 0),
            revenue: currency(d.revenue || 0),
            count: d.count || 0,
          }))}
          search={employeeSearch}
          onSearch={setEmployeeSearch}
          topLimit={topLimit}
          onTopChange={setTopLimit}
          hideFinancialData={hideFinancialData}
        />
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: string;
  percent: number;
  color: "indigo" | "green";
}) {
  const barColor =
    color === "green"
      ? "bg-linear-to-r from-emerald-400 to-green-500"
      : "bg-linear-to-r from-indigo-400 to-blue-500";

  const safePercent = Math.max(4, Math.min(100, percent));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="font-semibold text-gray-100">{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-800">
        <div
          className={`h-2 rounded-full ${barColor}`}
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
}

function RankingTable({
  title,
  subtitle,
  rows,
  search,
  onSearch,
  topLimit,
  onTopChange,
  hideFinancialData = false,
}: {
  title: string;
  subtitle: string;
  rows: { name: string; profit: string; revenue: string; count: number }[];
  search: string;
  onSearch: (v: string) => void;
  topLimit: number;
  onTopChange: (n: number) => void;
  hideFinancialData?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-purple-300/70">
            {subtitle}
          </p>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar"
            className="w-24 rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40 md:w-32"
          />
          <select
            value={topLimit}
            onChange={e => onTopChange(Number(e.target.value))}
            className="rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          >
            {[5, 10, 15, 20, 50].map(n => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800">
        <table className="min-w-full divide-y divide-gray-800 bg-gray-950/60">
          <thead>
            <tr className="bg-gray-900/80">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                Nombre
              </th>
              {hideFinancialData ? (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Ventas
                </th>
              ) : (
                <>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Ganancia
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Ingresos
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map((r, idx) => (
              <tr key={`${r.name}-${idx}`} className="hover:bg-gray-900/40">
                <td className="px-4 py-2 text-sm text-gray-100">{r.name}</td>
                {hideFinancialData ? (
                  <td className="px-4 py-2 text-right text-sm font-semibold text-sky-300">
                    {r.count.toLocaleString()}
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-2 text-right text-sm font-semibold text-green-300">
                      {r.profit}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-400">
                      {r.revenue}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={hideFinancialData ? 2 : 3}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  Sin datos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
