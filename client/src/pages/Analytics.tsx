import { useEffect, useMemo, useState } from "react";
import { analyticsService } from "../api/services";
import type {
  AnalyticsDashboard,
  DistributorProfit,
  FinancialSummary,
  MonthlyProfitData,
  ProductProfit,
  TimelineData,
} from "../types";

type Period = "day" | "week" | "month";

const toISO = (d: Date) => d.toISOString().slice(0, 10);

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

const currency = (n: number | undefined) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [monthly, setMonthly] = useState<MonthlyProfitData | null>(null);
  const [products, setProducts] = useState<ProductProfit[]>([]);
  const [distributors, setDistributors] = useState<DistributorProfit[]>([]);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [financial, setFinancial] = useState<FinancialSummary | null>(null);
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);

  const [period, setPeriod] = useState<Period>("month");
  const [timelineDays, setTimelineDays] = useState(30);
  const [topLimit, setTopLimit] = useState(15);
  const [productSearch, setProductSearch] = useState("");
  const [distributorSearch, setDistributorSearch] = useState("");

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
    [dateRange.endDate, dateRange.startDate]
  );

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [monthlyRes, prodRes, distRes, timeRes, finRes, dashRes] =
        await Promise.all([
          analyticsService.getMonthlyProfit(),
          analyticsService.getProfitByProduct(filters),
          analyticsService.getProfitByDistributor(filters),
          analyticsService.getSalesTimeline({ days: timelineDays, ...filters }),
          analyticsService.getFinancialSummary(filters),
          analyticsService.getAnalyticsDashboard(),
        ]);

      setMonthly(monthlyRes);
      setProducts(prodRes);
      setDistributors(distRes);
      setTimeline(timeRes);
      setFinancial(finRes);
      setDashboard(dashRes);
    } catch (err: any) {
      console.error("Error cargando analytics", err);
      setError(err?.message || "No se pudo cargar analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [period, timelineDays, filters]);

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

  const visibleDistributors = useMemo(
    () =>
      distributors
        .filter(d =>
          (d.distributorName || "")
            .toLowerCase()
            .includes(distributorSearch.toLowerCase())
        )
        .slice(0, topLimit)
        .map(d => ({
          name: d.distributorName || "Sin nombre",
          profit: (d as any).profit ?? d.totalAdminProfit ?? d.totalProfit ?? 0,
          revenue: (d as any).revenue ?? d.totalRevenue ?? 0,
          count: d.totalSales ?? 0,
        })),
    [distributors, distributorSearch, topLimit]
  );

  const financialTotals = useMemo(
    () => ({
      revenue: (financial as any)?.revenue ?? financial?.totalRevenue ?? 0,
      cost: (financial as any)?.cost ?? financial?.totalCost ?? 0,
      profit: (financial as any)?.profit ?? financial?.totalProfit ?? 0,
      salesCount:
        (financial as any)?.ordersCount ??
        (financial as any)?.salesCount ??
        financial?.totalSales ??
        0,
    }),
    [financial]
  );

  const timelineTotals = useMemo(
    () =>
      timeline.reduce(
        (acc, item) => {
          acc.revenue += item.revenue || 0;
          acc.profit += item.profit || 0;
          // Usar ordersCount si existe, sino fallback a salesCount/sales
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

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setDateRange({ startDate: toISO(start), endDate: toISO(end) });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-purple-300/70">
            Reportes de negocio
          </p>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-400">
            KPIs diarios, timeline y ranking por producto/distribuidor.
          </p>
        </div>
        <button
          onClick={loadData}
          className="rounded-md border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-100 transition hover:border-purple-400 hover:text-white"
        >
          Recargar
        </button>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Fecha inicio
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={e =>
                setDateRange({ ...dateRange, startDate: e.target.value })
              }
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Fecha fin
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={e =>
                setDateRange({ ...dateRange, endDate: e.target.value })
              }
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Promedios
            </label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as Period)}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            >
              <option value="day">Diario</option>
              <option value="week">Semanal</option>
              <option value="month">Mensual</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Timeline (días)
            </label>
            <select
              value={timelineDays}
              onChange={e => setTimelineDays(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            >
              {[15, 30, 60, 90].map(n => (
                <option key={n} value={n}>
                  {n} días
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => setQuickRange(30)}
              className="w-1/2 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 transition hover:border-purple-400"
            >
              30 días
            </button>
            <button
              onClick={() => setQuickRange(90)}
              className="w-1/2 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 transition hover:border-purple-400"
            >
              90 días
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <StatCard
          title="Ganancia neta mes"
          subtitle="Después de costos y descuentos"
          value={currency(
            monthly?.currentMonth?.netProfit ??
              monthly?.currentMonth?.totalProfit ??
              0
          )}
        />
        <StatCard
          title="Ingresos mes"
          subtitle="Facturaci�n bruta"
          value={currency(monthly?.currentMonth?.revenue || 0)}
        />
        <StatCard
          title="Crecimiento"
          subtitle="vs mes anterior"
          value={`${(monthly?.growthPercentage ?? 0) >= 0 ? "+" : ""}${(
            monthly?.growthPercentage || 0
          ).toFixed(1)}%`}
          tone={(monthly?.growthPercentage || 0) >= 0 ? "positive" : "negative"}
        />
        <StatCard
          title="Ticket promedio"
          subtitle="Promedio por venta"
          value={currency(
            monthly?.averageTicket || financial?.averageTicket || 0
          )}
        />
      </div>

      {/* Sección Métricas de Créditos/Fiados */}
      {dashboard?.creditMetrics && dashboard.creditMetrics.totalCredits > 0 && (
        <div className="bg-linear-to-br rounded-xl border border-amber-800/50 from-amber-900/20 to-gray-900/70 p-4">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-amber-300">
                📋 Cartera de Fiados
              </h2>
              <p className="text-sm text-gray-400">
                Resumen de créditos y deudas pendientes
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-amber-400/70">
                Total Originado
              </p>
              <p className="text-lg font-bold text-amber-300">
                {currency(
                  (dashboard.creditMetrics.totalDebt || 0) +
                    (dashboard.creditMetrics.totalPaid || 0)
                )}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard
              title="Total Créditos"
              subtitle="Registrados"
              value={String(dashboard.creditMetrics.totalCredits)}
            />
            <StatCard
              title="Deuda Total"
              subtitle="Pendiente"
              value={currency(dashboard.creditMetrics.totalDebt)}
              tone="negative"
            />
            <StatCard
              title="Pagado"
              subtitle="Recuperado"
              value={currency(dashboard.creditMetrics.totalPaid)}
              tone="positive"
            />
            <StatCard
              title="Vencidos"
              subtitle="Cantidad"
              value={String(dashboard.creditMetrics.overdueCount)}
              tone={
                dashboard.creditMetrics.overdueCount > 0
                  ? "negative"
                  : undefined
              }
            />
            <StatCard
              title="Monto Vencido"
              subtitle="En mora"
              value={currency(dashboard.creditMetrics.overdueAmount)}
              tone="negative"
            />
            <StatCard
              title="Tasa Recuperación"
              subtitle="% cobrado"
              value={`${dashboard.creditMetrics.recoveryRate}%`}
              tone={
                Number(dashboard.creditMetrics.recoveryRate) >= 50
                  ? "positive"
                  : "negative"
              }
            />
          </div>

          {/* Indicador de Salud de Cartera */}
          <div className="mt-4 rounded-lg border border-amber-700/30 bg-gray-950/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-400/70">
                  Salud de Cartera
                </p>
                <p className="mt-1 text-sm text-gray-300">
                  {Number(dashboard.creditMetrics.recoveryRate) >= 70
                    ? "✅ Excelente - Alta recuperación"
                    : Number(dashboard.creditMetrics.recoveryRate) >= 50
                      ? "⚠️ Aceptable - Mejorar cobranza"
                      : "❌ Crítico - Atención urgente"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-amber-400/70">Mora</p>
                <p className="text-lg font-bold text-red-400">
                  {dashboard.creditMetrics.overdueCount > 0
                    ? `${(
                        (dashboard.creditMetrics.overdueAmount /
                          ((dashboard.creditMetrics.totalDebt || 1) +
                            (dashboard.creditMetrics.overdueAmount || 0))) *
                        100
                      ).toFixed(1)}%`
                    : "0%"}
                </p>
              </div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-800">
              <div
                className="bg-linear-to-r h-full from-green-500 via-yellow-500 to-red-500"
                style={{
                  width: `${Math.min(100, Number(dashboard.creditMetrics.recoveryRate))}%`,
                }}
              />
            </div>
          </div>

          {dashboard.creditMetrics.topDebtors.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium text-amber-300/80">
                🎯 Top 5 Deudores
              </h3>
              <div className="overflow-hidden rounded-lg border border-amber-800/30">
                <table className="min-w-full divide-y divide-amber-800/30 bg-gray-950/60">
                  <thead>
                    <tr className="bg-amber-900/20">
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-amber-300/70">
                        Cliente
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-amber-300/70">
                        Deuda
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-amber-300/70">
                        Créditos
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-800/20">
                    {dashboard.creditMetrics.topDebtors.map((debtor, idx) => (
                      <tr
                        key={debtor.customerId || idx}
                        className="hover:bg-amber-900/10"
                      >
                        <td className="px-4 py-2 text-sm text-gray-100">
                          {debtor.customerName}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-semibold text-red-300">
                          {currency(debtor.totalDebt)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-300">
                          {debtor.creditsCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Evolución de ventas
            </h2>
            <p className="text-sm text-gray-400">
              Pagos confirmados en el rango seleccionado
            </p>
          </div>
          {!loading && timeline.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2 text-xs text-gray-300">
              <span className="rounded-full border border-gray-700 bg-gray-950 px-3 py-1">
                Ingresos {currency(timelineTotals.revenue)}
              </span>
              <span className="rounded-full border border-gray-700 bg-gray-950 px-3 py-1">
                Ganancia {currency(timelineTotals.profit)}
              </span>
              <span className="rounded-full border border-gray-700 bg-gray-950 px-3 py-1">
                Ventas {timelineTotals.salesCount}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {loading && <SkeletonCard count={6} />}
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
                        Ventas {salesCount}
                      </span>
                      <span className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1">
                        Ganancia {currency(profit)}
                      </span>
                      <span className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1">
                        Ingresos {currency(revenue)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MetricBar
                      label="Ingresos"
                      value={currency(revenue)}
                      percent={revenuePercent}
                      color="indigo"
                    />
                    <MetricBar
                      label="Ganancia"
                      value={currency(profit)}
                      percent={profitPercent}
                      color="green"
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankingTable
          title="Top productos"
          subtitle="Por ganancia"
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
        />

        <RankingTable
          title="Top distribuidores"
          subtitle="Por ganancia"
          rows={visibleDistributors.map(d => ({
            name: d.name,
            profit: currency(d.profit || 0),
            revenue: currency(d.revenue || 0),
            count: d.count || 0,
          }))}
          search={distributorSearch}
          onSearch={setDistributorSearch}
          topLimit={topLimit}
          onTopChange={setTopLimit}
        />
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
        <h2 className="text-xl font-semibold text-white">Resumen financiero</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ingresos"
            value={currency(financialTotals.revenue)}
          />
          <StatCard title="Costos" value={currency(financialTotals.cost)} />
          <StatCard title="Ganancia" value={currency(financialTotals.profit)} />
          <StatCard title="Ventas" value={`${financialTotals.salesCount}`} />
        </div>

        {/* Métricas de Cartera (Créditos) */}
        {dashboard?.creditMetrics &&
          dashboard.creditMetrics.totalCredits > 0 && (
            <div className="mt-4 rounded-lg border border-amber-700/30 bg-amber-900/10 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-300">
                💰 Cartera y Créditos
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Deuda Pendiente"
                  subtitle="Por cobrar"
                  value={currency(dashboard.creditMetrics.totalDebt)}
                  tone="negative"
                />
                <StatCard
                  title="Total Recuperado"
                  subtitle="Pagos recibidos"
                  value={currency(dashboard.creditMetrics.totalPaid)}
                  tone="positive"
                />
                <StatCard
                  title="En Mora"
                  subtitle={`${dashboard.creditMetrics.overdueCount} vencidos`}
                  value={currency(dashboard.creditMetrics.overdueAmount)}
                  tone={
                    dashboard.creditMetrics.overdueCount > 0
                      ? "negative"
                      : "neutral"
                  }
                />
                <StatCard
                  title="Tasa de Recuperación"
                  subtitle="% de cartera cobrada"
                  value={`${dashboard.creditMetrics.recoveryRate}%`}
                  tone={
                    Number(dashboard.creditMetrics.recoveryRate) >= 50
                      ? "positive"
                      : "negative"
                  }
                />
              </div>
            </div>
          )}
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
      ? "text-green-400"
      : tone === "negative"
        ? "text-red-400"
        : "text-white";

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-400">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
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
}: {
  title: string;
  subtitle: string;
  rows: { name: string; profit: string; revenue: string; count: number }[];
  search: string;
  onSearch: (v: string) => void;
  topLimit: number;
  onTopChange: (n: number) => void;
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
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          />
          <select
            value={topLimit}
            onChange={e => onTopChange(Number(e.target.value))}
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          >
            {[10, 15, 25, 40].map(n => (
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
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                Ganancia
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                Ingresos
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                Ventas
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map((r, idx) => (
              <tr key={`${r.name}-${idx}`} className="hover:bg-gray-900/40">
                <td className="px-4 py-3 text-sm text-gray-100">{r.name}</td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-green-300">
                  {r.profit}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-200">
                  {r.revenue}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-200">
                  {r.count}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-4 text-center text-sm text-gray-400"
                >
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SkeletonCard({ count = 3 }: { count?: number }) {
  return (
    <>
      {[...Array(count)].map((_, idx) => (
        <div
          key={idx}
          className="h-24 animate-pulse rounded-lg border border-gray-800 bg-gray-900/40"
        />
      ))}
    </>
  );
}
