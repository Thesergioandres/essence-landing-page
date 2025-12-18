import { useEffect, useState } from "react";
import { defectiveProductService, stockService } from "../api/services";
import type { DefectiveProduct, DistributorStock } from "../types";

export default function DefectiveReports() {
  const [reports, setReports] = useState<DefectiveProduct[]>([]);
  const [stock, setStock] = useState<DistributorStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "pendiente" | "confirmado" | "rechazado"
  >("all");

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

  const filteredReports = reports.filter(report => {
    if (filter === "all") return true;
    return report.status === filter;
  });

  const stats = {
    total: reports.length,
    pendiente: reports.filter(r => r.status === "pendiente").length,
    confirmado: reports.filter(r => r.status === "confirmado").length,
    rechazado: reports.filter(r => r.status === "rechazado").length,
  };

  const selectedStock = stock.find(s => {
    const product = typeof s.product === "object" ? s.product : null;
    return product?._id === formData.productId;
  });
  const maxQuantity = selectedStock?.quantity || 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Productos Defectuosos</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-linear-to-r rounded-lg from-red-600 to-orange-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:from-red-700 hover:to-orange-700"
        >
          + Reportar Defectuoso
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <p className="text-sm text-gray-400">Total Reportes</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-6">
          <p className="text-sm text-yellow-300">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-200">
            {stats.pendiente}
          </p>
        </div>
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-6">
          <p className="text-sm text-green-300">Confirmados</p>
          <p className="text-2xl font-bold text-green-200">
            {stats.confirmado}
          </p>
        </div>
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6">
          <p className="text-sm text-red-300">Rechazados</p>
          <p className="text-2xl font-bold text-red-200">{stats.rechazado}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-200 hover:bg-white/5"
            }`}
          >
            Todos ({stats.total})
          </button>
          <button
            onClick={() => setFilter("pendiente")}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              filter === "pendiente"
                ? "bg-yellow-500 text-white"
                : "bg-gray-800 text-gray-200 hover:bg-white/5"
            }`}
          >
            Pendientes ({stats.pendiente})
          </button>
          <button
            onClick={() => setFilter("confirmado")}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              filter === "confirmado"
                ? "bg-green-500 text-white"
                : "bg-gray-800 text-gray-200 hover:bg-white/5"
            }`}
          >
            Confirmados ({stats.confirmado})
          </button>
          <button
            onClick={() => setFilter("rechazado")}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              filter === "rechazado"
                ? "bg-red-500 text-white"
                : "bg-gray-800 text-gray-200 hover:bg-white/5"
            }`}
          >
            Rechazados ({stats.rechazado})
          </button>
        </div>
      </div>

      {/* Lista de reportes */}
      <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Fecha
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
                  Notas Admin
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900">
              {filteredReports.map(report => {
                const product =
                  typeof report.product === "object" ? report.product : null;

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
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-white">
                      {report.quantity}
                    </td>
                    <td className="max-w-xs px-6 py-4 text-sm text-white">
                      {report.reason}
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
                    <td className="max-w-xs px-6 py-4 text-sm text-gray-300">
                      {report.adminNotes || "-"}
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

      {/* Modal para reportar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-2xl font-bold text-white">
              Reportar Producto Defectuoso
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Producto *
                </label>
                <select
                  value={formData.productId}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      productId: e.target.value,
                      quantity: 1,
                    })
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecciona un producto</option>
                  {stock
                    .filter(s => s.quantity > 0)
                    .map(s => {
                      const product =
                        typeof s.product === "object" ? s.product : null;
                      return (
                        <option key={s._id} value={product?._id}>
                          {product?.name} | Stock: {s.quantity} | Precio dist: $
                          {product?.distributorPrice || 0} | Cliente: $
                          {product?.clientPrice || 0}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Cantidad * (Máx: {maxQuantity})
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxQuantity}
                  value={formData.quantity}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Razón del Defecto *
                </label>
                <textarea
                  value={formData.reason}
                  onChange={e =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  rows={4}
                  placeholder="Describe el problema del producto..."
                  className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
