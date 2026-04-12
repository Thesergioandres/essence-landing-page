import { m as motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFinancialPrivacy } from "../features/auth/utils/financialPrivacy";
import type { DefectiveProduct } from "../features/common/types/common.types";
import { productService } from "../features/inventory/services/inventory.service";
import { defectiveProductService } from "../features/sales/services";
import type { Sale } from "../features/sales/types/sales.types";

interface SaleDetailModalProps {
  sale: Sale | null;
  onClose: () => void;
}

const formatCurrency = (value: unknown) => {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return "$0";
  return `$${Math.round(numericValue).toLocaleString("es-CO")}`;
};

const formatDateTime = (value?: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString("es-ES");
};

const getRankInfo = (percentage?: number, hasEmployee?: boolean) => {
  if (!hasEmployee) {
    return {
      rank: "Admin",
      emoji: "👑",
      color: "text-purple-300 bg-purple-500/15 border border-purple-500/30",
    };
  }

  switch (percentage) {
    case 25:
      return {
        rank: "1º Lugar",
        emoji: "🥇",
        color: "text-yellow-300 bg-yellow-500/15 border border-yellow-500/30",
      };
    case 23:
      return {
        rank: "2º Lugar",
        emoji: "🥈",
        color: "text-gray-200 bg-gray-500/15 border border-gray-500/30",
      };
    case 21:
      return {
        rank: "3º Lugar",
        emoji: "🥉",
        color: "text-orange-300 bg-orange-500/15 border border-orange-500/30",
      };
    case 20:
    default:
      return {
        rank: "Normal",
        emoji: "📊",
        color: "text-sky-300 bg-sky-500/15 border border-sky-500/30",
      };
  }
};

const getSaleTypeInfo = (sale: Sale) => {
  if (sale.source === "special") {
    return {
      label: "Especial",
      className: "text-amber-200 bg-amber-500/15 border border-amber-500/30",
    };
  }

  if (sale.isPromotion || Boolean(sale.promotion)) {
    return {
      label: "Promoción",
      className: "text-violet-200 bg-violet-500/15 border border-violet-500/30",
    };
  }

  if ((sale.discount || 0) > 0) {
    return {
      label: "Descuento",
      className: "text-orange-200 bg-orange-500/15 border border-orange-500/30",
    };
  }

  return {
    label: "Normal",
    className: "text-slate-200 bg-slate-500/15 border border-slate-500/30",
  };
};

