import { endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { motion } from "framer-motion";
import {
  BarChart3,
  CreditCard,
  Download,
  FileText,
  RefreshCcw,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  advancedAnalyticsService,
  creditService,
  expenseService,
} from "../api/services";
import {
  CategoryDistributionChart,
  ComparativeAnalysisView,
  DistributorRankingsTable,
  FinancialKPICards,
  LowStockAlertsVisual,
  SalesTimelineChart,
  TopProductsChart,
} from "../components/charts";
import { useFeature } from "../components/FeatureSection";
import type { CreditMetrics, Expense } from "../types";
import { formatCurrency } from "../utils";
import {
  exportKPIsToPDF,
  exportRankingsToExcel,
  exportRankingsToPDF,
} from "../utils/exportUtils";

export default function AdvancedDashboard() {
  // Feature flags
  const distributorsEnabled = useFeature("distributors");
  const creditsEnabled = useFeature("credits");

  const [overviewRange, setOverviewRange] = useState({
    startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [timelineRange, setTimelineRange] = useState({
    startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [timelinePeriod, setTimelinePeriod] = useState<
    "day" | "week" | "month"
  >("day");
  const [productsRange, setProductsRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [distributorsRange, setDistributorsRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [topProductsLimit, setTopProductsLimit] = useState(10);
  const [rankingLimit, setRankingLimit] = useState(10);
  const [rankingSearch, setRankingSearch] = useState("");
  const [activeTab, setActiveTab] = useState<
    "overview" | "products" | "distributors" | "stock" | "credits" | "expenses"
  >("overview");

  const [salesFunnel, setSalesFunnel] = useState<{
    pending: { count: number; totalValue: number };
    confirmed: { count: number; totalValue: number };
    conversionRate: number;
  } | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);

  // Créditos y Gastos
  const [creditMetrics, setCreditMetrics] = useState<CreditMetrics | null>(
    null
  );
  const [creditLoading, setCreditLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseMetrics, setExpenseMetrics] = useState({
    total: 0,
    thisMonth: 0,
    lastMonth: 0,
    byCategory: [] as { type: string; amount: number }[],
  });

  const [rotationDays, setRotationDays] = useState(30);
  const [rotationLoading, setRotationLoading] = useState(false);
  const [productRotation, setProductRotation] = useState<
    {
      _id: string;
      name: string;
      totalSold: number;
      frequency: number;
      currentStock: number;
      rotationRate: number;
    }[]
  >([]);

  const validateRange = (range: { startDate: string; endDate: string }) => {
    if (!range.startDate || !range.endDate) return null;
    return range.startDate > range.endDate
      ? "La fecha inicio no puede ser mayor que la fecha fin."
      : null;
  };

  const isSameRange = (
    range: { startDate: string; endDate: string },
    days: number
  ) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const start = format(subDays(new Date(), days), "yyyy-MM-dd");
    return range.startDate === start && range.endDate === today;
  };

  const isCurrentMonthRange = (range: {
    startDate: string;
    endDate: string;
  }) => {
    const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const end = format(endOfMonth(new Date()), "yyyy-MM-dd");
    return range.startDate === start && range.endDate === end;
  };

  const rangeBtn = (active: boolean) =>
    `${active ? "border-purple-500 bg-purple-500/10 text-white" : "border-gray-700 text-gray-100"} rounded-md border px-3 py-2 text-sm transition hover:border-purple-500`;

  const applyQuickRange = (
    setter: (r: { startDate: string; endDate: string }) => void,
    days: number
  ) => {
    setter({
      startDate: format(subDays(new Date(), days), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    });
  };

  const applyCurrentMonth = (
    setter: (r: { startDate: string; endDate: string }) => void
  ) => {
    setter({
      startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      endDate: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    });
  };

  const clearRange = (
    setter: (r: { startDate: string; endDate: string }) => void
  ) => setter({ startDate: "", endDate: "" });

  const handleReload = () => {
    setReloadKey(key => key + 1);
  };

  const [deferHeavy, setDeferHeavy] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDeferHeavy(true), 350);
    return () => clearTimeout(t);
  }, []);

  const overviewRangeError = validateRange(overviewRange);
  const timelineRangeError = validateRange(timelineRange);
  const productsRangeError = validateRange(productsRange);
  const distributorsRangeError = validateRange(distributorsRange);

  useEffect(() => {
    const fetchFunnel = async () => {
      try {
        setFunnelLoading(true);
        const response = await advancedAnalyticsService.getSalesFunnel({
          startDate: overviewRange.startDate || undefined,
          endDate: overviewRange.endDate || undefined,
        });
        setSalesFunnel(response.funnel);
      } catch (error) {
        console.error("Error al cargar funnel:", error);
        setSalesFunnel(null);
      } finally {
        setFunnelLoading(false);
      }
    };

    if (!validateRange(overviewRange)) {
      fetchFunnel();
    }
  }, [overviewRange.endDate, overviewRange.startDate, reloadKey]);

  useEffect(() => {
    const fetchRotation = async () => {
      try {
        setRotationLoading(true);
        const response = await advancedAnalyticsService.getProductRotation({
          days: rotationDays,
        });
        setProductRotation((response.productRotation || []) as any);
      } catch (error) {
        console.error("Error al cargar rotación de productos:", error);
        setProductRotation([]);
      } finally {
        setRotationLoading(false);
      }
    };

    if (activeTab === "products") {
      fetchRotation();
    }
  }, [activeTab, rotationDays, reloadKey]);

  // Cargar métricas de créditos
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        setCreditLoading(true);
        const response = await creditService.getMetrics();
        setCreditMetrics(response.metrics);
      } catch (error) {
        console.error("Error al cargar métricas de créditos:", error);
        setCreditMetrics(null);
      } finally {
        setCreditLoading(false);
      }
    };

    if (
      creditsEnabled &&
      (activeTab === "credits" || activeTab === "overview")
    ) {
      fetchCredits();
    }
  }, [activeTab, reloadKey, creditsEnabled]);

  // Cargar gastos
  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        setExpenseLoading(true);
        const response = await expenseService.getAll();
        const expenseList = response.expenses || [];
        setExpenses(expenseList);

        // Calcular métricas
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear =
          currentMonth === 0 ? currentYear - 1 : currentYear;

        const thisMonthTotal = expenseList
          .filter((e: Expense) => {
            const d = new Date(e.expenseDate);
            return (
              d.getMonth() === currentMonth && d.getFullYear() === currentYear
            );
          })
          .reduce(
            (sum: number, e: Expense) => sum + (Number(e.amount) || 0),
            0
          );

        const lastMonthTotal = expenseList
          .filter((e: Expense) => {
            const d = new Date(e.expenseDate);
            return (
              d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear
            );
          })
          .reduce(
            (sum: number, e: Expense) => sum + (Number(e.amount) || 0),
            0
          );

        const total = expenseList.reduce(
          (sum: number, e: Expense) => sum + (Number(e.amount) || 0),
          0
        );

        // Agrupar por categoría
        const byType = expenseList.reduce<Record<string, number>>(
          (acc, e: Expense) => {
            const type = e.type || e.category || e.description || "Otros";
            acc[type] = (acc[type] || 0) + (Number(e.amount) || 0);
            return acc;
          },
          {}
        );

        const byCategory = Object.entries(byType)
          .map(([type, amount]) => ({ type, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        setExpenseMetrics({
          total,
          thisMonth: thisMonthTotal,
          lastMonth: lastMonthTotal,
          byCategory,
        });
      } catch (error) {
        console.error("Error al cargar gastos:", error);
        setExpenses([]);
      } finally {
        setExpenseLoading(false);
      }
    };

    if (activeTab === "expenses" || activeTab === "overview") {
      fetchExpenses();
    }
  }, [activeTab, reloadKey]);

  const handleExportKPIs = async () => {
    try {
      const response = await advancedAnalyticsService.getFinancialKPIs({
        startDate: overviewRange.startDate || undefined,
        endDate: overviewRange.endDate || undefined,
      });
      exportKPIsToPDF(response.kpis || response);
    } catch (error) {
      console.error("Error al exportar KPIs:", error);
    }
  };

  const handleExportRankings = async (format: "pdf" | "excel") => {
    try {
      const response = await advancedAnalyticsService.getDistributorRankings({
        startDate: distributorsRange.startDate || undefined,
        endDate: distributorsRange.endDate || undefined,
      });

      if (format === "pdf") {
        exportRankingsToPDF(response.rankings);
      } else {
        exportRankingsToExcel(response.rankings);
      }
    } catch (error) {
      console.error("Error al exportar rankings:", error);
    }
  };

  // Filtrar tabs basándose en features habilitados
  const tabs = [
    { id: "overview", label: "Vista General", icon: BarChart3 },
    { id: "products", label: "Productos", icon: TrendingUp },
    ...(distributorsEnabled
      ? [{ id: "distributors", label: "Distribuidores", icon: TrendingUp }]
      : []),
    ...(creditsEnabled
      ? [{ id: "credits", label: "Créditos", icon: CreditCard }]
      : []),
    { id: "expenses", label: "Gastos", icon: Wallet },
    { id: "stock", label: "Inventario", icon: FileText },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 flex items-center text-4xl font-bold text-white">
              <BarChart3 className="mr-3 h-10 w-10 text-purple-600" />
              Analíticas Avanzadas
            </h1>
            <p className="text-gray-300">
              Dashboard completo de métricas y análisis de rendimiento
            </p>
          </div>

          <div className="mt-4 flex items-center space-x-4 md:mt-0">
            <button
              onClick={handleReload}
              className="flex items-center rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-gray-100 transition-colors hover:border-purple-500 hover:text-white"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Recargar
            </button>
            <button
              onClick={handleExportKPIs}
              className="flex items-center rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar KPIs
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filters info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-8 rounded-xl border border-gray-700 bg-gray-800/40 p-4 text-sm text-gray-300"
      >
        Cada bloque tiene sus propios filtros rápidos (fechas, período, top N).
        Ajusta en el mismo bloque según lo que quieras analizar.
      </motion.div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${
                    activeTab === tab.id
                      ? "border-purple-500 text-purple-600"
                      : "border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200"
                  } flex items-center whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors`}
                >
                  <Icon className="mr-2 h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-8">
        {activeTab === "overview" && (
          <>
            {/* Filtros Overview */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-gray-800 bg-gray-900/70 p-4"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">
                      Fecha inicio (KPIs / Embudo)
                    </label>
                    <input
                      type="date"
                      value={overviewRange.startDate}
                      onChange={e =>
                        setOverviewRange({
                          ...overviewRange,
                          startDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">
                      Fecha fin
                    </label>
                    <input
                      type="date"
                      value={overviewRange.endDate}
                      onChange={e =>
                        setOverviewRange({
                          ...overviewRange,
                          endDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500/40 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => applyQuickRange(setOverviewRange, 7)}
                    className={rangeBtn(isSameRange(overviewRange, 7))}
                  >
                    Últimos 7 días
                  </button>
                  <button
                    onClick={() => applyQuickRange(setOverviewRange, 30)}
                    className={rangeBtn(isSameRange(overviewRange, 30))}
                  >
                    Últimos 30 días
                  </button>
                  <button
                    onClick={() => applyQuickRange(setOverviewRange, 90)}
                    className={rangeBtn(isSameRange(overviewRange, 90))}
                  >
                    Últimos 90 días
                  </button>
                  <button
                    onClick={() => applyCurrentMonth(setOverviewRange)}
                    className={rangeBtn(isCurrentMonthRange(overviewRange))}
                  >
                    Mes actual
                  </button>
                  <button
                    onClick={() => clearRange(setOverviewRange)}
                    className={rangeBtn(
                      !overviewRange.startDate && !overviewRange.endDate
                    )}
                  >
                    Todo
                  </button>
                </div>
              </div>
              {overviewRangeError && (
                <p className="mt-3 text-sm text-red-300">
                  {overviewRangeError}
                </p>
              )}
            </motion.div>

            {/* KPIs */}
            <FinancialKPICards
              reloadKey={reloadKey}
              startDate={overviewRange.startDate || undefined}
              endDate={overviewRange.endDate || undefined}
            />

            {/* Comparative Analysis */}
            <ComparativeAnalysisView reloadKey={reloadKey} />

            {/* Sales Funnel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-lg border border-gray-800 bg-gray-900 p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  Embudo de pagos
                </h3>
                <span className="text-sm text-gray-400">
                  {overviewRange.startDate && overviewRange.endDate
                    ? `${overviewRange.startDate} → ${overviewRange.endDate}`
                    : "Global"}
                </span>
              </div>

              {funnelLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-purple-600"></div>
                </div>
              ) : !salesFunnel ? (
                <div className="text-gray-400">
                  No hay datos del embudo disponibles.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-gray-800 bg-gray-950/20 p-4">
                    <p className="text-sm text-gray-400">Pendientes</p>
                    <p className="text-2xl font-bold text-yellow-300">
                      {salesFunnel.pending.count}
                    </p>
                    <p className="text-sm text-gray-400">
                      {formatCurrency(salesFunnel.pending.totalValue)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/20 p-4">
                    <p className="text-sm text-gray-400">Confirmadas</p>
                    <p className="text-2xl font-bold text-green-300">
                      {salesFunnel.confirmed.count}
                    </p>
                    <p className="text-sm text-gray-400">
                      {formatCurrency(salesFunnel.confirmed.totalValue)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/20 p-4">
                    <p className="text-sm text-gray-400">Conversión</p>
                    <p className="text-2xl font-bold text-purple-300">
                      {salesFunnel.conversionRate.toFixed(2)}%
                    </p>
                    <p className="text-sm text-gray-400">Confirmadas / Total</p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Sales Timeline */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    Línea de tiempo de ventas
                  </h3>
                  <p className="text-sm text-gray-400">
                    Ajusta periodo y rango solo para esta vista.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={timelinePeriod}
                    onChange={e =>
                      setTimelinePeriod(
                        e.target.value as "day" | "week" | "month"
                      )
                    }
                    className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
                  >
                    <option value="day">Diario</option>
                    <option value="week">Semanal</option>
                    <option value="month">Mensual</option>
                  </select>
                  <input
                    type="date"
                    value={timelineRange.startDate}
                    onChange={e =>
                      setTimelineRange({
                        ...timelineRange,
                        startDate: e.target.value,
                      })
                    }
                    className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
                  />
                  <input
                    type="date"
                    value={timelineRange.endDate}
                    onChange={e =>
                      setTimelineRange({
                        ...timelineRange,
                        endDate: e.target.value,
                      })
                    }
                    className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
                  />
                  <button
                    onClick={() => applyQuickRange(setTimelineRange, 7)}
                    className={rangeBtn(isSameRange(timelineRange, 7))}
                  >
                    7d
                  </button>
                  <button
                    onClick={() => applyQuickRange(setTimelineRange, 14)}
                    className={rangeBtn(isSameRange(timelineRange, 14))}
                  >
                    14d
                  </button>
                  <button
                    onClick={() => applyQuickRange(setTimelineRange, 30)}
                    className={rangeBtn(isSameRange(timelineRange, 30))}
                  >
                    30d
                  </button>
                  <button
                    onClick={() => applyQuickRange(setTimelineRange, 90)}
                    className={rangeBtn(isSameRange(timelineRange, 90))}
                  >
                    90d
                  </button>
                </div>
              </div>
              {timelineRangeError && (
                <p className="mb-2 text-sm text-red-300">
                  {timelineRangeError}
                </p>
              )}
              <SalesTimelineChart
                period={timelinePeriod}
                startDate={timelineRange.startDate || undefined}
                endDate={timelineRange.endDate || undefined}
                reloadKey={reloadKey}
              />
            </div>
          </>
        )}

        {activeTab === "products" && (
          <>
            <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">
                      Fecha inicio (Productos)
                    </label>
                    <input
                      type="date"
                      value={productsRange.startDate}
                      onChange={e =>
                        setProductsRange({
                          ...productsRange,
                          startDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">
                      Fecha fin
                    </label>
                    <input
                      type="date"
                      value={productsRange.endDate}
                      onChange={e =>
                        setProductsRange({
                          ...productsRange,
                          endDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => applyQuickRange(setProductsRange, 7)}
                    className={rangeBtn(isSameRange(productsRange, 7))}
                  >
                    7d
                  </button>
                  <button
                    onClick={() => applyQuickRange(setProductsRange, 30)}
                    className={rangeBtn(isSameRange(productsRange, 30))}
                  >
                    30d
                  </button>
                  <button
                    onClick={() => applyQuickRange(setProductsRange, 90)}
                    className={rangeBtn(isSameRange(productsRange, 90))}
                  >
                    90d
                  </button>
                  <button
                    onClick={() => applyCurrentMonth(setProductsRange)}
                    className={rangeBtn(isCurrentMonthRange(productsRange))}
                  >
                    Mes actual
                  </button>
                  <button
                    onClick={() => clearRange(setProductsRange)}
                    className={rangeBtn(
                      !productsRange.startDate && !productsRange.endDate
                    )}
                  >
                    Todo
                  </button>
                  <select
                    value={topProductsLimit}
                    onChange={e => setTopProductsLimit(Number(e.target.value))}
                    className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
                  >
                    {[5, 10, 15, 20].map(n => (
                      <option key={n} value={n}>
                        Top {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {productsRangeError && (
                <p className="mt-2 text-sm text-red-300">
                  {productsRangeError}
                </p>
              )}
            </div>

            {/* Top Products */}
            <TopProductsChart
              limit={topProductsLimit}
              startDate={productsRange.startDate || undefined}
              endDate={productsRange.endDate || undefined}
              reloadKey={reloadKey}
            />

            {/* Category Distribution */}
            <CategoryDistributionChart
              startDate={productsRange.startDate || undefined}
              endDate={productsRange.endDate || undefined}
              reloadKey={reloadKey}
            />

            {/* Product Rotation */}
            {deferHeavy && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="rounded-lg border border-gray-800 bg-gray-900 p-6"
              >
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-xl font-bold text-white">
                    Rotación de productos
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRotationDays(7)}
                      className={`rounded-lg border border-gray-700 px-3 py-1 text-sm text-gray-200 transition-colors hover:bg-gray-800 ${
                        rotationDays === 7 ? "bg-gray-800" : ""
                      }`}
                    >
                      7 días
                    </button>
                    <button
                      onClick={() => setRotationDays(30)}
                      className={`rounded-lg border border-gray-700 px-3 py-1 text-sm text-gray-200 transition-colors hover:bg-gray-800 ${
                        rotationDays === 30 ? "bg-gray-800" : ""
                      }`}
                    >
                      30 días
                    </button>
                    <button
                      onClick={() => setRotationDays(90)}
                      className={`rounded-lg border border-gray-700 px-3 py-1 text-sm text-gray-200 transition-colors hover:bg-gray-800 ${
                        rotationDays === 90 ? "bg-gray-800" : ""
                      }`}
                    >
                      90 días
                    </button>
                  </div>
                </div>

                {rotationLoading ? (
                  <div className="flex h-40 items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-purple-600"></div>
                  </div>
                ) : productRotation.length === 0 ? (
                  <div className="text-gray-400">
                    No hay datos de rotación disponibles.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-900/50 text-gray-300">
                        <tr>
                          <th className="px-4 py-3 text-left">Producto</th>
                          <th className="px-4 py-3 text-right">Unidades</th>
                          <th className="px-4 py-3 text-right">Frecuencia</th>
                          <th className="px-4 py-3 text-right">Stock</th>
                          <th className="px-4 py-3 text-right">Rotación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 text-gray-200">
                        {productRotation.slice(0, 20).map(p => (
                          <tr key={p._id} className="hover:bg-gray-900/30">
                            <td className="px-4 py-3">
                              <span className="font-medium text-gray-100">
                                {p.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {Number(p.totalSold) || 0}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {Number(p.frequency) || 0}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {Number(p.currentStock) || 0}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-purple-300">
                              {((Number(p.rotationRate) || 0) * 100).toFixed(1)}
                              %
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}

        {activeTab === "distributors" && distributorsEnabled && (
          <>
            <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-gray-300">
                    Fecha inicio (Distribuidores)
                  </label>
                  <input
                    type="date"
                    value={distributorsRange.startDate}
                    onChange={e =>
                      setDistributorsRange({
                        ...distributorsRange,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-300">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    value={distributorsRange.endDate}
                    onChange={e =>
                      setDistributorsRange({
                        ...distributorsRange,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-300">
                    Buscar distribuidor
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      value={rankingSearch}
                      onChange={e => setRankingSearch(e.target.value)}
                      placeholder="Nombre o correo"
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-10 py-2 text-sm text-gray-100 focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => applyQuickRange(setDistributorsRange, 30)}
                  className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-100 transition hover:border-purple-500"
                >
                  30d
                </button>
                <button
                  onClick={() => applyQuickRange(setDistributorsRange, 90)}
                  className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-100 transition hover:border-purple-500"
                >
                  90d
                </button>
                <button
                  onClick={() => applyCurrentMonth(setDistributorsRange)}
                  className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-100 transition hover:border-purple-500"
                >
                  Mes actual
                </button>
                <select
                  value={rankingLimit}
                  onChange={e => setRankingLimit(Number(e.target.value))}
                  className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
                >
                  {[5, 10, 15, 25].map(n => (
                    <option key={n} value={n}>
                      Top {n}
                    </option>
                  ))}
                </select>
              </div>
              {distributorsRangeError && (
                <p className="mt-2 text-sm text-red-300">
                  {distributorsRangeError}
                </p>
              )}
            </div>

            {/* Export Buttons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-end space-x-4"
            >
              <button
                onClick={() => handleExportRankings("pdf")}
                className="flex items-center rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
              >
                <Download className="mr-2 h-4 w-4" />
                PDF
              </button>
              <button
                onClick={() => handleExportRankings("excel")}
                className="flex items-center rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
              >
                <Download className="mr-2 h-4 w-4" />
                Excel
              </button>
            </motion.div>

            {/* Rankings */}
            {deferHeavy && (
              <DistributorRankingsTable
                startDate={distributorsRange.startDate || undefined}
                endDate={distributorsRange.endDate || undefined}
                limit={rankingLimit}
                search={rankingSearch}
                reloadKey={reloadKey}
              />
            )}
          </>
        )}

        {/* Tab: Créditos */}
        {activeTab === "credits" && creditsEnabled && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-linear-to-br rounded-xl border border-amber-700/30 from-amber-900/20 to-gray-900/70 p-6"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-amber-300">
                    💳 Cartera de Créditos
                  </h3>
                  <p className="text-sm text-gray-400">
                    Análisis completo de tu cartera de fiados
                  </p>
                </div>
              </div>

              {creditLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-500" />
                </div>
              ) : !creditMetrics ? (
                <div className="py-10 text-center text-gray-400">
                  No hay datos de créditos disponibles.
                </div>
              ) : (
                <>
                  {/* KPIs de Créditos */}
                  <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <p className="text-xs uppercase text-gray-400">
                        Total Créditos
                      </p>
                      <p className="mt-1 text-2xl font-bold text-white">
                        {creditMetrics.total.totalCredits}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <p className="text-xs uppercase text-gray-400">
                        Deuda Pendiente
                      </p>
                      <p className="mt-1 text-2xl font-bold text-red-400">
                        {formatCurrency(
                          creditMetrics.total.totalRemainingAmount
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <p className="text-xs uppercase text-gray-400">
                        Total Recuperado
                      </p>
                      <p className="mt-1 text-2xl font-bold text-green-400">
                        {formatCurrency(creditMetrics.total.totalPaidAmount)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <p className="text-xs uppercase text-gray-400">
                        Tasa Recuperación
                      </p>
                      <p
                        className={`mt-1 text-2xl font-bold ${Number(creditMetrics.recoveryRate) >= 50 ? "text-green-400" : "text-amber-400"}`}
                      >
                        {creditMetrics.recoveryRate}%
                      </p>
                    </div>
                  </div>

                  {/* Métricas de Mora */}
                  <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="rounded-lg border border-red-700/30 bg-red-900/10 p-4">
                      <p className="text-sm font-medium text-red-300">
                        ⚠️ Créditos Vencidos
                      </p>
                      <p className="mt-2 text-3xl font-bold text-red-400">
                        {creditMetrics.overdue.count}
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        Monto: {formatCurrency(creditMetrics.overdue.amount)}
                      </p>
                    </div>
                    <div className="col-span-2 rounded-lg border border-gray-700 bg-gray-900/40 p-4">
                      <p className="text-sm font-medium text-gray-300">
                        Indicador de Salud
                      </p>
                      <div className="mt-3 flex items-center gap-4">
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-700">
                          <div
                            className="bg-linear-to-r h-full from-green-500 via-yellow-500 to-red-500"
                            style={{
                              width: `${Math.min(100, Number(creditMetrics.recoveryRate))}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-200">
                          {Number(creditMetrics.recoveryRate) >= 70
                            ? "✅ Excelente"
                            : Number(creditMetrics.recoveryRate) >= 50
                              ? "⚠️ Aceptable"
                              : "❌ Crítico"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top Deudores */}
                  {creditMetrics.topDebtors &&
                    creditMetrics.topDebtors.length > 0 && (
                      <div className="rounded-lg border border-amber-800/30 bg-gray-900/40 p-4">
                        <h4 className="mb-3 text-lg font-semibold text-amber-300">
                          🎯 Top Deudores
                        </h4>
                        <div className="overflow-hidden rounded-lg border border-amber-800/20">
                          <table className="w-full divide-y divide-amber-800/20">
                            <thead className="bg-amber-900/20">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-amber-300/70">
                                  Cliente
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-amber-300/70">
                                  Deuda Total
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-amber-300/70">
                                  Créditos
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-800/10">
                              {creditMetrics.topDebtors.map((debtor, idx) => (
                                <tr
                                  key={debtor.customerId || idx}
                                  className="hover:bg-amber-900/10"
                                >
                                  <td className="px-4 py-3 text-sm text-gray-100">
                                    {debtor.customerName}
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm font-semibold text-red-400">
                                    {formatCurrency(debtor.totalDebt)}
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm text-gray-300">
                                    {debtor.creditsCount}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                </>
              )}
            </motion.div>
          </>
        )}

        {/* Tab: Gastos */}
        {activeTab === "expenses" && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-linear-to-br rounded-xl border border-rose-700/30 from-rose-900/20 to-gray-900/70 p-6"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-rose-300">
                    💸 Análisis de Gastos
                  </h3>
                  <p className="text-sm text-gray-400">
                    Control y distribución de gastos operativos
                  </p>
                </div>
              </div>

              {expenseLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-rose-500" />
                </div>
              ) : expenses.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  No hay gastos registrados.
                </div>
              ) : (
                <>
                  {/* KPIs de Gastos */}
                  <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <p className="text-xs uppercase text-gray-400">
                        Este Mes
                      </p>
                      <p className="mt-1 text-2xl font-bold text-rose-400">
                        {formatCurrency(expenseMetrics.thisMonth)}
                      </p>
                      {expenseMetrics.lastMonth > 0 && (
                        <p
                          className={`mt-1 text-xs ${expenseMetrics.thisMonth <= expenseMetrics.lastMonth ? "text-green-400" : "text-red-400"}`}
                        >
                          {expenseMetrics.thisMonth <= expenseMetrics.lastMonth
                            ? "↓"
                            : "↑"}
                          {Math.abs(
                            ((expenseMetrics.thisMonth -
                              expenseMetrics.lastMonth) /
                              expenseMetrics.lastMonth) *
                              100
                          ).toFixed(1)}
                          % vs anterior
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <p className="text-xs uppercase text-gray-400">
                        Mes Anterior
                      </p>
                      <p className="mt-1 text-2xl font-bold text-amber-400">
                        {formatCurrency(expenseMetrics.lastMonth)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <p className="text-xs uppercase text-gray-400">
                        Total Histórico
                      </p>
                      <p className="mt-1 text-2xl font-bold text-purple-400">
                        {formatCurrency(expenseMetrics.total)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <p className="text-xs uppercase text-gray-400">
                        Promedio/Gasto
                      </p>
                      <p className="mt-1 text-2xl font-bold text-cyan-400">
                        {formatCurrency(
                          expenses.length > 0
                            ? expenseMetrics.total / expenses.length
                            : 0
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Distribución por Categoría */}
                  {expenseMetrics.byCategory.length > 0 && (
                    <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
                      <h4 className="mb-4 text-lg font-semibold text-rose-300">
                        📊 Distribución por Categoría
                      </h4>
                      <div className="space-y-3">
                        {expenseMetrics.byCategory.map((cat, idx) => {
                          const percentage =
                            (cat.amount / expenseMetrics.total) * 100;
                          return (
                            <div key={cat.type}>
                              <div className="mb-1 flex items-center justify-between text-sm">
                                <span className="text-gray-200">
                                  {cat.type}
                                </span>
                                <span className="font-medium text-rose-300">
                                  {formatCurrency(cat.amount)} (
                                  {percentage.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700">
                                <div
                                  className={`h-full transition-all ${
                                    idx === 0
                                      ? "bg-rose-500"
                                      : idx === 1
                                        ? "bg-amber-500"
                                        : idx === 2
                                          ? "bg-purple-500"
                                          : idx === 3
                                            ? "bg-cyan-500"
                                            : "bg-gray-500"
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </>
        )}

        {activeTab === "stock" && (
          <>
            {/* Low Stock Alerts */}
            <LowStockAlertsVisual reloadKey={reloadKey} />
          </>
        )}
      </div>
    </div>
  );
}
