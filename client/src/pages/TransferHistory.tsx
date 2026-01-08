import { useCallback, useEffect, useState } from "react";
import {
  distributorService,
  productService,
  stockService,
} from "../api/services";
import type { Product, User } from "../types";

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
  }, [
    page,
    fromDistributor,
    toDistributor,
    product,
    startDate,
    endDate,
    status,
  ]);

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
    <div className="bg-linear-to-br min-h-screen from-gray-900 via-purple-900/10 to-gray-900 py-4 sm:py-8">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="mb-2 text-2xl font-bold text-white sm:text-4xl">
            📋 Historial de Transferencias
          </h1>
          <p className="text-sm text-gray-400 sm:text-base">
            Registro de movimientos de stock: bodega → distribuidor,
            distribuidor → distribuidor
          </p>
        </div>

        {/* Estadísticas */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:mb-8 sm:gap-6">
          <div className="bg-linear-to-br rounded-xl border border-purple-500/30 from-purple-900/20 to-pink-900/20 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-xs text-gray-400 sm:text-sm">
                  Total Transferencias
                </p>
                <p className="text-2xl font-bold text-white sm:text-3xl">
                  {stats.totalTransfers}
                </p>
              </div>
              <div className="hidden rounded-full bg-purple-600/20 p-3 sm:block sm:p-4">
                <svg
                  className="h-6 w-6 text-purple-400 sm:h-8 sm:w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-linear-to-br rounded-xl border border-blue-500/30 from-blue-900/20 to-cyan-900/20 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-xs text-gray-400 sm:text-sm">
                  Unidades Transferidas
                </p>
                <p className="text-2xl font-bold text-white sm:text-3xl">
                  {stats.totalQuantity}
                </p>
              </div>
              <div className="hidden rounded-full bg-blue-600/20 p-3 sm:block sm:p-4">
                <svg
                  className="h-6 w-6 text-blue-400 sm:h-8 sm:w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6 rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:mb-8 sm:p-6">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-300 sm:mb-2 sm:text-sm">
                Origen
              </label>
              <select
                value={fromDistributor}
                onChange={e => setFromDistributor(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none sm:px-4"
              >
                <option value="">Todos</option>
                {distributors.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-300 sm:mb-2 sm:text-sm">
                Destino
              </label>
              <select
                value={toDistributor}
                onChange={e => setToDistributor(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none sm:px-4"
              >
                <option value="">Todos</option>
                {distributors.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-300 sm:mb-2 sm:text-sm">
                Producto
              </label>
              <select
                value={product}
                onChange={e => setProduct(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none sm:px-4"
              >
                <option value="">Todos</option>
                {products.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-300 sm:mb-2 sm:text-sm">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none sm:px-4"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-300 sm:mb-2 sm:text-sm">
                Fecha Fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none sm:px-4"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-300 sm:mb-2 sm:text-sm">
                Estado
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none sm:px-4"
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
            className="w-full rounded-lg bg-gray-700 px-4 py-2 text-sm text-white transition hover:bg-gray-600 sm:w-auto sm:px-6"
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
                <p className="mb-2 text-xl font-semibold text-white">
                  Cargando transferencias
                </p>
                <div className="flex justify-center gap-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500 [animation-delay:-0.3s]"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-pink-500 [animation-delay:-0.15s]"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500"></div>
                </div>
              </div>
            </div>
          </div>
        ) : transfers.length === 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-12 text-center">
            <p className="text-lg text-gray-400">
              No se encontraron transferencias
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50">
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[960px]">
                  <thead className="sticky top-0 bg-gray-700/70 backdrop-blur">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase text-gray-300">
                        Fecha
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase text-gray-300">
                        Origen
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase text-gray-300">
                        Destino
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase text-gray-300">
                        Producto
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-medium uppercase text-gray-300">
                        Cantidad
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-medium uppercase text-gray-300">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {transfers.map(transfer => (
                      <tr
                        key={transfer._id}
                        className="transition hover:bg-gray-700/30"
                      >
                        <td className="px-6 py-4 text-sm text-gray-300">
                          {formatDate(transfer.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {transfer.fromDistributor.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {transfer.fromStockBefore} →{" "}
                              {transfer.fromStockAfter} unidades
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {transfer.toDistributor.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {transfer.toStockBefore} → {transfer.toStockAfter}{" "}
                              unidades
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-white">
                          {transfer.product.name}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center rounded-full bg-blue-600/20 px-3 py-1 text-sm font-medium text-blue-400">
                            {transfer.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
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

              {/* Vista móvil en tarjetas */}
              <div className="space-y-3 p-3 md:hidden">
                {transfers.map(transfer => (
                  <div
                    key={transfer._id}
                    className="rounded-lg border border-gray-700 bg-gray-900/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                          {formatDate(transfer.createdAt)}
                        </p>
                        <p className="text-sm font-semibold text-white">
                          {transfer.product.name}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${
                          transfer.status === "completed"
                            ? "bg-green-600/20 text-green-300"
                            : transfer.status === "failed"
                              ? "bg-red-600/20 text-red-300"
                              : "bg-yellow-600/20 text-yellow-300"
                        }`}
                      >
                        {transfer.status === "completed"
                          ? "Completada"
                          : transfer.status === "failed"
                            ? "Fallida"
                            : "Cancelada"}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-gray-200">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-gray-400">Origen</span>
                        <div className="text-right">
                          <p className="font-semibold text-white">
                            {transfer.fromDistributor.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {transfer.fromStockBefore} →{" "}
                            {transfer.fromStockAfter} uds
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-gray-400">Destino</span>
                        <div className="text-right">
                          <p className="font-semibold text-white">
                            {transfer.toDistributor.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {transfer.toStockBefore} → {transfer.toStockAfter}{" "}
                            uds
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-400">Cantidad</span>
                        <span className="inline-flex items-center rounded-full bg-blue-600/20 px-3 py-1 text-sm font-semibold text-blue-300">
                          {transfer.quantity}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="rounded-lg bg-gray-800 px-4 py-2 text-white">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
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
