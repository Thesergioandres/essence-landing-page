import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saleService, stockService, gamificationService } from '../api/services';
import type { DistributorStock, Sale } from '../types';

interface DashboardStats {
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  productsCount: number;
  lowStockCount: number;
}

interface RankingInfo {
  position: number | null;
  bonusCommission: number;
  periodStart: string;
  periodEnd: string;
  totalDistributors: number;
}

export default function DistributorDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    productsCount: 0,
    lowStockCount: 0,
  });
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [myStock, setMyStock] = useState<DistributorStock[]>([]);
  const [rankingInfo, setRankingInfo] = useState<RankingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('userId');
      const [salesData, stockData, commissionData] = await Promise.all([
        saleService.getDistributorSales(),
        stockService.getDistributorStock('me'),
        userId ? gamificationService.getAdjustedCommission(userId).catch(() => null) : Promise.resolve(null),
      ]);

      // Calcular estadísticas
      const totalSales = salesData.sales.length;
      const totalRevenue = salesData.sales.reduce((sum, sale) => sum + sale.salePrice * sale.quantity, 0);
      const totalProfit = salesData.sales.reduce((sum, sale) => sum + sale.distributorProfit, 0);
      const lowStockCount = stockData.filter(item => item.quantity <= item.lowStockAlert).length;

      setStats({
        totalSales,
        totalRevenue,
        totalProfit,
        productsCount: stockData.length,
        lowStockCount,
      });

      setRecentSales(salesData.sales.slice(0, 5));
      setMyStock(stockData.slice(0, 6));
      
      if (commissionData) {
        setRankingInfo(commissionData);
      }
    } catch (error) {
      console.error('Error al cargar datos del dashboard:', error);
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white">Dashboard</h1>
        <p className="mt-2 text-gray-400">
          Bienvenido a tu panel de distribuidor
        </p>
      </div>

      {/* Ranking Widget - Solo si hay información */}
      {rankingInfo && rankingInfo.position && (
        <div className="rounded-xl border border-yellow-500/50 bg-gradient-to-br from-yellow-900/30 to-orange-900/30 p-6 backdrop-blur-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">
                  {rankingInfo.position === 1 ? "🥇" : rankingInfo.position === 2 ? "🥈" : rankingInfo.position === 3 ? "🥉" : "🏅"}
                </span>
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    Posición #{rankingInfo.position}
                  </h3>
                  <p className="text-sm text-gray-300">
                    de {rankingInfo.totalDistributors} distribuidores
                  </p>
                </div>
              </div>
              
              {rankingInfo.bonusCommission > 0 && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-500/20 px-4 py-2 border border-green-500/50">
                  <span className="text-xl">💰</span>
                  <div>
                    <p className="text-xs text-green-300">Comisión extra activa</p>
                    <p className="text-lg font-bold text-green-400">
                      +{rankingInfo.bonusCommission}% en cada venta
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">Período actual</p>
              <p className="text-sm text-white font-medium">
                {new Date(rankingInfo.periodStart).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                {' - '}
                {new Date(rankingInfo.periodEnd).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
              </p>
              <button
                onClick={() => navigate('/distributor/stats')}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Ver ranking completo →
              </button>
            </div>
          </div>

          {rankingInfo.position <= 3 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-300 flex items-center gap-2">
                <span>🏆</span>
                {rankingInfo.position === 1 
                  ? "¡Primer lugar! Ganas $50,000 al final del período" 
                  : "¡Top 3! Sigue vendiendo para ganar el primer lugar ($50,000)"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Sales */}
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-blue-900/50 to-gray-800/50 p-6 backdrop-blur-lg transition hover:border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Ventas Realizadas</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {stats.totalSales}
              </p>
            </div>
            <div className="rounded-full bg-blue-600/20 p-3">
              <svg
                className="h-8 w-8 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-green-900/50 to-gray-800/50 p-6 backdrop-blur-lg transition hover:border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Ingresos Totales</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>
            <div className="rounded-full bg-green-600/20 p-3">
              <svg
                className="h-8 w-8 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Profit */}
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-purple-900/50 to-gray-800/50 p-6 backdrop-blur-lg transition hover:border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Mis Ganancias</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {formatCurrency(stats.totalProfit)}
              </p>
            </div>
            <div className="rounded-full bg-purple-600/20 p-3">
              <svg
                className="h-8 w-8 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Products Count */}
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-yellow-900/50 to-gray-800/50 p-6 backdrop-blur-lg transition hover:border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Mis Productos</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {stats.productsCount}
              </p>
              {stats.lowStockCount > 0 && (
                <p className="text-xs text-red-400 mt-1">
                  {stats.lowStockCount} con stock bajo
                </p>
              )}
            </div>
            <div className="rounded-full bg-yellow-600/20 p-3">
              <svg
                className="h-8 w-8 text-yellow-400"
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
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <button
          onClick={() => navigate('/distributor/register-sale')}
          className="rounded-xl border border-gray-700 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 p-6 text-left transition hover:border-blue-500 hover:from-blue-600/30 hover:to-cyan-600/30"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-blue-600/30 p-4">
              <svg
                className="h-8 w-8 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Registrar Venta</h3>
              <p className="mt-1 text-sm text-gray-400">
                Registra una nueva venta de productos
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/distributor/products')}
          className="rounded-xl border border-gray-700 bg-gradient-to-br from-purple-600/20 to-pink-600/20 p-6 text-left transition hover:border-purple-500 hover:from-purple-600/30 hover:to-pink-600/30"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-purple-600/30 p-4">
              <svg
                className="h-8 w-8 text-purple-400"
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
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Ver Productos</h3>
              <p className="mt-1 text-sm text-gray-400">
                Consulta tu inventario asignado
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* My Stock */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 backdrop-blur-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Mi Inventario</h2>
          <button
            onClick={() => navigate('/distributor/products')}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Ver todos →
          </button>
        </div>
        {myStock.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-600 p-8 text-center">
            <p className="text-gray-400">
              No tienes productos asignados aún
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myStock.map((item) => {
              const product = typeof item.product === 'object' ? item.product : null;
              const isLowStock = item.quantity <= item.lowStockAlert;
              
              return (
                <div
                  key={item._id}
                  className={`rounded-lg border p-4 transition ${
                    isLowStock
                      ? 'border-red-500 bg-red-900/20'
                      : 'border-gray-700 bg-gray-900/50 hover:border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">
                        {product?.name || 'Producto'}
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        Precio: {formatCurrency(product?.distributorPrice || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Stock disponible</p>
                      <p className={`text-2xl font-bold ${isLowStock ? 'text-red-400' : 'text-blue-400'}`}>
                        {item.quantity}
                      </p>
                    </div>
                    {isLowStock && (
                      <div className="rounded-full bg-red-600/20 px-3 py-1">
                        <p className="text-xs font-semibold text-red-400">Stock Bajo</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Sales */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 backdrop-blur-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Ventas Recientes</h2>
          <button
            onClick={() => navigate('/distributor/sales')}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Ver todas →
          </button>
        </div>
        {recentSales.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-600 p-8 text-center">
            <p className="text-gray-400">
              No has registrado ventas aún.{' '}
              <button
                onClick={() => navigate('/distributor/register-sale')}
                className="font-semibold text-blue-400 hover:text-blue-300"
              >
                Registra tu primera venta
              </button>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Precio Venta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Ganancia
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {recentSales.map((sale) => {
                  const product = typeof sale.product === 'object' ? sale.product : null;
                  return (
                    <tr key={sale._id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatDate(sale.saleDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-white font-medium">
                        {product?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {sale.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatCurrency(sale.salePrice)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-400">
                        {formatCurrency(sale.distributorProfit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
