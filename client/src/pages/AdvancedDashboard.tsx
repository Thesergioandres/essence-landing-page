import { endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { motion } from "framer-motion";
import {
  BarChart3,
  Calendar,
  Download,
  FileText,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { advancedAnalyticsService } from "../api/services";
import {
  CategoryDistributionChart,
  ComparativeAnalysisView,
  DistributorRankingsTable,
  FinancialKPICards,
  LowStockAlertsVisual,
  SalesTimelineChart,
  TopProductsChart,
} from "../components/charts";
import {
  exportKPIsToPDF,
  exportRankingsToExcel,
  exportRankingsToPDF,
} from "../utils/exportUtils";

export default function AdvancedDashboard() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [activeTab, setActiveTab] = useState<
    "overview" | "products" | "distributors" | "stock"
  >("overview");

  const handleExportKPIs = async () => {
    try {
      const response = await advancedAnalyticsService.getFinancialKPIs();
      exportKPIsToPDF(response.kpis);
    } catch (error) {
      console.error("Error al exportar KPIs:", error);
    }
  };

  const handleExportRankings = async (format: "pdf" | "excel") => {
    try {
      const response = await advancedAnalyticsService.getDistributorRankings({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
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

  const tabs = [
    { id: "overview", label: "Vista General", icon: BarChart3 },
    { id: "products", label: "Productos", icon: TrendingUp },
    { id: "distributors", label: "Distribuidores", icon: TrendingUp },
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
              onClick={handleExportKPIs}
              className="flex items-center rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar KPIs
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-8 rounded-xl border border-gray-700 bg-gray-800/50 p-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              <Calendar className="mr-2 inline h-4 w-4" />
              Periodo
            </label>
            <select
              value={period}
              onChange={e =>
                setPeriod(e.target.value as "day" | "week" | "month")
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2 text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
            >
              <option value="day">Diario</option>
              <option value="week">Semanal</option>
              <option value="month">Mensual</option>
            </select>
          </div>

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
              className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2 text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
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
              className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2 text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
            />
          </div>
        </div>

        <div className="mt-4 flex space-x-2">
          <button
            onClick={() =>
              setDateRange({
                startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
                endDate: format(new Date(), "yyyy-MM-dd"),
              })
            }
            className="rounded-lg border border-gray-700 px-3 py-1 text-sm text-gray-200 transition-colors hover:bg-gray-800"
          >
            Últimos 7 días
          </button>
          <button
            onClick={() =>
              setDateRange({
                startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
                endDate: format(new Date(), "yyyy-MM-dd"),
              })
            }
            className="rounded-lg border border-gray-700 px-3 py-1 text-sm text-gray-200 transition-colors hover:bg-gray-800"
          >
            Últimos 30 días
          </button>
          <button
            onClick={() =>
              setDateRange({
                startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"),
                endDate: format(endOfMonth(new Date()), "yyyy-MM-dd"),
              })
            }
            className="rounded-lg border border-gray-700 px-3 py-1 text-sm text-gray-200 transition-colors hover:bg-gray-800"
          >
            Este mes
          </button>
        </div>
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
            {/* KPIs */}
            <FinancialKPICards />

            {/* Comparative Analysis */}
            <ComparativeAnalysisView />

            {/* Sales Timeline */}
            <SalesTimelineChart
              period={period}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
            />
          </>
        )}

        {activeTab === "products" && (
          <>
            {/* Top Products */}
            <TopProductsChart
              limit={10}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
            />

            {/* Category Distribution */}
            <CategoryDistributionChart
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
            />
          </>
        )}

        {activeTab === "distributors" && (
          <>
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
            <DistributorRankingsTable
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
            />
          </>
        )}

        {activeTab === "stock" && (
          <>
            {/* Low Stock Alerts */}
            <LowStockAlertsVisual />
          </>
        )}
      </div>
    </div>
  );
}
