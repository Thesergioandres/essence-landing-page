import { useCallback, useEffect, useState } from "react";
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
  const [filterStatus, setFilterStatus] = useState<"active" | "cancelled" | "refunded" | "">("active");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterEventName, setFilterEventName] = useState("");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadSpecialSales = useCallback(async () => {
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
  }, [currentPage, filterStatus, filterStartDate, filterEndDate, filterEventName]);

  const loadStatistics = useCallback(async () => {
    try {
      const data = await specialSaleService.getStatistics({
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
      });
      setStats(data.data);
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    }
  }, [filterStartDate, filterEndDate]);

  useEffect(() => {
    loadSpecialSales();
    loadStatistics();
  }, [loadSpecialSales, loadStatistics]);

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
      {/* Header con gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-purple-900/50 via-pink-900/30 to-purple-900/50 p-6 sm:p-8 border border-purple-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-linear-to-br from-purple-500 to-pink-500 p-3 shadow-lg shadow-purple-500/50">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                Ventas Especiales
                {stats && (
                  <span className="inline-flex items-center rounded-full bg-purple-500/20 px-3 py-1 text-sm font-medium text-purple-300">
                    {stats.count || 0}
                  </span>
                )}
              </h1>
              <p className="mt-1 text-sm text-gray-300">
                Gestiona ventas con precios y distribuciones personalizadas
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-linear-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-purple-500/50 min-h-12"
          >
            <div className="absolute inset-0 bg-linear-to-r from-purple-700 to-pink-700 opacity-0 transition-opacity group-hover:opacity-100"></div>
            <svg
              className="relative h-5 w-5"
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
            <span className="relative">Nueva Venta Especial</span>
          </button>
        </div>
      </div>

      {/* Estadísticas mejoradas */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="group relative overflow-hidden rounded-xl border border-gray-700 bg-linear-to-br from-gray-800/80 to-gray-900/80 p-5 transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/20">
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-blue-500/10 blur-2xl transition-all group-hover:bg-blue-500/20"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-400">Total Ventas</p>
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold text-white">
                ${stats.totalSales?.toLocaleString() || 0}
              </p>
              <p className="mt-1 text-xs text-gray-500">Ingresos totales</p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl border border-gray-700 bg-linear-to-br from-gray-800/80 to-gray-900/80 p-5 transition-all hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/20">
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-orange-500/10 blur-2xl transition-all group-hover:bg-orange-500/20"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-400">Total Costos</p>
                <div className="rounded-lg bg-orange-500/10 p-2">
                  <svg className="h-5 w-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold text-white">
                ${stats.totalCosts?.toLocaleString() || 0}
              </p>
              <p className="mt-1 text-xs text-gray-500">Inversión total</p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl border border-gray-700 bg-linear-to-br from-gray-800/80 to-gray-900/80 p-5 transition-all hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/20">
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-green-500/10 blur-2xl transition-all group-hover:bg-green-500/20"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-400">Total Ganancia</p>
                <div className="rounded-lg bg-green-500/10 p-2">
                  <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold text-green-400">
                ${stats.totalProfit?.toLocaleString() || 0}
              </p>
              <p className="mt-1 text-xs text-gray-500">Beneficio neto</p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl border border-gray-700 bg-linear-to-br from-gray-800/80 to-gray-900/80 p-5 transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20">
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-purple-500/10 blur-2xl transition-all group-hover:bg-purple-500/20"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-400">Cantidad</p>
                <div className="rounded-lg bg-purple-500/10 p-2">
                  <svg className="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold text-white">
                {stats.count || 0}
              </p>
              <p className="mt-1 text-xs text-gray-500">Ventas especiales</p>
            </div>
          </div>
        </div>
      )}

      {/* Filtros mejorados */}
      <div className="rounded-xl border border-gray-700 bg-linear-to-br from-gray-800/50 to-gray-900/50 p-5 backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <h3 className="text-sm font-semibold text-white">Filtros de búsqueda</h3>
          </div>
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-purple-400 transition hover:bg-purple-500/10 hover:text-purple-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Limpiar
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Estado
              </span>
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "" | "active" | "cancelled" | "refunded")}
              className="w-full rounded-lg border border-gray-600 bg-gray-700/80 px-3 py-2.5 text-sm text-white transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="">Todos los estados</option>
              <option value="active">✓ Activas</option>
              <option value="cancelled">✗ Canceladas</option>
              <option value="refunded">↺ Reembolsadas</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Fecha inicio
              </span>
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-700/80 px-3 py-2.5 text-sm text-white transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Fecha fin
              </span>
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-700/80 px-3 py-2.5 text-sm text-white transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Evento
              </span>
            </label>
            <input
              type="text"
              value={filterEventName}
              onChange={(e) => setFilterEventName(e.target.value)}
              placeholder="Buscar por evento..."
              className="w-full rounded-lg border border-gray-600 bg-gray-700/80 px-3 py-2.5 text-sm text-white placeholder-gray-500 transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
        </div>
      </div>

      {/* Tabla mejorada */}
      <div className="overflow-hidden rounded-xl border border-gray-700 bg-linear-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm">
        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-gray-700 border-t-purple-500"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="h-6 w-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
            </div>
          </div>
        ) : specialSales.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
            <div className="rounded-full bg-linear-to-br from-purple-500/20 to-pink-500/20 p-6">
              <svg
                className="h-16 w-16 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="mt-6 text-lg font-medium text-gray-300">
              No hay ventas especiales registradas
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Comienza creando tu primera venta especial con precios personalizados
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-6 flex items-center gap-2 rounded-xl bg-linear-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-purple-500/50"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Crear primera venta especial
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-700 bg-linear-to-r from-purple-900/30 to-pink-900/30">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Fecha
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Producto / Evento
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Cantidad
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Precio
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Ganancia
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Distribución
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Estado
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {specialSales.map((sale) => (
                  <tr
                    key={sale._id}
                    className="group transition-all hover:bg-gray-700/30"
                  >
                    <td className="px-5 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-gray-300">
                          {new Date(sale.saleDate).toLocaleDateString("es-CO", { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-2">
                        <div className="rounded-lg bg-purple-500/10 p-2">
                          <svg className="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {sale.product.name}
                          </p>
                          {sale.eventName && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-purple-400">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              {sale.eventName}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-700/50 px-3 py-1 text-sm font-medium text-gray-300">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                        {sale.quantity}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-semibold text-white">
                        ${sale.specialPrice.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-green-500/10 px-3 py-1.5 text-sm font-bold text-green-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        ${sale.totalProfit.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {sale.distribution.slice(0, 3).map((dist, idx) => (
                          <span
                            key={idx}
                            className="group/badge relative inline-flex items-center gap-1 rounded-full bg-linear-to-r from-purple-900/50 to-pink-900/50 px-3 py-1 text-xs font-medium text-purple-300 transition-all hover:from-purple-800/50 hover:to-pink-800/50"
                            title={`${dist.name}: $${dist.amount.toLocaleString()}`}
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {dist.name}
                          </span>
                        ))}
                        {sale.distribution.length > 3 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-700/50 px-3 py-1 text-xs font-medium text-gray-400">
                            +{sale.distribution.length - 3} más
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                          sale.status === "active"
                            ? "bg-green-500/10 text-green-400 ring-1 ring-green-500/20"
                            : sale.status === "cancelled"
                              ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                              : "bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20"
                        }`}
                      >
                        {sale.status === "active" ? (
                          <>
                            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Activa
                          </>
                        ) : sale.status === "cancelled" ? (
                          <>
                            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            Cancelada
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                            </svg>
                            Reembolsada
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(sale)}
                          className="group/btn rounded-lg bg-blue-500/10 p-2 text-blue-400 ring-1 ring-blue-500/20 transition-all hover:bg-blue-500/20 hover:ring-blue-500/40"
                          title="Editar"
                        >
                          <svg
                            className="h-4 w-4 transition-transform group-hover/btn:scale-110"
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
                            className="group/btn rounded-lg bg-yellow-500/10 p-2 text-yellow-400 ring-1 ring-yellow-500/20 transition-all hover:bg-yellow-500/20 hover:ring-yellow-500/40"
                            title="Cancelar"
                          >
                            <svg
                              className="h-4 w-4 transition-transform group-hover/btn:scale-110"
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
                          className="group/btn rounded-lg bg-red-500/10 p-2 text-red-400 ring-1 ring-red-500/20 transition-all hover:bg-red-500/20 hover:ring-red-500/40"
                          title="Eliminar"
                        >
                          <svg
                            className="h-4 w-4 transition-transform group-hover/btn:scale-110"
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

      {/* Paginación mejorada */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-gray-700 bg-linear-to-br from-gray-800/50 to-gray-900/50 p-4 backdrop-blur-sm">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="group flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-700/50 px-4 py-2.5 text-sm font-medium text-gray-300 transition-all hover:border-purple-500/50 hover:bg-gray-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-600 disabled:hover:bg-gray-700/50"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Anterior
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Página</span>
            <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-linear-to-r from-purple-600 to-pink-600 px-3 text-sm font-bold text-white">
              {currentPage}
            </span>
            <span className="text-sm text-gray-400">de</span>
            <span className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-gray-600 bg-gray-700/50 px-3 text-sm font-semibold text-gray-300">
              {totalPages}
            </span>
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="group flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-700/50 px-4 py-2.5 text-sm font-medium text-gray-300 transition-all hover:border-purple-500/50 hover:bg-gray-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-600 disabled:hover:bg-gray-700/50"
          >
            Siguiente
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
