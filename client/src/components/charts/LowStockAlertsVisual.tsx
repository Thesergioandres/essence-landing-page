import { useState, useEffect } from "react";
import { advancedAnalyticsService } from "../../api/services";
import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

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
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-green-500" />;
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
      <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-lg shadow-lg text-center"
      >
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          Stock en Buenos Niveles
        </h3>
        <p className="text-gray-600">
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
      className="bg-white p-6 rounded-lg shadow-lg"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">
          Alertas de Stock Bajo
        </h3>
        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
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
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                {getUrgencyIcon(product.urgency)}
                <div>
                  <h4 className="font-semibold text-gray-800">
                    {product.productName}
                  </h4>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${
                      product.urgency === "critical"
                        ? "bg-red-100 text-red-800"
                        : product.urgency === "warning"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {getUrgencyText(product.urgency)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">
                  {product.currentStock}
                </div>
                <div className="text-xs text-gray-500">
                  Mínimo: {product.lowStockAlert}
                </div>
              </div>
            </div>

            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block text-gray-600">
                    Nivel de Stock
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-gray-600">
                    {(Number(product.stockPercentage) || 0).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${product.stockPercentage}%` }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${getUrgencyColor(
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
