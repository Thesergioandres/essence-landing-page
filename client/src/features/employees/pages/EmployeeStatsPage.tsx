import { gsap } from "gsap";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SalesTimelineChart,
  TopProductsChart,
} from "../../../components/charts";
import { ConfidentialBadge } from "../../../shared/components/ui";
import { analyticsService } from "../../analytics/services";
import type {
  GamificationConfig,
  RankingEntry,
} from "../../analytics/types/gamification.types";
import { useFinancialPrivacy } from "../../auth/utils/financialPrivacy";
import { gamificationService } from "../../common/services";
import { saleService } from "../../sales/services";
import type { Sale } from "../../sales/types/sales.types";
import LeaderboardTable from "../components/LeaderboardTable";

interface EstimatedProfitProduct {
  productId: string;
  name: string;
  image?: { url: string; publicId: string };
  quantity: number;
  employeePrice: number;
  clientPrice: number;
  investment: number;
  salesValue: number;
  estimatedProfit: number;
  profitPercentage: string;
}

interface EmployeeEstimate {
  grossProfit: number;
  netProfit: number;
  totalProducts: number;
  totalUnits: number;
  investment: number;
  salesValue: number;
  profitMargin: string;
  profitability?: number;
  products: EstimatedProfitProduct[];
}

interface AnimatedReportMetrics {
  totalSales: number;
  totalSoldAmount: number;
  netCommission: number;
  avgTicket: number;
}

interface ProductSalesItem {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  revenue: number;
  profit: number;
}

