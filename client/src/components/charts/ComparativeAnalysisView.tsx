import { useState, useEffect } from "react";
import { advancedAnalyticsService } from "../../api/services";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export const ComparativeAnalysisView: React.FC = () => {
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response =
          await advancedAnalyticsService.getComparativeAnalysis();
        setComparison(response.comparison);
      } catch (error) {
        console.error("Error al cargar análisis comparativo:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <TrendingUp className="w-5 h-5" />;
    if (growth < 0) return <TrendingDown className="w-5 h-5" />;
    return <Minus className="w-5 h-5" />;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return "text-green-500";
    if (growth < 0) return "text-red-500";
    return "text-gray-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-900/60 border border-gray-800 rounded-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!comparison) return null;

  const metrics = [
    {
      label: "Ventas",
      current: comparison.currentMonth.sales,
      previous: comparison.previousMonth.sales,
      growth: comparison.growth.salesGrowth,
      prefix: "",
    },
    {
      label: "Ingresos",
      current: comparison.currentMonth.revenue,
      previous: comparison.previousMonth.revenue,
      growth: comparison.growth.revenueGrowth,
      prefix: "$",
    },
    {
      label: "Ganancia",
      current: comparison.currentMonth.profit,
      previous: comparison.previousMonth.profit,
      growth: comparison.growth.profitGrowth,
      prefix: "$",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="bg-gray-900 border border-gray-800 p-6 rounded-lg"
    >
      <h3 className="text-xl font-bold text-white mb-6">
        Análisis Comparativo (Mes Actual vs Mes Anterior)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="border border-gray-800 rounded-lg p-6 hover:bg-white/5 transition-colors"
          >
            <div className="text-sm text-gray-400 mb-2">{metric.label}</div>

            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="text-3xl font-bold text-white mb-1">
                  {metric.prefix}
                  {(Number(metric.current) || 0).toFixed(metric.prefix === "$" ? 2 : 0)}
                </div>
                <div className="text-xs text-gray-400">Mes Actual</div>
              </div>
              <div className={`flex items-center ${getGrowthColor(metric.growth)}`}>
                {getGrowthIcon(metric.growth)}
                <span className="font-bold text-lg ml-1">
                  {metric.growth > 0 ? "+" : ""}
                  {(Number(metric.growth) || 0).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-4 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Mes Anterior:</span>
                <span className="font-semibold text-gray-200">
                  {metric.prefix}
                  {(Number(metric.previous) || 0).toFixed(metric.prefix === "$" ? 2 : 0)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-300">Diferencia:</span>
                <span
                  className={`font-semibold ${
                    metric.current - metric.previous > 0
                      ? "text-green-600"
                      : metric.current - metric.previous < 0
                      ? "text-red-600"
                      : "text-gray-300"
                  }`}
                >
                  {metric.current - metric.previous > 0 ? "+" : ""}
                  {metric.prefix}
                  {(Number(metric.current - metric.previous) || 0).toFixed(
                    metric.prefix === "$" ? 2 : 0
                  )}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(
                        (metric.current / (metric.previous || 1)) * 100,
                        100
                      )}%`,
                    }}
                    transition={{ duration: 0.5, delay: index * 0.15 }}
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                      metric.growth > 0
                        ? "bg-green-500"
                        : metric.growth < 0
                        ? "bg-red-500"
                        : "bg-gray-500"
                    }`}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
