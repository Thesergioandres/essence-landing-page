import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { advancedAnalyticsService } from "../../api/services";

interface SalesTimelineChartProps {
  period: "day" | "week" | "month";
  startDate?: string;
  endDate?: string;
}

export const SalesTimelineChart: React.FC<SalesTimelineChartProps> = ({
  period,
  startDate,
  endDate,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await advancedAnalyticsService.getSalesTimeline({
          period,
          startDate,
          endDate,
        });

        console.log("Sales Timeline Response:", response);

        if (!response.timeline || !Array.isArray(response.timeline)) {
          console.warn("Invalid timeline data received:", response);
          setData([]);
          return;
        }

        const formattedData = response.timeline.map((item: any) => ({
          ...item,
          period: format(parseISO(item.period || item._id), "dd MMM", {
            locale: es,
          }),
          revenue: Number(item.revenue) || 0,
          profit: Number(item.profit) || 0,
          salesCount: Number(item.salesCount) || 0,
        }));

        setData(formattedData);
      } catch (error) {
        console.error("Error al cargar timeline de ventas:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period, startDate, endDate]);

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
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="period"
            stroke="#9ca3af"
            tick={{ fill: "#d1d5db", fontSize: 12 }}
          />
          <YAxis
            yAxisId="left"
            stroke="#9ca3af"
            tick={{ fill: "#d1d5db", fontSize: 12 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#9ca3af"
            tick={{ fill: "#d1d5db", fontSize: 12 }}
          />
          <Tooltip
            formatter={(value: any) => {
              const num = Number(value);
              return isNaN(num) ? "$0.00" : `$${num.toFixed(2)}`;
            }}
            contentStyle={{
              backgroundColor: "rgba(17, 24, 39, 0.95)",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#e5e7eb",
            }}
          />
          <Legend wrapperStyle={{ color: "#d1d5db" }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="revenue"
            stroke="#8b5cf6"
            strokeWidth={2}
            name="Ingresos"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="profit"
            stroke="#10b981"
            strokeWidth={2}
            name="Ganancia"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="salesCount"
            stroke="#f59e0b"
            strokeWidth={2}
            name="Nº Ventas"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
};
