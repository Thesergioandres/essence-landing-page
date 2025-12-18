import { motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { advancedAnalyticsService } from "../../api/services";

export const LowStockAlertsVisual: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await advancedAnalyticsService.getLowStockVisual();
        setProducts(response.lowStockProducts);
      } catch (error) {
        console.error("Error al cargar alertas de stock:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return "bg-red-500";
      case "warning":
        return "bg-yellow-500";
      default:
        return "bg-green-500";
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  const getUrgencyText = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return "Crítico";
      case "warning":
        return "Advertencia";
      default:
        return "Normal";
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-gray-800 bg-gray-900/60">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center"
      >
        <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
        <h3 className="mb-2 text-xl font-bold text-white">
          Stock en Buenos Niveles
        </h3>
        <p className="text-gray-300">
          No hay productos con stock bajo en este momento
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="rounded-lg border border-gray-800 bg-gray-900 p-6"
    >
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Alertas de Stock Bajo</h3>
        <span className="rounded-full bg-red-500/15 px-3 py-1 text-sm font-semibold text-red-300">
          {products.length} producto{products.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-4">
        {products.map((product, index) => (
          <motion.div
            key={product.productId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="rounded-lg border border-gray-800 p-4 transition-colors hover:bg-white/5"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getUrgencyIcon(product.urgency)}
                <div>
                  <h4 className="font-semibold text-white">
                    {product.productName}
                  </h4>
                  <span
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      product.urgency === "critical"
                        ? "bg-red-500/15 text-red-300"
                        : product.urgency === "warning"
                          ? "bg-yellow-500/15 text-yellow-300"
                          : "bg-green-500/15 text-green-300"
                    }`}
                  >
                    {getUrgencyText(product.urgency)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {product.currentStock}
                </div>
                <div className="text-xs text-gray-400">
                  Mínimo: {product.lowStockAlert}
                </div>
              </div>
            </div>

            <div className="relative pt-1">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="inline-block text-xs font-semibold text-gray-300">
                    Nivel de Stock
                  </span>
                </div>
                <div className="text-right">
                  <span className="inline-block text-xs font-semibold text-gray-300">
                    {(Number(product.stockPercentage) || 0).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex h-2 overflow-hidden rounded bg-gray-800 text-xs">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${product.stockPercentage}%` }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`flex flex-col justify-center whitespace-nowrap text-center text-white shadow-none ${getUrgencyColor(
                    product.urgency
                  )}`}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
