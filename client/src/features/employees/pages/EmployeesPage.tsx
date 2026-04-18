import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useBusiness } from "../../../context/BusinessContext";
import { LoadingSpinner, PlanLimitModal } from "../../../shared/components/ui";
import {
  buildCacheKey,
  readSessionCache,
  writeSessionCache,
} from "../../../utils/requestCache";
import { toast } from "../../../utils/toast";
import type { User } from "../../auth/types/auth.types";
import type { BusinessPlanSnapshot } from "../../business/types/business.types";
import { globalSettingsService } from "../../common/services";
import { employeeService } from "../../employees/services";

const EMPLOYEES_CACHE_TTL_MS = 60 * 1000;

export default function Employees() {
  const navigate = useNavigate();
  const { businessId } = useBusiness();
  const [employees, setEmployees] = useState<User[]>([]);
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
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [planSnapshot, setPlanSnapshot] = useState<BusinessPlanSnapshot | null>(
    null
  );
  const [showLimitModal, setShowLimitModal] = useState(false);

  const applyFilterToList = useCallback(
    (items: User[]) => {
      if (filter === "all") return items;
      const expectedActive = filter === "active";
      return items.filter(item => (item.active !== false) === expectedActive);
    },
    [filter]
  );

  const loadEmployees = useCallback(async () => {
    try {
      if (!businessId) {
        setError("Selecciona un negocio para ver empleados");
        setEmployees([]);
        setLoading(false);
        return;
      }

      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        businessId,
      };
      if (filter !== "all") params.active = filter === "active";

      const cacheKey = buildCacheKey("employees:list", params);
      const cached = readSessionCache<{
        data: User[];
        pagination?: typeof pagination;
      }>(cacheKey, EMPLOYEES_CACHE_TTL_MS);

      if (cached?.data?.length) {
        setEmployees(cached.data);
        if (cached.pagination) setPagination(cached.pagination);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const response = await employeeService.getAll(params);

      if (Array.isArray(response)) {
        setEmployees(response);
        writeSessionCache(cacheKey, { data: response });
      } else if ("data" in response) {
        setEmployees(response.data);
        setPagination(response.pagination);
        writeSessionCache(cacheKey, {
          data: response.data,
          pagination: response.pagination,
        });
      }
    } catch (err) {
      setError("Error al cargar empleados");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter, pagination.page, pagination.limit, businessId]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (!businessId) {
      setPlanSnapshot(null);
      return;
    }

    let isMounted = true;
    globalSettingsService
      .getBusinessLimits()
      .then(snapshot => {
        if (isMounted) {
          setPlanSnapshot(snapshot);
        }
      })
      .catch(() => null);

    return () => {
      isMounted = false;
    };
  }, [businessId]);

  const handleToggleActive = async (id: string) => {
    try {
      setActionLoadingId(id);
      const result = await employeeService.toggleActive(id);
      const updatedEmployee = result?.employee;

      if (updatedEmployee?._id) {
        setEmployees(prev => {
          const next = prev.map(employee =>
            employee._id === updatedEmployee._id
              ? {
                  ...employee,
                  ...updatedEmployee,
                }
              : employee
          );
          return applyFilterToList(next);
        });
      } else {
        await loadEmployees();
      }

      toast.success(
        updatedEmployee?.active
          ? "Empleado activado correctamente"
          : "Empleado pausado correctamente"
      );
    } catch (err) {
      setError("Error al cambiar estado del empleado");
      toast.error("No se pudo cambiar el estado del empleado");
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleNewEmployee = () => {
    if (planSnapshot && planSnapshot.remaining.employees <= 0) {
      setShowLimitModal(true);
      return;
    }
    navigate("/admin/employees/add");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteSubmitting(true);
      const result = await employeeService.delete(deleteTarget._id);

      setEmployees(prev => prev.filter(item => item._id !== deleteTarget._id));
      setPagination(prev => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));

      toast.success(
        `${result.employeeNameSnapshot} eliminado. ${result.returnedUnits} unidades retornadas a bodega.`
      );
      setDeleteTarget(null);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al eliminar empleado";
      setError(message);
      toast.error(message);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 overflow-hidden">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white">Empleados</h1>
          <p className="mt-2 text-gray-400">
            Gestiona los empleados y asigna productos
          </p>
        </div>
        <button
          onClick={handleNewEmployee}
          className="bg-linear-to-r inline-flex items-center gap-2 rounded-lg from-purple-600 to-pink-600 px-5 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700"
        >
          <span className="text-2xl leading-none">＋</span>
          Nuevo employee
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
          <LoadingSpinner size="lg" message="Cargando empleados..." />
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-12 text-center text-gray-400">
          No hay empleados {filter !== "all" && `${filter}s`}.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {employees.map(employee => (
            <div
              key={employee._id}
              className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 transition hover:border-purple-500"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {employee.name}
                  </h3>
                  <p className="text-sm text-gray-400">{employee.email}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    employee.active
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {employee.active ? "Activo" : "Inactivo"}
                </span>
              </div>

              {employee.phone && (
                <p className="text-sm text-gray-400">📞 {employee.phone}</p>
              )}
              {employee.address && (
                <p className="text-sm text-gray-400">📍 {employee.address}</p>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Productos</p>
                  <p className="text-lg font-bold text-purple-400">
                    {(employee as any).stats?.assignedProductsCount || 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Ventas</p>
                  <p className="text-lg font-bold text-blue-400">
                    {(employee as any).stats?.totalSales || 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Ganancias</p>
                  <p className="text-lg font-bold text-green-400">
                    $
                    {(employee as any).stats?.totalProfit?.toFixed(2) || "0.00"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => navigate(`/admin/employees/${employee._id}`)}
                  className="flex-1 rounded-lg border border-purple-500/60 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20"
                >
                  Ver Detalle
                </button>
                <button
                  onClick={() => handleToggleActive(employee._id)}
                  disabled={
                    actionLoadingId === employee._id ||
                    deleteSubmitting ||
                    Boolean(deleteTarget)
                  }
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    employee.active
                      ? "border-yellow-500/60 text-yellow-300 hover:bg-yellow-600/20"
                      : "border-green-500/60 text-green-300 hover:bg-green-600/20"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                  title={employee.active ? "Desactivar" : "Activar"}
                >
                  {actionLoadingId === employee._id
                    ? "..."
                    : employee.active
                      ? "⏸"
                      : "▶"}
                </button>
                <button
                  onClick={() => setDeleteTarget(employee)}
                  disabled={
                    actionLoadingId === employee._id ||
                    deleteSubmitting ||
                    Boolean(deleteTarget)
                  }
                  className="rounded-lg border border-red-500/60 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-600/20 disabled:cursor-not-allowed disabled:opacity-60"
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
            {pagination.total} empleados
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

      {deleteTarget &&
        createPortal(
          <div className="z-90 fixed inset-0 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-[#190b0b] p-6 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-300">
                Confirmación crítica
              </p>
              <h3 className="mt-2 text-2xl font-bold text-red-100">
                Eliminar y reasignar empleado
              </h3>
              <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
                ¿Estás seguro? El stock de este empleado regresará a la bodega
                principal.
              </p>
              <p className="mt-3 text-sm text-red-100/90">
                Esta acción también conservará el historial de ventas usando
                snapshot del nombre del empleado y luego eliminará el registro
                de usuario.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteSubmitting}
                  className="min-h-11 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteSubmitting}
                  className="min-h-11 rounded-lg border border-red-500/70 bg-red-600/30 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-600/45 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteSubmitting ? "Eliminando..." : "Eliminar y reasignar"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <PlanLimitModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        title="Límite de empleados alcanzado"
        description="Tu plan actual alcanzó el máximo de empleados. Sube de plan para crear nuevos usuarios empleados."
        plan={planSnapshot?.plan}
        currentUsage={planSnapshot?.usage.employees}
        currentLimit={planSnapshot?.limits.employees}
      />
    </div>
  );
}