export default function SaleDetailModal({
  sale,
  onClose,
}: SaleDetailModalProps) {
  const { hideFinancialData } = useFinancialPrivacy();
  const [fallbackProductImageUrl, setFallbackProductImageUrl] = useState("");
  const [isProofZoomOpen, setIsProofZoomOpen] = useState(false);
  const [warrantyProducts, setWarrantyProducts] = useState<DefectiveProduct[]>(
    []
  );
  const [loadingWarranties, setLoadingWarranties] = useState(false);

  const setFallbackImageSafe = (nextUrl: string) => {
    setFallbackProductImageUrl(prev => (prev === nextUrl ? prev : nextUrl));
  };

  const saleProductId =
    typeof sale?.product === "string"
      ? sale.product
      : typeof sale?.product === "object"
        ? sale.product?._id || ""
        : "";

  const saleProductImageUrl =
    typeof sale?.product === "object" ? sale.product?.image?.url || "" : "";

  const hasWarrantyCostSignal = Boolean(
    (sale?.additionalCosts || []).some(
      cost => cost.type === "warranty" || cost.type === "garantia"
    )
  );

  useEffect(() => {
    setIsProofZoomOpen(false);
  }, [sale?._id]);

  useEffect(() => {
    let isCancelled = false;

    const loadFallbackProductImage = async () => {
      if (!sale?.product) {
        setFallbackImageSafe("");
        return;
      }

      if (saleProductImageUrl) {
        setFallbackImageSafe(saleProductImageUrl);
        return;
      }

      if (!saleProductId) {
        setFallbackImageSafe("");
        return;
      }

      try {
        const fullProduct = await productService.getById(saleProductId);
        if (isCancelled) return;
        setFallbackImageSafe(fullProduct?.image?.url || "");
      } catch {
        if (!isCancelled) {
          setFallbackImageSafe("");
        }
      }
    };

    void loadFallbackProductImage();

    return () => {
      isCancelled = true;
    };
  }, [sale?._id, saleProductId, saleProductImageUrl]);

  useEffect(() => {
    let isCancelled = false;

    const loadWarrantyProducts = async () => {
      const hasWarrantySignal =
        Boolean(sale?.warrantyTicketId) || hasWarrantyCostSignal;

      if (
        !sale?.saleGroupId ||
        sale.source === "special" ||
        !hasWarrantySignal
      ) {
        setWarrantyProducts(prev => (prev.length > 0 ? [] : prev));
        setLoadingWarranties(prev => (prev ? false : prev));
        return;
      }

      setLoadingWarranties(true);
      setWarrantyProducts(prev => (prev.length > 0 ? [] : prev));

      try {
        const response = await defectiveProductService.getBySaleGroup(
          sale.saleGroupId
        );

        if (isCancelled) return;

        const rawList =
          (response as { defectiveProducts?: DefectiveProduct[] })
            ?.defectiveProducts ??
          (response as { data?: DefectiveProduct[] })?.data ??
          (response as { reports?: DefectiveProduct[] })?.reports ??
          [];

        setWarrantyProducts(Array.isArray(rawList) ? rawList : []);
      } catch (error) {
        if (!isCancelled) {
          console.error("Error cargando productos en garantía:", error);
          setWarrantyProducts(prev => (prev.length > 0 ? [] : prev));
        }
      } finally {
        if (!isCancelled) {
          setLoadingWarranties(prev => (prev ? false : prev));
        }
      }
    };

    void loadWarrantyProducts();

    return () => {
      isCancelled = true;
    };
  }, [
    sale?._id,
    sale?.saleGroupId,
    sale?.source,
    sale?.warrantyTicketId,
    hasWarrantyCostSignal,
  ]);

  useEffect(() => {
    if (!sale) return;

    const htmlElement = document.documentElement;
    const mainScrollContainer = document.querySelector<HTMLElement>(
      "main.content-with-safe-header"
    );

    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverflow = htmlElement.style.overflow;
    const previousHtmlOverscroll = htmlElement.style.overscrollBehavior;
    const previousMainOverflowY = mainScrollContainer?.style.overflowY ?? "";
    const previousMainTouchAction =
      mainScrollContainer?.style.touchAction ?? "";
    const previousMainOverscroll =
      mainScrollContainer?.style.overscrollBehavior ?? "";
    const previousMainScrollTop = mainScrollContainer?.scrollTop ?? 0;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    htmlElement.style.overflow = "hidden";
    htmlElement.style.overscrollBehavior = "none";

    if (mainScrollContainer) {
      mainScrollContainer.style.overflowY = "hidden";
      mainScrollContainer.style.touchAction = "none";
      mainScrollContainer.style.overscrollBehavior = "none";
      mainScrollContainer.scrollTop = previousMainScrollTop;
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      htmlElement.style.overflow = previousHtmlOverflow;
      htmlElement.style.overscrollBehavior = previousHtmlOverscroll;

      if (mainScrollContainer) {
        mainScrollContainer.style.overflowY = previousMainOverflowY;
        mainScrollContainer.style.touchAction = previousMainTouchAction;
        mainScrollContainer.style.overscrollBehavior = previousMainOverscroll;
        mainScrollContainer.scrollTop = previousMainScrollTop;
      }
    };
  }, [sale?._id]);

  useEffect(() => {
    if (!sale) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isProofZoomOpen) {
          setIsProofZoomOpen(false);
          return;
        }
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [sale?._id, onClose, isProofZoomOpen]);

  if (!sale) return null;

  const product = typeof sale.product === "object" ? sale.product : null;
  const productImageUrl = product?.image?.url || fallbackProductImageUrl;
  const employee =
    typeof sale.employee === "object" ? sale.employee : null;
  const createdBy = typeof sale.createdBy === "object" ? sale.createdBy : null;
  const customer = typeof sale.customer === "object" ? sale.customer : null;
  const branch = typeof sale.branch === "object" ? sale.branch : null;

  const rankInfo = getRankInfo(sale.employeeProfitPercentage, !!employee);
  const saleTypeInfo = getSaleTypeInfo(sale);

  const totalVenta = Number(sale.salePrice || 0) * Number(sale.quantity || 0);
  const discount = Number(sale.discount || 0);
  const shippingCost = Number(sale.shippingCost || 0);
  const fallbackActual = Math.max(0, totalVenta - discount);
  const totalCobrado = Number.isFinite(Number(sale.actualPayment))
    ? Number(sale.actualPayment)
    : fallbackActual;

  const costBasis = Number(sale.averageCostAtSale ?? sale.purchasePrice ?? 0);
  const costoTotal = costBasis * Number(sale.quantity || 0);
  const gananciaBruta = totalVenta - costoTotal;
  const employeeUnitPrice = Number(sale.employeePrice || 0);
  const totalToDeliver =
    employee && employeeUnitPrice > 0
      ? employeeUnitPrice * Number(sale.quantity || 0)
      : 0;

  const warrantyLossFromReports = warrantyProducts.reduce(
    (sum, warranty) => sum + Number(warranty.lossAmount || 0),
    0
  );

  const warrantyCostInSale = (sale.additionalCosts || []).reduce(
    (sum, cost) =>
      cost.type === "warranty" || cost.type === "garantia"
        ? sum + Number(cost.amount || 0)
        : sum,
    0
  );

  const warrantyLossGap = Math.max(
    0,
    warrantyLossFromReports - warrantyCostInSale
  );
  const netProfitBase = Number(
    sale.netProfit ?? sale.adminProfit ?? gananciaBruta ?? 0
  );
  const netProfitAdjusted = netProfitBase - warrantyLossGap;

  const additionalCostItems = sale.additionalCosts || [];
  const hasAdditionalDetails =
    additionalCostItems.length > 0 || shippingCost > 0 || discount > 0;

  const sourceLabel =
    sale.sourceLocation === "branch"
      ? "Sede"
      : sale.sourceLocation === "employee"
        ? "Empleado"
        : "Bodega";

  const paymentStatusLabel =
    sale.paymentStatus === "confirmado" ? "Confirmado" : "Pendiente";

  const paymentProofUrl = sale.paymentProof || "";
  const proofIsImage =
    Boolean(paymentProofUrl) &&
    ((typeof sale.paymentProofMimeType === "string" &&
      sale.paymentProofMimeType.startsWith("image/")) ||
      /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(paymentProofUrl));

  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="z-60 fixed inset-0 overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-4"
    >
      <div className="flex min-h-full items-start justify-center py-2 sm:items-center sm:py-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{
            type: "spring",
            stiffness: 340,
            damping: 28,
            mass: 0.6,
          }}
          onClick={event => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Detalle de venta"
          className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-700/80 bg-[linear-gradient(160deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] shadow-[0_30px_90px_-45px_rgba(6,182,212,0.7)]"
        >
          <div className="sticky top-0 z-10 border-b border-slate-700/80 bg-slate-950/80 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">
                  Auditoria de venta
                </p>
                <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                  Detalle de venta
                </h2>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-slate-600 bg-slate-900/80 px-2.5 py-1 text-slate-200">
                    ID: {sale.saleId || sale._id}
                  </span>
                  {sale.saleGroupId && (
                    <span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-2.5 py-1 text-violet-200">
                      Grupo: {sale.saleGroupId}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 font-semibold ${saleTypeInfo.className}`}
                  >
                    {saleTypeInfo.label}
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="min-h-11 min-w-11 rounded-lg border border-slate-600 bg-slate-900/80 px-3 text-lg text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
                aria-label="Cerrar detalle"
              >
                ×
              </button>
            </div>
          </div>

          <div className="max-h-[calc(94vh-94px)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
                <p className="text-xs text-slate-400">Estado de pago</p>
                <span
                  className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    sale.paymentStatus === "confirmado"
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "bg-yellow-500/15 text-yellow-200"
                  }`}
                >
                  {paymentStatusLabel}
                </span>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
                <p className="text-xs text-slate-400">Fecha de venta</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {formatDateTime(sale.saleDate)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
                <p className="text-xs text-slate-400">Total cobrado</p>
                <p className="mt-2 text-base font-bold text-cyan-200 sm:text-lg">
                  {formatCurrency(totalCobrado)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
                <p className="text-xs text-slate-400">Cantidad</p>
                <p className="mt-2 text-base font-bold text-white sm:text-lg">
                  {sale.quantity} unidades
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr,1fr]">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-300">
                    Producto
                  </h3>
                  <div className="mt-3 flex items-start gap-3">
                    {productImageUrl ? (
                      <img
                        src={productImageUrl}
                        alt={product?.name || sale.productName || "Producto"}
                        className="h-20 w-20 rounded-xl border border-slate-700 object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-slate-700 text-xs text-slate-500">
                        Sin imagen
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-white">
                        {product?.name || sale.productName || "Producto"}
                      </p>
                      {product?.description && (
                        <p className="mt-1 text-sm text-slate-400">
                          {product.description}
                        </p>
                      )}
                      {product?.category && (
                        <p className="mt-1 text-xs text-slate-500">
                          Categoria:{" "}
                          {typeof product.category === "object"
                            ? product.category.name
                            : product.category}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-300">
                    Responsable de la venta
                  </h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">
                        {employee?.name || createdBy?.name || "Admin"}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rankInfo.color}`}
                      >
                        {rankInfo.emoji} {rankInfo.rank}
                      </span>
                    </div>
                    {(employee?.email || createdBy?.email) && (
                      <p className="text-slate-300">
                        Correo: {employee?.email || createdBy?.email}
                      </p>
                    )}
                    {(employee?.phone || createdBy?.phone) && (
                      <p className="text-slate-300">
                        Telefono: {employee?.phone || createdBy?.phone}
                      </p>
                    )}
                    {!hideFinancialData &&
                      employee &&
                      sale.employeeProfitPercentage !== undefined && (
                        <p className="text-slate-400">
                          Comisión:{" "}
                          {formatCurrency(sale.employeeProfit || 0)} (
                          {sale.employeeProfitPercentage}%)
                        </p>
                      )}
                  </div>
                </div>

                {(customer || sale.customerName) && (
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Cliente
                    </h3>
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="font-semibold text-white">
                        {customer?.name || sale.customerName}
                      </p>
                      {customer?.email && (
                        <p className="text-slate-300">
                          Correo: {customer.email}
                        </p>
                      )}
                      {customer?.phone && (
                        <p className="text-slate-300">
                          Telefono: {customer.phone}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-300">
                    Datos de registro
                  </h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-2.5">
                      <p className="text-xs text-slate-400">Origen</p>
                      <p className="text-slate-200">{sourceLabel}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-2.5">
                      <p className="text-xs text-slate-400">Sede</p>
                      <p className="text-slate-200">
                        {branch?.name || sale.branchName || "General"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-2.5">
                      <p className="text-xs text-slate-400">Método de pago</p>
                      <p className="text-slate-200">
                        {sale.paymentMethodCode ||
                          (typeof sale.paymentMethod === "string"
                            ? sale.paymentMethod
                            : "N/A")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-2.5">
                      <p className="text-xs text-slate-400">
                        Método de entrega
                      </p>
                      <p className="text-slate-200">
                        {sale.deliveryMethodCode ||
                          (typeof sale.deliveryMethod === "string"
                            ? sale.deliveryMethod
                            : "N/A")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-2.5">
                      <p className="text-xs text-slate-400">Registrado</p>
                      <p className="text-slate-200">
                        {formatDateTime(sale.createdAt)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-2.5">
                      <p className="text-xs text-slate-400">Pago confirmado</p>
                      <p className="text-slate-200">
                        {formatDateTime(sale.paymentConfirmedAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {sale.notes?.trim() && (
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Notas
                    </h3>
                    <p className="mt-3 text-sm text-slate-300">{sale.notes}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-300">
                    Resumen financiero
                  </h3>

                  {hideFinancialData ? (
                    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-300">
                      Datos financieros protegidos por permisos de usuario.
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-2.5">
                        <p className="text-xs text-slate-400">
                          Precio venta unitario
                        </p>
                        <p className="font-semibold text-cyan-200">
                          {formatCurrency(sale.salePrice)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-2.5">
                        <p className="text-xs text-slate-400">Total venta</p>
                        <p className="font-semibold text-cyan-200">
                          {formatCurrency(totalVenta)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-2.5">
                        <p className="text-xs text-slate-400">
                          {sale.averageCostAtSale !== undefined
                            ? "Costo promedio"
                            : "Precio compra"}
                        </p>
                        <p className="font-semibold text-slate-200">
                          {formatCurrency(costBasis)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-2.5">
                        <p className="text-xs text-slate-400">Costo total</p>
                        <p className="font-semibold text-slate-200">
                          {formatCurrency(costoTotal)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                        <p className="text-xs text-emerald-200">
                          Ganancia bruta
                        </p>
                        <p className="font-semibold text-emerald-200">
                          {formatCurrency(gananciaBruta)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                        <p className="text-xs text-emerald-200">
                          Ganancia neta admin
                        </p>
                        <p className="font-semibold text-emerald-200">
                          {formatCurrency(netProfitAdjusted)}
                        </p>
                      </div>
                      {employee && totalToDeliver > 0 && (
                        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 sm:col-span-2">
                          <p className="text-xs text-sky-200">
                            A entregar a empleado
                          </p>
                          <p className="font-semibold text-sky-200">
                            {formatCurrency(totalToDeliver)}
                          </p>
                        </div>
                      )}
                      {warrantyLossGap > 0 && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 sm:col-span-2">
                          <p className="text-xs text-amber-200">
                            Ajuste por garantías no descontadas
                          </p>
                          <p className="font-semibold text-amber-200">
                            -{formatCurrency(warrantyLossGap)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {hasAdditionalDetails && (
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Costos y descuentos
                    </h3>
                    <div className="mt-3 space-y-2 text-sm">
                      {additionalCostItems.map((cost, index) => (
                        <div
                          key={`${cost.type}-${index}`}
                          className="flex items-center justify-between rounded-lg border border-slate-700/70 bg-slate-950/50 px-2.5 py-2"
                        >
                          <span className="text-slate-300">
                            {cost.type === "warranty"
                              ? "Garantía"
                              : cost.type === "gift"
                                ? "Regalo"
                                : cost.type === "shipping"
                                  ? "Envío"
                                  : cost.type === "other"
                                    ? "Otro"
                                    : cost.type}
                            {cost.description ? ` - ${cost.description}` : ""}
                          </span>
                          <span className="font-semibold text-red-300">
                            -{formatCurrency(cost.amount)}
                          </span>
                        </div>
                      ))}

                      {shippingCost > 0 && (
                        <div className="flex items-center justify-between rounded-lg border border-slate-700/70 bg-slate-950/50 px-2.5 py-2">
                          <span className="text-slate-300">Costo de envío</span>
                          <span className="font-semibold text-red-300">
                            -{formatCurrency(shippingCost)}
                          </span>
                        </div>
                      )}

                      {discount > 0 && (
                        <div className="flex items-center justify-between rounded-lg border border-slate-700/70 bg-slate-950/50 px-2.5 py-2">
                          <span className="text-slate-300">Descuento</span>
                          <span className="font-semibold text-orange-300">
                            -{formatCurrency(discount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(loadingWarranties || warrantyProducts.length > 0) && (
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Garantías asociadas
                    </h3>
                    {loadingWarranties ? (
                      <p className="mt-3 text-sm text-slate-400">
                        Cargando productos en garantía...
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {warrantyProducts.map(defective => {
                          const defectiveProduct =
                            typeof defective.product === "object"
                              ? defective.product
                              : null;

                          return (
                            <div
                              key={defective._id}
                              className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    {defectiveProduct?.name || "Producto"}
                                  </p>
                                  <p className="text-xs text-slate-300">
                                    Cantidad: {defective.quantity}
                                  </p>
                                  {defective.reason && (
                                    <p className="mt-1 text-xs text-slate-400">
                                      Motivo: {defective.reason}
                                    </p>
                                  )}
                                </div>
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    defective.warrantyStatus === "approved"
                                      ? "bg-emerald-500/20 text-emerald-200"
                                      : defective.warrantyStatus === "rejected"
                                        ? "bg-red-500/20 text-red-200"
                                        : "bg-yellow-500/20 text-yellow-200"
                                  }`}
                                >
                                  {defective.warrantyStatus === "approved"
                                    ? "Aprobado"
                                    : defective.warrantyStatus === "rejected"
                                      ? "Rechazado"
                                      : "Pendiente"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {(sale.isCredit || sale.credit) && (
                  <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-orange-200">
                      Crédito
                    </h3>
                    {sale.credit && typeof sale.credit === "object" ? (
                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        <div className="rounded-lg border border-orange-400/30 bg-orange-950/30 p-2.5">
                          <p className="text-xs text-orange-200/80">Original</p>
                          <p className="font-semibold text-white">
                            {formatCurrency(sale.credit.originalAmount)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-orange-400/30 bg-orange-950/30 p-2.5">
                          <p className="text-xs text-orange-200/80">Pagado</p>
                          <p className="font-semibold text-emerald-200">
                            {formatCurrency(sale.credit.paidAmount)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-orange-400/30 bg-orange-950/30 p-2.5">
                          <p className="text-xs text-orange-200/80">
                            Pendiente
                          </p>
                          <p className="font-semibold text-orange-200">
                            {formatCurrency(sale.credit.remainingAmount)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-orange-400/30 bg-orange-950/30 p-2.5">
                          <p className="text-xs text-orange-200/80">Estado</p>
                          <p className="font-semibold text-white">
                            {sale.credit.status || "Pendiente"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-orange-100/90">
                        Venta marcada como crédito.
                      </p>
                    )}
                  </div>
                )}

                {paymentProofUrl && (
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Comprobante de pago
                    </h3>
                    <div className="mt-3">
                      {proofIsImage ? (
                        <>
                          <img
                            src={paymentProofUrl}
                            alt="Comprobante de pago"
                            onClick={() => setIsProofZoomOpen(true)}
                            className="max-h-72 w-full cursor-zoom-in rounded-lg border border-slate-700 object-contain transition hover:border-cyan-400/70"
                          />
                          <p className="mt-2 text-xs text-slate-500">
                            Haz clic en la imagen para ampliarla.
                          </p>
                        </>
                      ) : (
                        <a
                          href={paymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-11 items-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"
                        >
                          Abrir comprobante
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isProofZoomOpen && proofIsImage && (
              <div
                className="z-70 fixed inset-0 flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6"
                role="dialog"
                aria-modal="true"
                aria-label="Comprobante ampliado"
                onClick={event => {
                  event.stopPropagation();
                  setIsProofZoomOpen(false);
                }}
              >
                <div className="relative flex h-full w-full items-center justify-center">
                  <button
                    onClick={event => {
                      event.stopPropagation();
                      setIsProofZoomOpen(false);
                    }}
                    className="absolute right-0 top-0 min-h-11 min-w-11 rounded-lg border border-slate-500 bg-slate-900/80 px-3 text-lg text-slate-100 transition hover:border-cyan-400 hover:text-cyan-200"
                    aria-label="Cerrar vista ampliada"
                  >
                    ×
                  </button>

                  <img
                    src={paymentProofUrl}
                    alt="Comprobante de pago ampliado"
                    className="max-h-[86vh] w-auto max-w-full rounded-xl border border-slate-600 object-contain shadow-2xl"
                    onClick={event => event.stopPropagation()}
                  />
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end border-t border-slate-700/70 pt-4">
              <button
                onClick={onClose}
                className="min-h-11 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-5 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
              >
                Cerrar detalle
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );

  return createPortal(modalContent, document.body);
}
