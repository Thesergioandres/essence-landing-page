import { useEffect, useState } from 'react';
import { saleService } from '../api/services';
import type { Sale } from '../types';

export default function DistributorStats() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const now = new Date();
      let startDate = '';

      if (period === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().split('T')[0];
      } else if (period === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().split('T')[0];
      }

      const response = await saleService.getDistributorSales(undefined, {
        ...(startDate && { startDate }),
      });

      setSales(response.sales);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Calcular estadísticas
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.salePrice * sale.quantity, 0);
  const totalProfit = sales.reduce((sum, sale) => sum + sale.distributorProfit, 0);
  const avgSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
  const avgProfit = totalSales > 0 ? totalProfit / totalSales : 0;

  // Productos más vendidos
  const productSales = sales.reduce((acc, sale) => {
    const product = typeof sale.product === 'object' ? sale.product : null;
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
  }, [] as Array<{
    productId: string;
    productName: string;
    productImage?: string;
    quantity: number;
    revenue: number;
    profit: number;
  }>);

  const topProducts = productSales.sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  // Ventas por día
  const salesByDay = sales.reduce((acc, sale) => {
    const date = new Date(sale.saleDate).toLocaleDateString('es-CO');
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
          <p className="mt-2 text-gray-400">
            Análisis de tu desempeño
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('week')}
            className={`rounded-lg px-4 py-2 font-medium transition ${
              period === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`rounded-lg px-4 py-2 font-medium transition ${
              period === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Mes
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`rounded-lg px-4 py-2 font-medium transition ${
              period === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Todo
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-blue-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Total Ventas</p>
          <p className="mt-2 text-3xl font-bold text-white">{totalSales}</p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-green-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Ingresos Totales</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-purple-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Ganancias Totales</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(totalProfit)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-yellow-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Promedio por Venta</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(avgSaleValue)}
          </p>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Métricas Adicionales
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-700">
              <span className="text-gray-400">Ganancia promedio por venta</span>
              <span className="text-lg font-bold text-purple-400">
                {formatCurrency(avgProfit)}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-700">
              <span className="text-gray-400">Productos diferentes vendidos</span>
              <span className="text-lg font-bold text-blue-400">
                {productSales.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Margen de ganancia promedio</span>
              <span className="text-lg font-bold text-green-400">
                {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Actividad Diaria
          </h2>
          {Object.keys(salesByDay).length === 0 ? (
            <p className="text-center text-gray-400 py-8">No hay datos de ventas</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(salesByDay)
                .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                .slice(0, 7)
                .map(([date, count]) => (
                  <div key={date} className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{date}</span>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-32 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-cyan-600"
                          style={{
                            width: `${(count / Math.max(...Object.values(salesByDay))) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-white w-8 text-right">
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
          <p className="text-center text-gray-400 py-8">No hay datos de productos</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {topProducts.map((product, index) => (
              <div
                key={product.productId}
                className="rounded-lg border border-gray-700 bg-gray-900/50 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{product.productName}</h3>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Unidades vendidas:</span>
                        <span className="font-semibold text-blue-400">{product.quantity}</span>
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
