import { useEffect, useMemo, useState } from "react";
import { useFeature } from "../../../components/FeatureSection";
import { useBusiness } from "../../../context/BusinessContext";
import { analyticsService } from "../../analytics/services";
import {
  expenseService,
  profitHistoryService,
} from "../../common/services";
import { creditService } from "../../credits/services";
import { defectiveProductService } from "../../sales/services";
import type {
  CreditMetrics,
  Expense,
  ProfitHistoryAdminDistributor,
  ProfitHistoryAdminEntry,
  ProfitHistoryAdminOverview,
} from "../../../types";

interface DefectiveStats {
  totalReports: number;
  totalQuantity: number;
  totalLoss: number;
  pendingCount: number;
  confirmedCount: number;
  withWarranty: number;
  warrantyPending: number;
  warrantyApproved: number;
  stockRestored: number;
}

interface EstimatedProfitData {
  success: boolean;
  scenario: "A" | "B" | "C" | "D";
  message: string;
  hasBranches: boolean;
  hasDistributors: boolean;
  warehouse: {
    grossProfit: number;
    adminProfit: number;
    netProfit: number;
    totalProducts: number;
    totalUnits: number;
    investment: number;
    salesValue: number;
  };
  branches: {
    grossProfit: number;
    adminProfit: number;
    netProfit: number;
    totalProducts: number;
    totalUnits: number;
    investment: number;
    salesValue: number;
    branches: Array<{
      id: string;
      name: string;
      grossProfit: number;
      adminProfit: number;
      investment: number;
      salesValue: number;
      totalProducts: number;
      totalUnits: number;
    }>;
  };
  distributors: {
    grossProfit: number;
    adminProfit: number;
    netProfit: number;
    totalProducts: number;
    totalUnits: number;
    investment: number;
    salesValue: number;
    distributors: Array<{
      id: string;
      name: string;
      email: string;
      grossProfit: number;
      adminProfit: number;
      investment: number;
      salesValue: number;
      totalProducts: number;
      totalUnits: number;
    }>;
  };
  consolidated: {
    grossProfit: number;
    adminProfit: number;
    netProfit: number;
    totalProducts: number;
    totalUnits: number;
    investment: number;
    salesValue: number;
    profitability?: number; // Ganancia / Ventas × 100
    costMultiplier?: number; // Ganancia / Inversión × 100
  };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const quickRanges = [
  { label: "Últimos 7 días", days: 7 },
  { label: "Últimos 30 días", days: 30 },
  { label: "Últimos 90 días", days: 90 },
];

const isValidObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

export default function ProfitHistory() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<ProfitHistoryAdminOverview | null>(
    null
  );
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [creditMetrics, setCreditMetrics] = useState<CreditMetrics | null>(
    null
  );
  const [defectiveStats, setDefectiveStats] = useState<DefectiveStats | null>(
    null
  );
  const [estimatedProfit, setEstimatedProfit] =
    useState<EstimatedProfitData | null>(null);
  const [loadingEstimated, setLoadingEstimated] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState<string>("");
  const [limit, setLimit] = useState(150);
  const [showEstimatedDetails, setShowEstimatedDetails] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      startDate: toISODate(start),
      endDate: toISODate(today),
    };
  });

  const { businessId } = useBusiness();
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = ["admin", "super_admin", "god"].includes(currentUser?.role);
  const creditsEnabled = useFeature("credits");
  const distributorsEnabled = useFeature("distributors");

  const loadOverview = async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Cargar ganancias, gastos y métricas de créditos en paralelo
      const [profitData, expenseData, creditData] = await Promise.all([
        profitHistoryService.getAdminOverview({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          distributorId: selectedDistributor || undefined,
          limit,
        }),
        expenseService.getAll({
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
        }),
        creditsEnabled
          ? creditService
              .getMetrics({
                startDate: dateRange.startDate || undefined,
                endDate: dateRange.endDate || undefined,
              })
              .catch(() => ({ metrics: null }))
          : Promise.resolve({ metrics: null }),
      ]);

      setOverview(profitData);
      setExpenses(expenseData.expenses || []);
      setCreditMetrics(creditData.metrics);
    } catch (error) {
      console.error("Error cargando overview de ganancias", error);
    } finally {
      setLoading(false);
    }
  };

  const loadEstimatedProfit = async () => {
    try {
      setLoadingEstimated(true);
      const [profitData, defectiveData] = await Promise.all([
        analyticsService.getEstimatedProfit(),
        defectiveProductService.getStats().catch(() => ({ stats: null })),
      ]);
      setEstimatedProfit(profitData);

      if (defectiveData && defectiveData.stats) {
        setDefectiveStats(defectiveData.stats);
      } else {
        setDefectiveStats(null);
      }
    } catch (error) {
      console.error("Error cargando ganancia estimada", error);
    } finally {
      setLoadingEstimated(false);
    }
  };

  useEffect(() => {
    // No dependemos de businessId para god/super_admin, pero lo mantenemos para refrescar cuando cambie
    void loadOverview();
    void loadEstimatedProfit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedDistributor,
    dateRange.startDate,
    dateRange.endDate,
    limit,
    businessId,
  ]);

  const distributors = useMemo<ProfitHistoryAdminDistributor[]>(() => {
    if (!overview) return [];
    return overview.distributors;
  }, [overview]);

  const distributorOptions = useMemo(() => {
    const seen = new Set<string>();
    return distributors.filter(dist => {
      const allow = dist.id === "admin" || isValidObjectId(dist.id);
      if (!allow) return false;
      if (seen.has(dist.id)) return false;
      seen.add(dist.id);
      return true;
    });
  }, [distributors]);

  const handleQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateRange({ startDate: toISODate(start), endDate: toISODate(end) });
  };

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center p-6">
        <div className="text-lg text-gray-200">
          Solo los administradores pueden ver este módulo.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-purple-300/70">
            Reporte vivo
          </p>
          <h1 className="text-3xl font-bold text-white">
            Historial de ganancias
          </h1>
          <p className="text-sm text-gray-400">
            Calculado directamente desde las ventas, sin depender de registros
            previos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quickRanges.map(range => (
            <button
              key={range.days}
              onClick={() => handleQuickRange(range.days)}
              className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-sm font-medium text-purple-100 transition hover:border-purple-400/60 hover:bg-purple-500/20"
            >
              {range.label}
            </button>
          ))}
          <button
            onClick={() => setDateRange({ startDate: "", endDate: "" })}
            className="rounded-full border border-gray-600 bg-gray-800 px-3 py-1 text-sm text-gray-200 transition hover:border-gray-500"
          >
            Todo el tiempo
          </button>
        </div>
      </div>

      {/* Cálculos de gastos y utilidad neta */}
      {(() => {
        const totalExpenses = expenses.reduce(
          (sum, e) => sum + (e.amount || 0),
          0
        );
        const totalProfit = overview?.summary.totalProfit || 0;
        // Usar netProfit del backend que ya considera deducciones de venta (garantía, envío, descuentos)
        const salesNetProfit =
          overview?.summary.netProfit ?? overview?.summary.adminProfit ?? 0;
        const totalDeductions = overview?.summary.totalDeductions || 0;
        // Pérdidas por productos defectuosos
        const defectiveLosses = defectiveStats?.totalLoss || 0;
        // Utilidad neta final = ganancia neta de ventas - gastos operativos - pérdidas defectuosos
        const netProfit = salesNetProfit - totalExpenses - defectiveLosses;
        // Total vendido (revenue)
        const totalSalesValue = overview?.summary.salesValue || 0;
        // Rentabilidad = utilidad neta / total vendido * 100 (fórmula financiera correcta)
        const profitability =
          totalSalesValue > 0 ? (netProfit / totalSalesValue) * 100 : 0;
        const expensesByType = expenses.reduce(
          (acc, e) => {
            const type = e.type || "Otros";
            acc[type] = (acc[type] || 0) + (e.amount || 0);
            return acc;
          },
          {} as Record<string, number>
        );

        return (
          <>
            <div
              className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${distributorsEnabled ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
            >
              <div className="rounded-xl border border-gray-800 bg-gradient-to-br from-purple-600/30 via-indigo-600/20 to-gray-900 p-4 text-white shadow-lg">
                <p className="text-sm text-purple-100">Ganancia bruta</p>
                <p className="mt-2 text-2xl font-bold">
                  {formatCurrency(totalProfit)}
                </p>
                <p className="text-xs text-purple-100/80">
                  {distributorsEnabled
                    ? "Admin + distribuidores"
                    : "Total ventas"}
                </p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-white">
                <p className="text-sm text-gray-300">Ganancia neta ventas</p>
                <p className="mt-2 text-xl font-semibold text-emerald-300">
                  {formatCurrency(netProfit)}
                </p>
                <p className="text-xs text-gray-400">
                  {totalDeductions > 0 ||
                  totalExpenses > 0 ||
                  defectiveLosses > 0
                    ? `- ${formatCurrency(totalDeductions + totalExpenses + defectiveLosses)} (deduc. + gastos + defec.)`
                    : distributorsEnabled
                      ? "Ventas directas + margen"
                      : "Ventas directas"}
                </p>
              </div>
              {distributorsEnabled && (
                <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-white">
                  <p className="text-sm text-gray-300">
                    Comisiones distribuidores
                  </p>
                  <p className="mt-2 text-xl font-semibold text-cyan-300">
                    {formatCurrency(overview?.summary.distributorProfit || 0)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {overview?.summary.ordersCount ??
                      overview?.summary.count ??
                      0}{" "}
                    ventas
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-white">
                <p className="text-sm text-red-300">Total gastos + pérdidas</p>
                <p className="mt-2 text-xl font-semibold text-red-400">
                  -{formatCurrency(totalExpenses + defectiveLosses)}
                </p>
                <p className="text-xs text-red-300/70">
                  {expenses.length} gastos
                  {defectiveLosses > 0
                    ? ` + ${formatCurrency(defectiveLosses)} defec.`
                    : ""}
                </p>
              </div>
              <div
                className={`rounded-xl border p-4 text-white shadow-lg ${
                  profitability >= 0
                    ? "border-blue-800/50 bg-gradient-to-br from-blue-900/40 to-gray-900"
                    : "border-red-800/50 bg-gradient-to-br from-red-900/40 to-gray-900"
                }`}
              >
                <p className="text-sm text-gray-200">📈 Rentabilidad</p>
                <p
                  className={`mt-2 text-2xl font-bold ${profitability >= 0 ? "text-blue-400" : "text-red-400"}`}
                >
                  {profitability.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400">
                  Utilidad neta / Total vendido
                </p>
              </div>
            </div>

            {/* Desglose de gastos por tipo */}
            {Object.keys(expensesByType).length > 0 && (
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-300">
                    Desglose de gastos por tipo
                  </h3>
                  <span className="text-xs text-gray-500">
                    En el período seleccionado
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {Object.entries(expensesByType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, amount]) => (
                      <div key={type} className="rounded-lg bg-gray-800/50 p-3">
                        <p
                          className="truncate text-xs text-gray-400"
                          title={type}
                        >
                          {type}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-red-400">
                          {formatCurrency(amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {((amount / totalExpenses) * 100).toFixed(1)}%
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Pérdidas por Productos Defectuosos */}
            <div className="rounded-xl border border-orange-900/50 bg-gradient-to-br from-orange-950/40 to-gray-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-orange-300">
                  ⚠️ Pérdidas por Productos Defectuosos
                </h3>
                <span className="text-xs text-gray-500">
                  Historial completo
                </span>
              </div>
              {loadingEstimated ? (
                <div className="py-4 text-center text-gray-400">
                  Cargando estadísticas...
                </div>
              ) : defectiveStats && defectiveStats.totalReports > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    <div className="rounded-lg border border-red-700/30 bg-red-900/20 p-3">
                      <p className="text-xs text-red-300">Total Pérdidas</p>
                      <p className="mt-1 text-xl font-bold text-red-400">
                        {formatCurrency(defectiveStats.totalLoss)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-800/50 p-3">
                      <p className="text-xs text-gray-400">Total Reportes</p>
                      <p className="mt-1 text-lg font-semibold text-orange-300">
                        {defectiveStats.totalReports}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-800/50 p-3">
                      <p className="text-xs text-gray-400">
                        Unidades Afectadas
                      </p>
                      <p className="mt-1 text-lg font-semibold text-orange-300">
                        {defectiveStats.totalQuantity}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-800/50 p-3">
                      <p className="text-xs text-gray-400">Con Garantía</p>
                      <p className="mt-1 text-lg font-semibold text-amber-300">
                        {defectiveStats.withWarranty}
                      </p>
                      {defectiveStats.warrantyApproved > 0 && (
                        <p className="text-xs text-green-400">
                          {defectiveStats.warrantyApproved} aprobadas
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg bg-gray-800/50 p-3">
                      <p className="text-xs text-gray-400">Stock Recuperado</p>
                      <p className="mt-1 text-lg font-semibold text-green-400">
                        {defectiveStats.stockRestored}
                      </p>
                      <p className="text-xs text-gray-500">unidades</p>
                    </div>
                  </div>
                  {defectiveStats.pendingCount > 0 && (
                    <p className="mt-2 text-xs text-yellow-400">
                      ⏳ {defectiveStats.pendingCount} reportes pendientes de
                      revisar
                    </p>
                  )}
                </>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-sm text-gray-400">
                    ✅ No hay productos defectuosos reportados
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Cuando se reporten productos defectuosos, las estadísticas
                    aparecerán aquí
                  </p>
                </div>
              )}
            </div>

            {/* Ganancia Estimada Total */}
            <div className="rounded-xl border border-teal-900/50 bg-gradient-to-br from-teal-950/40 to-gray-900 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-teal-200">
                    📊 Ganancia Estimada Total
                  </h3>
                  <p className="text-xs text-gray-400">
                    {estimatedProfit?.message || "Cargando..."}
                  </p>
                </div>
                <button
                  onClick={() => setShowEstimatedDetails(!showEstimatedDetails)}
                  className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-300 transition hover:bg-teal-500/30"
                >
                  {showEstimatedDetails ? "Ocultar detalles" : "Ver detalles"}
                </button>
              </div>

              {loadingEstimated ? (
                <div className="text-center text-gray-400">Calculando...</div>
              ) : estimatedProfit ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">Tu Ganancia Admin</p>
                      <p className="mt-1 text-xl font-bold text-emerald-400">
                        {formatCurrency(
                          estimatedProfit.consolidated.adminProfit
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">Inversión Total</p>
                      <p className="mt-1 text-xl font-bold text-amber-300">
                        {formatCurrency(
                          estimatedProfit.consolidated.investment
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">Valor en Ventas</p>
                      <p className="mt-1 text-xl font-bold text-green-300">
                        {formatCurrency(
                          estimatedProfit.consolidated.salesValue
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">Total Productos</p>
                      <p className="mt-1 text-xl font-bold text-purple-300">
                        {estimatedProfit.consolidated.totalProducts}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">Total Unidades</p>
                      <p className="mt-1 text-xl font-bold text-blue-300">
                        {estimatedProfit.consolidated.totalUnits.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">📈 Rentabilidad</p>
                      <p className="mt-1 text-xl font-bold text-teal-300">
                        {estimatedProfit.consolidated.profitability ??
                          (estimatedProfit.consolidated.salesValue > 0
                            ? (
                                (estimatedProfit.consolidated.adminProfit /
                                  estimatedProfit.consolidated.salesValue) *
                                100
                              ).toFixed(1)
                            : 0)}
                        %
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-500">
                        Ganancia / Ventas
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">⚡ Multiplicador</p>
                      <p className="mt-1 text-xl font-bold text-amber-300">
                        {estimatedProfit.consolidated.costMultiplier ??
                          (estimatedProfit.consolidated.investment > 0
                            ? (
                                (estimatedProfit.consolidated.adminProfit /
                                  estimatedProfit.consolidated.investment) *
                                100
                              ).toFixed(1)
                            : 0)}
                        %
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-500">
                        Ganancia / Inversión
                      </p>
                    </div>
                  </div>

                  {/* Detalles por origen */}
                  {showEstimatedDetails && (
                    <div className="mt-4 space-y-4">
                      {/* Bodega */}
                      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                          🏭 Bodega Principal
                          <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs font-normal text-gray-300">
                            {estimatedProfit.warehouse.totalUnits} unidades
                          </span>
                        </h4>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-gray-400">Inversión:</span>
                            <span className="ml-1 font-semibold text-amber-300">
                              {formatCurrency(
                                estimatedProfit.warehouse.investment
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Valor venta:</span>
                            <span className="ml-1 font-semibold text-green-300">
                              {formatCurrency(
                                estimatedProfit.warehouse.salesValue
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Tu ganancia:</span>
                            <span className="ml-1 font-semibold text-emerald-400">
                              {formatCurrency(
                                estimatedProfit.warehouse.adminProfit
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Sedes */}
                      {estimatedProfit.hasBranches &&
                        estimatedProfit.branches.branches.length > 0 && (
                          <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                              🏪 Sedes (
                              {estimatedProfit.branches.branches.length})
                              <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs font-normal text-gray-300">
                                {estimatedProfit.branches.totalUnits} unidades
                              </span>
                            </h4>
                            <div className="space-y-2">
                              {estimatedProfit.branches.branches.map(branch => (
                                <div
                                  key={branch.id}
                                  className="flex items-center justify-between rounded bg-gray-900/50 px-2 py-1.5 text-xs"
                                >
                                  <span className="font-medium text-gray-200">
                                    {branch.name}
                                  </span>
                                  <div className="flex gap-4">
                                    <span className="text-gray-400">
                                      {branch.totalUnits} uds
                                    </span>
                                    <span className="font-semibold text-emerald-400">
                                      {formatCurrency(branch.adminProfit)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex justify-end border-t border-gray-700 pt-2 text-xs">
                              <span className="text-gray-400">
                                Tu ganancia de sedes:
                              </span>
                              <span className="ml-2 font-bold text-emerald-400">
                                {formatCurrency(
                                  estimatedProfit.branches.adminProfit
                                )}
                              </span>
                            </div>
                          </div>
                        )}

                      {/* Distribuidores */}
                      {estimatedProfit.hasDistributors &&
                        estimatedProfit.distributors.distributors.length >
                          0 && (
                          <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                              👥 Distribuidores (
                              {estimatedProfit.distributors.distributors.length}
                              )
                              <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs font-normal text-gray-300">
                                {estimatedProfit.distributors.totalUnits}{" "}
                                unidades
                              </span>
                            </h4>
                            <p className="mb-2 text-xs text-gray-400">
                              Tu ganancia es solo el margen (precio distribuidor
                              - costo)
                            </p>
                            <div className="space-y-2">
                              {estimatedProfit.distributors.distributors
                                .slice(0, 10)
                                .map(dist => (
                                  <div
                                    key={dist.id}
                                    className="flex items-center justify-between rounded bg-gray-900/50 px-2 py-1.5 text-xs"
                                  >
                                    <div>
                                      <span className="font-medium text-gray-200">
                                        {dist.name}
                                      </span>
                                      {dist.email && (
                                        <span className="ml-2 text-gray-500">
                                          {dist.email}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex gap-4">
                                      <span className="text-gray-400">
                                        {dist.totalUnits} uds
                                      </span>
                                      <span className="font-semibold text-emerald-400">
                                        {formatCurrency(dist.adminProfit)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                            <div className="mt-2 flex justify-end border-t border-gray-700 pt-2 text-xs">
                              <span className="text-gray-400">
                                Tu ganancia de distribuidores:
                              </span>
                              <span className="ml-2 font-bold text-emerald-400">
                                {formatCurrency(
                                  estimatedProfit.distributors.adminProfit
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-400">
                  No se pudo cargar la información de ganancia estimada
                </div>
              )}
            </div>

            {/* Métricas de Créditos */}
            {creditsEnabled &&
              creditMetrics &&
              (creditMetrics.total.totalCredits > 0 ||
                creditMetrics.total.totalPaidAmount > 0) && (
                <div className="rounded-xl border border-orange-900/50 bg-gradient-to-br from-orange-950/40 to-gray-900 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-orange-200">
                        💳 Métricas de Créditos
                      </h3>
                      <p className="text-xs text-gray-400">
                        Resumen de cuentas por cobrar
                      </p>
                    </div>
                    {creditMetrics.total.totalCredits > 0 && (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          (creditMetrics.overdue.count || 0) > 0
                            ? "bg-red-500/20 text-red-300"
                            : "bg-green-500/20 text-green-300"
                        }`}
                      >
                        {(creditMetrics.overdue.count || 0) > 0
                          ? `${creditMetrics.overdue.count} vencidos`
                          : "Al día"}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">Créditos activos</p>
                      <p className="mt-1 text-xl font-bold text-orange-300">
                        {creditMetrics.total.totalCredits || 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">Por cobrar</p>
                      <p className="mt-1 text-xl font-bold text-orange-400">
                        {formatCurrency(
                          creditMetrics.total.totalRemainingAmount || 0
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">Cobrado</p>
                      <p className="mt-1 text-xl font-bold text-green-400">
                        {formatCurrency(
                          creditMetrics.total.totalPaidAmount || 0
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">Vencidos</p>
                      <p
                        className={`mt-1 text-xl font-bold ${
                          (creditMetrics.overdue.count || 0) > 0
                            ? "text-red-400"
                            : "text-gray-400"
                        }`}
                      >
                        {creditMetrics.overdue.count || 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">Monto vencido</p>
                      <p
                        className={`mt-1 text-xl font-bold ${
                          (creditMetrics.overdue.amount || 0) > 0
                            ? "text-red-400"
                            : "text-gray-400"
                        }`}
                      >
                        {formatCurrency(creditMetrics.overdue.amount || 0)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">Tasa recuperación</p>
                      <p
                        className={`mt-1 text-xl font-bold ${
                          Number(creditMetrics.recoveryRate || 0) >= 70
                            ? "text-green-400"
                            : Number(creditMetrics.recoveryRate || 0) >= 50
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {creditMetrics.recoveryRate || 0}%
                      </p>
                    </div>
                  </div>
                  {/* Top deudores */}
                  {creditMetrics.topDebtors &&
                    creditMetrics.topDebtors.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm font-medium text-gray-300">
                          Top deudores
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {creditMetrics.topDebtors
                            .slice(0, 6)
                            .map((debtor, idx) => (
                              <div
                                key={debtor.customerId || idx}
                                className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-gray-200">
                                    {debtor.customerName || "Cliente"}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {debtor.creditsCount} crédito
                                    {debtor.creditsCount !== 1 ? "s" : ""}
                                  </p>
                                </div>
                                <p className="ml-2 text-sm font-semibold text-orange-400">
                                  {formatCurrency(debtor.totalDebt || 0)}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
          </>
        );
      })()}

      <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
        <div
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${distributorsEnabled ? "md:grid-cols-4" : "md:grid-cols-3"}`}
        >
          {distributorsEnabled && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Distribuidor
              </label>
              <select
                value={selectedDistributor}
                onChange={e => setSelectedDistributor(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              >
                <option value="">Todos</option>
                <option value="admin">Solo ventas admin</option>
                {distributorOptions
                  .filter(d => d.id !== "admin")
                  .map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.email ? `(${d.email})` : ""}
                    </option>
                  ))}
              </select>
            </div>
          )}

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
              Máx. ventas
            </label>
            <input
              type="number"
              min={20}
              max={400}
              value={limit}
              onChange={e => setLimit(Number(e.target.value) || 0)}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
          </div>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-6 ${distributorsEnabled ? "xl:grid-cols-4" : ""}`}
      >
        <div
          className={`rounded-xl border border-gray-800 bg-gray-900/70 shadow-lg ${distributorsEnabled ? "xl:col-span-3" : ""}`}
        >
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <div>
              <p className="text-sm text-gray-400">Transacciones recientes</p>
              <p className="text-lg font-semibold text-white">
                {overview?.summary.ordersCount ?? overview?.summary.count ?? 0}{" "}
                ventas
              </p>
            </div>
            <button
              onClick={loadOverview}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 transition hover:border-purple-400 hover:text-white"
            >
              Recargar
            </button>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[960px] divide-y divide-gray-800">
              <thead className="sticky top-0 bg-gray-950/80 backdrop-blur">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Venta
                  </th>
                  {distributorsEnabled && (
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Distribuidor
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Producto
                  </th>
                  {distributorsEnabled && (
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Ganancia dist
                    </th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Ganancia admin
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading && (
                  <tr>
                    <td
                      colSpan={distributorsEnabled ? 7 : 5}
                      className="px-4 py-6 text-center text-gray-400"
                    >
                      Cargando...
                    </td>
                  </tr>
                )}

                {!loading && (!overview || overview.entries.length === 0) && (
                  <tr>
                    <td
                      colSpan={distributorsEnabled ? 7 : 5}
                      className="px-4 py-6 text-center text-gray-400"
                    >
                      No hay ventas en el rango seleccionado.
                    </td>
                  </tr>
                )}

                {!loading &&
                  overview?.entries.map((entry: ProfitHistoryAdminEntry) => (
                    <tr key={entry.id} className="hover:bg-gray-950/40">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-200">
                        {formatDateTime(entry.date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300">
                        <div className="flex flex-col">
                          <span className="font-semibold">
                            {entry.saleId || entry.id}
                          </span>
                          {entry.eventName && (
                            <span className="text-xs text-purple-300">
                              {entry.eventName}
                            </span>
                          )}
                          <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-[11px] font-semibold uppercase text-gray-200">
                            <span
                              className={
                                entry.source === "special"
                                  ? "text-pink-300"
                                  : "text-emerald-300"
                              }
                            >
                              ●
                            </span>
                            {entry.source === "special" ? "Especial" : "Normal"}
                          </span>
                        </div>
                      </td>
                      {distributorsEnabled && (
                        <td className="px-4 py-3 text-sm text-gray-100">
                          <div className="flex flex-col">
                            <span className="font-semibold">
                              {entry.distributorName}
                            </span>
                            <span className="text-xs text-gray-400">
                              {entry.distributorEmail || "Admin"}
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-200">
                        {entry.productName || "-"}
                      </td>
                      {distributorsEnabled && (
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-cyan-300">
                          {formatCurrency(entry.distributorProfit)}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-emerald-300">
                        {formatCurrency(entry.netProfit ?? entry.adminProfit)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-purple-200">
                        {formatCurrency(entry.netProfit ?? entry.totalProfit)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Vista móvil en tarjetas */}
          <div className="space-y-3 md:hidden">
            {loading && (
              <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-center text-gray-300">
                Cargando...
              </div>
            )}

            {!loading && (!overview || overview.entries.length === 0) && (
              <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-center text-gray-300">
                No hay ventas en el rango seleccionado.
              </div>
            )}

            {!loading &&
              overview?.entries.map(entry => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">
                        {formatDateTime(entry.date)}
                      </p>
                      <p className="text-sm font-semibold text-white">
                        {entry.saleId || entry.id}
                      </p>
                      {entry.eventName && (
                        <p className="text-xs text-purple-300">
                          {entry.eventName}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2 py-1 text-[11px] font-semibold uppercase text-gray-200">
                      <span
                        className={
                          entry.source === "special"
                            ? "text-pink-300"
                            : "text-emerald-300"
                        }
                      >
                        ●
                      </span>
                      {entry.source === "special" ? "Especial" : "Normal"}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-sm text-gray-200">
                    {distributorsEnabled && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-400">Distribuidor</span>
                        <span className="text-right font-semibold text-white">
                          {entry.distributorName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-400">Producto</span>
                      <span className="text-right text-white">
                        {entry.productName || "-"}
                      </span>
                    </div>
                    {distributorsEnabled && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-400">Ganancia dist</span>
                        <span className="font-semibold text-cyan-300">
                          {formatCurrency(entry.distributorProfit)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-400">Ganancia admin</span>
                      <span className="font-semibold text-emerald-300">
                        {formatCurrency(entry.netProfit ?? entry.adminProfit)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-400">Total</span>
                      <span className="font-semibold text-purple-200">
                        {formatCurrency(entry.netProfit ?? entry.totalProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {distributorsEnabled && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Ranking distribuidores</p>
                <p className="text-lg font-semibold text-white">
                  Top comisiones
                </p>
              </div>
              <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-200">
                {distributors.filter(d => d.id !== "admin").length} activos
              </span>
            </div>

            <div className="space-y-3">
              {distributors.length === 0 && (
                <p className="text-sm text-gray-400">
                  Aún no hay ventas registradas en este rango.
                </p>
              )}

              {distributors
                .filter(d => d.id !== "admin")
                .map((dist: ProfitHistoryAdminDistributor) => (
                  <div
                    key={dist.id}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2"
                  >
                    <div>
                      <p className="font-semibold text-gray-100">{dist.name}</p>
                      <p className="text-xs text-gray-400">
                        {dist.email || ""}
                      </p>
                      <p className="text-xs text-gray-500">
                        {dist.sales} ventas
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-cyan-300">
                        {formatCurrency(dist.distributorProfit)}
                      </p>
                      <p className="text-xs text-gray-400">Comisión</p>
                    </div>
                  </div>
                ))}
            </div>

            <div className="mt-5 rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <p className="text-sm font-semibold text-white">Ventas admin</p>
              <p className="text-xs text-gray-400">
                Incluye ventas directas y margen de cada venta de distribuidor.
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-300">Total admin</span>
                <span className="font-semibold text-emerald-300">
                  {formatCurrency(
                    distributors.find(d => d.id === "admin")?.adminProfit || 0
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
