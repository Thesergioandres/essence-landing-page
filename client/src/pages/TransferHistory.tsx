import { useEffect, useState, useCallback } from "react";
import { stockService, distributorService, productService } from "../api/services";
import type { User, Product } from "../types";

interface StockTransfer {
  _id: string;
  fromDistributor: User;
  toDistributor: User;
  product: Product;
  quantity: number;
  fromStockBefore: number;
  fromStockAfter: number;
  toStockBefore: number;
  toStockAfter: number;
  status: "completed" | "failed" | "cancelled";
  createdAt: string;
}

export default function TransferHistory() {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [distributors, setDistributors] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [fromDistributor, setFromDistributor] = useState("");
  const [toDistributor, setToDistributor] = useState("");
  const [product, setProduct] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");

  // Paginación
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ totalTransfers: 0, totalQuantity: 0 });

  const loadFiltersData = useCallback(async () => {
    try {
      const [distData, prodData] = await Promise.all([
        distributorService.getAll({}),
        productService.getAll(),
      ]);
      setDistributors(Array.isArray(distData) ? distData : distData.data || []);
      setProducts(Array.isArray(prodData) ? prodData : prodData.data || []);
    } catch (error) {
      console.error("Error cargando datos de filtros:", error);
    }
  }, []);

  useEffect(() => {
    loadFiltersData();
  }, [loadFiltersData]);

  const loadTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 20 };
      if (fromDistributor) params.fromDistributor = fromDistributor;
      if (toDistributor) params.toDistributor = toDistributor;
      if (product) params.product = product;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (status) params.status = status;

      const response = await stockService.getTransferHistory(params);
      setTransfers(response.transfers);
      setTotalPages(response.pagination.pages);
      setStats(response.stats);
    } catch (error) {
      console.error("Error cargando historial:", error);
    } finally {
      setLoading(false);
    }
  }, [page, fromDistributor, toDistributor, product, startDate, endDate, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTransfers();
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timer);
  }, [loadTransfers]);

  const clearFilters = useCallback(() => {
    setFromDistributor("");
    setToDistributor("");
    setProduct("");
    setStartDate("");
    setEndDate("");
    setStatus("");
    setPage(1);
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            📋 Historial de Transferencias
          </h1>
          <p className="text-gray-400">
            Registro completo de todas las transferencias entre distribuidores
          </p>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-pink-900/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Transferencias</p>
                <p className="text-3xl font-bold text-white">{stats.totalTransfers}</p>
              </div>
              <div className="rounded-full bg-purple-600/20 p-4">
                <svg className="h-8 w-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-900/20 to-cyan-900/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Unidades Transferidas</p>
                <p className="text-3xl font-bold text-white">{stats.totalQuantity}</p>
              </div>
              <div className="rounded-full bg-blue-600/20 p-4">
                <svg className="h-8 w-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Origen
              </label>
              <select
                value={fromDistributor}
                onChange={(e) => setFromDistributor(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">Todos</option>
                {distributors.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Destino
              </label>
              <select
                value={toDistributor}
                onChange={(e) => setToDistributor(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">Todos</option>
                {distributors.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Producto
              </label>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">Todos</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Fecha Fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">Todos</option>
                <option value="completed">Completada</option>
                <option value="failed">Fallida</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          </div>

          <button
            onClick={clearFilters}
            className="w-full md:w-auto px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            Limpiar Filtros
          </button>
        </div>

        {/* Tabla de Transferencias */}
        {loading ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-12">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 animate-spin rounded-full border-b-4 border-t-4 border-purple-500"></div>
                <div className="absolute inset-0 h-16 w-16 animate-ping rounded-full border-4 border-purple-500/30"></div>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-white mb-2">Cargando transferencias</p>
                <div className="flex gap-1 justify-center">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500 [animation-delay:-0.3s]"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-pink-500 [animation-delay:-0.15s]"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500"></div>
                </div>
              </div>
            </div>
          </div>
        ) : transfers.length === 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-12 text-center">
            <p className="text-gray-400 text-lg">No se encontraron transferencias</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">
                        Fecha
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">
                        Origen
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">
                        Destino
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">
                        Producto
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase">
                        Cantidad
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {transfers.map((transfer) => (
                      <tr key={transfer._id} className="hover:bg-gray-700/30 transition">
                        <td className="px-6 py-4 text-sm text-gray-300">
                          {formatDate(transfer.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {transfer.fromDistributor.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {transfer.fromStockBefore} → {transfer.fromStockAfter} unidades
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {transfer.toDistributor.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {transfer.toStockBefore} → {transfer.toStockAfter} unidades
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-white">
                          {transfer.product.name}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-600/20 text-blue-400">
                            {transfer.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              transfer.status === "completed"
                                ? "bg-green-600/20 text-green-400"
                                : transfer.status === "failed"
                                ? "bg-red-600/20 text-red-400"
                                : "bg-yellow-600/20 text-yellow-400"
                            }`}
                          >
                            {transfer.status === "completed"
                              ? "Completada"
                              : transfer.status === "failed"
                              ? "Fallida"
                              : "Cancelada"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="px-4 py-2 bg-gray-800 text-white rounded-lg">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
