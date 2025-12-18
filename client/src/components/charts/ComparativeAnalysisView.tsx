import { motion } from "framer-motion";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { advancedAnalyticsService } from "../../api/services";

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
    if (growth > 0) return <TrendingUp className="h-5 w-5" />;
    if (growth < 0) return <TrendingDown className="h-5 w-5" />;
    return <Minus className="h-5 w-5" />;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return "text-green-500";
    if (growth < 0) return "text-red-500";
    return "text-gray-500";
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-gray-800 bg-gray-900/60">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600"></div>
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
      className="rounded-lg border border-gray-800 bg-gray-900 p-6"
    >
      <h3 className="mb-6 text-xl font-bold text-white">
        Análisis Comparativo (Mes Actual vs Mes Anterior)
      </h3>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="rounded-lg border border-gray-800 p-6 transition-colors hover:bg-white/5"
          >
            <div className="mb-2 text-sm text-gray-400">{metric.label}</div>

            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="mb-1 text-3xl font-bold text-white">
                  {metric.prefix}
                  {(Number(metric.current) || 0).toFixed(
                    metric.prefix === "$" ? 2 : 0
                  )}
                </div>
                <div className="text-xs text-gray-400">Mes Actual</div>
              </div>
              <div
                className={`flex items-center ${getGrowthColor(metric.growth)}`}
              >
                {getGrowthIcon(metric.growth)}
                <span className="ml-1 text-lg font-bold">
                  {metric.growth > 0 ? "+" : ""}
                  {(Number(metric.growth) || 0).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="mt-4 border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Mes Anterior:</span>
                <span className="font-semibold text-gray-200">
                  {metric.prefix}
                  {(Number(metric.previous) || 0).toFixed(
                    metric.prefix === "$" ? 2 : 0
                  )}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
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
                <div className="flex h-2 overflow-hidden rounded bg-gray-800 text-xs">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(
                        (metric.current / (metric.previous || 1)) * 100,
                        100
                      )}%`,
                    }}
                    transition={{ duration: 0.5, delay: index * 0.15 }}
                    className={`flex flex-col justify-center whitespace-nowrap text-center text-white shadow-none ${
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
