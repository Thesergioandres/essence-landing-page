import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { advancedAnalyticsService } from "../../features/analytics/services";
import InfoTooltip from "../InfoTooltip";

interface TopProductsChartProps {
  limit?: number;
  startDate?: string;
  endDate?: string;
  reloadKey?: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);

export const TopProductsChart: React.FC<TopProductsChartProps> = ({
  limit = 10,
  startDate,
  endDate,
  reloadKey = 0,
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
        const productsData =
          (response as any).topProducts || (response as any).products || [];
        console.log("[TopProductsChart] productsData:", productsData);
        const validatedData = productsData.map((item: any) => ({
          ...item,
          totalQuantity: Number(item.totalQuantity) || 0,
          totalRevenue: Number(item.totalRevenue) || 0,
          salesCount: Number(item.salesCount) || 0,
        }));
        console.log("[TopProductsChart] validatedData:", validatedData);
        console.log(
          "[TopProductsChart] validatedData.length:",
          validatedData.length
        );
        setData(validatedData);
      } catch (error) {
        console.error("Error al cargar productos top:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [limit, startDate, endDate, reloadKey]);

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
        transition={{ duration: 0.5, delay: 0.1 }}
        className="rounded-lg border border-gray-800 bg-gray-900 p-6"
      >
        <h3 className="mb-4 text-xl font-bold text-white">
          Top {limit} Productos Más Vendidos
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
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p className="text-lg font-medium">No hay productos vendidos</p>
          <p className="mt-2 text-sm">
            Los datos aparecerán cuando haya ventas registradas
          </p>
        </div>
      </motion.div>
    );
  }

  console.log(
    "[TopProductsChart] Rendering table with data:",
    JSON.stringify(data, null, 2)
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-lg border border-gray-800 bg-gray-900 p-6"
    >
      <h3 className="mb-4 text-xl font-bold text-white">
        Top {limit} Productos Más Vendidos
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-gray-300">
          <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="py-2 pr-4">
                #
                <InfoTooltip text="Posicion en el ranking." />
              </th>
              <th className="py-2 pr-4">
                Producto
                <InfoTooltip text="Nombre del producto." />
              </th>
              <th className="py-2 pr-4">
                Categoria
                <InfoTooltip text="Categoria del producto." />
              </th>
              <th className="py-2 pr-4 text-right">
                Cantidad
                <InfoTooltip text="Unidades vendidas en el periodo." />
              </th>
              <th className="py-2 pr-4 text-right">
                Ingresos
                <InfoTooltip text="Ingresos brutos generados por el producto." />
              </th>
              <th className="py-2 text-right">
                Utilidad
                <InfoTooltip text="Ganancia estimada generada por el producto." />
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={item.productId || item._id || index}
                className="border-b border-gray-800/60"
              >
                <td className="py-3 pr-4 text-gray-400">{index + 1}</td>
                <td className="py-3 pr-4 font-medium text-white">
                  {item.name || "Sin nombre"}
                </td>
                <td className="py-3 pr-4 text-gray-400">
                  {item.category || "Sin categoria"}
                </td>
                <td className="py-3 pr-4 text-right">
                  {Number(
                    item.totalQuantity || item.quantity || 0
                  ).toLocaleString()}
                </td>
                <td className="py-3 pr-4 text-right text-emerald-300">
                  {formatCurrency(
                    Number(item.totalRevenue || item.revenue || 0)
                  )}
                </td>
                <td className="py-3 text-right text-sky-300">
                  {formatCurrency(Number(item.totalProfit || item.profit || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
