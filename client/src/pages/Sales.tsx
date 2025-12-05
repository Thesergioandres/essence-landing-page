import { useEffect, useState } from "react";
import { saleService, authService } from "../api/services";
import type { Sale } from "../types";
import SaleDetailModal from "../components/SaleDetailModal";

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0, hasMore: false });
  const [statsData, setStatsData] = useState<{ totalSales?: number; totalRevenue?: number; confirmedSales?: number; pendingSales?: number; totalProfit?: number }>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pendiente" | "confirmado">("all");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "distributor">("date-desc");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filter, sortBy]);

  const loadSales = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: sortBy,
      };
      if (filter !== "all") params.paymentStatus = filter;

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
    if (!confirm("¿Seguro que deseas eliminar esta venta? Esto restaurará el stock del producto.")) return;
    
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
            ? { ...sale, paymentStatus: "confirmado", paymentConfirmedAt: new Date().toISOString() }
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
    pendiente: statsData.pendingSales || sales.filter((s) => s.paymentStatus === "pendiente").length,
    confirmado: statsData.confirmedSales || sales.filter((s) => s.paymentStatus === "confirmado").length,
    totalRevenue: statsData.totalRevenue || sales.reduce((sum, s) => sum + s.salePrice * s.quantity, 0),
    totalProfit: statsData.totalProfit || sales.reduce((sum, s) => sum + s.adminProfit, 0),
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Ventas</h1>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Ventas</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 p-6 rounded-lg shadow">
          <p className="text-sm text-yellow-700">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-900">{stats.pendiente}</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg shadow">
          <p className="text-sm text-green-700">Confirmadas</p>
          <p className="text-2xl font-bold text-green-900">{stats.confirmado}</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg shadow">
          <p className="text-sm text-purple-700">Ingresos Totales</p>
          <p className="text-2xl font-bold text-purple-900">
            ${stats.totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="bg-blue-50 p-6 rounded-lg shadow">
          <p className="text-sm text-blue-700">Ganancia Admin</p>
          <p className="text-2xl font-bold text-blue-900">
            ${stats.totalProfit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filtros y Ordenamiento */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Filtrar por estado:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                filter === "all"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Todas ({stats.total})
            </button>
            <button
              onClick={() => setFilter("pendiente")}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                filter === "pendiente"
                  ? "bg-yellow-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Pendientes ({stats.pendiente})
            </button>
            <button
              onClick={() => setFilter("confirmado")}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
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
          <label htmlFor="sortBy" className="text-sm font-medium text-gray-700 mb-2 block">
            Ordenar por:
          </label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="date-desc">Fecha (Más reciente primero)</option>
            <option value="date-asc">Fecha (Más antigua primero)</option>
            <option value="distributor">Distribuidor (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Tabla de ventas */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto table-responsive">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Distribuidor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rango
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Venta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ganancia Admin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.map((sale) => {
                const product = typeof sale.product === "object" ? sale.product : null;
                const distributor = typeof sale.distributor === "object" ? sale.distributor : null;
                
                // Determinar rango según comisión
                let rankBadge = { emoji: '👑', text: 'Admin', color: 'bg-purple-100 text-purple-800' };
                if (distributor) {
                  const percentage = sale.distributorProfitPercentage || 20;
                  if (percentage === 25) {
                    rankBadge = { emoji: '🥇', text: '1º', color: 'bg-yellow-100 text-yellow-800' };
                  } else if (percentage === 23) {
                    rankBadge = { emoji: '🥈', text: '2º', color: 'bg-gray-100 text-gray-800' };
                  } else if (percentage === 21) {
                    rankBadge = { emoji: '🥉', text: '3º', color: 'bg-orange-100 text-orange-800' };
                  } else {
                    rankBadge = { emoji: '📊', text: 'Normal', color: 'bg-blue-100 text-blue-800' };
                  }
                }

                return (
                  <tr 
                    key={sale._id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={(e) => {
                      // No abrir modal si se hace clic en botones
                      if ((e.target as HTMLElement).closest('button')) return;
                      setSelectedSale(sale);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(sale.saleDate).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {distributor?.name || "Admin"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {distributor?.email || ""}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${rankBadge.color}`}>
                        {rankBadge.emoji} {rankBadge.text}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {product?.image?.url && (
                          <img
                            src={product.image.url}
                            alt={product.name}
                            className="h-10 w-10 rounded object-cover mr-3"
                          />
                        )}
                        <span className="text-sm text-gray-900">
                          {product?.name || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${(sale.salePrice * sale.quantity).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ${sale.adminProfit.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sale.paymentStatus === "pendiente" ? (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                      ) : (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Confirmado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {sale.paymentStatus === "pendiente" ? (
                          <button
                            onClick={() => handleConfirmPayment(sale._id)}
                            disabled={confirmingId === sale._id}
                            className="text-green-600 hover:text-green-900 font-medium disabled:opacity-50"
                          >
                            {confirmingId === sale._id
                              ? "Confirmando..."
                              : "Confirmar Pago"}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            Confirmado el{" "}
                            {sale.paymentConfirmedAt &&
                              new Date(sale.paymentConfirmedAt).toLocaleDateString()}
                          </span>
                        )}
                        {/* Botón eliminar solo para admin */}
                        {authService.getCurrentUser()?.role === "admin" && (
                          <button
                            onClick={() => handleDeleteSale(sale._id)}
                            disabled={deletingId === sale._id}
                            className="text-red-600 hover:text-red-900 font-medium disabled:opacity-50"
                          >
                            {deletingId === sale._id ? "Eliminando..." : "Eliminar"}
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
            <div className="text-center py-12">
              <p className="text-gray-500">No hay ventas que mostrar</p>
            </div>
          )}
        </div>

        {/* Controles de Paginación */}
        {pagination.pages > 1 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-gray-50">
            <div className="text-sm text-gray-600">
              Página {pagination.page} de {pagination.pages} • Total: {pagination.total} ventas
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                ← Anterior
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasMore}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalle */}
      <SaleDetailModal 
        sale={selectedSale} 
        onClose={() => setSelectedSale(null)} 
      />
    </div>
  );
}
