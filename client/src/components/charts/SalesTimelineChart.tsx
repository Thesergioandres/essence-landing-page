import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { advancedAnalyticsService } from "../../features/analytics/services";
import InfoTooltip from "../InfoTooltip";

interface SalesTimelineChartProps {
  period: "day" | "week" | "month";
  startDate?: string;
  endDate?: string;
  reloadKey?: number;
}

export const SalesTimelineChart: React.FC<SalesTimelineChartProps> = ({
  period,
  startDate,
  endDate,
  reloadKey = 0,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(value || 0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await advancedAnalyticsService.getSalesTimeline({
          startDate,
          endDate,
        } as any);

        console.log("Sales Timeline Response:", response);

        if (!response.timeline || !Array.isArray(response.timeline)) {
          console.warn("Invalid timeline data received:", response);
          setData([]);
          return;
        }

        console.log("[SalesTimelineChart] timeline data:", response.timeline);
        const formattedData = response.timeline
          .filter((item: any) => item.date || item.period || item._id)
          .map((item: any) => {
            const dateStr = item.date || item.period || item._id;
            let formattedPeriod = dateStr;

            try {
              if (dateStr && typeof dateStr === "string") {
                formattedPeriod = format(parseISO(dateStr), "dd MMM", {
                  locale: es,
                });
              }
            } catch (e) {
              console.warn("Error parsing date:", dateStr, e);
              formattedPeriod = dateStr;
            }

            return {
              ...item,
              period: formattedPeriod,
              date: dateStr,
              revenue: Number(item.revenue) || 0,
              profit: Number(item.profit) || 0,
              salesCount: Number(item.ordersCount ?? item.salesCount) || 0,
              quantity: Number(item.quantity) || 0,
              netProfit: Number(item.netProfit ?? item.profit) || 0,
            };
          });

        setData(formattedData);
      } catch (error) {
        console.error("Error al cargar timeline de ventas:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period, startDate, endDate, reloadKey]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-gray-800 bg-gray-900/60">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-lg border border-gray-800 bg-gray-900 p-6"
      >
        <h3 className="mb-4 text-xl font-bold text-white">
          Línea de Tiempo de Ventas
        </h3>
        <div className="flex h-96 flex-col items-center justify-center text-gray-400">
          <svg
            className="mb-4 h-16 w-16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-lg font-medium">
            No hay datos de ventas disponibles
          </p>
          <p className="mt-2 text-sm">
            Intenta ajustar el período o el rango de fechas
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-lg border border-gray-800 bg-gray-900 p-6"
    >
      <h3 className="mb-4 text-xl font-bold text-white">
        Línea de Tiempo de Ventas
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-gray-300">
          <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="py-2 pr-4">
                Fecha
                <InfoTooltip text="Periodo o fecha agrupada de la venta." />
              </th>
              <th className="py-2 pr-4 text-right">
                Ventas
                <InfoTooltip text="Cantidad de ventas confirmadas." />
              </th>
              <th className="py-2 pr-4 text-right">
                Productos
                <InfoTooltip text="Unidades totales vendidas." />
              </th>
              <th className="py-2 text-right">
                Ingresos
                <InfoTooltip text="Ingresos brutos del periodo." />
              </th>
              <th className="py-2 pr-4 text-right">
                Ganancia bruta
                <InfoTooltip text="Ingresos menos costo de venta." />
              </th>
              <th className="py-2 text-right">
                Ganancia neta
                <InfoTooltip text="Ganancia luego de ajustes y gastos." />
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={`${item.date || item.period}-${index}`}
                className="border-b border-gray-800/60"
              >
                <td className="py-3 pr-4 text-white">
                  {item.period || item.date || "Sin fecha"}
                </td>
                <td className="py-3 pr-4 text-right text-amber-300">
                  {Number(item.salesCount || 0).toLocaleString()}
                </td>
                <td className="py-3 pr-4 text-right text-emerald-300">
                  {Number(item.quantity || 0).toLocaleString()}
                </td>
                <td className="py-3 text-right text-sky-300">
                  {formatCurrency(Number(item.revenue || 0))}
                </td>
                <td className="py-3 pr-4 text-right text-emerald-300">
                  {formatCurrency(Number(item.profit || 0))}
                </td>
                <td className="py-3 text-right text-teal-300">
                  {formatCurrency(Number(item.netProfit || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
