import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { distributorService } from "../api/services";
import LoadingSpinner from "../components/LoadingSpinner";
import type { User } from "../types";
import {
  buildCacheKey,
  readSessionCache,
  writeSessionCache,
} from "../utils/requestCache";

const DISTRIBUTORS_CACHE_TTL_MS = 60 * 1000;

export default function Distributors() {
  const navigate = useNavigate();
  const [distributors, setDistributors] = useState<User[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const loadDistributors = useCallback(async () => {
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (filter !== "all") params.active = filter === "active";

      const cacheKey = buildCacheKey("distributors:list", params);
      const cached = readSessionCache<{
        data: User[];
        pagination?: typeof pagination;
      }>(cacheKey, DISTRIBUTORS_CACHE_TTL_MS);

      if (cached?.data?.length) {
        setDistributors(cached.data);
        if (cached.pagination) setPagination(cached.pagination);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const response = await distributorService.getAll(params);

      if (Array.isArray(response)) {
        setDistributors(response);
        writeSessionCache(cacheKey, { data: response });
      } else if ("data" in response) {
        setDistributors(response.data);
        setPagination(response.pagination);
        writeSessionCache(cacheKey, {
          data: response.data,
          pagination: response.pagination,
        });
      }
    } catch (err) {
      setError("Error al cargar distribuidores");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter, pagination.page, pagination.limit]);

  useEffect(() => {
    loadDistributors();
  }, [loadDistributors]);

  const handleToggleActive = async (id: string) => {
    try {
      await distributorService.toggleActive(id);
      await loadDistributors();
    } catch (err) {
      setError("Error al cambiar estado del distribuidor");
      console.error(err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !window.confirm(
        `¿Estás seguro de eliminar al distribuidor "${name}"?\nEsta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      await distributorService.delete(id);
      await loadDistributors();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al eliminar distribuidor";
      setError(message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white">Distribuidores</h1>
          <p className="mt-2 text-gray-400">
            Gestiona los distribuidores y asigna productos
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/distributors/add")}
          className="bg-linear-to-r inline-flex items-center gap-2 rounded-lg from-purple-600 to-pink-600 px-5 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700"
        >
          <span className="text-2xl leading-none">＋</span>
          Nuevo distribuidor
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg px-4 py-2 font-medium transition ${
            filter === "all"
              ? "bg-purple-600 text-white"
              : "border border-gray-700 text-gray-400 hover:text-white"
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilter("active")}
          className={`rounded-lg px-4 py-2 font-medium transition ${
            filter === "active"
              ? "bg-green-600 text-white"
              : "border border-gray-700 text-gray-400 hover:text-white"
          }`}
        >
          Activos
        </button>
        <button
          onClick={() => setFilter("inactive")}
          className={`rounded-lg px-4 py-2 font-medium transition ${
            filter === "inactive"
              ? "bg-red-600 text-white"
              : "border border-gray-700 text-gray-400 hover:text-white"
          }`}
        >
          Inactivos
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <LoadingSpinner size="lg" message="Cargando distribuidores..." />
        </div>
      ) : distributors.length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-12 text-center text-gray-400">
          No hay distribuidores {filter !== "all" && `${filter}s`}.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {distributors.map(distributor => (
            <div
              key={distributor._id}
              className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 transition hover:border-purple-500"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {distributor.name}
                  </h3>
                  <p className="text-sm text-gray-400">{distributor.email}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    distributor.active
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {distributor.active ? "Activo" : "Inactivo"}
                </span>
              </div>

              {distributor.phone && (
                <p className="text-sm text-gray-400">📞 {distributor.phone}</p>
              )}
              {distributor.address && (
                <p className="text-sm text-gray-400">
                  📍 {distributor.address}
                </p>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Productos</p>
                  <p className="text-lg font-bold text-purple-400">
                    {(distributor as any).stats?.assignedProductsCount || 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Ventas</p>
                  <p className="text-lg font-bold text-blue-400">
                    {(distributor as any).stats?.totalSales || 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Ganancias</p>
                  <p className="text-lg font-bold text-green-400">
                    $
                    {(distributor as any).stats?.totalProfit?.toFixed(2) ||
                      "0.00"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() =>
                    navigate(`/admin/distributors/${distributor._id}`)
                  }
                  className="flex-1 rounded-lg border border-purple-500/60 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20"
                >
                  Ver Detalle
                </button>
                <button
                  onClick={() => handleToggleActive(distributor._id)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    distributor.active
                      ? "border-yellow-500/60 text-yellow-300 hover:bg-yellow-600/20"
                      : "border-green-500/60 text-green-300 hover:bg-green-600/20"
                  }`}
                  title={distributor.active ? "Desactivar" : "Activar"}
                >
                  {distributor.active ? "⏸" : "▶"}
                </button>
                <button
                  onClick={() =>
                    handleDelete(distributor._id, distributor.name)
                  }
                  className="rounded-lg border border-red-500/60 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-600/20"
                  title="Eliminar"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controles de Paginación */}
      {!loading && pagination.pages > 1 && (
        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-lg border border-gray-700 bg-gray-800/50 px-6 py-4 sm:flex-row">
          <div className="text-sm text-gray-400">
            Página {pagination.page} de {pagination.pages} • Total:{" "}
            {pagination.total} distribuidores
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                setPagination(prev => ({ ...prev, page: prev.page - 1 }))
              }
              disabled={pagination.page === 1}
              className="rounded-lg border border-purple-500/60 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              ← Anterior
            </button>
            <button
              onClick={() =>
                setPagination(prev => ({ ...prev, page: prev.page + 1 }))
              }
              disabled={!pagination.hasMore}
              className="rounded-lg border border-purple-500/60 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
