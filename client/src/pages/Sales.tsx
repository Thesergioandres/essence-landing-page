import { useEffect, useState } from "react";
import { authService, saleService } from "../api/services";
import LoadingSpinner from "../components/LoadingSpinner";
import SaleDetailModal from "../components/SaleDetailModal";
import type { Sale } from "../types";

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
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: sortBy,
      };
      if (filter !== "all") params.paymentStatus = filter;
      if (dateFilters.startDate) params.startDate = dateFilters.startDate;
      if (dateFilters.endDate) params.endDate = dateFilters.endDate;

      const response = await saleService.getAllSales(params);
      setSales(response.sales || response);

      if (response.pagination) {
        setPagination(response.pagination);
      }

      if (response.stats) {
        setStatsData(response.stats);
      }
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
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Ventas</h1>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm text-gray-600">Total Ventas</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-lg bg-yellow-50 p-6 shadow">
          <p className="text-sm text-yellow-700">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-900">
            {stats.pendiente}
          </p>
        </div>
        <div className="rounded-lg bg-green-50 p-6 shadow">
          <p className="text-sm text-green-700">Confirmadas</p>
          <p className="text-2xl font-bold text-green-900">
            {stats.confirmado}
          </p>
        </div>
        <div className="rounded-lg bg-purple-50 p-6 shadow">
          <p className="text-sm text-purple-700">Ingresos Totales</p>
          <p className="text-2xl font-bold text-purple-900">
            ${stats.totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-blue-50 p-6 shadow">
          <p className="text-sm text-blue-700">Ganancia Admin</p>
          <p className="text-2xl font-bold text-blue-900">
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
          <div className="space-y-4 rounded-lg bg-white p-4 shadow">
            {/* Filtros de fecha */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                Filtrar por fecha:
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="min-w-[180px] flex-1">
                  <label
                    htmlFor="startDate"
                    className="mb-1 block text-xs text-gray-600"
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="min-w-[180px] flex-1">
                  <label
                    htmlFor="endDate"
                    className="mb-1 block text-xs text-gray-600"
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {(dateFilters.startDate || dateFilters.endDate) && (
                  <div className="flex items-end">
                    <button
                      onClick={() =>
                        setDateFilters({ startDate: "", endDate: "" })
                      }
                      className="rounded-lg bg-gray-500 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-600"
                    >
                      Limpiar fechas
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                Filtrar por estado:
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter("all")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                    filter === "all"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Todas ({stats.total})
                </button>
                <button
                  onClick={() => setFilter("pendiente")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                    filter === "pendiente"
                      ? "bg-yellow-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Pendientes ({stats.pendiente})
                </button>
                <button
                  onClick={() => setFilter("confirmado")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                    filter === "confirmado"
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Confirmadas ({stats.confirmado})
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="sortBy"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Ordenar por:
              </label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-purple-500"
              >
                <option value="date-desc">Fecha (Más reciente primero)</option>
                <option value="date-asc">Fecha (Más antigua primero)</option>
                <option value="distributor">Distribuidor (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Tabla de ventas */}
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="table-responsive overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Distribuidor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Rango
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Comisión
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Cantidad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Total Venta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Ganancia Admin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
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
                      color: "bg-purple-100 text-purple-800",
                    };
                    if (distributor) {
                      const percentage = sale.distributorProfitPercentage || 20;
                      if (percentage === 25) {
                        rankBadge = {
                          emoji: "🥇",
                          text: "1º",
                          color: "bg-yellow-100 text-yellow-800",
                        };
                      } else if (percentage === 23) {
                        rankBadge = {
                          emoji: "🥈",
                          text: "2º",
                          color: "bg-gray-100 text-gray-800",
                        };
                      } else if (percentage === 21) {
                        rankBadge = {
                          emoji: "🥉",
                          text: "3º",
                          color: "bg-orange-100 text-orange-800",
                        };
                      } else {
                        rankBadge = {
                          emoji: "📊",
                          text: "Normal",
                          color: "bg-blue-100 text-blue-800",
                        };
                      }
                    }

                    return (
                      <tr
                        key={sale._id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={e => {
                          // No abrir modal si se hace clic en botones
                          if ((e.target as HTMLElement).closest("button"))
                            return;
                          setSelectedSale(sale);
                        }}
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {new Date(sale.saleDate).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {distributor?.name || "Admin"}
                          </div>
                          <div className="text-sm text-gray-500">
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
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
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
                            <span className="text-sm text-gray-900">
                              {product?.name || "N/A"}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {sale.quantity}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          ${(sale.salePrice * sale.quantity).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-green-600">
                          ${sale.adminProfit.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {sale.paymentStatus === "pendiente" ? (
                            <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold leading-5 text-yellow-800">
                              Pendiente
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold leading-5 text-green-800">
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
                                className="font-medium text-green-600 hover:text-green-900 disabled:opacity-50"
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
                                className="font-medium text-red-600 hover:text-red-900 disabled:opacity-50"
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
                  <p className="text-gray-500">No hay ventas que mostrar</p>
                </div>
              )}
            </div>

            {/* Controles de Paginación */}
            {pagination.pages > 1 && (
              <div className="mt-4 flex flex-col items-center justify-between gap-4 bg-gray-50 px-6 py-4 sm:flex-row">
                <div className="text-sm text-gray-600">
                  Página {pagination.page} de {pagination.pages} • Total:{" "}
                  {pagination.total} ventas
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasMore}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
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
