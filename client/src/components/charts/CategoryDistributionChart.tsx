import { m as motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { advancedAnalyticsService } from "../../features/analytics/services";
import InfoTooltip from "../InfoTooltip";

interface CategoryDistributionChartProps {
  startDate?: string;
  endDate?: string;
  reloadKey?: number;
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
> = ({ startDate, endDate, reloadKey = 0 }) => {
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
        console.warn("[Essence Debug]", "Category Distribution Response:", response);
        const categoryData =
          (response as any).categoryDistribution ||
          (response as any).categories ||
          [];
        console.warn("[Essence Debug]", "[CategoryDistributionChart] categoryData:", categoryData);
        const validatedData = categoryData.map((item: any) => ({
          ...item,
          totalSales: Number(item.totalSales) || 0,
          totalRevenue: Number(item.totalRevenue) || 0,
        }));
        console.warn("[Essence Debug]", 
          "[CategoryDistributionChart] validatedData:",
          validatedData
        );
        console.warn("[Essence Debug]", 
          "[CategoryDistributionChart] validatedData.length:",
          validatedData.length
        );
        setData(validatedData);
      } catch (error) {
        console.error("Error al cargar distribuciÃ³n por categorÃ­a:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate, reloadKey]);

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
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-lg border border-gray-800 bg-gray-900 p-6"
      >
        <h3 className="mb-4 text-xl font-bold text-white">
          DistribuciÃ³n por CategorÃ­a
          <InfoTooltip
            text="Ventas y porcentaje de participacion por categoria."
            className="ml-2"
          />
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
              d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
            />
          </svg>
          <p className="text-lg font-medium">No hay ventas por categorÃ­a</p>
          <p className="mt-2 text-sm">
            Los datos aparecer Ã¡n cuando haya ventas registradas
          </p>
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

  console.warn("[Essence Debug]", 
    "[CategoryDistributionChart] Rendering chart with data:",
    JSON.stringify(data, null, 2)
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-lg border border-gray-800 bg-gray-900 p-6"
    >
      <h3 className="mb-4 text-xl font-bold text-white">
        DistribuciÃ³n de Ventas por CategorÃ­a
        <InfoTooltip
          text="Cada porcion representa ventas por categoria."
          className="ml-2"
        />
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
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any, _name: string, props: any) => {
              const val = Number(value) || 0;
              const revenue = Number(props?.payload?.totalRevenue) || 0;
              return [
                `${val} ventas ($${revenue.toFixed(2)})`,
                props?.payload?.name || "CategorÃ­a",
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
              const name = entry?.payload?.name || "CategorÃ­a";
              return `${name}`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