export default function EmployeeStats() {
  const { hideFinancialData, isEmployeeRole, canViewCosts } =
    useFinancialPrivacy();
  const pageRef = useRef<HTMLDivElement | null>(null);

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  });
  const [chartRange, setChartRange] = useState<"7d" | "30d" | "90d">("30d");
  const [previousStats, setPreviousStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
  });
  const [estimatedProfit, setEstimatedProfit] =
    useState<EmployeeEstimate | null>(null);
  const [loadingEstimated, setLoadingEstimated] = useState(true);
  const [showEstimatedProducts, setShowEstimatedProducts] = useState(false);
  const [rankingData, setRankingData] = useState<RankingEntry[]>([]);
  const [gamificationConfig, setGamificationConfig] =
    useState<GamificationConfig | null>(null);
  const [animatedMetrics, setAnimatedMetrics] = useState<AnimatedReportMetrics>(
    {
      totalSales: 0,
      totalSoldAmount: 0,
      netCommission: 0,
      avgTicket: 0,
    }
  );

  const loadStats = React.useCallback(async () => {
    try {
      setLoading(true);

      const startDate = dateRange.startDate;
      const endDate = dateRange.endDate;
      const rangeStart = new Date(`${startDate}T00:00:00`);
      const rangeEnd = new Date(`${endDate}T23:59:59`);
      const dayMs = 24 * 60 * 60 * 1000;
      const rangeDays = Math.max(
        1,
        Math.round((rangeEnd.getTime() - rangeStart.getTime()) / dayMs) + 1
      );
      const prevEnd = new Date(rangeStart.getTime() - dayMs);
      const prevStart = new Date(prevEnd.getTime() - (rangeDays - 1) * dayMs);

      const [currentRes, previousRes] = await Promise.all([
        saleService.getEmployeeSales(undefined, {
          startDate,
          endDate,
          limit: 500,
        }),
        saleService.getEmployeeSales(undefined, {
          startDate: prevStart.toISOString().slice(0, 10),
          endDate: prevEnd.toISOString().slice(0, 10),
          limit: 500,
        }),
      ]);

      const currentSales = currentRes?.sales || [];
      const previousSales = previousRes?.sales || [];
      setSales(currentSales);

      const prevStats = previousRes?.stats || {
        totalSales: previousSales.length,
        totalRevenue: previousSales.reduce(
          (sum, sale) => sum + sale.salePrice * sale.quantity,
          0
        ),
        totalEmployeeProfit: previousSales.reduce(
          (sum, sale) => sum + (sale.employeeProfit || 0),
          0
        ),
      };

      setPreviousStats({
        totalSales: prevStats.totalSales || 0,
        totalRevenue: prevStats.totalRevenue || 0,
        totalProfit: prevStats.totalEmployeeProfit || 0,
      });
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange.endDate, dateRange.startDate]);

  const loadEstimatedProfit = React.useCallback(async () => {
    try {
      setLoadingEstimated(true);
      const response = await analyticsService.getEmployeeEstimatedProfit();
      setEstimatedProfit(response.estimatedProfit as EmployeeEstimate);
    } catch (error) {
      console.error("Error al cargar ganancia estimada:", error);
    } finally {
      setLoadingEstimated(false);
    }
  }, []);

  const loadRanking = React.useCallback(async () => {
    try {
      const businessId = localStorage.getItem("businessId") || undefined;
      const [configRes, rankingRes] = await Promise.all([
        gamificationService.getConfig().catch(() => null),
        gamificationService
          .getRanking({ period: "current", businessId })
          .catch(() => null),
      ]);
      setGamificationConfig(configRes as GamificationConfig | null);
      setRankingData(rankingRes?.rankings || []);
    } catch (error) {
      console.error("Error al cargar ranking:", error);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadEstimatedProfit();
  }, [loadEstimatedProfit]);

  useEffect(() => {
    void loadRanking();
  }, [loadRanking]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) =>
    `${value.toFixed(1).replace("-0.0", "0.0")}%`;

  const calculateDelta = (current: number, previous: number) => {
    if (!previous) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const setPresetRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setDateRange({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    });
  };

  const totalSales = sales.length;
  const totalRevenue = sales.reduce(
    (sum, sale) => sum + sale.salePrice * sale.quantity,
    0
  );
  const totalUnits = sales.reduce((sum, sale) => sum + sale.quantity, 0);
  const totalProfit = sales.reduce(
    (sum, sale) => sum + (sale.employeeProfit || 0),
    0
  );
  const avgSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
  const avgProfit = totalSales > 0 ? totalProfit / totalSales : 0;
  const adminDue = sales.reduce((sum, sale) => {
    const pct = sale.employeeProfitPercentage ?? 0;
    const fallbackEmployeePrice = sale.salePrice * ((100 - pct) / 100);
    const unitPrice = sale.employeePrice ?? fallbackEmployeePrice;
    return sum + unitPrice * sale.quantity;
  }, 0);
  const netCommission = totalProfit;

  const deltaSales = calculateDelta(totalSales, previousStats.totalSales);
  const deltaRevenue = calculateDelta(totalRevenue, previousStats.totalRevenue);
  const deltaProfit = calculateDelta(totalProfit, previousStats.totalProfit);
  const previousAvgSale = previousStats.totalSales
    ? previousStats.totalRevenue / previousStats.totalSales
    : 0;
  const deltaAvgSale = calculateDelta(avgSaleValue, previousAvgSale);

  const canViewOwnEmployeeEarnings = isEmployeeRole || !hideFinancialData;
  const canViewOwnMonetaryMetrics = isEmployeeRole || !hideFinancialData;
  const canViewAdminFinancials =
    !hideFinancialData && canViewCosts && !isEmployeeRole;

  useEffect(() => {
    if (loading) return;

    const counters = {
      totalSales: 0,
      totalSoldAmount: 0,
      netCommission: 0,
      avgTicket: 0,
    };

    const context = gsap.context(() => {
      gsap.fromTo(
        ".report-glass-card",
        { autoAlpha: 0, y: 24, scale: 0.98 },
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

      gsap.fromTo(
        ".report-panel",
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.12,
          overwrite: "auto",
        }
      );

      gsap.to(counters, {
        totalSales,
        totalSoldAmount: totalRevenue,
        netCommission,
        avgTicket: avgSaleValue,
        duration: 1.15,
        ease: "power3.out",
        onUpdate: () => {
          setAnimatedMetrics({
            totalSales: Math.round(counters.totalSales),
            totalSoldAmount: counters.totalSoldAmount,
            netCommission: counters.netCommission,
            avgTicket: counters.avgTicket,
          });
        },
      });
    }, pageRef);

    return () => {
      context.revert();
    };
  }, [avgSaleValue, loading, netCommission, totalRevenue, totalSales]);

  const productSales = useMemo(() => {
    return sales.reduce((acc, sale) => {
      const product =
        typeof sale.product === "object" && sale.product
          ? (sale.product as any)
          : null;
      if (!product || !product._id) return acc;

      const categoryName =
        typeof product.category === "object" && product.category
          ? product.category.name || "Sin categoría"
          : product.category || "Sin categoría";

      const existing = acc.find(item => item.productId === product._id);
      if (existing) {
        existing.quantity += sale.quantity;
        existing.revenue += sale.salePrice * sale.quantity;
        existing.profit += sale.employeeProfit || 0;
      } else {
        acc.push({
          productId: product._id,
          productName: product.name || "Producto",
          category: categoryName,
          quantity: sale.quantity,
          revenue: sale.salePrice * sale.quantity,
          profit: sale.employeeProfit || 0,
        });
      }

      return acc;
    }, [] as ProductSalesItem[]);
  }, [sales]);

  const topProductsVolumeData = useMemo(() => {
    return [...productSales]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8)
      .map(item => ({
        productId: item.productId,
        name: item.productName,
        category: item.category,
        totalQuantity: item.quantity,
        totalRevenue: item.revenue,
        totalProfit: item.profit,
      }));
  }, [productSales]);

  const topProductsProfitData = useMemo(() => {
    return [...productSales]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8)
      .map(item => ({
        productId: item.productId,
        name: item.productName,
        category: item.category,
        totalQuantity: item.quantity,
        totalRevenue: item.revenue,
        totalProfit: item.profit,
      }));
  }, [productSales]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    sales.forEach(sale => {
      const key = sale.paymentMethodCode || "sin_metodo";
      const current = map.get(key) || { count: 0, revenue: 0 };
      map.set(key, {
        count: current.count + 1,
        revenue: current.revenue + sale.salePrice * sale.quantity,
      });
    });
    return Array.from(map.entries()).map(([key, value]) => ({
      key,
      label:
        key === "cash"
          ? "Efectivo"
          : key === "transfer"
            ? "Transferencia"
            : key === "credit"
              ? "Crédito"
              : "Otro",
      ...value,
    }));
  }, [sales]);

  const deliveryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(sale => {
      const key = sale.deliveryMethodCode || "sin_entrega";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries()).map(([key, count]) => ({
      key,
      label: key === "delivery" ? "Domicilio" : "Retiro",
      count,
    }));
  }, [sales]);

  const topCustomers = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; revenue: number }
    >();

    sales.forEach(sale => {
      const customerName =
        sale.customerName ||
        (typeof sale.customer === "object" ? sale.customer?.name : "") ||
        "Sin cliente";
      const current = map.get(customerName) || {
        name: customerName,
        count: 0,
        revenue: 0,
      };

      map.set(customerName, {
        name: customerName,
        count: current.count + 1,
        revenue: current.revenue + sale.salePrice * sale.quantity,
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [sales]);

  const timelineData = useMemo(() => {
    const end = new Date(`${dateRange.endDate}T00:00:00`);
    const days = chartRange === "7d" ? 7 : chartRange === "30d" ? 30 : 90;
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    const dayMs = 24 * 60 * 60 * 1000;

    const buckets: Array<{
      date: string;
      salesCount: number;
      quantity: number;
      revenue: number;
      netProfit: number;
    }> = [];

    for (let i = 0; i < days; i += 1) {
      const current = new Date(start.getTime() + i * dayMs);
      const key = current.toISOString().slice(0, 10);
      buckets.push({
        date: key,
        salesCount: 0,
        quantity: 0,
        revenue: 0,
        netProfit: 0,
      });
    }

    const bucketMap = new Map(buckets.map(item => [item.date, item]));
    sales.forEach(sale => {
      const key = sale.saleDate?.slice(0, 10);
      if (!key) return;
      const bucket = bucketMap.get(key);
      if (!bucket) return;
      bucket.salesCount += 1;
      bucket.quantity += sale.quantity;
      bucket.revenue += sale.salePrice * sale.quantity;
      bucket.netProfit += sale.employeeProfit || 0;
    });

    return buckets;
  }, [chartRange, dateRange.endDate, sales]);

  const renderShieldedMoney = (
    canView: boolean,
    value: number,
    badgeLabel: string,
    className: string
  ) => {
    if (canView) {
      return <span className={className}>{formatCurrency(value)}</span>;
    }

    return (
      <span className="inline-flex items-center gap-2">
        <span className="rounded-lg border border-slate-300/20 bg-slate-900/70 px-2 py-1 text-sm font-semibold text-slate-300 blur-[2px]">
          COP 000.000
        </span>
        <ConfidentialBadge compact label={badgeLabel} />
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-200/10 bg-[#0A0A0A]/95">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div ref={pageRef} className="space-y-7 px-0 text-slate-100">
      <div className="report-panel rounded-2xl border border-slate-200/10 bg-[#0A0A0A]/95 p-4 shadow-[0_24px_95px_rgba(2,6,23,0.6)] backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 sm:text-4xl">
              Reportes Dark Luxury
            </h1>
            <p className="mt-1 text-sm text-slate-400 sm:text-base">
              Centro de inteligencia de ventas con lectura operativa y blindaje
              premium.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="rounded-xl border border-slate-300/15 bg-slate-950/75 px-3 py-2">
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">
                Inicio
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={e =>
                  setDateRange({ ...dateRange, startDate: e.target.value })
                }
                className="min-h-11 rounded-md border border-slate-700 bg-[#0A0A0A] px-3 py-2 text-sm text-slate-100 sm:text-xs"
              />
            </div>

            <div className="rounded-xl border border-slate-300/15 bg-slate-950/75 px-3 py-2">
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">
                Fin
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={e =>
                  setDateRange({ ...dateRange, endDate: e.target.value })
                }
                className="min-h-11 rounded-md border border-slate-700 bg-[#0A0A0A] px-3 py-2 text-sm text-slate-100 sm:text-xs"
              />
            </div>

            <button
              onClick={() => setPresetRange(7)}
              className="min-h-11 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
            >
              7 días
            </button>
            <button
              onClick={() => setPresetRange(30)}
              className="min-h-11 rounded-xl border border-slate-300/20 bg-slate-900/70 px-3 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/35"
            >
              30 días
            </button>
            <button
              onClick={() => setPresetRange(90)}
              className="min-h-11 rounded-xl border border-slate-300/20 bg-slate-900/70 px-3 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/35"
            >
              90 días
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="report-glass-card w-full rounded-2xl border border-slate-200/10 bg-[linear-gradient(140deg,rgba(8,47,73,0.5),rgba(2,6,23,0.86))] p-4 backdrop-blur-xl sm:p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Total Vendido
          </p>
          <div className="mt-3 text-2xl font-bold text-cyan-200 sm:text-3xl">
            {renderShieldedMoney(
              canViewOwnMonetaryMetrics,
              animatedMetrics.totalSoldAmount,
              "Monto Protegido",
              "text-2xl font-bold text-cyan-200 sm:text-3xl"
            )}
          </div>
          <p
            className={`mt-2 text-xs font-semibold ${
              deltaRevenue >= 0 ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {deltaRevenue >= 0 ? "▲" : "▼"} {formatPercent(deltaRevenue)}
          </p>
        </div>

        <div className="report-glass-card w-full rounded-2xl border border-slate-200/10 bg-[linear-gradient(145deg,rgba(59,7,100,0.52),rgba(2,6,23,0.88))] p-4 backdrop-blur-xl sm:p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Comisión Acumulada
          </p>
          <div className="mt-3 text-2xl font-bold text-violet-200 sm:text-3xl">
            {renderShieldedMoney(
              canViewOwnEmployeeEarnings,
              animatedMetrics.netCommission,
              "Comisión Protegida",
              "text-2xl font-bold text-violet-200 sm:text-3xl"
            )}
          </div>
          <p
            className={`mt-2 text-xs font-semibold ${
              deltaProfit >= 0 ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {deltaProfit >= 0 ? "▲" : "▼"} {formatPercent(deltaProfit)}
          </p>
        </div>

        <div className="report-glass-card w-full rounded-2xl border border-slate-200/10 bg-[linear-gradient(140deg,rgba(30,41,59,0.55),rgba(2,6,23,0.9))] p-4 backdrop-blur-xl sm:col-span-2 sm:p-5 xl:col-span-1">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Ticket Promedio
          </p>
          <div className="mt-3 text-2xl font-bold text-slate-100 sm:text-3xl">
            {renderShieldedMoney(
              canViewOwnMonetaryMetrics,
              animatedMetrics.avgTicket,
              "Ticket Protegido",
              "text-2xl font-bold text-slate-100 sm:text-3xl"
            )}
          </div>
          <p
            className={`mt-2 text-xs font-semibold ${
              deltaAvgSale >= 0 ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {deltaAvgSale >= 0 ? "▲" : "▼"} {formatPercent(deltaAvgSale)}
          </p>
        </div>
      </div>

      <div className="report-panel rounded-2xl border border-slate-200/10 bg-[#0A0A0A]/95 p-4 backdrop-blur-xl sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-100">
            Gráfica de Rendimiento
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "7d", label: "7D" },
              { key: "30d", label: "30D" },
              { key: "90d", label: "90D" },
            ].map(range => (
              <button
                key={range.key}
                onClick={() => setChartRange(range.key as "7d" | "30d" | "90d")}
                className={`min-h-11 rounded-xl px-3 text-xs font-semibold transition ${
                  chartRange === range.key
                    ? "border border-cyan-400/55 bg-cyan-500/15 text-cyan-100"
                    : "border border-slate-300/20 bg-slate-900/70 text-slate-300 hover:border-cyan-400/40"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <SalesTimelineChart
          period="day"
          data={timelineData}
          hideFinancialData={hideFinancialData}
          showOwnEmployeeEarnings={canViewOwnEmployeeEarnings}
          showAdminFinancials={canViewAdminFinancials}
          title="Línea de Ventas y Desempeño"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="report-panel">
          <TopProductsChart
            data={topProductsVolumeData}
            metricMode="quantity"
            hideFinancialData={hideFinancialData}
            showOwnEmployeeEarnings={canViewOwnEmployeeEarnings}
            showAdminFinancials={canViewAdminFinancials}
            title="Top Productos por Volumen"
          />
        </div>
        <div className="report-panel">
          <TopProductsChart
            data={topProductsProfitData}
            metricMode="ownProfit"
            hideFinancialData={hideFinancialData}
            showOwnEmployeeEarnings={canViewOwnEmployeeEarnings}
            showAdminFinancials={canViewAdminFinancials}
            title="Top Productos por Ganancia"
          />
        </div>
      </div>

      <div className="report-panel rounded-2xl border border-slate-200/10 bg-[#0A0A0A]/95 p-4 backdrop-blur-xl sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              Analítica de Ganancia Estimada
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Vista operativa del inventario con caja negra para margen
              administrativo.
            </p>
          </div>
          {estimatedProfit && estimatedProfit.products.length > 0 && (
            <button
              onClick={() => setShowEstimatedProducts(!showEstimatedProducts)}
              className="min-h-11 rounded-xl border border-teal-300/35 bg-teal-500/10 px-3 text-xs font-semibold text-teal-100 transition hover:bg-teal-500/20"
            >
              {showEstimatedProducts ? "Ocultar desglose" : "Ver desglose"}
            </button>
          )}
        </div>

        {loadingEstimated ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-teal-400" />
          </div>
        ) : estimatedProfit ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <div className="rounded-xl border border-slate-300/15 bg-slate-900/65 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Ganancia Neta Est.
                </p>
                <div className="mt-2 text-lg font-bold text-emerald-300">
                  {renderShieldedMoney(
                    canViewOwnEmployeeEarnings,
                    estimatedProfit.netProfit || estimatedProfit.grossProfit,
                    "Ganancia Protegida",
                    "text-lg font-bold text-emerald-300"
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-300/15 bg-slate-900/65 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Productos
                </p>
                <p className="mt-2 text-2xl font-bold text-violet-200">
                  {estimatedProfit.totalProducts}
                </p>
              </div>

              <div className="rounded-xl border border-slate-300/15 bg-slate-900/65 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Unidades
                </p>
                <p className="mt-2 text-2xl font-bold text-cyan-200">
                  {estimatedProfit.totalUnits.toLocaleString("es-CO")}
                </p>
              </div>

              <div className="rounded-xl border border-slate-300/15 bg-slate-900/65 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Rentabilidad
                </p>
                <p className="mt-2 text-2xl font-bold text-amber-200">
                  {(
                    estimatedProfit.profitability ??
                    (estimatedProfit.salesValue > 0
                      ? (estimatedProfit.grossProfit /
                          estimatedProfit.salesValue) *
                        100
                      : 0)
                  ).toFixed(1)}
                  %
                </p>
              </div>

              <div className="rounded-xl border border-slate-300/20 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Caja Negra Admin
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <ConfidentialBadge compact label="Margen Admin" />
                  <span className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 blur-[1.8px]">
                    costo real
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-300/15 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-200">
                  Blindaje de Utilidad Operativa
                </p>
                <div className="flex items-center gap-2">
                  <ConfidentialBadge compact label="Costo Interno" />
                  <span className="rounded-lg border border-slate-300/20 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 blur-[2px]">
                    Margen real administrativo
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Se muestran volúmenes y desempeño comercial; los cálculos que
                exponen costo de adquisición quedan protegidos automáticamente.
              </p>
            </div>

            {showEstimatedProducts && estimatedProfit.products.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-300/15 bg-slate-950/70 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-100">
                  Desglose por producto
                </h3>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {estimatedProfit.products
                    .slice()
                    .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
                    .map(product => (
                      <div
                        key={product.productId}
                        className="flex items-center justify-between rounded-xl border border-slate-300/10 bg-slate-900/55 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          {product.image?.url && (
                            <img
                              src={product.image.url}
                              alt={product.name}
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium text-slate-100">
                              {product.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {product.quantity} uds x{" "}
                              {formatCurrency(product.clientPrice)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-300">
                            {renderShieldedMoney(
                              canViewOwnEmployeeEarnings,
                              product.estimatedProfit,
                              "Ganancia",
                              "text-sm font-bold text-emerald-300"
                            )}
                          </div>
                          {!canViewAdminFinancials && (
                            <div className="mt-1 flex justify-end">
                              <ConfidentialBadge compact label="Costo" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-10 text-center text-slate-400">
            No hay inventario suficiente para calcular ganancia estimada.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="report-panel rounded-2xl border border-slate-200/10 bg-[#0A0A0A]/95 p-4 backdrop-blur-xl sm:p-5">
          <h3 className="mb-3 text-lg font-semibold text-slate-100">
            Métodos de Pago
          </h3>
          {paymentBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {paymentBreakdown.map(item => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border border-slate-300/10 bg-slate-900/50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-500">
                      {item.count} ventas
                    </p>
                  </div>
                  <div className="text-right text-sm font-semibold text-cyan-200">
                    {canViewOwnMonetaryMetrics ? (
                      formatCurrency(item.revenue)
                    ) : (
                      <ConfidentialBadge compact label="Monto" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="report-panel rounded-2xl border border-slate-200/10 bg-[#0A0A0A]/95 p-4 backdrop-blur-xl sm:p-5">
          <h3 className="mb-3 text-lg font-semibold text-slate-100">
            Métodos de Entrega
          </h3>
          {deliveryBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {deliveryBreakdown.map(item => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border border-slate-300/10 bg-slate-900/50 px-3 py-2"
                >
                  <span className="text-sm text-slate-200">{item.label}</span>
                  <span className="text-sm font-semibold text-violet-200">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="report-panel rounded-2xl border border-slate-200/10 bg-[#0A0A0A]/95 p-4 backdrop-blur-xl sm:p-5">
          <h3 className="mb-3 text-lg font-semibold text-slate-100">
            Top Clientes
          </h3>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.map(customer => (
                <div
                  key={customer.name}
                  className="flex items-center justify-between rounded-lg border border-slate-300/10 bg-slate-900/50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-slate-200">{customer.name}</p>
                    <p className="text-xs text-slate-500">
                      {customer.count} compras
                    </p>
                  </div>
                  <div className="text-right text-sm font-semibold text-emerald-200">
                    {canViewOwnMonetaryMetrics ? (
                      formatCurrency(customer.revenue)
                    ) : (
                      <ConfidentialBadge compact label="Monto" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="report-panel rounded-2xl border border-slate-200/10 bg-[#0A0A0A]/95 p-4 backdrop-blur-xl sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-100">
            Ranking de Empleados
          </h2>
          <div className="rounded-lg border border-slate-300/20 bg-slate-900/65 px-3 py-1.5 text-xs text-slate-300">
            Ventas: {animatedMetrics.totalSales.toLocaleString("es-CO")} |
            Unidades: {totalUnits.toLocaleString("es-CO")}
          </div>
        </div>

        <LeaderboardTable rankings={rankingData} config={gamificationConfig} />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-300/10 bg-slate-900/60 px-3 py-2 text-sm">
            <p className="text-slate-400">Ganancia Promedio</p>
            <p className="mt-1 font-semibold text-violet-200">
              {renderShieldedMoney(
                canViewOwnEmployeeEarnings,
                avgProfit,
                "Promedio",
                "text-base font-semibold text-violet-200"
              )}
            </p>
          </div>

          <div className="rounded-lg border border-slate-300/10 bg-slate-900/60 px-3 py-2 text-sm">
            <p className="text-slate-400">Saldo a Entregar</p>
            <p className="mt-1 font-semibold text-cyan-200">
              {renderShieldedMoney(
                canViewAdminFinancials,
                adminDue,
                "Admin",
                "text-base font-semibold text-cyan-200"
              )}
            </p>
          </div>

          <div className="rounded-lg border border-slate-300/10 bg-slate-900/60 px-3 py-2 text-sm">
            <p className="text-slate-400">Variación de Ventas</p>
            <p
              className={`mt-1 font-semibold ${
                deltaSales >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {deltaSales >= 0 ? "▲" : "▼"} {formatPercent(deltaSales)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
