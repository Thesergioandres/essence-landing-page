import { useState, useEffect } from "react";
import { advancedAnalyticsService } from "../../api/services";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Target,
} from "lucide-react";

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-lg shadow animate-pulse h-32"
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
      icon: <ShoppingCart className="w-8 h-8" />,
      color: "bg-purple-500",
    },
    {
      label: "Ingresos del Mes",
      value: `$${safeNumber(kpis.monthly?.revenue).toFixed(2)}`,
      icon: <DollarSign className="w-8 h-8" />,
      color: "bg-green-500",
    },
    {
      label: "Ganancia del Mes",
      value: `$${safeNumber(kpis.monthly?.profit).toFixed(2)}`,
      icon: <TrendingUp className="w-8 h-8" />,
      color: "bg-blue-500",
    },
    {
      label: "Ticket Promedio",
      value: `$${safeNumber(kpis.avgTicket).toFixed(2)}`,
      icon: <Target className="w-8 h-8" />,
      color: "bg-orange-500",
    },
    {
      label: "Ventas Semana",
      value: safeNumber(kpis.weekly?.sales),
      icon: <ShoppingCart className="w-8 h-8" />,
      color: "bg-pink-500",
    },
    {
      label: "Ingresos Semana",
      value: `$${safeNumber(kpis.weekly?.revenue).toFixed(2)}`,
      icon: <DollarSign className="w-8 h-8" />,
      color: "bg-teal-500",
    },
    {
      label: "Ventas del Día",
      value: safeNumber(kpis.daily?.sales),
      icon: <ShoppingCart className="w-8 h-8" />,
      color: "bg-indigo-500",
    },
    {
      label: "Ingresos del Día",
      value: `$${safeNumber(kpis.daily?.revenue).toFixed(2)}`,
      icon: <DollarSign className="w-8 h-8" />,
      color: "bg-violet-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpiCards.map((kpi, index) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`${kpi.color} text-white p-3 rounded-lg`}>
                {kpi.icon}
              </div>
              {kpi.change !== undefined && (
                <div
                  className={`flex items-center ${
                    kpi.change >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {kpi.change >= 0 ? (
                    <TrendingUp className="w-5 h-5 mr-1" />
                  ) : (
                    <TrendingDown className="w-5 h-5 mr-1" />
                  )}
                  <span className="font-semibold">
                    {Math.abs(kpi.change)}%
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">{kpi.label}</p>
              <p className="text-3xl font-bold text-gray-800">{kpi.value}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
