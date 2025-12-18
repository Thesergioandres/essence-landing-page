import { useEffect, useState } from "react";
import { authService, saleService } from "../api/services";
import LoadingSpinner from "../components/LoadingSpinner";
import SaleDetailModal from "../components/SaleDetailModal";
import type { Sale } from "../types";
import {
  buildCacheKey,
  readSessionCache,
  writeSessionCache,
} from "../utils/requestCache";

const SALES_CACHE_TTL_MS = 60 * 1000;

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasMore: false,
  });
  const [statsData, setStatsData] = useState<{
    totalSales?: number;
    totalRevenue?: number;
    confirmedSales?: number;
    pendingSales?: number;
    totalProfit?: number;
  }>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pendiente" | "confirmado">(
    "all"
  );
  const [sortBy, setSortBy] = useState<
    "date-desc" | "date-asc" | "distributor"
  >("date-desc");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [dateFilters, setDateFilters] = useState({
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filter, sortBy, dateFilters]);

  const loadSales = async () => {
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: sortBy,
      };
      if (filter !== "all") params.paymentStatus = filter;
      if (dateFilters.startDate) params.startDate = dateFilters.startDate;
      if (dateFilters.endDate) params.endDate = dateFilters.endDate;

      const cacheKey = buildCacheKey("sales:list", params);
      const cached = readSessionCache<{
        sales: Sale[];
        pagination?: typeof pagination;
        stats?: typeof statsData;
      }>(cacheKey, SALES_CACHE_TTL_MS);

      if (cached?.sales?.length) {
        setSales(cached.sales);
        if (cached.pagination) setPagination(cached.pagination);
        if (cached.stats) setStatsData(cached.stats);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const response = await saleService.getAllSales(params);
      const normalized = {
        sales: (response?.sales || response) as Sale[],
        pagination: response?.pagination,
        stats: response?.stats,
      };

      setSales(normalized.sales || []);
      if (normalized.pagination) setPagination(normalized.pagination);
      if (normalized.stats) setStatsData(normalized.stats);
      writeSessionCache(cacheKey, normalized);
    } catch (error) {
      console.error("Error al cargar ventas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (
      !confirm(
        "¿Seguro que deseas eliminar esta venta? Esto restaurará el stock del producto."
      )
    )
      return;

    try {
      setDeletingId(saleId);
      await saleService.deleteSale(saleId);

      // Actualizar la lista sin recargar toda la página
      setSales(prevSales => prevSales.filter(sale => sale._id !== saleId));
    } catch (error) {
      console.error("Error al eliminar la venta:", error);
      alert("Error al eliminar la venta");
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfirmPayment = async (saleId: string) => {
    if (!confirm("¿Confirmar que has recibido el pago de esta venta?")) {
      return;
    }

    try {
      setConfirmingId(saleId);
      await saleService.confirmPayment(saleId);

      // Actualizar solo la venta específica sin recargar toda la página
      setSales(prevSales =>
        prevSales.map(sale =>
          sale._id === saleId
            ? {
                ...sale,
                paymentStatus: "confirmado",
                paymentConfirmedAt: new Date().toISOString(),
              }
            : sale
        )
      );
    } catch (error) {
      console.error("Error al confirmar pago:", error);
      alert("Error al confirmar el pago");
    } finally {
      setConfirmingId(null);
    }
  };

  // Ya no necesitamos filtrado/ordenamiento local, el servidor lo hace

  const stats = {
    total: statsData.totalSales || sales.length,
    pendiente:
      statsData.pendingSales ||
      sales.filter(s => s.paymentStatus === "pendiente").length,
    confirmado:
      statsData.confirmedSales ||
      sales.filter(s => s.paymentStatus === "confirmado").length,
    totalRevenue:
      statsData.totalRevenue ||
      sales.reduce((sum, s) => sum + s.salePrice * s.quantity, 0),
    totalProfit:
      statsData.totalProfit || sales.reduce((sum, s) => sum + s.adminProfit, 0),
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Gestión de Ventas</h1>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Total Ventas</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Pendientes</p>
          <p className="text-2xl font-bold text-white">{stats.pendiente}</p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Confirmadas</p>
          <p className="text-2xl font-bold text-white">{stats.confirmado}</p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Ingresos Totales</p>
          <p className="text-2xl font-bold text-white">
            ${stats.totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <p className="text-sm text-gray-400">Ganancia Admin</p>
          <p className="text-2xl font-bold text-white">
            ${stats.totalProfit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner
            size="lg"
            variant="dots"
            message="Cargando ventas..."
          />
        </div>
      )}

      {/* Filtros y Ordenamiento */}
      {!loading && (
        <>
          <div className="space-y-4 rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            {/* Filtros de fecha */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300">
                Filtrar por fecha:
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="min-w-[180px] flex-1">
                  <label
                    htmlFor="startDate"
                    className="mb-1 block text-xs text-gray-400"
                  >
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={dateFilters.startDate}
                    onChange={e =>
                      setDateFilters({
                        ...dateFilters,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div className="min-w-[180px] flex-1">
                  <label
                    htmlFor="endDate"
                    className="mb-1 block text-xs text-gray-400"
                  >
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={dateFilters.endDate}
                    onChange={e =>
                      setDateFilters({
                        ...dateFilters,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                {(dateFilters.startDate || dateFilters.endDate) && (
                  <div className="flex items-end">
                    <button
                      onClick={() =>
                        setDateFilters({ startDate: "", endDate: "" })
                      }
                      className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-gray-800"
                    >
                      Limpiar fechas
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-300">
                Filtrar por estado:
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter("all")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                    filter === "all"
                      ? "bg-purple-600 text-white"
                      : "border border-gray-700 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  Todas ({stats.total})
                </button>
                <button
                  onClick={() => setFilter("pendiente")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                    filter === "pendiente"
                      ? "bg-yellow-500 text-white"
                      : "border border-gray-700 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  Pendientes ({stats.pendiente})
                </button>
                <button
                  onClick={() => setFilter("confirmado")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                    filter === "confirmado"
                      ? "bg-green-500 text-white"
                      : "border border-gray-700 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  Confirmadas ({stats.confirmado})
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="sortBy"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Ordenar por:
              </label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2 text-sm text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
              >
                <option value="date-desc">Fecha (Más reciente primero)</option>
                <option value="date-asc">Fecha (Más antigua primero)</option>
                <option value="distributor">Distribuidor (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Tabla de ventas */}
          <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50">
            <div className="table-responsive overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Distribuidor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Rango
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Comisión
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Cantidad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Total Venta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Ganancia Admin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {sales.map(sale => {
                    const product =
                      typeof sale.product === "object" ? sale.product : null;
                    const distributor =
                      typeof sale.distributor === "object"
                        ? sale.distributor
                        : null;

                    // Determinar rango según comisión
                    let rankBadge = {
                      emoji: "👑",
                      text: "Admin",
                      color: "bg-purple-500/20 text-purple-300",
                    };
                    if (distributor) {
                      const percentage = sale.distributorProfitPercentage || 20;
                      if (percentage === 25) {
                        rankBadge = {
                          emoji: "🥇",
                          text: "1º",
                          color: "bg-yellow-500/20 text-yellow-300",
                        };
                      } else if (percentage === 23) {
                        rankBadge = {
                          emoji: "🥈",
                          text: "2º",
                          color: "bg-gray-500/20 text-gray-200",
                        };
                      } else if (percentage === 21) {
                        rankBadge = {
                          emoji: "🥉",
                          text: "3º",
                          color: "bg-orange-500/20 text-orange-300",
                        };
                      } else {
                        rankBadge = {
                          emoji: "📊",
                          text: "Normal",
                          color: "bg-blue-500/20 text-blue-300",
                        };
                      }
                    }

                    return (
                      <tr
                        key={sale._id}
                        className="cursor-pointer hover:bg-gray-900/30"
                        onClick={e => {
                          // No abrir modal si se hace clic en botones
                          if ((e.target as HTMLElement).closest("button"))
                            return;
                          setSelectedSale(sale);
                        }}
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-200">
                          {new Date(sale.saleDate).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm font-medium text-gray-200">
                            {distributor?.name || "Admin"}
                          </div>
                          <div className="text-sm text-gray-400">
                            {distributor?.email || ""}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${rankBadge.color}`}
                          >
                            {rankBadge.emoji} {rankBadge.text}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-200">
                          {distributor
                            ? `${sale.distributorProfitPercentage ?? 20}%`
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center">
                            {product?.image?.url && (
                              <img
                                src={product.image.url}
                                alt={product.name}
                                className="mr-3 h-10 w-10 rounded object-cover"
                              />
                            )}
                            <span className="text-sm text-gray-200">
                              {product?.name || "N/A"}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-200">
                          {sale.quantity}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-200">
                          ${(sale.salePrice * sale.quantity).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-green-400">
                          ${sale.adminProfit.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {sale.paymentStatus === "pendiente" ? (
                            <span className="inline-flex rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold leading-5 text-yellow-300">
                              Pendiente
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold leading-5 text-green-300">
                              Confirmado
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <div className="flex gap-2">
                            {sale.paymentStatus === "pendiente" ? (
                              <button
                                onClick={() => handleConfirmPayment(sale._id)}
                                disabled={confirmingId === sale._id}
                                className="font-medium text-green-400 hover:text-green-300 disabled:opacity-50"
                              >
                                {confirmingId === sale._id
                                  ? "Confirmando..."
                                  : "Confirmar Pago"}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">
                                Confirmado el{" "}
                                {sale.paymentConfirmedAt &&
                                  new Date(
                                    sale.paymentConfirmedAt
                                  ).toLocaleDateString()}
                              </span>
                            )}
                            {/* Botón eliminar solo para admin */}
                            {authService.getCurrentUser()?.role === "admin" && (
                              <button
                                onClick={() => handleDeleteSale(sale._id)}
                                disabled={deletingId === sale._id}
                                className="font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                              >
                                {deletingId === sale._id
                                  ? "Eliminando..."
                                  : "Eliminar"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {sales.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-gray-400">No hay ventas que mostrar</p>
                </div>
              )}
            </div>

            {/* Controles de Paginación */}
            {pagination.pages > 1 && (
              <div className="mt-4 flex flex-col items-center justify-between gap-4 border-t border-gray-700 bg-gray-900/30 px-6 py-4 sm:flex-row">
                <div className="text-sm text-gray-300">
                  Página {pagination.page} de {pagination.pages} • Total:{" "}
                  {pagination.total} ventas
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="rounded-lg border border-gray-700 bg-transparent px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasMore}
                    className="rounded-lg border border-gray-700 bg-transparent px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Detalle */}
      <SaleDetailModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
      />
    </div>
  );
}
