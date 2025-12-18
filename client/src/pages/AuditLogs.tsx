import { useEffect, useState } from "react";
import { auditService } from "../api/services";
import type { AuditLog, AuditStats, DailySummary } from "../types";

export default function AuditLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalLogs: 0,
  });

  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    action: "",
    module: "",
    severity: "",
    startDate: "",
    endDate: "",
  });

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [logsData, statsData, summaryData] = await Promise.all([
          auditService.getLogs(filters),
          auditService.getStats(30),
          auditService.getDailySummary(),
        ]);

        setLogs(logsData.logs);
        setPagination({
          currentPage: logsData.currentPage,
          totalPages: logsData.totalPages,
          totalLogs: logsData.totalLogs,
        });
        setStats(statsData);
        setDailySummary(summaryData);
      } catch (error) {
        console.error("Error cargando auditoría:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [filters]);

  const applyFilters = () => {
    setFilters({ ...filters, page: 1 });
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 50,
      action: "",
      module: "",
      severity: "",
      startDate: "",
      endDate: "",
    });
  };

  const viewLogDetails = async (logId: string) => {
    try {
      const log = await auditService.getLogById(logId);
      setSelectedLog(log);
      setShowDetails(true);
    } catch (error) {
      console.error("Error cargando detalles:", error);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "info":
        return "bg-blue-100 text-blue-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      case "error":
        return "bg-red-100 text-red-800";
      case "critical":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      login: "Inicio de Sesión",
      logout: "Cierre de Sesión",
      login_failed: "Login Fallido",
      product_created: "Producto Creado",
      product_updated: "Producto Actualizado",
      product_deleted: "Producto Eliminado",
      product_price_changed: "Precio Modificado",
      category_created: "Categoría Creada",
      category_updated: "Categoría Actualizada",
      category_deleted: "Categoría Eliminada",
      distributor_created: "Distribuidor Creado",
      distributor_updated: "Distribuidor Actualizado",
      stock_assigned: "Stock Asignado",
      stock_withdrawn: "Stock Retirado",
      sale_registered: "Venta Registrada",
      payment_confirmed: "Pago Confirmado",
      defective_reported: "Defectivo Reportado",
      defective_confirmed: "Defectivo Confirmado",
    };
    return labels[action] || action;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-white">Cargando auditoría...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white">🔍 Auditoría y Logs</h1>
        <p className="mt-2 text-gray-400">
          Historial completo de acciones del sistema
        </p>
      </div>

      {/* Resumen Diario */}
      {dailySummary && (
        <div className="bg-linear-to-br rounded-xl border border-gray-700 from-blue-900/50 to-gray-800/50 p-6 backdrop-blur-lg">
          <h2 className="mb-4 text-2xl font-bold text-white">
            📊 Resumen de Hoy
          </h2>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-gray-400">Total Acciones</p>
              <p className="text-2xl font-bold text-white">
                {dailySummary.totalActions}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-gray-400">Ventas</p>
              <p className="text-2xl font-bold text-green-400">
                {dailySummary.sales.count}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-gray-400">Ganancia</p>
              <p className="text-2xl font-bold text-blue-400">
                {new Intl.NumberFormat("es-MX", {
                  style: "currency",
                  currency: "MXN",
                }).format(dailySummary.sales.profit)}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-gray-400">Stock Bodega</p>
              <p className="text-2xl font-bold text-purple-400">
                {dailySummary.inventory.warehouse.totalWarehouseStock}
              </p>
            </div>
          </div>

          {dailySummary.topUsers.length > 0 && (
            <div>
              <h3 className="mb-3 text-lg font-semibold text-white">
                👤 Usuarios Más Activos Hoy
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {dailySummary.topUsers.slice(0, 3).map((user, index) => (
                  <div key={index} className="rounded-lg bg-white/5 p-3">
                    <p className="font-medium text-white">{user.name}</p>
                    <p className="text-sm text-gray-400">
                      {user.count} acciones
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Estadísticas Generales */}
      {stats && (
        <div className="bg-linear-to-br rounded-xl border border-gray-700 from-purple-900/50 to-gray-800/50 p-6 backdrop-blur-lg">
          <h2 className="mb-4 text-2xl font-bold text-white">
            📈 Estadísticas (Últimos 30 días)
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <h3 className="mb-3 text-lg font-semibold text-white">
                Por Módulo
              </h3>
              <div className="space-y-2">
                {Object.entries(stats.moduleStats)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([module, count]) => (
                    <div key={module} className="flex justify-between text-sm">
                      <span className="capitalize text-gray-300">{module}</span>
                      <span className="font-semibold text-white">{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-semibold text-white">
                Por Severidad
              </h3>
              <div className="space-y-2">
                {Object.entries(stats.severityStats).map(
                  ([severity, count]) => (
                    <div
                      key={severity}
                      className="flex justify-between text-sm"
                    >
                      <span
                        className={`rounded px-2 py-1 text-xs ${getSeverityColor(severity)}`}
                      >
                        {severity}
                      </span>
                      <span className="font-semibold text-white">{count}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-semibold text-white">
                Acciones Principales
              </h3>
              <div className="space-y-2">
                {Object.entries(stats.actionStats)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([action, count]) => (
                    <div key={action} className="flex justify-between text-sm">
                      <span className="text-xs text-gray-300">
                        {getActionLabel(action)}
                      </span>
                      <span className="font-semibold text-white">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 backdrop-blur-lg">
        <h2 className="mb-4 text-xl font-bold text-white">🔎 Filtros</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Módulo
            </label>
            <select
              value={filters.module}
              onChange={e => setFilters({ ...filters, module: e.target.value })}
              className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white"
            >
              <option value="">Todos</option>
              <option value="auth">Autenticación</option>
              <option value="products">Productos</option>
              <option value="categories">Categorías</option>
              <option value="distributors">Distribuidores</option>
              <option value="stock">Stock</option>
              <option value="sales">Ventas</option>
              <option value="defective_products">Defectuosos</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Severidad
            </label>
            <select
              value={filters.severity}
              onChange={e =>
                setFilters({ ...filters, severity: e.target.value })
              }
              className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white"
            >
              <option value="">Todas</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e =>
                setFilters({ ...filters, startDate: e.target.value })
              }
              className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Fecha Fin
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e =>
                setFilters({ ...filters, endDate: e.target.value })
              }
              className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={applyFilters}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Aplicar Filtros
          </button>
          <button
            onClick={clearFilters}
            className="rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla de Logs */}
      <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50 backdrop-blur-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                  Usuario
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                  Acción
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                  Módulo
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                  Descripción
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                  Severidad
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {logs.map(log => (
                <tr key={log._id} className="hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {log.userName}
                      </p>
                      <p className="text-xs text-gray-400">{log.userEmail}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {getActionLabel(log.action)}
                  </td>
                  <td className="px-4 py-3 text-sm capitalize text-gray-300">
                    {log.module}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-300">
                    {log.description}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-1 text-xs ${getSeverityColor(log.severity)}`}
                    >
                      {log.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => viewLogDetails(log._id)}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between bg-gray-700/30 px-6 py-4">
          <div className="text-sm text-gray-400">
            Mostrando {logs.length} de {pagination.totalLogs} logs
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                setFilters({ ...filters, page: Math.max(1, filters.page - 1) })
              }
              disabled={filters.page === 1}
              className="rounded bg-gray-700 px-3 py-1 text-white disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="px-3 py-1 text-white">
              {pagination.currentPage} / {pagination.totalPages}
            </span>
            <button
              onClick={() =>
                setFilters({
                  ...filters,
                  page: Math.min(pagination.totalPages, filters.page + 1),
                })
              }
              disabled={filters.page === pagination.totalPages}
              className="rounded bg-gray-700 px-3 py-1 text-white disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Detalles */}
      {showDetails && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-gray-800 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">
                Detalles del Log
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Usuario</p>
                <p className="font-medium text-white">
                  {selectedLog.userName} ({selectedLog.userEmail})
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Acción</p>
                <p className="text-white">
                  {getActionLabel(selectedLog.action)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Descripción</p>
                <p className="text-white">{selectedLog.description}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Fecha</p>
                <p className="text-white">
                  {formatDate(selectedLog.createdAt)}
                </p>
              </div>

              {selectedLog.ipAddress && (
                <div>
                  <p className="text-sm text-gray-400">IP Address</p>
                  <p className="font-mono text-sm text-white">
                    {selectedLog.ipAddress}
                  </p>
                </div>
              )}

              {selectedLog.metadata &&
                Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <p className="mb-2 text-sm text-gray-400">Metadata</p>
                    <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}

              {selectedLog.oldValues && (
                <div>
                  <p className="mb-2 text-sm text-gray-400">
                    Valores Anteriores
                  </p>
                  <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
                    {JSON.stringify(selectedLog.oldValues, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValues && (
                <div>
                  <p className="mb-2 text-sm text-gray-400">Valores Nuevos</p>
                  <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
                    {JSON.stringify(selectedLog.newValues, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
