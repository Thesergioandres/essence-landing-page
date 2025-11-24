import { useEffect, useState } from 'react';
import { stockService } from '../api/services';
import type { DistributorStock } from '../types';

export default function DistributorProducts() {
  const [stock, setStock] = useState<DistributorStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'normal' | 'low'>('all');

  useEffect(() => {
    loadStock();
  }, []);

  const loadStock = async () => {
    try {
      setLoading(true);
      const response = await stockService.getDistributorStock('me');
      setStock(response);
    } catch (error) {
      console.error('Error al cargar inventario:', error);
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

  const filteredStock = stock.filter((item) => {
    if (filter === 'all') return true;
    const isLowStock = item.quantity <= item.lowStockAlert;
    if (filter === 'low') return isLowStock;
    if (filter === 'normal') return !isLowStock;
    return true;
  });

  const lowStockCount = stock.filter(item => item.quantity <= item.lowStockAlert).length;

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
        <h1 className="text-4xl font-bold text-white">Mis Productos</h1>
        <p className="mt-2 text-gray-400">
          Inventario asignado a tu cuenta
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-blue-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Total Productos</p>
          <p className="mt-2 text-3xl font-bold text-white">{stock.length}</p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-green-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Stock Normal</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {stock.length - lowStockCount}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-red-900/50 to-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Stock Bajo</p>
          <p className="mt-2 text-3xl font-bold text-white">{lowStockCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-6 py-2 font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Todos ({stock.length})
        </button>
        <button
          onClick={() => setFilter('normal')}
          className={`rounded-lg px-6 py-2 font-medium transition ${
            filter === 'normal'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Stock Normal ({stock.length - lowStockCount})
        </button>
        <button
          onClick={() => setFilter('low')}
          className={`rounded-lg px-6 py-2 font-medium transition ${
            filter === 'low'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Stock Bajo ({lowStockCount})
        </button>
      </div>

      {/* Products Grid */}
      {filteredStock.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-600 bg-gray-800/50 p-12 text-center">
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
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p className="mt-4 text-lg text-gray-400">
            {filter === 'all'
              ? 'No tienes productos asignados'
              : `No hay productos con ${filter === 'low' ? 'stock bajo' : 'stock normal'}`}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredStock.map((item) => {
            const product = typeof item.product === 'object' ? item.product : null;
            const isLowStock = item.quantity <= item.lowStockAlert;

            return (
              <div
                key={item._id}
                className={`rounded-xl border p-6 transition ${
                  isLowStock
                    ? 'border-red-500 bg-red-900/20'
                    : 'border-gray-700 bg-gray-800/50 hover:border-blue-500'
                }`}
              >
                {/* Product Image */}
                {product?.image?.url ? (
                  <img
                    src={product.image.url}
                    alt={product.name}
                    className="h-40 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center rounded-lg bg-gray-700">
                    <svg
                      className="h-16 w-16 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}

                {/* Product Info */}
                <div className="mt-4">
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-bold text-white">
                      {product?.name || 'Producto'}
                    </h3>
                    {isLowStock && (
                      <span className="rounded-full bg-red-600/20 px-2 py-1 text-xs font-semibold text-red-400">
                        Stock Bajo
                      </span>
                    )}
                  </div>
                  
                  <p className="mt-2 text-sm text-gray-400 line-clamp-2">
                    {product?.description || 'Sin descripción'}
                  </p>

                  {/* Pricing */}
                  <div className="mt-4 space-y-2 rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Precio tu compra:</span>
                      <span className="font-semibold text-blue-400">
                        {formatCurrency(product?.distributorPrice || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Precio sugerido venta:</span>
                      <span className="font-semibold text-green-400">
                        {formatCurrency(product?.clientPrice || 0)}
                      </span>
                    </div>
                    <div className="border-t border-gray-700 pt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Tu ganancia:</span>
                        <span className="font-bold text-purple-400">
                          {formatCurrency((product?.clientPrice || 0) - (product?.distributorPrice || 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stock Info */}
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Stock disponible</p>
                      <p className={`text-2xl font-bold ${isLowStock ? 'text-red-400' : 'text-blue-400'}`}>
                        {item.quantity} unidades
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Alerta en</p>
                      <p className="text-sm text-gray-400">{item.lowStockAlert}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
