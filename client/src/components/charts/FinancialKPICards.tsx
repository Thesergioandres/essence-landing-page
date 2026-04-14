import { m as motion } from "framer-motion";
import {
  DollarSign,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { advancedAnalyticsService } from "../../features/analytics/services";
import InfoTooltip from "../InfoTooltip";

interface KPI {
  id: string;
  label: string;
  value: string | number;
  tooltip?: string;
  change?: number;
  icon: React.ReactNode;
  color: string;
}

export const FinancialKPICards: React.FC<{
  reloadKey?: number;
  startDate?: string;
  endDate?: string;
}> = ({ reloadKey = 0, startDate, endDate }) => {
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await advancedAnalyticsService.getFinancialKPIs({
          startDate,
          endDate,
        });
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
  }, [reloadKey, startDate, endDate]);

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

  const formatMoney = (val: any) => `$${safeNumber(val).toFixed(0)}`;

  const summary = kpis?.kpis || kpis || {};
  const daily = kpis?.daily || {};
  const weekly = kpis?.weekly || {};
  const monthly = kpis?.monthly || {};
  const range = kpis?.range || {}; // Datos del rango personalizado

  const hasCustomRange = Boolean(startDate || endDate);

  // Cuando hay rango personalizado, mostrar solo datos del rango
  // Si no hay rango, mostrar Hoy, Semana y Mes
  const kpiCards: KPI[] = hasCustomRange
    ? [
        // Con rango personalizado: solo 4 tarjetas (ventas, ingresos, ganancia, ticket)
        {
          id: "rangeSales",
          label: "Ventas (rango)",
          tooltip: "Cantidad de ventas confirmadas en el rango seleccionado.",
          value: safeNumber(range.sales ?? daily.sales ?? summary.todaySales),
          icon: <ShoppingCart className="h-8 w-8" />,
          color: "bg-purple-500",
        },
        {
          id: "rangeRevenue",
          label: "Ingresos (rango)",
          tooltip: "Ingresos brutos generados en el rango seleccionado.",
          value: formatMoney(
            range.revenue ?? daily.revenue ?? summary.todayRevenue
          ),
          icon: <DollarSign className="h-8 w-8" />,
          color: "bg-violet-500",
        },
        {
          id: "rangeReceivable",
          label: "Cuentas por Cobrar (rango)",
          tooltip: "Saldo pendiente por cobrar en el rango seleccionado.",
          value: formatMoney(
            range.accountsReceivable ?? summary.accountsReceivable ?? 0
          ),
          icon: <TrendingDown className="h-8 w-8" />,
          color: "bg-rose-500",
        },
        {
          id: "rangeProfit",
          label: "Ganancia neta (rango)",
          tooltip:
            "Ganancia neta de ventas en el rango (ventas - costo producto - costos adicionales - comision employee - garantias).",
          value: formatMoney(
            range.netProfit ??
              range.grossProfit ??
              range.totalProfit ??
              range.profit ??
              daily.profit ??
              summary.todayProfit
          ),
          icon: <TrendingUp className="h-8 w-8" />,
          color: "bg-emerald-500",
        },
        {
          id: "avgTicket",
          label: "Ticket promedio",
          tooltip: "Ingreso promedio por venta en el rango seleccionado.",
          value: formatMoney(
            range.avgTicket ??
              range.averageTicket ??
              summary.averageTicket ??
              kpis?.avgTicket ??
              0
          ),
          icon: <Target className="h-8 w-8" />,
          color: "bg-orange-500",
        },
        {
          id: "activeEmployees",
          label: "Employees activos",
          tooltip: "Employees con al menos una venta en el periodo.",
          value: safeNumber(summary.totalActiveEmployees),
          icon: <Users className="h-8 w-8" />,
          color: "bg-gray-600",
        },
      ]
    : [
        // Sin rango: mostrar Hoy, Semana y Mes
        {
          id: "todaySales",
          label: "Ventas Hoy",
          tooltip: "Cantidad de ventas confirmadas hoy.",
          value: safeNumber(daily.sales ?? summary.todaySales),
          icon: <ShoppingCart className="h-8 w-8" />,
          color: "bg-purple-500",
        },
        {
          id: "todayRevenue",
          label: "Ingresos Hoy",
          tooltip: "Ingresos brutos generados hoy.",
          value: formatMoney(daily.revenue ?? summary.todayRevenue),
          icon: <DollarSign className="h-8 w-8" />,
          color: "bg-violet-500",
        },
        {
          id: "todayProfit",
          label: "Ganancia neta Hoy",
          tooltip: "Ganancia neta de ventas generada hoy.",
          value: formatMoney(
            summary.todayNetProfit ??
              daily.netProfit ??
              daily.profit ??
              summary.todayProfit
          ),
          icon: <TrendingUp className="h-8 w-8" />,
          color: "bg-emerald-500",
        },
        {
          id: "weekSales",
          label: "Ventas Semana",
          tooltip: "Cantidad de ventas confirmadas en la semana actual.",
          value: safeNumber(weekly.sales ?? summary.weekSales),
          icon: <ShoppingCart className="h-8 w-8" />,
          color: "bg-pink-500",
        },
        {
          id: "weekRevenue",
          label: "Ingresos Semana",
          tooltip: "Ingresos brutos generados en la semana actual.",
          value: formatMoney(weekly.revenue ?? summary.weekRevenue),
          icon: <DollarSign className="h-8 w-8" />,
          color: "bg-teal-500",
        },
        {
          id: "weekProfit",
          label: "Ganancia neta Semana",
          tooltip: "Ganancia neta de ventas generada en la semana actual.",
          value: formatMoney(
            summary.weekNetProfit ??
              weekly.netProfit ??
              weekly.profit ??
              summary.weekProfit
          ),
          icon: <TrendingUp className="h-8 w-8" />,
          color: "bg-green-500",
        },
        {
          id: "monthSales",
          label: "Ventas Mes",
          tooltip: "Cantidad de ventas confirmadas del mes.",
          value: safeNumber(monthly.sales ?? summary.monthSales),
          icon: <ShoppingCart className="h-8 w-8" />,
          color: "bg-blue-500",
        },
        {
          id: "monthRevenue",
          label: "Ingresos Mes",
          tooltip: "Ingresos brutos generados en el mes.",
          value: formatMoney(monthly.revenue ?? summary.monthRevenue),
          icon: <DollarSign className="h-8 w-8" />,
          color: "bg-indigo-600",
        },
        {
          id: "monthProfit",
          label: "Ganancia neta Mes",
          tooltip: "Ganancia neta de ventas generada en el mes.",
          value: formatMoney(
            summary.monthNetProfit ??
              monthly.netProfit ??
              monthly.profit ??
              summary.monthProfit
          ),
          icon: <TrendingUp className="h-8 w-8" />,
          color: "bg-cyan-600",
        },
        {
          id: "monthReceivable",
          label: "Cuentas por Cobrar (mes)",
          tooltip: "Saldo pendiente por cobrar del mes actual.",
          value: formatMoney(
            summary.monthAccountsReceivable ?? summary.accountsReceivable ?? 0
          ),
          icon: <TrendingDown className="h-8 w-8" />,
          color: "bg-rose-500",
        },
        {
          id: "avgTicket",
          label: "Ticket promedio",
          tooltip: "Ingreso promedio por venta en el periodo actual.",
          value: formatMoney(summary.averageTicket ?? kpis?.avgTicket),
          icon: <Target className="h-8 w-8" />,
          color: "bg-orange-500",
        },
        {
          id: "activeEmployees",
          label: "Employees activos",
          tooltip: "Employees con al menos una venta en el periodo.",
          value: safeNumber(summary.totalActiveEmployees),
          icon: <Users className="h-8 w-8" />,
          color: "bg-gray-600",
        },
      ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {kpiCards.map((kpi, index) => (
        <motion.div
          key={kpi.id}
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
              <p className="mb-1 text-sm text-gray-400">
                {kpi.label}
                {kpi.tooltip && <InfoTooltip text={kpi.tooltip} />}
              </p>
              <p className="text-3xl font-bold text-white">{kpi.value}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
