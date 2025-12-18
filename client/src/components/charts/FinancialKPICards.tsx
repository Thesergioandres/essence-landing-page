import { motion } from "framer-motion";
import {
  DollarSign,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { advancedAnalyticsService } from "../../api/services";

interface KPI {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: string;
}

export const FinancialKPICards: React.FC = () => {
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await advancedAnalyticsService.getFinancialKPIs();
        console.log("Financial KPIs Response:", response);
        setKpis(response);
      } catch (error) {
        console.error("Error al cargar KPIs financieros:", error);
        setKpis(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-lg border border-gray-800 bg-gray-900/60 p-6"
          ></div>
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  const safeNumber = (val: any) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  const kpiCards: KPI[] = [
    {
      label: "Ventas Hoy",
      value: safeNumber(kpis.daily?.sales),
      icon: <ShoppingCart className="h-8 w-8" />,
      color: "bg-purple-500",
    },
    {
      label: "Ingresos del Mes",
      value: `$${safeNumber(kpis.monthly?.revenue).toFixed(2)}`,
      icon: <DollarSign className="h-8 w-8" />,
      color: "bg-green-500",
    },
    {
      label: "Ganancia del Mes",
      value: `$${safeNumber(kpis.monthly?.profit).toFixed(2)}`,
      icon: <TrendingUp className="h-8 w-8" />,
      color: "bg-blue-500",
    },
    {
      label: "Ticket Promedio",
      value: `$${safeNumber(kpis.avgTicket).toFixed(2)}`,
      icon: <Target className="h-8 w-8" />,
      color: "bg-orange-500",
    },
    {
      label: "Ventas Semana",
      value: safeNumber(kpis.weekly?.sales),
      icon: <ShoppingCart className="h-8 w-8" />,
      color: "bg-pink-500",
    },
    {
      label: "Ingresos Semana",
      value: `$${safeNumber(kpis.weekly?.revenue).toFixed(2)}`,
      icon: <DollarSign className="h-8 w-8" />,
      color: "bg-teal-500",
    },
    {
      label: "Ventas del Día",
      value: safeNumber(kpis.daily?.sales),
      icon: <ShoppingCart className="h-8 w-8" />,
      color: "bg-indigo-500",
    },
    {
      label: "Ingresos del Día",
      value: `$${safeNumber(kpis.daily?.revenue).toFixed(2)}`,
      icon: <DollarSign className="h-8 w-8" />,
      color: "bg-violet-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {kpiCards.map((kpi, index) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900"
        >
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className={`${kpi.color} rounded-lg p-3 text-white`}>
                {kpi.icon}
              </div>
              {kpi.change !== undefined && (
                <div
                  className={`flex items-center ${
                    kpi.change >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {kpi.change >= 0 ? (
                    <TrendingUp className="mr-1 h-5 w-5" />
                  ) : (
                    <TrendingDown className="mr-1 h-5 w-5" />
                  )}
                  <span className="font-semibold">{Math.abs(kpi.change)}%</span>
                </div>
              )}
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-400">{kpi.label}</p>
              <p className="text-3xl font-bold text-white">{kpi.value}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
