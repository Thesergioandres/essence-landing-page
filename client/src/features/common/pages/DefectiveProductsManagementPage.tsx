import { useEffect, useState } from "react";
import ProductSelector from "../../../components/ProductSelector";
import { branchService } from "../../branches/services";
import {
  productService,
  stockService,
} from "../../inventory/services/inventory.service";
import type {
  Branch,
  BranchStock,
  DefectiveProduct,
  Product,
} from "../../inventory/types/product.types";
import { defectiveProductService, warrantyService } from "../../sales/services";

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
  const [hasWarrantyOnConfirm, setHasWarrantyOnConfirm] = useState(false);
  const [actionType, setActionType] = useState<
    | "confirm"
    | "reject"
    | "approveWarranty"
    | "rejectWarranty"
    | "resolveScrap"
    | "resolveSupplier"
  >("confirm");

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
    hasWarranty: false,
    countsAsLoss: false,
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
      const [response, statsResponse] = await Promise.all([
        defectiveProductService.getAllReports(),
        defectiveProductService.getStats().catch(() => ({ stats: null })),
      ]);
      const reports = response?.reports || [];
      const statsFromApi = statsResponse?.stats || null;

      const derivedStats = reports.reduce(
        (acc, report) => {
          acc.totalReports += 1;
          acc.totalQuantity += report.quantity || 0;
          if (report.status === "pendiente") acc.pendingCount += 1;
          if (report.status === "confirmado") acc.confirmedCount += 1;
          if (report.status === "rechazado") acc.rejectedCount += 1;
          if (report.hasWarranty) acc.withWarranty += 1;
          if (report.warrantyStatus === "pending") acc.warrantyPending += 1;
          if (report.warrantyStatus === "approved") acc.warrantyApproved += 1;
          if (report.stockRestored) acc.stockRestored += report.quantity || 0;
          acc.totalLoss += report.lossAmount || 0;
          return acc;
        },
        {
          totalReports: 0,
          totalQuantity: 0,
          totalLoss: 0,
          pendingCount: 0,
          confirmedCount: 0,
          rejectedCount: 0,
          withWarranty: 0,
          warrantyPending: 0,
          warrantyApproved: 0,
          stockRestored: 0,
        }
      );

      const stats = statsFromApi || derivedStats;
      setData({
        reports,
        stats: {
          total: stats.totalReports || derivedStats.totalReports,
          pendiente: stats.pendingCount || derivedStats.pendingCount,
          confirmado: stats.confirmedCount || derivedStats.confirmedCount,
          rechazado: stats.rejectedCount || derivedStats.rejectedCount,
          totalQuantity: stats.totalQuantity || derivedStats.totalQuantity,
        },
      });
    } catch (error) {
      console.error("Error al cargar reportes:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await productService.getAll();
      const productsList = Array.isArray(response)
        ? response
        : response.data || [];
      setProducts(productsList.filter((p: Product) => p.warehouseStock > 0));
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
    action:
      | "confirm"
      | "reject"
      | "approveWarranty"
      | "rejectWarranty"
      | "resolveScrap"
      | "resolveSupplier"
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
        await defectiveProductService.confirm(
          selectedReport._id,
          adminNotes,
          hasWarrantyOnConfirm
        );
      } else if (actionType === "reject") {
        await defectiveProductService.reject(selectedReport._id, adminNotes);
      } else if (actionType === "approveWarranty") {
        await defectiveProductService.approveWarranty(
          selectedReport._id,
          adminNotes
        );
      } else if (actionType === "rejectWarranty") {
        await defectiveProductService.rejectWarranty(
          selectedReport._id,
          adminNotes
        );
      } else if (actionType === "resolveScrap") {
        await warrantyService.resolveWarranty(
          selectedReport._id,
          "scrap",
          adminNotes
        );
      } else if (actionType === "resolveSupplier") {
        await warrantyService.resolveWarranty(
          selectedReport._id,
          "supplier_warranty",
          adminNotes
        );
      }

      await loadReports();
      setShowNotesModal(false);
      setSelectedReport(null);
      setAdminNotes("");
      setHasWarrantyOnConfirm(false);
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

    if (!reportForm.hasWarranty && !reportForm.countsAsLoss) {
      alert("Selecciona garantia o perdida antes de enviar");
      return;
    }

    if (reportForm.hasWarranty && reportForm.countsAsLoss) {
      alert("Selecciona solo una opcion: garantia o perdida");
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
          hasWarranty: reportForm.hasWarranty,
        });

        await Promise.all([loadReports(), loadBranchStock(selectedBranchId)]);
      } else {
        await defectiveProductService.reportAdmin({
          productId: reportForm.productId,
          quantity: reportForm.quantity,
          reason: reportForm.reason,
          hasWarranty: reportForm.hasWarranty,
        });

        await Promise.all([loadReports(), loadProducts()]);
      }

      setReportForm({
        productId: "",
        quantity: 1,
        reason: "",
        hasWarranty: false,
        countsAsLoss: false,
      });
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

  const filteredReports = (data.reports || []).filter(report => {
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

  const warehouseProducts = products
    .filter(p => !p.isPromotion && (p.warehouseStock || 0) > 0)
    .map(product => ({
      _id: product._id,
      name: product.name,
      category: product.category,
      totalStock: product.warehouseStock,
      warehouseStock: product.warehouseStock,
      purchasePrice: product.purchasePrice,
      averageCost: product.averageCost,
      suggestedPrice: product.clientPrice,
      clientPrice: product.clientPrice,
      image: product.image,
    }));

  const branchProducts = (branchStock || [])
    .filter(stockItem => (stockItem.quantity || 0) > 0)
    .map(stockItem => {
      const product =
        typeof stockItem.product === "object" ? stockItem.product : null;
      if (!product) return null;
      return {
        _id: product._id,
        name: product.name,
        category: product.category,
        totalStock: stockItem.quantity,
        warehouseStock: product.warehouseStock,
        purchasePrice: product.purchasePrice,
        averageCost: product.averageCost,
        suggestedPrice: product.clientPrice,
        clientPrice: product.clientPrice,
        image: product.image,
      };
    })
    .filter(Boolean);

  const availableProducts =
    reportOrigin === "branch" ? branchProducts : warehouseProducts;
  const selectorDisabled = reportOrigin === "branch" && !selectedBranchId;

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
            setReportForm({
              productId: "",
              quantity: 1,
              reason: "",
              hasWarranty: false,
              countsAsLoss: false,
            });
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] divide-y divide-gray-800">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                  Employee
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
                  Garantía
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
                const employee =
                  typeof report.employee === "object"
                    ? report.employee
                    : null;
                const branch =
                  typeof report.branch === "object" ? report.branch : null;
                const replacementProduct =
                  typeof report.replacementProduct === "object"
                    ? report.replacementProduct
                    : null;
                const resolutionLabel =
                  report.warrantyResolution === "scrap"
                    ? "Pérdida total"
                    : report.warrantyResolution === "supplier_warranty"
                      ? "Garantía proveedor"
                      : "Pendiente";

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
                      {report.employee ? (
                        <>
                          <div className="text-sm font-medium text-white">
                            {employee?.name || "N/A"}
                          </div>
                          <div className="text-sm text-gray-400">
                            {employee?.email || ""}
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
                      ) : report.employee ? (
                        <span className="inline-flex items-center rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-200">
                          🚚 Employee
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
                      {report.ticketId && (
                        <div className="mt-1 text-xs text-purple-300">
                          Ticket: {report.ticketId}
                        </div>
                      )}
                      {replacementProduct && (
                        <div className="mt-1 text-xs text-gray-400">
                          Reemplazo: {replacementProduct.name}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white">
                      {report.quantity}
                    </td>
                    <td className="max-w-xs px-6 py-4 text-sm text-white">
                      <div className="line-clamp-2" title={report.reason}>
                        {report.reason}
                      </div>
                      {report.priceDifference && report.priceDifference > 0 && (
                        <div className="mt-1 text-xs text-emerald-300">
                          Upselling: +${report.priceDifference.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {report.hasWarranty ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-300">
                            ✓ Con garantía
                          </span>
                          {report.warrantyStatus === "approved" && (
                            <span className="text-xs text-green-400">
                              ✓ Aprobada
                            </span>
                          )}
                          {report.warrantyStatus === "rejected" && (
                            <span className="text-xs text-red-400">
                              ✗ Rechazada
                            </span>
                          )}
                          {report.warrantyStatus === "pending" && (
                            <span className="text-xs text-yellow-400">
                              ⏳ Pendiente
                            </span>
                          )}
                          {report.origin === "customer_warranty" &&
                            report.warrantyResolution && (
                              <span className="text-xs text-purple-300">
                                Resolución: {resolutionLabel}
                              </span>
                            )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-500/15 px-2.5 py-0.5 text-xs font-medium text-gray-400">
                          Sin garantía
                        </span>
                      )}
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
                      {/* ⭐ Si es de un pedido (origin=order), mostrar solo info, no acciones */}
                      {report.origin === "customer_warranty" ? (
                        report.warrantyResolution === "pending" ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() =>
                                handleAction(report, "resolveScrap")
                              }
                              disabled={processingId === report._id}
                              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              ✗ Pérdida total
                            </button>
                            <button
                              onClick={() =>
                                handleAction(report, "resolveSupplier")
                              }
                              disabled={processingId === report._id}
                              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              ✓ Garantía proveedor
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-400">
                              Resuelto: {resolutionLabel}
                            </span>
                            {report.lossAmount && report.lossAmount > 0 && (
                              <span className="text-xs text-red-400">
                                Pérdida: ${report.lossAmount}
                              </span>
                            )}
                          </div>
                        )
                      ) : report.origin === "order" ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-300">
                            📦 Desde Pedido
                          </span>
                          {report.hasWarranty ? (
                            <span className="text-xs text-blue-400">
                              Reposición proveedor
                            </span>
                          ) : (
                            <span className="text-xs text-red-400">
                              Pérdida: $
                              {report.lossAmount?.toLocaleString() || 0}
                            </span>
                          )}
                        </div>
                      ) : report.status === "pendiente" ? (
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
                      ) : report.status === "confirmado" &&
                        report.hasWarranty &&
                        report.warrantyStatus === "pending" ? (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() =>
                              handleAction(report, "approveWarranty")
                            }
                            disabled={processingId === report._id}
                            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                          >
                            ✓ Aprobar Garantía
                          </button>
                          <button
                            onClick={() =>
                              handleAction(report, "rejectWarranty")
                            }
                            disabled={processingId === report._id}
                            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                          >
                            ✗ Rechazar Garantía
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
                          {report.stockRestored && (
                            <span className="text-xs text-green-400">
                              Stock repuesto
                            </span>
                          )}
                          {report.lossAmount && report.lossAmount > 0 && (
                            <span className="text-xs text-red-400">
                              Pérdida: ${report.lossAmount}
                            </span>
                          )}
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
                                Cancelar y restaurar
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
      </div>

      {/* Modal de notas */}
      {showNotesModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl shadow-black/30">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {actionType === "confirm"
                    ? "Confirmar Recepción"
                    : actionType === "reject"
                      ? "Rechazar Reporte"
                      : actionType === "approveWarranty"
                        ? "✓ Aprobar Garantía"
                        : actionType === "rejectWarranty"
                          ? "✗ Rechazar Garantía"
                          : actionType === "resolveScrap"
                            ? "✗ Pérdida total"
                            : "✓ Garantía proveedor"}
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Revisa los detalles antes de continuar.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
                #{selectedReport._id?.toString().slice(-6) || "Reporte"}
              </span>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Producto
                    </p>
                    <p className="text-base font-semibold text-white">
                      {typeof selectedReport.product === "object"
                        ? selectedReport.product.name
                        : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white">
                    x{selectedReport.quantity}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Razón
                  </p>
                  <p className="text-sm text-gray-300">
                    {selectedReport.reason}
                  </p>
                </div>
              </div>

              {actionType === "approveWarranty" && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
                  <p className="text-sm font-medium text-green-200">
                    ✓ Se repondrán {selectedReport.quantity} unidades al stock
                    de bodega.
                  </p>
                </div>
              )}
              {actionType === "rejectWarranty" && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                  <p className="text-sm font-medium text-red-200">
                    ✗ Se registrará como pérdida definitiva.
                  </p>
                </div>
              )}
              {actionType === "resolveScrap" && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                  <p className="text-sm font-medium text-red-200">
                    ✗ Se marcará como pérdida total (scrap).
                  </p>
                </div>
              )}
              {actionType === "resolveSupplier" && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                  <p className="text-sm font-medium text-blue-200">
                    ✓ Se marca como garantía de proveedor.
                  </p>
                </div>
              )}

              {actionType === "confirm" && (
                <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                  <p className="mb-3 text-sm font-semibold text-gray-200">
                    ¿Cómo se registrará este reporte?
                  </p>
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-800 bg-gray-900/60 p-3 transition hover:border-red-500/40">
                      <input
                        type="checkbox"
                        checked={!hasWarrantyOnConfirm}
                        onChange={() => setHasWarrantyOnConfirm(false)}
                        className="mt-0.5 h-5 w-5 rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-2 focus:ring-red-500 focus:ring-offset-0"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-white">
                          Se toma como pérdida definitiva
                        </p>
                        <p className="text-sm text-gray-400">
                          Se descuenta del stock y queda como gasto.
                        </p>
                      </div>
                    </label>

                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-800 bg-gray-900/60 p-3 transition hover:border-green-500/40">
                      <input
                        type="checkbox"
                        checked={hasWarrantyOnConfirm}
                        onChange={() => setHasWarrantyOnConfirm(true)}
                        className="mt-0.5 h-5 w-5 rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-2 focus:ring-green-500 focus:ring-offset-0"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-white">
                          No se toma como pérdida (garantía)
                        </p>
                        <p className="text-sm text-gray-400">
                          Se marca para reposición y ajusta el stock total.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
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
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowNotesModal(false);
                  setSelectedReport(null);
                  setAdminNotes("");
                }}
                className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-gray-200 transition hover:border-gray-500 hover:bg-white/5"
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
                    : actionType === "reject"
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : actionType === "approveWarranty"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : actionType === "rejectWarranty"
                          ? "bg-orange-600 text-white hover:bg-orange-700"
                          : actionType === "resolveScrap"
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {processingId !== null
                  ? "Procesando..."
                  : actionType === "confirm"
                    ? "Confirmar"
                    : actionType === "reject"
                      ? "Rechazar"
                      : actionType === "approveWarranty"
                        ? "Aprobar Garantía"
                        : actionType === "rejectWarranty"
                          ? "Rechazar Garantía"
                          : actionType === "resolveScrap"
                            ? "Marcar pérdida"
                            : "Garantía proveedor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para reportar desde bodega */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-800 bg-gray-900 p-5">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white">
                Reportar Producto Defectuoso
              </h2>
              <p className="text-sm text-gray-400">
                Completa los datos y define garantia o perdida.
              </p>
            </div>

            <form
              onSubmit={handleReportFromInventory}
              className="max-h-[75vh] space-y-3 overflow-y-auto pr-1"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setReportOrigin("warehouse");
                    setSelectedBranchId("");
                    setBranchStock([]);
                    setReportForm({
                      productId: "",
                      quantity: 1,
                      reason: "",
                      hasWarranty: false,
                      countsAsLoss: false,
                    });
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
                    setReportForm({
                      productId: "",
                      quantity: 1,
                      reason: "",
                      hasWarranty: false,
                      countsAsLoss: false,
                    });
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
                      setReportForm({
                        productId: "",
                        quantity: 1,
                        reason: "",
                        hasWarranty: false,
                        countsAsLoss: false,
                      });
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

              <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Producto *
                  </label>
                  <ProductSelector
                    value={reportForm.productId}
                    onChange={productId =>
                      setReportForm({
                        ...reportForm,
                        productId,
                        quantity: 1,
                      })
                    }
                    placeholder="Buscar producto para reportar..."
                    showStock={true}
                    products={availableProducts as any}
                    disabled={
                      selectorDisabled || availableProducts.length === 0
                    }
                  />
                  {selectorDisabled ? (
                    <p className="mt-2 text-xs text-gray-500">
                      Selecciona una sede para ver su inventario.
                    </p>
                  ) : availableProducts.length === 0 ? (
                    <p className="mt-2 text-xs text-gray-500">
                      No hay stock disponible para reportar en este origen.
                    </p>
                  ) : null}
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
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-red-500"
                  placeholder="Describe el defecto del producto..."
                  required
                />
              </div>

              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
                <p className="mb-3 text-sm font-semibold text-blue-200">
                  Selecciona como se debe registrar
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                    <input
                      type="checkbox"
                      checked={reportForm.hasWarranty}
                      onChange={e =>
                        setReportForm({
                          ...reportForm,
                          hasWarranty: e.target.checked,
                          countsAsLoss: e.target.checked
                            ? false
                            : reportForm.countsAsLoss,
                        })
                      }
                      className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-100">
                        Tiene garantia del proveedor
                      </p>
                      <p className="text-xs text-blue-200/80">
                        Solo reduce inventario, costo $0.
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                    <input
                      type="checkbox"
                      checked={reportForm.countsAsLoss}
                      onChange={e =>
                        setReportForm({
                          ...reportForm,
                          countsAsLoss: e.target.checked,
                          hasWarranty: e.target.checked
                            ? false
                            : reportForm.hasWarranty,
                        })
                      }
                      className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-700 text-red-500 focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-100">
                        Se toma como perdida
                      </p>
                      <p className="text-xs text-red-200/80">
                        Descuenta stock y registra gasto.
                      </p>
                    </div>
                  </label>
                </div>
                {!reportForm.hasWarranty && !reportForm.countsAsLoss && (
                  <p className="mt-3 text-xs text-amber-300">
                    Debes seleccionar una opcion para continuar.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                <p className="text-xs text-yellow-200">
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
                    setReportForm({
                      productId: "",
                      quantity: 1,
                      reason: "",
                      hasWarranty: false,
                      countsAsLoss: false,
                    });
                  }}
                  className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-gray-200 transition hover:bg-white/5"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (!reportForm.hasWarranty && !reportForm.countsAsLoss)
                  }
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
