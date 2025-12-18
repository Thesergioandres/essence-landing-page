import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { advancedAnalyticsService } from "../../api/services";
import { motion } from "framer-motion";

interface CategoryDistributionChartProps {
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
];

export const CategoryDistributionChart: React.FC<
  CategoryDistributionChartProps
> = ({ startDate, endDate }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await advancedAnalyticsService.getSalesByCategory({
          startDate,
          endDate,
        });
        console.log("Category Distribution Response:", response);
        const validatedData = (response.categoryDistribution || []).map((item: any) => ({
          ...item,
          totalSales: Number(item.totalSales) || 0,
          totalRevenue: Number(item.totalRevenue) || 0
        }));
        setData(validatedData);
      } catch (error) {
        console.error("Error al cargar distribución por categoría:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-900/60 border border-gray-800 rounded-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-gray-900 border border-gray-800 p-6 rounded-lg"
      >
        <h3 className="text-xl font-bold text-white mb-4">
          Distribución por Categoría
        </h3>
        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          <p className="text-lg font-medium">No hay ventas por categoría</p>
          <p className="text-sm mt-2">Los datos aparecer án cuando haya ventas registradas</p>
        </div>
      </motion.div>
    );
  }

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    const percentage = Number(percent) || 0;

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        className="font-bold"
      >
        {`${(percentage * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-gray-900 border border-gray-800 p-6 rounded-lg"
    >
      <h3 className="text-xl font-bold text-white mb-4">
        Distribución de Ventas por Categoría
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={120}
            fill="#8884d8"
            dataKey="totalSales"
            nameKey="name"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any, _name: string, props: any) => {
              const val = Number(value) || 0;
              const revenue = Number(props?.payload?.totalRevenue) || 0;
              return [
                `${val} ventas ($${revenue.toFixed(2)})`,
                props?.payload?.name || 'Categoría',
              ];
            }}
            contentStyle={{
              backgroundColor: "rgba(17, 24, 39, 0.95)",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#e5e7eb",
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ color: "#d1d5db" }}
            formatter={(_value, entry: any) => {
              const name = entry?.payload?.name || 'Categoría';
              return `${name}`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
};
