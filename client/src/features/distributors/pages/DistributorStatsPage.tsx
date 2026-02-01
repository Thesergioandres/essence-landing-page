import React, { useEffect, useState } from "react";
import { analyticsService } from "../../analytics/services";
import { saleService } from "../../sales/services";
import type { Sale } from "../../../types";

interface EstimatedProfitProduct {
  productId: string;
  name: string;
  image?: { url: string; publicId: string };
  quantity: number;
  distributorPrice: number;
  clientPrice: number;
  investment: number;
  salesValue: number;
  estimatedProfit: number;
  profitPercentage: string;
}

interface DistributorEstimate {
  grossProfit: number;
  netProfit: number;
  totalProducts: number;
  totalUnits: number;
  investment: number;
  salesValue: number;
  profitMargin: string;
  profitability?: number; // Ganancia / Ventas × 100
  products: EstimatedProfitProduct[];
}

export default function DistributorStats() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const [estimatedProfit, setEstimatedProfit] =
    useState<DistributorEstimate | null>(null);
  const [loadingEstimated, setLoadingEstimated] = useState(true);
  const [showEstimatedProducts, setShowEstimatedProducts] = useState(false);

  const loadStats = React.useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      let startDate = "";

      if (period === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().split("T")[0];
      } else if (period === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().split("T")[0];
      }

      const response = await saleService.getDistributorSales(undefined, {
        ...(startDate && { startDate }),
        limit: 200,
      });

      setSales(response.sales);
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const loadEstimatedProfit = React.useCallback(async () => {
    try {
      setLoadingEstimated(true);
      const response =
        await analyticsService.getDistributorEstimatedProfit("me");
      setEstimatedProfit(response.estimate);
    } catch (error) {
      console.error("Error al cargar ganancia estimada:", error);
    } finally {
      setLoadingEstimated(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [period, loadStats]);

  useEffect(() => {
    loadEstimatedProfit();
  }, [loadEstimatedProfit]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Calcular estadísticas
  const totalSales = sales.length;
  const totalRevenue = sales.reduce(
    (sum, sale) => sum + sale.salePrice * sale.quantity,
    0
  );
  const totalProfit = sales.reduce(
    (sum, sale) => sum + sale.distributorProfit,
    0
  );
  const avgSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
  const avgProfit = totalSales > 0 ? totalProfit / totalSales : 0;

  // Productos más vendidos
  const productSales = sales.reduce(
    (acc, sale) => {
      const product = typeof sale.product === "object" ? sale.product : null;
      if (!product) return acc;

      const existing = acc.find(item => item.productId === product._id);
      if (existing) {
        existing.quantity += sale.quantity;
        existing.revenue += sale.salePrice * sale.quantity;
        existing.profit += sale.distributorProfit;
      } else {
        acc.push({
          productId: product._id,
          productName: product.name,
          productImage: product.image?.url,
          quantity: sale.quantity,
          revenue: sale.salePrice * sale.quantity,
          profit: sale.distributorProfit,
        });
      }
      return acc;
    },
    [] as Array<{
      productId: string;
      productName: string;
      productImage?: string;
      quantity: number;
      revenue: number;
      profit: number;
    }>
  );

  const topProducts = productSales
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Ventas por día
  const salesByDay = sales.reduce(
    (acc, sale) => {
      const date = new Date(sale.saleDate).toLocaleDateString("es-CO");
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white">Estadísticas</h1>
          <p className="mt-2 text-gray-400">Análisis de tu desempeño</p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod("week")}
            className={`rounded-lg px-4 py-2 font-medium transition ${
              period === "week"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={`rounded-lg px-4 py-2 font-medium transition ${
              period === "month"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Mes
          </button>
          <button
            onClick={() => setPeriod("all")}
            className={`rounded-lg px-4 py-2 font-medium transition ${
              period === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Todo
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-linear-to-br rounded-xl border border-gray-700 from-blue-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Total Ventas</p>
          <p className="mt-2 text-3xl font-bold text-white">{totalSales}</p>
        </div>
        <div className="bg-linear-to-br rounded-xl border border-gray-700 from-green-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Ingresos Totales</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="bg-linear-to-br rounded-xl border border-gray-700 from-purple-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Ganancias Totales</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(totalProfit)}
          </p>
        </div>
        <div className="bg-linear-to-br rounded-xl border border-gray-700 from-yellow-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Promedio por Venta</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(avgSaleValue)}
          </p>
        </div>
      </div>

      {/* Ganancia Estimada con Inventario Actual */}
      <div className="rounded-xl border border-teal-700/50 bg-gradient-to-br from-teal-900/30 to-gray-800/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              📊 Ganancia Estimada
            </h2>
            <p className="text-sm text-gray-400">
              Basado en tu inventario actual
            </p>
          </div>
          {estimatedProfit && estimatedProfit.products.length > 0 && (
            <button
              onClick={() => setShowEstimatedProducts(!showEstimatedProducts)}
              className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-300 transition hover:bg-teal-500/30"
            >
              {showEstimatedProducts ? "Ocultar productos" : "Ver productos"}
            </button>
          )}
        </div>

        {loadingEstimated ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-500"></div>
          </div>
        ) : estimatedProfit ? (
          <>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <p className="text-xs text-gray-400">Ganancia Bruta Est.</p>
                <p className="mt-1 text-xl font-bold text-teal-300">
                  {formatCurrency(estimatedProfit.grossProfit)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <p className="text-xs text-gray-400">Inversión (tu costo)</p>
                <p className="mt-1 text-xl font-bold text-amber-300">
                  {formatCurrency(estimatedProfit.investment)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <p className="text-xs text-gray-400">Valor en Ventas</p>
                <p className="mt-1 text-xl font-bold text-green-300">
                  {formatCurrency(estimatedProfit.salesValue)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <p className="text-xs text-gray-400">Productos</p>
                <p className="mt-1 text-xl font-bold text-purple-300">
                  {estimatedProfit.totalProducts}
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <p className="text-xs text-gray-400">Total Unidades</p>
                <p className="mt-1 text-xl font-bold text-blue-300">
                  {estimatedProfit.totalUnits.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <p className="text-xs text-gray-400">📈 Rentabilidad</p>
                <p className="mt-1 text-xl font-bold text-teal-300">
                  {estimatedProfit.profitability ??
                    (estimatedProfit.salesValue > 0
                      ? (
                          (estimatedProfit.grossProfit /
                            estimatedProfit.salesValue) *
                          100
                        ).toFixed(1)
                      : 0)}
                  %
                </p>
                <p className="mt-0.5 text-[10px] text-gray-500">
                  Ganancia / Ventas
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <p className="text-xs text-gray-400">⚡ Multiplicador</p>
                <p className="mt-1 text-xl font-bold text-amber-300">
                  {estimatedProfit.profitMargin}%
                </p>
                <p className="mt-0.5 text-[10px] text-gray-500">
                  Ganancia / Inversión
                </p>
              </div>
            </div>

            {/* Lista de productos con ganancia estimada */}
            {showEstimatedProducts && estimatedProfit.products.length > 0 && (
              <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                <h3 className="mb-3 text-sm font-semibold text-white">
                  Desglose por Producto
                </h3>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {estimatedProfit.products
                    .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
                    .map(product => (
                      <div
                        key={product.productId}
                        className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          {product.image?.url && (
                            <img
                              src={product.image.url}
                              alt={product.name}
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">
                              {product.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {product.quantity} uds ×{" "}
                              {formatCurrency(product.clientPrice)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-teal-300">
                            {formatCurrency(product.estimatedProfit)}
                          </p>
                          <p className="text-xs text-gray-400">
                            +{product.profitPercentage}%
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-8 text-center text-gray-400">
            No tienes inventario disponible para calcular ganancia estimada
          </div>
        )}
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Métricas Adicionales
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <span className="text-gray-400">Ganancia promedio por venta</span>
              <span className="text-lg font-bold text-purple-400">
                {formatCurrency(avgProfit)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <span className="text-gray-400">
                Productos diferentes vendidos
              </span>
              <span className="text-lg font-bold text-blue-400">
                {productSales.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Margen de ganancia promedio</span>
              <span className="text-lg font-bold text-green-400">
                {totalRevenue > 0
                  ? ((totalProfit / totalRevenue) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Actividad Diaria
          </h2>
          {Object.keys(salesByDay).length === 0 ? (
            <p className="py-8 text-center text-gray-400">
              No hay datos de ventas
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(salesByDay)
                .sort(
                  (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
                )
                .slice(0, 7)
                .map(([date, count]) => (
                  <div key={date} className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{date}</span>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-700">
                        <div
                          className="bg-linear-to-r h-full from-blue-600 to-cyan-600"
                          style={{
                            width: `${(count / Math.max(...Object.values(salesByDay))) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm font-semibold text-white">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Products */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Productos Más Vendidos
        </h2>
        {topProducts.length === 0 ? (
          <p className="py-8 text-center text-gray-400">
            No hay datos de productos
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {topProducts.map((product, index) => (
              <div
                key={product.productId}
                className="rounded-lg border border-gray-700 bg-gray-900/50 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="bg-linear-to-r flex h-10 w-10 items-center justify-center rounded-full from-blue-600 to-cyan-600 font-bold text-white">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">
                      {product.productName}
                    </h3>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">
                          Unidades vendidas:
                        </span>
                        <span className="font-semibold text-blue-400">
                          {product.quantity}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Ingresos:</span>
                        <span className="font-semibold text-green-400">
                          {formatCurrency(product.revenue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Ganancia:</span>
                        <span className="font-semibold text-purple-400">
                          {formatCurrency(product.profit)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
