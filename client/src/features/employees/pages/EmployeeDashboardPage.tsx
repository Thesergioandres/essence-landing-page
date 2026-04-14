import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfidentialBadge } from "../../../shared/components/ui";
import { authService } from "../../auth/services";
import { useFinancialPrivacy } from "../../auth/utils/financialPrivacy";
import { dispatchService } from "../../branches/services";
import { gamificationService } from "../../common/services";
import type { Credit } from "../../credits/types/credit.types";
import { stockService } from "../../inventory/services/inventory.service";
import type { EmployeeStock } from "../../inventory/types/product.types";
import { saleService } from "../../sales/services";
import type { Sale } from "../../sales/types/sales.types";

interface DashboardStats {
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  todaySalesCount: number;
  stockAvailableUnits: number;
  productsCount: number;
  lowStockCount: number;
  pendingCreditsAmount: number;
  pendingCreditsCount: number;
  overdueCreditsAmount: number;
  overdueCreditsCount: number;
}

interface AnimatedDashboardStats {
  salesToday: number;
  stockAvailable: number;
  totalSales: number;
  totalProfit: number;
  productsCount: number;
}

interface RankingInfo {
  position: number | null;
  bonusCommission: number;
  periodStart: string;
  periodEnd: string;
  totalEmployees: number;
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { hideFinancialData } = useFinancialPrivacy();
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    todaySalesCount: 0,
    stockAvailableUnits: 0,
    productsCount: 0,
    lowStockCount: 0,
    pendingCreditsAmount: 0,
    pendingCreditsCount: 0,
    overdueCreditsAmount: 0,
    overdueCreditsCount: 0,
  });
  const [animatedStats, setAnimatedStats] = useState<AnimatedDashboardStats>({
    salesToday: 0,
    stockAvailable: 0,
    totalSales: 0,
    totalProfit: 0,
    productsCount: 0,
  });
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [pendingCredits, setPendingCredits] = useState<Credit[]>([]);
  const [myStock, setMyStock] = useState<EmployeeStock[]>([]);
  const [rankingInfo, setRankingInfo] = useState<RankingInfo | null>(null);
  const [pendingReceptionCount, setPendingReceptionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    let isActive = true;

    const syncPendingReception = async () => {
      try {
        const count = await dispatchService.getPendingReceptionCount();
        if (isActive) {
          setPendingReceptionCount(Number(count || 0));
        }
      } catch {
        if (isActive) {
          setPendingReceptionCount(0);
        }
      }
    };

    syncPendingReception();
    const intervalId = window.setInterval(syncPendingReception, 45000);
    window.addEventListener("dispatch-updated", syncPendingReception);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      window.removeEventListener("dispatch-updated", syncPendingReception);
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const counters = {
      salesToday: 0,
      stockAvailable: 0,
      totalSales: 0,
      totalProfit: 0,
      productsCount: 0,
    };

    const context = gsap.context(() => {
      gsap.fromTo(
        ".dashboard-stat-card",
        { autoAlpha: 0, y: 28, scale: 0.97 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.62,
          ease: "power3.out",
          stagger: 0.1,
          overwrite: "auto",
        }
      );

      gsap.to(counters, {
        salesToday: stats.todaySalesCount,
        stockAvailable: stats.stockAvailableUnits,
        totalSales: stats.totalSales,
        totalProfit: stats.totalProfit,
        productsCount: stats.productsCount,
        duration: 1.15,
        ease: "power2.out",
        onUpdate: () => {
          setAnimatedStats({
            salesToday: Math.round(counters.salesToday),
            stockAvailable: Math.round(counters.stockAvailable),
            totalSales: Math.round(counters.totalSales),
            totalProfit: Math.round(counters.totalProfit),
            productsCount: Math.round(counters.productsCount),
          });
        },
      });
    }, dashboardRef);

    return () => {
      context.revert();
    };
  }, [
    loading,
    stats.productsCount,
    stats.stockAvailableUnits,
    stats.todaySalesCount,
    stats.totalProfit,
    stats.totalSales,
  ]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const businessId = localStorage.getItem("businessId");
      if (!businessId) {
        setError("Debes seleccionar un negocio antes de continuar.");
        setLoading(false);
        return;
      }

      const userId = authService.getCurrentUser()?._id || "";
      const [salesData, stockData, commissionData, shipmentPendingCount] =
        await Promise.all([
          saleService
            .getEmployeeSales(undefined, { limit: 50 })
            .catch(() => ({ sales: [] })),
          stockService.getEmployeeStock("me").catch(() => []),
          userId
            ? gamificationService
                .getAdjustedCommission(userId)
                .catch(() => null)
            : Promise.resolve(null),
          dispatchService.getPendingReceptionCount().catch(() => 0),
        ]);

      // Filter out promotions from stock data
      const filteredStockData = (stockData || []).filter(item => {
        const product = typeof item.product === "object" ? item.product : null;
        return product && !product.isPromotion;
      });

      // Filtrar créditos pendientes y vencidos
      const now = new Date();
      const salesList = salesData?.sales || [];
      const creditSales = salesList.filter(sale => {
        if (sale.isCredit || sale.paymentMethodCode === "credit") return true;
        const credit = sale.credit || sale.creditId;
        return Boolean(credit);
      });

      const pendingCreditSales = creditSales.filter(sale => {
        const credit = (sale.credit || sale.creditId) as Credit | null;
        if (!credit) return true;
        return ["pending", "partial", "overdue"].includes(credit.status);
      });

      const overdueCredits = pendingCreditSales.filter(sale => {
        const credit = (sale.credit || sale.creditId) as Credit | null;
        if (!credit?.dueDate) return false;
        return new Date(credit.dueDate) < now;
      });

      // Calcular estadísticas
      const totalSales = salesList.length;
      const totalRevenue = salesList.reduce(
        (sum, sale) => sum + sale.salePrice * sale.quantity,
        0
      );
      const totalProfit = salesList.reduce(
        (sum, sale) => sum + sale.employeeProfit,
        0
      );
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todaySalesCount = salesList.filter(sale => {
        const saleDate = new Date(sale.saleDate);
        return !Number.isNaN(saleDate.getTime()) && saleDate >= startOfDay;
      }).length;

      const stockAvailableUnits = filteredStockData.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      );
      const lowStockCount = filteredStockData.filter(
        item => item.quantity <= item.lowStockAlert
      ).length;

      // Calcular créditos pendientes
      const pendingCreditsAmount = pendingCreditSales.reduce((sum, sale) => {
        const credit = (sale.credit || sale.creditId) as Credit | null;
        if (credit) {
          return sum + (credit.remainingAmount || 0);
        }
        return sum + sale.salePrice * sale.quantity;
      }, 0);
      const overdueCreditsAmount = overdueCredits.reduce((sum, sale) => {
        const credit = (sale.credit || sale.creditId) as Credit | null;
        if (credit) {
          return sum + (credit.remainingAmount || 0);
        }
        return sum + sale.salePrice * sale.quantity;
      }, 0);

      setStats({
        totalSales,
        totalRevenue,
        totalProfit,
        todaySalesCount,
        stockAvailableUnits,
        productsCount: filteredStockData.length,
        lowStockCount,
        pendingCreditsAmount,
        pendingCreditsCount: pendingCreditSales.length,
        overdueCreditsAmount,
        overdueCreditsCount: overdueCredits.length,
      });

      setRecentSales(salesList.slice(0, 5));
      setPendingCredits(
        pendingCreditSales
          .slice(0, 5)
          .map(sale => (sale.credit || sale.creditId) as Credit)
          .filter(Boolean)
      );
      setMyStock(filteredStockData.slice(0, 6));

      if (commissionData) {
        setRankingInfo(commissionData);
      }

      setPendingReceptionCount(Number(shipmentPendingCount || 0));
    } catch (error) {
      console.error("Error al cargar datos del dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-center text-gray-200">
        <p className="text-lg font-semibold text-red-300">{error}</p>
        <p className="text-sm text-gray-400">
          Selecciona un negocio en el selector superior y vuelve a intentar.
        </p>
        <button
          onClick={() => navigate("/staff/dashboard")}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div ref={dashboardRef} className="space-y-8">
      <div className="dashboard-stat-card rounded-2xl border border-white/10 bg-gray-900/55 p-6 shadow-[0_10px_30px_rgba(2,6,23,0.35)] backdrop-blur-xl sm:p-7">
        <h1 className="bg-linear-to-r from-cyan-300 via-blue-300 to-slate-200 bg-clip-text text-4xl font-bold text-transparent">
          Employee Premium Hub
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-300 sm:text-base">
          Dashboard operativo con lectura en tiempo real, navegación fluida y
          blindaje financiero visual.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="dashboard-stat-card rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_28px_rgba(2,6,23,0.35)] backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/90">
            Ventas de Hoy
          </p>
          <p className="mt-3 text-4xl font-bold text-white">
            {animatedStats.salesToday.toLocaleString("es-CO")}
          </p>
          <p className="mt-2 text-sm text-gray-300">
            Registros cerrados durante la jornada actual.
          </p>
        </article>

        <article className="dashboard-stat-card rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_28px_rgba(2,6,23,0.35)] backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200/90">
            Stock Disponible
          </p>
          <p className="mt-3 text-4xl font-bold text-white">
            {animatedStats.stockAvailable.toLocaleString("es-CO")}
          </p>
          <p className="mt-2 text-sm text-gray-300">
            Unidades listas para venta inmediata.
          </p>
        </article>

        <article className="dashboard-stat-card bg-white/4 rounded-2xl border border-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_28px_rgba(2,6,23,0.35)] backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            Blindaje de Márgenes
          </p>
          <div className="mt-4">
            {hideFinancialData ? (
              <ConfidentialBadge
                label="Margen administrativo"
                className="pointer-events-none select-none"
              />
            ) : (
              <p className="text-sm font-semibold text-emerald-300">
                Acceso habilitado por permisos financieros.
              </p>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Los costos internos permanecen sellados para vista empleado.
          </p>
        </article>
      </div>

      {pendingReceptionCount > 0 && (
        <div className="dashboard-stat-card bg-linear-to-br from-sky-800/22 rounded-2xl border border-sky-400/35 via-blue-900/20 to-gray-900/70 p-5 shadow-[0_14px_30px_rgba(8,47,73,0.3)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-200">
                Tienes {pendingReceptionCount} pedidos pendientes por recibir
              </p>
              <p className="mt-1 text-sm text-gray-300">
                Confirma recepción para mover unidades de tránsito a stock
                disponible.
              </p>
            </div>
            <button
              onClick={() => navigate("/staff/my-shipments")}
              className="min-h-11 rounded-xl border border-sky-300/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-50 transition-all duration-300 hover:border-sky-200/70 hover:bg-sky-500/30"
            >
              Ver pedidos en camino
            </button>
          </div>
        </div>
      )}

      {rankingInfo && rankingInfo.position && (
        <div className="dashboard-stat-card bg-linear-to-br from-yellow-900/24 via-orange-900/18 rounded-2xl border border-yellow-500/40 to-gray-900/70 p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-4xl">
                  {rankingInfo.position === 1
                    ? "🥇"
                    : rankingInfo.position === 2
                      ? "🥈"
                      : rankingInfo.position === 3
                        ? "🥉"
                        : "🏅"}
                </span>
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    Posición #{rankingInfo.position}
                  </h3>
                  <p className="text-sm text-gray-300">
                    de {rankingInfo.totalEmployees} empleados
                  </p>
                </div>
              </div>

              {rankingInfo.bonusCommission > 0 && (
                <div className="bg-emerald-500/16 mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/45 px-4 py-2">
                  <span className="text-xl">💰</span>
                  <div>
                    <p className="text-xs text-emerald-300">
                      Comisión extra activa
                    </p>
                    <p className="text-lg font-bold text-emerald-200">
                      +{rankingInfo.bonusCommission}% en cada venta
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="text-left lg:text-right">
              <p className="mb-1 text-xs text-gray-400">Período actual</p>
              <p className="text-sm font-medium text-white">
                {new Date(rankingInfo.periodStart).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "short",
                })}
                {" - "}
                {new Date(rankingInfo.periodEnd).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "short",
                })}
              </p>
              <button
                onClick={() => navigate("/staff/stats")}
                className="mt-3 text-xs text-cyan-300 underline decoration-cyan-400/70 underline-offset-4 hover:text-cyan-200"
              >
                Ver ranking completo →
              </button>
            </div>
          </div>

          {rankingInfo.position <= 3 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="flex items-center gap-2 text-xs text-gray-300">
                <span>🏆</span>
                {rankingInfo.position === 1
                  ? "¡Primer lugar! Ganas $50,000 al final del período"
                  : "¡Top 3! Sigue vendiendo para ganar el primer lugar ($50,000)"}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="dashboard-stat-card bg-linear-to-br rounded-2xl border border-white/10 from-cyan-900/30 to-gray-900/70 p-6 backdrop-blur-xl transition-all duration-300 hover:border-cyan-400/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Ventas Realizadas</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {animatedStats.totalSales.toLocaleString("es-CO")}
              </p>
            </div>
            <div className="rounded-full border border-cyan-400/30 bg-cyan-500/15 p-3">
              <svg
                className="h-8 w-8 text-cyan-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="dashboard-stat-card bg-linear-to-br from-indigo-900/28 rounded-2xl border border-white/10 to-gray-900/70 p-6 backdrop-blur-xl transition-all duration-300 hover:border-indigo-400/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Mis Ganancias</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {formatCurrency(animatedStats.totalProfit)}
              </p>
              {hideFinancialData && (
                <div className="mt-2">
                  <ConfidentialBadge
                    compact
                    label="Costo base oculto"
                    className="pointer-events-none select-none"
                  />
                </div>
              )}
            </div>
            <div className="rounded-full border border-indigo-400/30 bg-indigo-500/15 p-3">
              <svg
                className="h-8 w-8 text-indigo-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="dashboard-stat-card bg-linear-to-br from-amber-900/28 rounded-2xl border border-white/10 to-gray-900/70 p-6 backdrop-blur-xl transition-all duration-300 hover:border-amber-400/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Mis Productos</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {animatedStats.productsCount.toLocaleString("es-CO")}
              </p>
              {stats.lowStockCount > 0 && (
                <p className="mt-1 text-xs text-red-300">
                  {stats.lowStockCount} con stock bajo
                </p>
              )}
            </div>
            <div className="rounded-full border border-amber-400/30 bg-amber-500/15 p-3">
              <svg
                className="h-8 w-8 text-amber-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {(stats.pendingCreditsCount > 0 || stats.overdueCreditsCount > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="dashboard-stat-card bg-linear-to-br from-orange-900/26 rounded-2xl border border-orange-500/45 to-gray-900/70 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-200">Pendiente por Cobrar</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {formatCurrency(stats.pendingCreditsAmount)}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {stats.pendingCreditsCount} créditos activos
                </p>
              </div>
              <div className="rounded-full border border-orange-400/40 bg-orange-500/15 p-3">
                <svg
                  className="h-8 w-8 text-orange-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
            {pendingCredits.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                {pendingCredits.slice(0, 3).map(credit => (
                  <div
                    key={credit._id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="max-w-[150px] truncate text-gray-300">
                      {typeof credit.customer === "object" &&
                      credit.customer?.name
                        ? credit.customer.name
                        : "Cliente"}
                    </span>
                    <span className="font-medium text-orange-300">
                      {formatCurrency(
                        (credit.originalAmount || 0) - (credit.paidAmount || 0)
                      )}
                    </span>
                  </div>
                ))}
                {stats.pendingCreditsCount > 3 && (
                  <p className="pt-1 text-xs text-gray-500">
                    +{stats.pendingCreditsCount - 3} más...
                  </p>
                )}
              </div>
            )}
          </div>

          {stats.overdueCreditsCount > 0 && (
            <div className="dashboard-stat-card bg-linear-to-br from-red-900/26 rounded-2xl border border-red-500/45 to-gray-900/70 p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-200">Créditos Vencidos</p>
                  <p className="mt-2 text-3xl font-bold text-red-300">
                    {formatCurrency(stats.overdueCreditsAmount)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {stats.overdueCreditsCount} créditos vencidos
                  </p>
                </div>
                <div className="rounded-full border border-red-400/40 bg-red-500/15 p-3">
                  <svg
                    className="h-8 w-8 text-red-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="bg-red-500/12 mt-4 rounded-xl border border-red-500/35 p-3">
                <p className="text-xs text-red-200">
                  ⚠️ Tienes créditos vencidos. Contacta a tus clientes para
                  gestionar el cobro.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <button
          onClick={() => navigate("/staff/register-sale")}
          className="dashboard-stat-card bg-linear-to-br from-cyan-600/18 to-blue-700/18 hover:from-cyan-600/26 hover:to-blue-700/28 rounded-2xl border border-white/10 p-6 text-left transition-all duration-300 hover:border-cyan-400/50"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-full border border-cyan-400/35 bg-cyan-500/20 p-4">
              <svg
                className="h-8 w-8 text-cyan-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Registrar Venta</h3>
              <p className="mt-1 text-sm text-gray-300">
                Registra una nueva venta de productos
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate("/staff/request-dispatch")}
          className="dashboard-stat-card bg-linear-to-br hover:from-amber-600/28 rounded-2xl border border-white/10 from-amber-600/20 to-orange-700/20 p-6 text-left transition-all duration-300 hover:border-amber-400/50 hover:to-orange-700/30"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-full border border-amber-300/30 bg-amber-500/20 p-4">
              <svg
                className="h-8 w-8 text-amber-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Solicitar Pedido</h3>
              <p className="mt-1 text-sm text-gray-300">
                Pide reposición de unidades a bodega
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate("/staff/products")}
          className="dashboard-stat-card bg-linear-to-br hover:from-indigo-600/28 rounded-2xl border border-white/10 from-indigo-600/20 to-violet-700/20 p-6 text-left transition-all duration-300 hover:border-indigo-400/50 hover:to-violet-700/30"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-full border border-indigo-300/30 bg-indigo-500/20 p-4">
              <svg
                className="h-8 w-8 text-indigo-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Ver Productos</h3>
              <p className="mt-1 text-sm text-gray-300">
                Consulta tu inventario asignado
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-gray-900/55 p-6 backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Mi Inventario</h2>
          <button
            onClick={() => navigate("/staff/products")}
            className="text-sm text-cyan-300 hover:text-cyan-200"
          >
            Ver todos →
          </button>
        </div>
        {myStock.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
            <p className="text-gray-400">No tienes productos asignados aún</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myStock.map(item => {
              const product =
                typeof item.product === "object" ? item.product : null;
              const isLowStock = item.quantity <= item.lowStockAlert;

              return (
                <div
                  key={item._id}
                  className={`rounded-xl border p-4 backdrop-blur-lg transition-all duration-300 ${
                    isLowStock
                      ? "bg-red-900/24 border-red-500/45"
                      : "border-white/12 bg-white/4 hover:border-cyan-400/40"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">
                        {product?.name || "Producto"}
                      </h3>
                      <p className="mt-1 text-sm text-gray-300">
                        Precio: {formatCurrency(product?.employeePrice || 0)}
                      </p>
                      {hideFinancialData && (
                        <div className="mt-2">
                          <ConfidentialBadge
                            compact
                            label="Margen interno"
                            className="pointer-events-none select-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Stock disponible</p>
                      <p
                        className={`text-2xl font-bold ${isLowStock ? "text-red-300" : "text-cyan-200"}`}
                      >
                        {item.quantity}
                      </p>
                    </div>
                    {isLowStock && (
                      <div className="rounded-full border border-red-400/40 bg-red-500/20 px-3 py-1">
                        <p className="text-xs font-semibold text-red-200">
                          Stock Bajo
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-gray-900/55 p-6 backdrop-blur-xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white">Ventas Recientes</h2>
          <div className="flex items-center gap-3">
            {hideFinancialData && (
              <ConfidentialBadge
                compact
                label="Márgenes admin"
                className="pointer-events-none select-none"
              />
            )}
            <button
              onClick={() => navigate("/staff/sales")}
              className="text-sm text-cyan-300 hover:text-cyan-200"
            >
              Ver todas →
            </button>
          </div>
        </div>
        {recentSales.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
            <p className="text-gray-400">
              No has registrado ventas aún.{" "}
              <button
                onClick={() => navigate("/staff/register-sale")}
                className="font-semibold text-cyan-300 hover:text-cyan-200"
              >
                Registra tu primera venta
              </button>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Precio Venta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Ganancia
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {recentSales.map(sale => {
                  const product =
                    typeof sale.product === "object" ? sale.product : null;
                  return (
                    <tr key={sale._id} className="transition hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatDate(sale.saleDate)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-white">
                        {product?.name || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {sale.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatCurrency(sale.salePrice)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-300">
                        {formatCurrency(sale.employeeProfit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
