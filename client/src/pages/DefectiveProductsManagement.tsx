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
  }>({
    reports: [],
    stats: {
      total: 0,
      pendiente: 0,
      confirmado: 0,
      rechazado: 0,
      totalQuantity: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "pendiente" | "confirmado" | "rechazado"
  >("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DefectiveProduct | null>(
    null
  );
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
      const products = response.data || response;
      setProducts(products.filter((p: Product) => p.warehouseStock > 0));
    } catch (error) {
      console.error("Error al cargar productos:", error);
    }
  };

  const handleAction = (
    report: DefectiveProduct,
    action: "confirm" | "reject"
  ) => {
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

    if (
      !reportForm.productId ||
      reportForm.quantity <= 0 ||
      !reportForm.reason.trim()
    ) {
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

  const filteredReports = data.reports.filter(report => {
    if (filter === "all") return true;
    return report.status === filter;
  });

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
        <h1 className="text-3xl font-bold text-white">Productos Defectuosos</h1>
        <button
          onClick={() => setShowReportModal(true)}
          className="bg-linear-to-r rounded-lg from-red-600 to-orange-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:from-red-700 hover:to-orange-700"
        >
          + Reportar desde Bodega
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <p className="text-sm text-gray-400">Total Reportes</p>
          <p className="text-2xl font-bold text-white">{data.stats.total}</p>
        </div>
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-6">
          <p className="text-sm text-yellow-300">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-200">
            {data.stats.pendiente}
          </p>
        </div>
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-6">
          <p className="text-sm text-green-300">Confirmados</p>
          <p className="text-2xl font-bold text-green-200">
            {data.stats.confirmado}
          </p>
        </div>
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6">
          <p className="text-sm text-red-300">Rechazados</p>
          <p className="text-2xl font-bold text-red-200">
            {data.stats.rechazado}
          </p>
        </div>
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-6">
          <p className="text-sm text-purple-300">Total Unidades</p>
          <p className="text-2xl font-bold text-purple-200">
            {data.stats.totalQuantity}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              filter === "all"
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-200 hover:bg-white/5"
            }`}
          >
            Todos ({data.stats.total})
          </button>
          <button
            onClick={() => setFilter("pendiente")}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              filter === "pendiente"
                ? "bg-yellow-500 text-white"
                : "bg-gray-800 text-gray-200 hover:bg-white/5"
            }`}
          >
            Pendientes ({data.stats.pendiente})
          </button>
          <button
            onClick={() => setFilter("confirmado")}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              filter === "confirmado"
                ? "bg-green-500 text-white"
                : "bg-gray-800 text-gray-200 hover:bg-white/5"
            }`}
          >
            Confirmados ({data.stats.confirmado})
          </button>
          <button
            onClick={() => setFilter("rechazado")}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              filter === "rechazado"
                ? "bg-red-500 text-white"
                : "bg-gray-800 text-gray-200 hover:bg-white/5"
            }`}
          >
            Rechazados ({data.stats.rechazado})
          </button>
        </div>
      </div>

      {/* Tabla de reportes */}
      <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Distribuidor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Razón
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900">
              {filteredReports.map(report => {
                const product =
                  typeof report.product === "object" ? report.product : null;
                const distributor =
                  typeof report.distributor === "object"
                    ? report.distributor
                    : null;

                return (
                  <tr key={report._id} className="hover:bg-white/5">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-white">
                      {new Date(report.reportDate).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {report.distributor ? (
                        <>
                          <div className="text-sm font-medium text-white">
                            {distributor?.name || "N/A"}
                          </div>
                          <div className="text-sm text-gray-400">
                            {distributor?.email || ""}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center">
                          <span className="inline-flex items-center rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-medium text-purple-300">
                            🏢 Bodega (Admin)
                          </span>
                        </div>
                      )}
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
                        <span className="text-sm text-white">
                          {product?.name || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white">
                      {report.quantity}
                    </td>
                    <td className="max-w-xs px-6 py-4 text-sm text-white">
                      <div className="line-clamp-2" title={report.reason}>
                        {report.reason}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {report.status === "pendiente" && (
                        <span className="inline-flex rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-semibold leading-5 text-yellow-300">
                          Pendiente
                        </span>
                      )}
                      {report.status === "confirmado" && (
                        <span className="inline-flex rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold leading-5 text-green-300">
                          Confirmado
                        </span>
                      )}
                      {report.status === "rechazado" && (
                        <span className="inline-flex rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold leading-5 text-red-300">
                          Rechazado
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {report.status === "pendiente" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(report, "confirm")}
                            disabled={processingId === report._id}
                            className="font-medium text-green-400 hover:text-green-300 disabled:opacity-50"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => handleAction(report, "reject")}
                            disabled={processingId === report._id}
                            className="font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {report.status === "confirmado"
                            ? "Confirmado"
                            : "Rechazado"}{" "}
                          el{" "}
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
            <div className="py-12 text-center">
              <p className="text-gray-400">No hay reportes</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de notas */}
      {showNotesModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-2xl font-bold text-white">
              {actionType === "confirm"
                ? "Confirmar Recepción"
                : "Rechazar Reporte"}
            </h2>

            <div className="mb-4">
              <p className="text-sm text-gray-300">
                <strong>Producto:</strong>{" "}
                {typeof selectedReport.product === "object"
                  ? selectedReport.product.name
                  : "N/A"}
              </p>
              <p className="text-sm text-gray-300">
                <strong>Cantidad:</strong> {selectedReport.quantity}
              </p>
              <p className="mt-2 text-sm text-gray-300">
                <strong>Razón:</strong> {selectedReport.reason}
              </p>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Notas (opcional)
              </label>
              <textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                rows={3}
                placeholder="Agregar notas adicionales..."
                className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-purple-500"
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
                className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-gray-200 transition hover:bg-white/5"
                disabled={processingId !== null}
              >
                Cancelar
              </button>
              <button
                onClick={executeAction}
                disabled={processingId !== null}
                className={`flex-1 rounded-lg px-4 py-2 font-semibold transition disabled:opacity-50 ${
                  actionType === "confirm"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-red-600 text-white hover:bg-red-700"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-2xl font-bold text-white">
              Reportar Producto Defectuoso (Bodega)
            </h2>

            <form onSubmit={handleReportFromWarehouse} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Producto *
                </label>
                <select
                  value={reportForm.productId}
                  onChange={e =>
                    setReportForm({
                      ...reportForm,
                      productId: e.target.value,
                      quantity: 1,
                    })
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-red-500"
                  required
                >
                  <option value="">Selecciona un producto</option>
                  {products.map(product => (
                    <option key={product._id} value={product._id}>
                      {product.name} | Stock: {product.warehouseStock} | Compra:
                      ${product.purchasePrice} | Cliente: $
                      {product.clientPrice || 0}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Cantidad *
                </label>
                <input
                  type="number"
                  min="1"
                  max={
                    reportForm.productId
                      ? products.find(p => p._id === reportForm.productId)
                          ?.warehouseStock || 1
                      : 1
                  }
                  value={reportForm.quantity}
                  onChange={e =>
                    setReportForm({
                      ...reportForm,
                      quantity: parseInt(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Razón del defecto *
                </label>
                <textarea
                  value={reportForm.reason}
                  onChange={e =>
                    setReportForm({ ...reportForm, reason: e.target.value })
                  }
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-red-500"
                  placeholder="Describe el defecto del producto..."
                  required
                />
              </div>

              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                <p className="text-sm text-yellow-200">
                  ℹ️ Los reportes desde bodega se auto-confirman automáticamente
                  y descuentan del stock de bodega.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowReportModal(false);
                    setReportForm({ productId: "", quantity: 1, reason: "" });
                  }}
                  className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-gray-200 transition hover:bg-white/5"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-linear-to-r flex-1 rounded-lg from-red-600 to-orange-600 px-4 py-2 font-semibold text-white transition hover:from-red-700 hover:to-orange-700 disabled:opacity-50"
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
