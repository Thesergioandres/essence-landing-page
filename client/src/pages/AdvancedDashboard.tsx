import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  FileText,
} from "lucide-react";
import {
  SalesTimelineChart,
  TopProductsChart,
  CategoryDistributionChart,
  FinancialKPICards,
  DistributorRankingsTable,
  LowStockAlertsVisual,
  ComparativeAnalysisView,
} from "../components/charts";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import {
  exportKPIsToPDF,
  exportRankingsToPDF,
  exportRankingsToExcel,
} from "../utils/exportUtils";
import { advancedAnalyticsService } from "../api/services";

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
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center">
              <BarChart3 className="w-10 h-10 mr-3 text-purple-600" />
              Analíticas Avanzadas
            </h1>
            <p className="text-gray-600">
              Dashboard completo de métricas y análisis de rendimiento
            </p>
          </div>

          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <button
              onClick={handleExportKPIs}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
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
        className="bg-white p-6 rounded-lg shadow-lg mb-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Periodo
            </label>
            <select
              value={period}
              onChange={(e) =>
                setPeriod(e.target.value as "day" | "week" | "month")
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="day">Diario</option>
              <option value="week">Semanal</option>
              <option value="month">Mensual</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, startDate: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Fin
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, endDate: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex space-x-2 mt-4">
          <button
            onClick={() =>
              setDateRange({
                startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
                endDate: format(new Date(), "yyyy-MM-dd"),
              })
            }
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
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
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
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
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Este mes
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${
                    activeTab === tab.id
                      ? "border-purple-500 text-purple-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors`}
                >
                  <Icon className="w-5 h-5 mr-2" />
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
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </button>
              <button
                onClick={() => handleExportRankings("excel")}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
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
