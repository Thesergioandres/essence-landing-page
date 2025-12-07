import { useEffect, useState } from "react";
import { specialSaleService } from "../api/services";
import SpecialSaleForm from "../components/SpecialSaleForm";

interface SpecialSale {
  _id: string;
  product: {
    name: string;
    productId?: {
      _id: string;
      name: string;
    };
  };
  quantity: number;
  specialPrice: number;
  cost: number;
  totalProfit: number;
  distribution: Array<{
    name: string;
    amount: number;
  }>;
  observations?: string;
  eventName?: string;
  saleDate: string;
  status: string;
  createdBy: {
    name: string;
    email: string;
  };
  createdAt: string;
}

export default function SpecialSales() {
  const [specialSales, setSpecialSales] = useState<SpecialSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<SpecialSale | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Filtros
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterEventName, setFilterEventName] = useState("");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadSpecialSales();
    loadStatistics();
  }, [currentPage, filterStatus, filterStartDate, filterEndDate, filterEventName]);

  const loadSpecialSales = async () => {
    try {
      setLoading(true);
      const data = await specialSaleService.getAll({
        page: currentPage,
        limit: 10,
        status: filterStatus || undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        eventName: filterEventName || undefined,
        sortBy: "-saleDate",
      });

      setSpecialSales(data.data);
      setTotalPages(data.pages);
    } catch (error) {
      console.error("Error al cargar ventas especiales:", error);
      alert("Error al cargar las ventas especiales");
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const data = await specialSaleService.getStatistics({
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
      });
      setStats(data.data);
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta venta especial?")) return;

    try {
      await specialSaleService.delete(id);
      alert("Venta especial eliminada exitosamente");
      loadSpecialSales();
      loadStatistics();
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("Error al eliminar la venta especial");
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("¿Estás seguro de cancelar esta venta especial?")) return;

    try {
      await specialSaleService.cancel(id);
      alert("Venta especial cancelada exitosamente");
      loadSpecialSales();
      loadStatistics();
    } catch (error) {
      console.error("Error al cancelar:", error);
      alert("Error al cancelar la venta especial");
    }
  };

  const handleEdit = (sale: SpecialSale) => {
    setEditData(sale);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditData(null);
    loadSpecialSales();
    loadStatistics();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditData(null);
  };

  const clearFilters = () => {
    setFilterStatus("active");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterEventName("");
    setCurrentPage(1);
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        <SpecialSaleForm
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
          editData={editData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Ventas Especiales
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Gestiona ventas con precios y distribuciones personalizadas
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 min-h-12"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <span>Nueva Venta Especial</span>
        </button>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-sm text-gray-400">Total Ventas</p>
            <p className="mt-1 text-2xl font-bold text-white">
              ${stats.totalSales?.toLocaleString() || 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-sm text-gray-400">Total Costos</p>
            <p className="mt-1 text-2xl font-bold text-white">
              ${stats.totalCosts?.toLocaleString() || 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-sm text-gray-400">Total Ganancia</p>
            <p className="mt-1 text-2xl font-bold text-green-400">
              ${stats.totalProfit?.toLocaleString() || 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-sm text-gray-400">Cantidad</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {stats.count || 0} ventas
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Filtros</h3>
          <button
            onClick={clearFilters}
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            Limpiar filtros
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="">Todos</option>
              <option value="active">Activas</option>
              <option value="cancelled">Canceladas</option>
              <option value="refunded">Reembolsadas</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">
              Fecha inicio
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">
              Fecha fin
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Evento</label>
            <input
              type="text"
              value={filterEventName}
              onChange={(e) => setFilterEventName(e.target.value)}
              placeholder="Nombre del evento"
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabla de ventas especiales */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-500"></div>
          </div>
        ) : specialSales.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
            <svg
              className="h-16 w-16 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-4 text-lg text-gray-400">
              No hay ventas especiales registradas
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              Crear primera venta especial
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-700 bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">
                    Producto / Evento
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">
                    Precio
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">
                    Ganancia
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">
                    Distribución
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {specialSales.map((sale) => (
                  <tr
                    key={sale._id}
                    className="hover:bg-gray-700/30 transition"
                  >
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {new Date(sale.saleDate).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-white">
                        {sale.product.name}
                      </div>
                      {sale.eventName && (
                        <div className="text-xs text-purple-400">
                          {sale.eventName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300">
                      {sale.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-white">
                      ${sale.specialPrice.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-green-400">
                      ${sale.totalProfit.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {sale.distribution.slice(0, 3).map((dist, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-purple-900/50 px-2 py-0.5 text-xs text-purple-300"
                            title={`${dist.name}: $${dist.amount.toLocaleString()}`}
                          >
                            {dist.name}
                          </span>
                        ))}
                        {sale.distribution.length > 3 && (
                          <span className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-400">
                            +{sale.distribution.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          sale.status === "active"
                            ? "bg-green-900/30 text-green-400"
                            : sale.status === "cancelled"
                              ? "bg-red-900/30 text-red-400"
                              : "bg-yellow-900/30 text-yellow-400"
                        }`}
                      >
                        {sale.status === "active"
                          ? "Activa"
                          : sale.status === "cancelled"
                            ? "Cancelada"
                            : "Reembolsada"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(sale)}
                          className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 transition"
                          title="Editar"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        {sale.status === "active" && (
                          <button
                            onClick={() => handleCancel(sale._id)}
                            className="rounded-lg bg-yellow-600 p-2 text-white hover:bg-yellow-700 transition"
                            title="Cancelar"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(sale._id)}
                          className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-700 transition"
                          title="Eliminar"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-400">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
