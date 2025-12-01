import { useEffect, useState } from "react";
import { defectiveProductService, productService } from "../api/services";
import type { DefectiveProduct, Product } from "../types";

export default function DefectiveProductsManagement() {
  const [data, setData] = useState<{
    reports: DefectiveProduct[];
    stats: {
      total: number;
      pendiente: number;
      confirmado: number;
      rechazado: number;
      totalQuantity: number;
    };
  }>({ reports: [], stats: { total: 0, pendiente: 0, confirmado: 0, rechazado: 0, totalQuantity: 0 } });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pendiente" | "confirmado" | "rechazado">("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DefectiveProduct | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionType, setActionType] = useState<"confirm" | "reject">("confirm");
  
  // Estados para reportar desde admin
  const [showReportModal, setShowReportModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [reportForm, setReportForm] = useState({
    productId: "",
    quantity: 1,
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReports();
    loadProducts();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await defectiveProductService.getAllReports();
      setData(response);
    } catch (error) {
      console.error("Error al cargar reportes:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await productService.getAll();
      setProducts(response.filter((p: Product) => p.warehouseStock > 0));
    } catch (error) {
      console.error("Error al cargar productos:", error);
    }
  };

  const handleAction = (report: DefectiveProduct, action: "confirm" | "reject") => {
    setSelectedReport(report);
    setActionType(action);
    setAdminNotes("");
    setShowNotesModal(true);
  };

  const executeAction = async () => {
    if (!selectedReport) return;

    try {
      setProcessingId(selectedReport._id);
      
      if (actionType === "confirm") {
        await defectiveProductService.confirm(selectedReport._id, adminNotes);
      } else {
        await defectiveProductService.reject(selectedReport._id, adminNotes);
      }

      await loadReports();
      setShowNotesModal(false);
      setSelectedReport(null);
      setAdminNotes("");
     
    } catch (error: any) {
      console.error("Error al procesar reporte:", error);
      alert(error.response?.data?.message || "Error al procesar el reporte");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReportFromWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reportForm.productId || reportForm.quantity <= 0 || !reportForm.reason.trim()) {
      alert("Por favor completa todos los campos");
      return;
    }

    try {
      setSubmitting(true);
      await defectiveProductService.reportAdmin({
        productId: reportForm.productId,
        quantity: reportForm.quantity,
        reason: reportForm.reason,
      });

      // Recargar datos
      await Promise.all([loadReports(), loadProducts()]);
      
      // Limpiar y cerrar
      setReportForm({ productId: "", quantity: 1, reason: "" });
      setShowReportModal(false);
      
      alert("Producto defectuoso reportado desde bodega");
    } catch (error: any) {
      console.error("Error al reportar:", error);
      alert(error.response?.data?.message || "Error al reportar el producto");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReports = data.reports.filter((report) => {
    if (filter === "all") return true;
    return report.status === filter;
  });

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
        <h1 className="text-3xl font-bold text-gray-900">Productos Defectuosos</h1>
        <button
          onClick={() => setShowReportModal(true)}
          className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-red-700 hover:to-orange-700 transition shadow-lg"
        >
          + Reportar desde Bodega
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Reportes</p>
          <p className="text-2xl font-bold text-gray-900">{data.stats.total}</p>
        </div>
        <div className="bg-yellow-50 p-6 rounded-lg shadow">
          <p className="text-sm text-yellow-700">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-900">{data.stats.pendiente}</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg shadow">
          <p className="text-sm text-green-700">Confirmados</p>
          <p className="text-2xl font-bold text-green-900">{data.stats.confirmado}</p>
        </div>
        <div className="bg-red-50 p-6 rounded-lg shadow">
          <p className="text-sm text-red-700">Rechazados</p>
          <p className="text-2xl font-bold text-red-900">{data.stats.rechazado}</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg shadow">
          <p className="text-sm text-purple-700">Total Unidades</p>
          <p className="text-2xl font-bold text-purple-900">{data.stats.totalQuantity}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "all"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Todos ({data.stats.total})
          </button>
          <button
            onClick={() => setFilter("pendiente")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "pendiente"
                ? "bg-yellow-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Pendientes ({data.stats.pendiente})
          </button>
          <button
            onClick={() => setFilter("confirmado")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "confirmado"
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Confirmados ({data.stats.confirmado})
          </button>
          <button
            onClick={() => setFilter("rechazado")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "rechazado"
                ? "bg-red-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Rechazados ({data.stats.rechazado})
          </button>
        </div>
      </div>

      {/* Tabla de reportes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
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
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Razón
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
              {filteredReports.map((report) => {
                const product = typeof report.product === "object" ? report.product : null;
                const distributor = typeof report.distributor === "object" ? report.distributor : null;

                return (
                  <tr key={report._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(report.reportDate).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {report.distributor ? (
                        <>
                          <div className="text-sm font-medium text-gray-900">
                            {distributor?.name || "N/A"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {distributor?.email || ""}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            🏢 Bodega (Admin)
                          </span>
                        </div>
                      )}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {report.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="line-clamp-2" title={report.reason}>
                        {report.reason}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {report.status === "pendiente" && (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                      )}
                      {report.status === "confirmado" && (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Confirmado
                        </span>
                      )}
                      {report.status === "rechazado" && (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Rechazado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {report.status === "pendiente" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(report, "confirm")}
                            disabled={processingId === report._id}
                            className="text-green-600 hover:text-green-900 font-medium disabled:opacity-50"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => handleAction(report, "reject")}
                            disabled={processingId === report._id}
                            className="text-red-600 hover:text-red-900 font-medium disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          {report.status === "confirmado" ? "Confirmado" : "Rechazado"} el{" "}
                          {report.confirmedAt &&
                            new Date(report.confirmedAt).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredReports.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No hay reportes</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de notas */}
      {showNotesModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {actionType === "confirm" ? "Confirmar Recepción" : "Rechazar Reporte"}
            </h2>

            <div className="mb-4">
              <p className="text-sm text-gray-600">
                <strong>Producto:</strong>{" "}
                {typeof selectedReport.product === "object"
                  ? selectedReport.product.name
                  : "N/A"}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Cantidad:</strong> {selectedReport.quantity}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Razón:</strong> {selectedReport.reason}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas (opcional)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                placeholder="Agregar notas adicionales..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowNotesModal(false);
                  setSelectedReport(null);
                  setAdminNotes("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                disabled={processingId !== null}
              >
                Cancelar
              </button>
              <button
                onClick={executeAction}
                disabled={processingId !== null}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50 ${
                  actionType === "confirm"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {processingId !== null
                  ? "Procesando..."
                  : actionType === "confirm"
                  ? "Confirmar"
                  : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para reportar desde bodega */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Reportar Producto Defectuoso (Bodega)
            </h2>

            <form onSubmit={handleReportFromWarehouse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Producto *
                </label>
                <select
                  value={reportForm.productId}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, productId: e.target.value, quantity: 1 })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecciona un producto</option>
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name} | Stock: {product.warehouseStock} | Compra: ${product.purchasePrice} | Cliente: ${product.clientPrice || 0}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad *
                </label>
                <input
                  type="number"
                  min="1"
                  max={
                    reportForm.productId
                      ? products.find((p) => p._id === reportForm.productId)
                          ?.warehouseStock || 1
                      : 1
                  }
                  value={reportForm.quantity}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, quantity: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razón del defecto *
                </label>
                <textarea
                  value={reportForm.reason}
                  onChange={(e) => setReportForm({ ...reportForm, reason: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  placeholder="Describe el defecto del producto..."
                  required
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ℹ️ Los reportes desde bodega se auto-confirman automáticamente y descuentan
                  del stock de bodega.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowReportModal(false);
                    setReportForm({ productId: "", quantity: 1, reason: "" });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-red-700 hover:to-orange-700 transition disabled:opacity-50"
                >
                  {submitting ? "Reportando..." : "Reportar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
