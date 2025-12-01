import { useEffect, useState } from "react";
import { defectiveProductService, stockService } from "../api/services";
import type { DefectiveProduct, DistributorStock } from "../types";

export default function DefectiveReports() {
  const [reports, setReports] = useState<DefectiveProduct[]>([]);
  const [stock, setStock] = useState<DistributorStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "pendiente" | "confirmado" | "rechazado">("all");

  // Form state
  const [formData, setFormData] = useState({
    productId: "",
    quantity: 1,
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportsData, stockData] = await Promise.all([
        defectiveProductService.getDistributorReports(),
        stockService.getDistributorStock("me"),
      ]);
      setReports(reportsData);
      setStock(stockData);
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productId || !formData.quantity || !formData.reason.trim()) {
      alert("Por favor completa todos los campos");
      return;
    }

    try {
      setSubmitting(true);
      await defectiveProductService.report(formData);
      alert("Reporte enviado exitosamente");
      setShowModal(false);
      setFormData({ productId: "", quantity: 1, reason: "" });
      await loadData();
     
    } catch (error: any) {
      console.error("Error al reportar producto:", error);
      alert(error.response?.data?.message || "Error al enviar el reporte");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReports = reports.filter((report) => {
    if (filter === "all") return true;
    return report.status === filter;
  });

  const stats = {
    total: reports.length,
    pendiente: reports.filter((r) => r.status === "pendiente").length,
    confirmado: reports.filter((r) => r.status === "confirmado").length,
    rechazado: reports.filter((r) => r.status === "rechazado").length,
  };

  const selectedStock = stock.find((s) => {
    const product = typeof s.product === "object" ? s.product : null;
    return product?._id === formData.productId;
  });
  const maxQuantity = selectedStock?.quantity || 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Productos Defectuosos</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-red-700 hover:to-orange-700 transition shadow-lg"
        >
          + Reportar Defectuoso
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Reportes</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 p-6 rounded-lg shadow">
          <p className="text-sm text-yellow-700">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-900">{stats.pendiente}</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg shadow">
          <p className="text-sm text-green-700">Confirmados</p>
          <p className="text-2xl font-bold text-green-900">{stats.confirmado}</p>
        </div>
        <div className="bg-red-50 p-6 rounded-lg shadow">
          <p className="text-sm text-red-700">Rechazados</p>
          <p className="text-2xl font-bold text-red-900">{stats.rechazado}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Todos ({stats.total})
          </button>
          <button
            onClick={() => setFilter("pendiente")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "pendiente"
                ? "bg-yellow-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Pendientes ({stats.pendiente})
          </button>
          <button
            onClick={() => setFilter("confirmado")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "confirmado"
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Confirmados ({stats.confirmado})
          </button>
          <button
            onClick={() => setFilter("rechazado")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "rechazado"
                ? "bg-red-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Rechazados ({stats.rechazado})
          </button>
        </div>
      </div>

      {/* Lista de reportes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
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
                  Notas Admin
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReports.map((report) => {
                const product = typeof report.product === "object" ? report.product : null;

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
                      {report.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      {report.reason}
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
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                      {report.adminNotes || "-"}
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

      {/* Modal para reportar */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Reportar Producto Defectuoso
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Producto *
                </label>
                <select
                  value={formData.productId}
                  onChange={(e) =>
                    setFormData({ ...formData, productId: e.target.value, quantity: 1 })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecciona un producto</option>
                  {stock
                    .filter((s) => s.quantity > 0)
                    .map((s) => {
                      const product = typeof s.product === "object" ? s.product : null;
                      return (
                        <option key={s._id} value={product?._id}>
                          {product?.name} | Stock: {s.quantity} | Precio dist: ${product?.distributorPrice || 0} | Cliente: ${product?.clientPrice || 0}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad * (Máx: {maxQuantity})
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxQuantity}
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razón del Defecto *
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={4}
                  placeholder="Describe el problema del producto..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ productId: "", quantity: 1, reason: "" });
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
                  {submitting ? "Enviando..." : "Enviar Reporte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
