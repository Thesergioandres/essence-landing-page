import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { advancedAnalyticsService } from "../../api/services";
import { motion } from "framer-motion";

interface TopProductsChartProps {
  limit?: number;
  startDate?: string;
  endDate?: string;
}

const COLORS = [
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#6366f1",
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#06b6d4",
];

export const TopProductsChart: React.FC<TopProductsChartProps> = ({
  limit = 10,
  startDate,
  endDate,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await advancedAnalyticsService.getTopProducts({
          limit,
          startDate,
          endDate,
        });
        console.log("Top Products Response:", response);
        const validatedData = (response.topProducts || []).map((item: any) => ({
          ...item,
          totalQuantity: Number(item.totalQuantity) || 0,
          totalRevenue: Number(item.totalRevenue) || 0,
          salesCount: Number(item.salesCount) || 0
        }));
        setData(validatedData);
      } catch (error) {
        console.error("Error al cargar productos top:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [limit, startDate, endDate]);

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
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white p-6 rounded-lg shadow-lg"
      >
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Top {limit} Productos Más Vendidos
        </h3>
        <div className="flex flex-col items-center justify-center h-96 text-gray-500">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-lg font-medium">No hay productos vendidos</p>
          <p className="text-sm mt-2">Los datos aparecerán cuando haya ventas registradas</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-white p-6 rounded-lg shadow-lg"
    >
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        Top {limit} Productos Más Vendidos
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value: any, name: string) => {
              const num = Number(value);
              if (isNaN(num)) return ['0', name];
              if (name === "totalRevenue") {
                return [`$${num.toFixed(2)}`, "Ingresos"];
              }
              return [num, "Cantidad"];
            }}
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Bar dataKey="totalQuantity" name="Cantidad Vendida" radius={[0, 8, 8, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
};
