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
    loadData();
  }, [filters]);

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-white">Cargando auditoría...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white">🔍 Auditoría y Logs</h1>
        <p className="mt-2 text-gray-400">Historial completo de acciones del sistema</p>
      </div>

      {/* Resumen Diario */}
      {dailySummary && (
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-blue-900/50 to-gray-800/50 p-6 backdrop-blur-lg">
          <h2 className="text-2xl font-bold text-white mb-4">📊 Resumen de Hoy</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-gray-400">Total Acciones</p>
              <p className="text-2xl font-bold text-white">{dailySummary.totalActions}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-gray-400">Ventas</p>
              <p className="text-2xl font-bold text-green-400">{dailySummary.sales.count}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-gray-400">Ganancia</p>
              <p className="text-2xl font-bold text-blue-400">
                {new Intl.NumberFormat("es-MX", {
                  style: "currency",
                  currency: "MXN",
                }).format(dailySummary.sales.profit)}
              </p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-gray-400">Stock Bodega</p>
              <p className="text-2xl font-bold text-purple-400">
                {dailySummary.inventory.warehouse.totalWarehouseStock}
              </p>
            </div>
          </div>

          {dailySummary.topUsers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">👤 Usuarios Más Activos Hoy</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {dailySummary.topUsers.slice(0, 3).map((user, index) => (
                  <div key={index} className="p-3 bg-white/5 rounded-lg">
                    <p className="font-medium text-white">{user.name}</p>
                    <p className="text-sm text-gray-400">{user.count} acciones</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Estadísticas Generales */}
      {stats && (
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-purple-900/50 to-gray-800/50 p-6 backdrop-blur-lg">
          <h2 className="text-2xl font-bold text-white mb-4">📈 Estadísticas (Últimos 30 días)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Por Módulo</h3>
              <div className="space-y-2">
                {Object.entries(stats.moduleStats)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([module, count]) => (
                    <div key={module} className="flex justify-between text-sm">
                      <span className="text-gray-300 capitalize">{module}</span>
                      <span className="font-semibold text-white">{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Por Severidad</h3>
              <div className="space-y-2">
                {Object.entries(stats.severityStats).map(([severity, count]) => (
                  <div key={severity} className="flex justify-between text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(severity)}`}>
                      {severity}
                    </span>
                    <span className="font-semibold text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Acciones Principales</h3>
              <div className="space-y-2">
                {Object.entries(stats.actionStats)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([action, count]) => (
                    <div key={action} className="flex justify-between text-sm">
                      <span className="text-gray-300 text-xs">{getActionLabel(action)}</span>
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
        <h2 className="text-xl font-bold text-white mb-4">🔎 Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Módulo</label>
            <select
              value={filters.module}
              onChange={(e) => setFilters({ ...filters, module: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md"
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
            <label className="block text-sm font-medium text-gray-300 mb-2">Severidad</label>
            <select
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md"
            >
              <option value="">Todas</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Fecha Inicio</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Fecha Fin</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={applyFilters}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Aplicar Filtros
          </button>
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla de Logs */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 backdrop-blur-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Fecha</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Usuario</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Acción</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Módulo</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Descripción</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Severidad</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {logs.map((log) => (
                <tr key={log._id} className="hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-sm text-gray-300">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{log.userName}</p>
                      <p className="text-xs text-gray-400">{log.userEmail}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-white">{getActionLabel(log.action)}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 capitalize">{log.module}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">{log.description}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(log.severity)}`}>
                      {log.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => viewLogDetails(log._id)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
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
        <div className="px-6 py-4 bg-gray-700/30 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Mostrando {logs.length} de {pagination.totalLogs} logs
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
              disabled={filters.page === 1}
              className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="px-3 py-1 text-white">
              {pagination.currentPage} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setFilters({ ...filters, page: Math.min(pagination.totalPages, filters.page + 1) })}
              disabled={filters.page === pagination.totalPages}
              className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Detalles */}
      {showDetails && selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-white">Detalles del Log</h3>
              <button onClick={() => setShowDetails(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Usuario</p>
                <p className="text-white font-medium">{selectedLog.userName} ({selectedLog.userEmail})</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Acción</p>
                <p className="text-white">{getActionLabel(selectedLog.action)}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Descripción</p>
                <p className="text-white">{selectedLog.description}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Fecha</p>
                <p className="text-white">{formatDate(selectedLog.createdAt)}</p>
              </div>

              {selectedLog.ipAddress && (
                <div>
                  <p className="text-sm text-gray-400">IP Address</p>
                  <p className="text-white font-mono text-sm">{selectedLog.ipAddress}</p>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Metadata</p>
                  <pre className="bg-gray-900 p-3 rounded text-xs text-gray-300 overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.oldValues && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Valores Anteriores</p>
                  <pre className="bg-gray-900 p-3 rounded text-xs text-gray-300 overflow-x-auto">
                    {JSON.stringify(selectedLog.oldValues, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValues && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Valores Nuevos</p>
                  <pre className="bg-gray-900 p-3 rounded text-xs text-gray-300 overflow-x-auto">
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
