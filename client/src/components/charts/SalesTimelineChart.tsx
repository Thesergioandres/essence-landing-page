import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { advancedAnalyticsService } from "../../api/services";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";

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
        
        const formattedData = response.timeline.map((item) => ({
          ...item,
          period: format(parseISO(item.period || item._id), "dd MMM", { locale: es }),
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
      <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-6 rounded-lg shadow-lg"
      >
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Línea de Tiempo de Ventas
        </h3>
        <div className="flex flex-col items-center justify-center h-96 text-gray-500">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium">No hay datos de ventas disponibles</p>
          <p className="text-sm mt-2">Intenta ajustar el período o el rango de fechas</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white p-6 rounded-lg shadow-lg"
    >
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        Línea de Tiempo de Ventas
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip
            formatter={(value: number) => `$${value.toFixed(2)}`}
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Legend />
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
