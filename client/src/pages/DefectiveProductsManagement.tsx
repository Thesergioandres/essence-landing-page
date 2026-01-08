import { useEffect, useState } from "react";
import {
  branchService,
  defectiveProductService,
  productService,
  stockService,
} from "../api/services";
import type { Branch, BranchStock, DefectiveProduct, Product } from "../types";

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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchStock, setBranchStock] = useState<BranchStock[]>([]);
  const [reportOrigin, setReportOrigin] = useState<"warehouse" | "branch">(
    "warehouse"
  );
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [reportForm, setReportForm] = useState({
    productId: "",
    quantity: 1,
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReports();
    loadProducts();
    loadBranches();
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

  const loadBranches = async () => {
    try {
      const data = await branchService.list();
      setBranches(data || []);
    } catch (error) {
      console.error("Error al cargar sedes:", error);
    }
  };

  const loadBranchStock = async (branchId: string) => {
    if (!branchId) {
      setBranchStock([]);
      return;
    }

    try {
      const stock = await stockService.getBranchStock(branchId);
      setBranchStock(stock || []);
    } catch (error) {
      console.error("Error al cargar stock de sede:", error);
      setBranchStock([]);
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

  const handleCancelReport = async (report: DefectiveProduct) => {
    const confirmCancel = window.confirm(
      `¿Estás seguro de cancelar este reporte?\n\nEl stock de "${typeof report.product === "object" ? report.product.name : "producto"}" (${report.quantity} unidades) será restaurado al inventario.`
    );

    if (!confirmCancel) return;

    try {
      setProcessingId(report._id);
      await defectiveProductService.delete(report._id);
      await loadReports();
    } catch (error: any) {
      console.error("Error al cancelar reporte:", error);
      alert(error.response?.data?.message || "Error al cancelar el reporte");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReportFromInventory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !reportForm.productId ||
      reportForm.quantity <= 0 ||
      !reportForm.reason.trim()
    ) {
      alert("Por favor completa todos los campos");
      return;
    }

    if (reportOrigin === "branch" && !selectedBranchId) {
      alert("Selecciona la sede desde donde reportas");
      return;
    }

    const availableQuantity =
      reportOrigin === "branch"
        ? selectedBranchStockItem?.quantity || 0
        : selectedWarehouseProduct?.warehouseStock || 0;

    if (!availableQuantity) {
      alert("No hay stock disponible para reportar");
      return;
    }

    if (reportForm.quantity > availableQuantity) {
      alert(`La cantidad supera el stock disponible (${availableQuantity})`);
      return;
    }

    try {
      setSubmitting(true);

      if (reportOrigin === "branch") {
        await defectiveProductService.reportFromBranch({
          branchId: selectedBranchId,
          productId: reportForm.productId,
          quantity: reportForm.quantity,
          reason: reportForm.reason,
        });

        await Promise.all([loadReports(), loadBranchStock(selectedBranchId)]);
      } else {
        await defectiveProductService.reportAdmin({
          productId: reportForm.productId,
          quantity: reportForm.quantity,
          reason: reportForm.reason,
        });

        await Promise.all([loadReports(), loadProducts()]);
      }

      setReportForm({ productId: "", quantity: 1, reason: "" });
      setShowReportModal(false);
      alert(
        reportOrigin === "branch"
          ? "Producto defectuoso reportado desde sede"
          : "Producto defectuoso reportado desde bodega"
      );
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

  const selectedBranchStockItem = Array.isArray(branchStock)
    ? branchStock.find(s => {
        const product =
          typeof s.product === "object" ? s.product._id : s.product;
        return product === reportForm.productId;
      })
    : undefined;

  const selectedWarehouseProduct = products.find(
    p => p._id === reportForm.productId
  );

  const maxQuantity =
    reportOrigin === "branch"
      ? selectedBranchStockItem?.quantity || 0
      : selectedWarehouseProduct?.warehouseStock || 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-white">Productos Defectuosos</h1>
        <button
          onClick={() => {
            setReportOrigin("warehouse");
            setSelectedBranchId("");
            setBranchStock([]);
            setReportForm({ productId: "", quantity: 1, reason: "" });
            setShowReportModal(true);
          }}
          className="bg-linear-to-r w-full rounded-lg from-red-600 to-orange-600 px-6 py-3 text-center font-semibold text-white shadow-lg transition hover:from-red-700 hover:to-orange-700 sm:w-auto"
        >
          + Reportar defecto
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-5">
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
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[960px] divide-y divide-gray-800">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Distribuidor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Origen
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
                const branch =
                  typeof report.branch === "object" ? report.branch : null;

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
                      {branch ? (
                        <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-200">
                          📦 Sede: {branch.name}
                        </span>
                      ) : report.distributor ? (
                        <span className="inline-flex items-center rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-200">
                          🚚 Distribuidor
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-medium text-purple-200">
                          🏭 Bodega
                        </span>
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
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-400">
                            {report.status === "confirmado"
                              ? "Confirmado"
                              : "Rechazado"}{" "}
                            el{" "}
                            {report.confirmedAt &&
                              new Date(report.confirmedAt).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => handleCancelReport(report)}
                            disabled={processingId === report._id}
                            className="inline-flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 disabled:opacity-50"
                          >
                            {processingId === report._id ? (
                              "Cancelando..."
                            ) : (
                              <>
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                  />
                                </svg>
                                Cancelar y restaurar stock
                              </>
                            )}
                          </button>
                        </div>
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

        {/* Vista móvil en tarjetas */}
        <div className="space-y-3 p-3 md:hidden">
          {filteredReports.length === 0 && (
            <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-center text-gray-300">
              No hay reportes
            </div>
          )}

          {filteredReports.map(report => {
            const product =
              typeof report.product === "object" ? report.product : null;
            const distributor =
              typeof report.distributor === "object"
                ? report.distributor
                : null;
            const branch =
              typeof report.branch === "object" ? report.branch : null;

            return (
              <div
                key={report._id}
                className="rounded-lg border border-gray-800 bg-gray-900 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      {new Date(report.reportDate).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {product?.name || "Producto"}
                    </p>
                    {product?.image?.url && (
                      <img
                        src={product.image.url}
                        alt={product.name}
                        className="mt-2 h-12 w-12 rounded object-cover"
                      />
                    )}
                  </div>
                  <span className="inline-flex rounded-full bg-gray-800 px-2 py-1 text-[11px] font-semibold uppercase text-gray-200">
                    {report.status}
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-sm text-gray-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Origen</span>
                    <span className="text-right text-white">
                      {branch
                        ? `Sede: ${branch.name}`
                        : report.distributor
                          ? "Distribuidor"
                          : "Bodega"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Distribuidor</span>
                    <span className="text-right text-white">
                      {distributor?.name || "Admin"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Cantidad</span>
                    <span className="font-semibold text-white">
                      {report.quantity}
                    </span>
                  </div>
                  <div className="text-gray-200">
                    <p className="text-gray-400">Razón</p>
                    <p className="text-sm leading-snug text-white">
                      {report.reason}
                    </p>
                  </div>
                </div>

                {report.status === "pendiente" ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      onClick={() => handleAction(report, "confirm")}
                      disabled={processingId === report._id}
                      className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => handleAction(report, "reject")}
                      disabled={processingId === report._id}
                      className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-400">
                    {report.status === "confirmado"
                      ? "Confirmado"
                      : "Rechazado"}
                    {report.confirmedAt
                      ? ` el ${new Date(report.confirmedAt).toLocaleDateString("es-ES")}`
                      : ""}
                  </p>
                )}
              </div>
            );
          })}
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
              Reportar Producto Defectuoso
            </h2>

            <form onSubmit={handleReportFromInventory} className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReportOrigin("warehouse");
                    setSelectedBranchId("");
                    setBranchStock([]);
                    setReportForm({ productId: "", quantity: 1, reason: "" });
                  }}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    reportOrigin === "warehouse"
                      ? "bg-red-600 text-white"
                      : "border border-gray-700 text-gray-200 hover:bg-white/5"
                  }`}
                >
                  Reportar desde bodega
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportOrigin("branch");
                    setReportForm({ productId: "", quantity: 1, reason: "" });
                  }}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    reportOrigin === "branch"
                      ? "bg-blue-600 text-white"
                      : "border border-gray-700 text-gray-200 hover:bg-white/5"
                  }`}
                >
                  Reportar desde sede
                </button>
              </div>

              {reportOrigin === "branch" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Sede *
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={async e => {
                      const value = e.target.value;
                      setSelectedBranchId(value);
                      setReportForm({ productId: "", quantity: 1, reason: "" });
                      await loadBranchStock(value);
                    }}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecciona la sede</option>
                    {branches.map(branch => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={reportOrigin === "branch" && !selectedBranchId}
                  required
                >
                  <option value="">Selecciona un producto</option>
                  {reportOrigin === "branch"
                    ? branchStock
                        .filter(s => s.quantity > 0)
                        .map(s => {
                          const product =
                            typeof s.product === "object" ? s.product : null;
                          return (
                            <option key={s._id} value={product?._id}>
                              {product?.name} | Stock sede: {s.quantity} |
                              Cliente: ${product?.clientPrice || 0}
                            </option>
                          );
                        })
                    : products.map(product => (
                        <option key={product._id} value={product._id}>
                          {product.name} | Stock bodega:{" "}
                          {product.warehouseStock} | Compra: $
                          {product.purchasePrice} | Cliente: $
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
                  max={Math.max(maxQuantity || 0, 1)}
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
                  ℹ️ Los reportes desde bodega o sede se auto-confirman
                  automáticamente y descuentan del stock correspondiente.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowReportModal(false);
                    setReportOrigin("warehouse");
                    setSelectedBranchId("");
                    setBranchStock([]);
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
