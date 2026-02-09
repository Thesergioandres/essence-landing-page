import { useEffect, useMemo, useState } from "react";
import { useBusiness } from "../../context/BusinessContext";
import { analyticsService } from "../../features/analytics/services";
import type {
  ProfitHistoryAdminDistributor,
  ProfitHistoryAdminEntry,
  ProfitHistoryAdminOverview,
} from "../../features/analytics/types/analytics.types";
import {
  expenseService,
  profitHistoryService,
} from "../../features/common/services";
import type { Expense } from "../../features/common/types/common.types";
import { creditService } from "../../features/credits/services";
import type { CreditMetrics } from "../../features/credits/types/credit.types";
import { defectiveProductService } from "../../features/sales/services";
import { useFeature } from "../FeatureSection";
import InfoTooltip from "../InfoTooltip";

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
    profitability?: number;
    costMultiplier?: number;
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

const isValidObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

interface ProfitHistoryViewProps {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void;
}

export default function ProfitHistoryView({
  dateRange,
  onDateRangeChange,
}: ProfitHistoryViewProps) {
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

  // We rely on dateRange prop, so no local date state

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
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      setOverview(profitData);
      setExpenses(expenseData.expenses || []);
      setCreditMetrics(creditData);
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
      setEstimatedProfit(profitData as any);

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
    void loadOverview();
    // Estimated profit is live snapshot, usually date-independent for current stock,
    // but defective stats *might* respect date if API supported it, but service signature suggests global.
    // However, user prompt says "Reporte vivo" and "Calculado directamente...".
    // We reload it when other things reload.
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
    if (!overview || !overview.distributors) return [];
    return overview.distributors;
  }, [overview]);

  const distributorOptions = useMemo(() => {
    if (!distributors || !Array.isArray(distributors)) return [];
    const seen = new Set<string>();
    return distributors.filter(dist => {
      const allow = dist.id === "admin" || isValidObjectId(dist.id);
      if (!allow) return false;
      if (seen.has(dist.id)) return false;
      seen.add(dist.id);
      return true;
    });
  }, [distributors]);

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
    <div className="space-y-6">
      {/* Removed standalone header with date controls as parent handles it */}

      {/* Cálculos de gastos y utilidad neta */}
      {(() => {
        // Validar que overview exista
        if (!overview) {
          return null;
        }

        // Filtrar gastos de defectuosos para evitar doble conteo
        // (ya se cuentan vía defectiveStats.totalLoss)
        // Filtrar gastos de defectuosos para evitar doble conteo.
        // "Costo de Venta" ya está filtrado desde el Backend.
        // "Publicidad" y otros deben pasar.
        const nonDefectiveExpenses = expenses.filter(e => {
          const t = (e.type || "").toLowerCase();
          const c = (e.category || "").toLowerCase();
          return !t.includes("defectuoso") && !c.includes("defectuoso");
        });
        const nonDefectiveTotal = nonDefectiveExpenses.reduce(
          (sum, e) => sum + (e.amount || 0),
          0
        );
        // const totalProfit = overview.totalProfit || 0;

        const entryTotals = (overview.recentEntries || []).map(entry => {
          const total = entry.totalProfit ?? entry.netProfit ?? 0;
          return Number.isFinite(total) ? total : 0;
        });
        const fallbackGross = entryTotals
          .filter(value => value > 0)
          .reduce((sum, value) => sum + value, 0);
        const fallbackExpenses = entryTotals
          .filter(value => value < 0)
          .reduce((sum, value) => sum + value, 0);

        // 1. Gross Profit (Ganancia Bruta): Should be Revenue - Cost - Shipping (No Commissions)
        // Note: Backend returns data directly in overview, not in overview.summary
        const rawGrossProfit =
          overview.grossProfit ?? overview.totalProfit ?? 0;
        const grossProfit =
          rawGrossProfit === 0 && fallbackGross !== 0
            ? fallbackGross
            : rawGrossProfit;

        // 2. Commissions (from backend overview)
        const commissions = overview.totalDistributorCommissions || 0;

        const historyTotalExpensesRaw = overview.totalExpenses ?? 0;
        const historyTotalExpenses = Math.abs(historyTotalExpensesRaw);
        const fallbackTotalExpenses = Math.abs(fallbackExpenses);
        const totalExpenses =
          historyTotalExpenses > 0
            ? historyTotalExpenses
            : fallbackTotalExpenses > 0
              ? fallbackTotalExpenses
              : nonDefectiveTotal;
        const defectiveLosses =
          historyTotalExpenses > 0 || fallbackTotalExpenses > 0
            ? 0
            : defectiveStats?.totalLoss || 0;

        const additionalSalesCosts = 0;

        // 3. Net Profit (Ganancia Neta): Gross - Commissions - Expenses - Defects - Additional Costs
        const computedNet =
          grossProfit -
          commissions -
          totalExpenses -
          defectiveLosses -
          additionalSalesCosts;
        const backendNet = overview.netProfit;
        const backendTotal = overview.totalProfit;
        const netProfit =
          typeof backendNet === "number" && backendNet !== 0
            ? backendNet
            : typeof backendTotal === "number" && backendTotal !== 0
              ? backendTotal
              : computedNet;

        // Usar gastos filtrados (sin defectuosos) para evitar doble conteo
        const expensesByType = nonDefectiveExpenses.reduce(
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
              <div className="bg-linear-to-br rounded-xl border border-gray-800 from-emerald-600/30 via-teal-600/20 to-gray-900 p-4 text-white shadow-lg">
                <p className="text-sm text-emerald-100">
                  Ganancia neta de ventas
                  <InfoTooltip
                    text="Utilidad neta real por ventas confirmadas en el periodo."
                    tone="neutral"
                    className="border-emerald-200/70 text-emerald-100"
                  />
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {formatCurrency(netProfit)}
                </p>
                <p className="text-xs text-emerald-100/80">
                  Metrica principal del periodo
                </p>
                <p className="text-xs text-emerald-100/70">
                  {totalExpenses > 0 ||
                  defectiveLosses > 0 ||
                  additionalSalesCosts > 0
                    ? `- ${formatCurrency(commissions + totalExpenses + defectiveLosses + additionalSalesCosts)} (comis. + gastos + defec. + costos adic.)`
                    : distributorsEnabled
                      ? "Ventas directas + margen"
                      : "Ventas directas"}
                </p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-white">
                <p className="text-sm text-gray-300">
                  Ganancia bruta
                  <InfoTooltip text="Suma de utilidades de ventas antes de gastos y ajustes." />
                </p>
                <p className="mt-2 text-xl font-semibold text-purple-200">
                  {formatCurrency(grossProfit)}
                </p>
                <p className="text-xs text-gray-400">
                  {distributorsEnabled
                    ? "Admin + distribuidores"
                    : "Total ventas"}
                </p>
              </div>
              {distributorsEnabled && (
                <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-white">
                  <p className="text-sm text-gray-300">
                    Comisiones distribuidores
                    <InfoTooltip text="Total pagado a distribuidores por ventas confirmadas." />
                  </p>
                  <p className="mt-2 text-xl font-semibold text-cyan-300">
                    {formatCurrency(commissions)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {overview?.totalEntries ?? 0} entradas
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-white">
                <p className="text-sm text-red-300">
                  Total gastos + perdidas
                  <InfoTooltip
                    text="Gastos operativos y perdidas por defectuosos del periodo."
                    tone="danger"
                  />
                </p>
                <p className="mt-2 text-xl font-semibold text-red-400">
                  -{formatCurrency(totalExpenses + defectiveLosses)}
                </p>
                <p className="text-xs text-red-300/70">
                  {nonDefectiveExpenses.length} gastos
                  {defectiveLosses > 0
                    ? ` + ${formatCurrency(defectiveLosses)} defec.`
                    : ""}
                </p>
              </div>
              {/* Rentabilidad deshabilitada - no tenemos datos de ventas totales */}
              {/* <div className="rounded-xl border p-4 text-white shadow-lg">
                <p className="text-sm text-gray-200">📈 Rentabilidad</p>
                <p className="mt-2 text-2xl font-bold">N/A</p>
                <p className="text-xs text-gray-400">
                  Utilidad neta / Total vendido
                </p>
              </div> */}
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
            <div className="bg-linear-to-br rounded-xl border border-orange-900/50 from-orange-950/40 to-gray-900 p-4">
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
                      <p className="text-xs text-red-300">
                        Total Pérdidas
                        <InfoTooltip
                          text="Perdida total por productos defectuosos en el periodo."
                          tone="danger"
                        />
                      </p>
                      <p className="mt-1 text-xl font-bold text-red-400">
                        {formatCurrency(defectiveStats.totalLoss)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-800/50 p-3">
                      <p className="text-xs text-gray-400">
                        Total Reportes
                        <InfoTooltip text="Cantidad de reportes defectuosos registrados." />
                      </p>
                      <p className="mt-1 text-lg font-semibold text-orange-300">
                        {defectiveStats.totalReports}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-800/50 p-3">
                      <p className="text-xs text-gray-400">
                        Unidades Afectadas
                        <InfoTooltip text="Total de unidades reportadas como defectuosas." />
                      </p>
                      <p className="mt-1 text-lg font-semibold text-orange-300">
                        {defectiveStats.totalQuantity}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-800/50 p-3">
                      <p className="text-xs text-gray-400">
                        Con Garantía
                        <InfoTooltip text="Reportes con garantia asociada." />
                      </p>
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
                      <p className="text-xs text-gray-400">
                        Stock Recuperado
                        <InfoTooltip text="Unidades recuperadas al inventario." />
                      </p>
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

            {/* Utilidad Potencial del Inventario */}
            <div className="bg-linear-to-br rounded-xl border border-teal-900/50 from-teal-950/40 to-gray-900 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-teal-200">
                    📦 Utilidad Potencial del Inventario
                    <InfoTooltip
                      text="Calculo teorico de cuanto ganarias si vendieras todo tu stock actual hoy."
                      tone="neutral"
                      className="border-teal-200/70 text-teal-200"
                    />
                  </h3>
                  <p className="text-xs text-gray-400">
                    {estimatedProfit?.message ||
                      "Estimado con inventario actual"}
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
              ) : estimatedProfit && estimatedProfit.consolidated ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">
                        Tu Ganancia Admin
                        <InfoTooltip text="Suma de la utilidad de tus ventas directas + la diferencia del precio B2B de tus distribuidores." />
                      </p>
                      <p className="mt-1 text-xl font-bold text-emerald-400">
                        {formatCurrency(
                          estimatedProfit.consolidated.adminProfit || 0
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">
                        Inversión Total
                        <InfoTooltip text="Costo total del inventario actual." />
                      </p>
                      <p className="mt-1 text-xl font-bold text-amber-300">
                        {formatCurrency(
                          estimatedProfit.consolidated.investment || 0
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">
                        Valor en Ventas
                        <InfoTooltip text="Valor total estimado si se vende todo el inventario." />
                      </p>
                      <p className="mt-1 text-xl font-bold text-green-300">
                        {formatCurrency(
                          estimatedProfit.consolidated.salesValue || 0
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">
                        Total Productos
                        <InfoTooltip text="Cantidad de referencias distintas en inventario." />
                      </p>
                      <p className="mt-1 text-xl font-bold text-purple-300">
                        {estimatedProfit.consolidated.totalProducts}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">
                        Total Unidades
                        <InfoTooltip text="Cantidad total de unidades en inventario." />
                      </p>
                      <p className="mt-1 text-xl font-bold text-blue-300">
                        {estimatedProfit.consolidated.totalUnits.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                      <p className="text-xs text-gray-400">
                        📈 Rentabilidad
                        <InfoTooltip text="Ganancia estimada / valor total de ventas." />
                      </p>
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
                      <p className="text-xs text-gray-400">
                        ⚡ Multiplicador
                        <InfoTooltip text="Ganancia estimada / inversion total." />
                      </p>
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
                <div className="bg-linear-to-br rounded-xl border border-orange-900/50 from-orange-950/40 to-gray-900 p-4">
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
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${distributorsEnabled ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
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
                onDateRangeChange({ ...dateRange, startDate: e.target.value })
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
                onDateRangeChange({ ...dateRange, endDate: e.target.value })
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
                {overview?.totalEntries ?? 0} entradas
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

                {!loading &&
                  (!overview ||
                    !overview.recentEntries ||
                    overview.recentEntries.length === 0) && (
                    <tr>
                      <td
                        colSpan={distributorsEnabled ? 7 : 5}
                        className="px-4 py-6 text-center text-gray-400"
                      >
                        No hay entradas en el rango seleccionado.
                      </td>
                    </tr>
                  )}

                {!loading &&
                  overview?.recentEntries?.map(
                    (entry: ProfitHistoryAdminEntry) => (
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
                              {entry.source === "special"
                                ? "Especial"
                                : "Normal"}
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
                          {formatCurrency(entry.adminProfit ?? 0)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-purple-200">
                          {formatCurrency(
                            entry.totalProfit ??
                              (entry.adminProfit || 0) +
                                (entry.distributorProfit || 0)
                          )}
                        </td>
                      </tr>
                    )
                  )}
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

            {!loading &&
              (!overview ||
                !overview.recentEntries ||
                overview.recentEntries.length === 0) && (
                <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-center text-gray-300">
                  No hay entradas en el rango seleccionado.
                </div>
              )}

            {!loading &&
              overview?.recentEntries?.map(entry => (
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
                        {formatCurrency(entry.adminProfit ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-400">Total</span>
                      <span className="font-semibold text-purple-200">
                        {formatCurrency(
                          entry.totalProfit ??
                            (entry.adminProfit || 0) +
                              (entry.distributorProfit || 0)
                        )}
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
