import { useEffect, useState } from 'react';
import { saleService } from '../api/services';
import type { Sale } from '../types';

export default function DistributorSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadSales();
  }, [filters]);

  const loadSales = async () => {
    try {
      setLoading(true);
      const filterParams = {
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      };
      
      const response = await saleService.getDistributorSales(undefined, filterParams);
      setSales(response.sales);
      setStats({
        totalSales: response.stats.totalSales,
        totalRevenue: response.stats.totalRevenue,
        totalProfit: response.stats.totalDistributorProfit,
      });
    } catch (error) {
      console.error('Error al cargar ventas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '' });
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
      hour: '2-digit',
      minute: '2-digit',
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white">Mis Ventas</h1>
        <p className="mt-2 text-gray-400">
          Historial completo de tus ventas
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-blue-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Total Ventas</p>
          <p className="mt-2 text-3xl font-bold text-white">{stats.totalSales}</p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-green-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Ingresos Totales</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(stats.totalRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-purple-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Mis Ganancias</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(stats.totalProfit)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Filtros</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Fecha inicio
            </label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Fecha fin
            </label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="rounded-lg bg-gray-700 px-6 py-2 text-white hover:bg-gray-600"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Historial de Ventas ({sales.length})
        </h2>
        
        {sales.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-600 p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-600"
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
            <p className="mt-4 text-lg text-gray-400">
              No se encontraron ventas
            </p>
            {(filters.startDate || filters.endDate) && (
              <p className="mt-2 text-sm text-gray-500">
                Intenta ajustar los filtros de búsqueda
              </p>
            )}
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
                    Precio Unit.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Ganancia
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Notas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {sales.map((sale) => {
                  const product = typeof sale.product === 'object' ? sale.product : null;
                  const total = sale.salePrice * sale.quantity;
                  
                  return (
                    <tr key={sale._id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatDate(sale.saleDate)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-3">
                          {product?.image?.url && (
                            <img
                              src={product.image.url}
                              alt={product.name}
                              className="h-10 w-10 rounded object-cover"
                            />
                          )}
                          <span className="font-medium text-white">
                            {product?.name || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {sale.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatCurrency(sale.salePrice)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-white">
                        {formatCurrency(total)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-400">
                        {formatCurrency(sale.distributorProfit)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {sale.notes || '-'}
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
