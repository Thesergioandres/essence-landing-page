import { useEffect, useState } from "react";
import { defectiveProductService } from "../features/sales/services";
import type { DefectiveProduct, Sale } from "../types";

interface SaleDetailModalProps {
  sale: Sale | null;
  onClose: () => void;
}

const getRankInfo = (percentage?: number, hasDistributor?: boolean) => {
  if (!hasDistributor) {
    return {
      rank: "Admin",
      emoji: "👑",
      color: "text-purple-300 bg-purple-500/15",
    };
  }

  switch (percentage) {
    case 25:
      return {
        rank: "1º Lugar",
        emoji: "🥇",
        color: "text-yellow-300 bg-yellow-500/15",
      };
    case 23:
      return {
        rank: "2º Lugar",
        emoji: "🥈",
        color: "text-gray-200 bg-gray-500/15",
      };
    case 21:
      return {
        rank: "3º Lugar",
        emoji: "🥉",
        color: "text-orange-300 bg-orange-500/15",
      };
    case 20:
    default:
      return {
        rank: "Normal",
        emoji: "📊",
        color: "text-blue-300 bg-blue-500/15",
      };
  }
};

export default function SaleDetailModal({
  sale,
  onClose,
}: SaleDetailModalProps) {
  const [warrantyProducts, setWarrantyProducts] = useState<DefectiveProduct[]>(
    []
  );
  const [loadingWarranties, setLoadingWarranties] = useState(false);

  useEffect(() => {
    const loadWarrantyProducts = async () => {
      if (sale?.saleGroupId) {
        setLoadingWarranties(true);
        try {
          const { defectiveProducts } =
            await defectiveProductService.getBySaleGroup(sale.saleGroupId);
          setWarrantyProducts(defectiveProducts);
        } catch (error) {
          console.error("Error cargando productos en garantía:", error);
        } finally {
          setLoadingWarranties(false);
        }
      } else {
        setWarrantyProducts([]);
      }
    };

    if (sale) {
      void loadWarrantyProducts();
    }
  }, [sale]);

  if (!sale) return null;

  const product = typeof sale.product === "object" ? sale.product : null;
  const distributor =
    typeof sale.distributor === "object" ? sale.distributor : null;
  const createdBy = typeof sale.createdBy === "object" ? sale.createdBy : null;
  const customer = typeof sale.customer === "object" ? sale.customer : null;
  const branch = typeof sale.branch === "object" ? sale.branch : null;
  const rankInfo = getRankInfo(sale.distributorProfitPercentage, !!distributor);

  // Calcular totales
  const totalVenta = sale.salePrice * sale.quantity;
  const costoTotal = sale.purchasePrice * sale.quantity;
  const gananciaBruta = totalVenta - costoTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-gray-800 bg-gray-900">
        <div className="p-6">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Detalle de Venta
              </h2>
              <div className="mt-1 space-y-1">
                <p className="font-mono text-sm text-gray-400">
                  ID:{" "}
                  <span className="font-semibold text-blue-400">
                    {sale.saleId || sale._id}
                  </span>
                </p>
                {sale.saleGroupId && (
                  <p className="font-mono text-xs text-gray-500">
                    Grupo:{" "}
                    <span className="text-purple-400">{sale.saleGroupId}</span>
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* Información del Producto */}
            <div className="border-b border-gray-800 pb-4">
              <h3 className="mb-3 text-lg font-semibold text-gray-200">
                📦 Producto
              </h3>
              <div className="flex items-center gap-4">
                {product?.image?.url && (
                  <img
                    src={product.image.url}
                    alt={product.name}
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="text-lg font-medium text-white">
                    {product?.name || "N/A"}
                  </p>
                  {product?.description && (
                    <p className="text-sm text-gray-400">
                      {product.description}
                    </p>
                  )}
                  {product?.category && (
                    <p className="mt-1 text-xs text-gray-500">
                      Categoría:{" "}
                      {typeof product.category === "object"
                        ? product.category.name
                        : product.category}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Información de Sede */}
            {branch && (
              <div className="border-b border-gray-800 pb-4">
                <h3 className="mb-3 text-lg font-semibold text-gray-200">
                  🏢 Sede
                </h3>
                <p className="text-white">{branch.name}</p>
                {branch.address && (
                  <p className="text-sm text-gray-400">{branch.address}</p>
                )}
              </div>
            )}

            {/* Información del Vendedor/Distribuidor */}
            <div className="border-b border-gray-800 pb-4">
              <h3 className="mb-3 text-lg font-semibold text-gray-200">
                {distributor ? "👤 Distribuidor" : "👤 Vendedor"}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <p className="font-medium text-white">
                    {distributor?.name || createdBy?.name || "Admin"}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${rankInfo.color}`}
                  >
                    {rankInfo.emoji} {rankInfo.rank}
                  </span>
                </div>
                {(distributor?.email || createdBy?.email) && (
                  <p className="text-sm text-gray-300">
                    📧 {distributor?.email || createdBy?.email}
                  </p>
                )}
                {(distributor?.phone || createdBy?.phone) && (
                  <p className="text-sm text-gray-300">
                    📱 {distributor?.phone || createdBy?.phone}
                  </p>
                )}
                {sale.distributorProfitPercentage !== undefined && (
                  <p className="text-sm text-gray-400">
                    Comisión: {sale.distributorProfitPercentage}%
                  </p>
                )}
              </div>
            </div>

            {/* Información del Cliente */}
            {(customer || sale.customerName) && (
              <div className="border-b border-gray-800 pb-4">
                <h3 className="mb-3 text-lg font-semibold text-gray-200">
                  🧑‍💼 Cliente
                </h3>
                <p className="font-medium text-white">
                  {customer?.name || sale.customerName}
                </p>
                {customer?.email && (
                  <p className="text-sm text-gray-300">📧 {customer.email}</p>
                )}
                {customer?.phone && (
                  <p className="text-sm text-gray-300">📱 {customer.phone}</p>
                )}
              </div>
            )}

            {/* Detalles de Precios y Cantidades */}
            <div className="border-b border-gray-800 pb-4">
              <h3 className="mb-3 text-lg font-semibold text-gray-200">
                💰 Detalles de la Venta
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                  <p className="text-xs text-gray-400">Cantidad</p>
                  <p className="text-lg font-semibold text-white">
                    {sale.quantity} unidades
                  </p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                  <p className="text-xs text-gray-400">Precio de Compra</p>
                  <p className="text-lg font-semibold text-white">
                    ${sale.purchasePrice.toLocaleString()}
                  </p>
                </div>
                {distributor && (
                  <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                    <p className="text-xs text-gray-400">Precio Distribuidor</p>
                    <p className="text-lg font-semibold text-white">
                      ${sale.distributorPrice.toLocaleString()}
                    </p>
                  </div>
                )}
                <div className="rounded-lg border border-purple-700/50 bg-purple-900/20 p-3">
                  <p className="text-xs text-purple-300">Precio de Venta</p>
                  <p className="text-lg font-semibold text-purple-300">
                    ${sale.salePrice.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-purple-700/50 bg-purple-900/20 p-3">
                  <p className="text-xs text-purple-300">Total Venta</p>
                  <p className="text-xl font-bold text-purple-300">
                    ${totalVenta.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                  <p className="text-xs text-gray-400">Costo Total</p>
                  <p className="text-lg font-semibold text-white">
                    ${costoTotal.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Ganancias */}
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-green-700/50 bg-green-900/20 p-3">
                  <p className="text-xs text-green-300">Ganancia Bruta</p>
                  <p className="text-xl font-bold text-green-400">
                    ${gananciaBruta.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-green-700/50 bg-green-900/20 p-3">
                  <p className="text-xs text-green-300">Ganancia Admin</p>
                  <p className="text-xl font-bold text-green-400">
                    ${(sale.adminProfit || 0).toLocaleString()}
                  </p>
                </div>
                {sale.netProfit !== undefined && (
                  <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-3">
                    <p className="text-xs text-emerald-300">Ganancia Neta</p>
                    <p className="text-xl font-bold text-emerald-400">
                      ${sale.netProfit.toLocaleString()}
                    </p>
                  </div>
                )}
                {distributor && sale.distributorProfit > 0 && (
                  <div className="rounded-lg border border-blue-700/50 bg-blue-900/20 p-3">
                    <p className="text-xs text-blue-300">
                      Ganancia Distribuidor
                    </p>
                    <p className="text-xl font-bold text-blue-400">
                      ${sale.distributorProfit.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Costos Adicionales, Envío y Descuentos */}
            {((sale.additionalCosts && sale.additionalCosts.length > 0) ||
              (sale.shippingCost && sale.shippingCost > 0) ||
              (sale.discount && sale.discount > 0)) && (
              <div className="border-b border-gray-800 pb-4">
                <h3 className="mb-3 text-lg font-semibold text-gray-200">
                  📊 Costos Adicionales y Descuentos
                </h3>
                <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                  {sale.additionalCosts?.map((cost, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-400">
                        {cost.type === "warranty"
                          ? "🛡️ Garantía"
                          : cost.type === "gift"
                            ? "🎁 Regalo"
                            : cost.type === "shipping"
                              ? "📦 Envío"
                              : cost.type === "other"
                                ? "📋 Otro"
                                : cost.type}
                        {cost.description && ` - ${cost.description}`}
                      </span>
                      <span className="text-red-400">
                        -${cost.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {sale.shippingCost && sale.shippingCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">🚚 Costo de Envío</span>
                      <span className="text-red-400">
                        -${sale.shippingCost.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {sale.discount && sale.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">🏷️ Descuento</span>
                      <span className="text-orange-400">
                        -${sale.discount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {sale.totalAdditionalCosts !== undefined &&
                    sale.totalAdditionalCosts > 0 && (
                      <div className="mt-2 flex justify-between border-t border-gray-700 pt-2 text-sm font-semibold">
                        <span className="text-gray-300">Total Deducciones</span>
                        <span className="text-red-400">
                          -${sale.totalAdditionalCosts.toLocaleString()}
                        </span>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Productos en Garantía */}
            {(warrantyProducts.length > 0 || loadingWarranties) && (
              <div className="border-b border-gray-800 pb-4">
                <h3 className="mb-3 text-lg font-semibold text-gray-200">
                  🛡️ Productos en Garantía
                </h3>
                {loadingWarranties ? (
                  <div className="text-center text-gray-400">Cargando...</div>
                ) : (
                  <div className="space-y-2">
                    {warrantyProducts.map(defective => {
                      const defectiveProduct =
                        typeof defective.product === "object"
                          ? defective.product
                          : null;
                      return (
                        <div
                          key={defective._id}
                          className="rounded-lg border border-amber-700/50 bg-amber-900/20 p-3"
                        >
                          <div className="flex items-center gap-3">
                            {defectiveProduct?.image?.url && (
                              <img
                                src={defectiveProduct.image.url}
                                alt={defectiveProduct.name}
                                className="h-12 w-12 rounded-lg object-cover"
                              />
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-white">
                                {defectiveProduct?.name || "Producto"}
                              </p>
                              <p className="text-sm text-gray-400">
                                Cantidad: {defective.quantity} unidades
                              </p>
                            </div>
                            <div className="text-right">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  defective.warrantyStatus === "approved"
                                    ? "bg-green-500/20 text-green-300"
                                    : defective.warrantyStatus === "rejected"
                                      ? "bg-red-500/20 text-red-300"
                                      : defective.warrantyStatus === "pending"
                                        ? "bg-yellow-500/20 text-yellow-300"
                                        : "bg-gray-500/20 text-gray-300"
                                }`}
                              >
                                {defective.warrantyStatus === "approved"
                                  ? "✅ Aprobado"
                                  : defective.warrantyStatus === "rejected"
                                    ? "❌ Rechazado"
                                    : defective.warrantyStatus === "pending"
                                      ? "⏳ Pendiente"
                                      : "N/A"}
                              </span>
                              {defective.lossAmount !== undefined &&
                                defective.lossAmount > 0 && (
                                  <p className="mt-1 text-xs text-red-400">
                                    Pérdida: $
                                    {defective.lossAmount.toLocaleString()}
                                  </p>
                                )}
                            </div>
                          </div>
                          {defective.reason && (
                            <p className="mt-2 text-xs text-gray-400">
                              Razón: {defective.reason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Información de Crédito */}
            {(sale.isCredit || sale.credit) && (
              <div className="border-b border-gray-800 pb-4">
                <h3 className="mb-3 text-lg font-semibold text-gray-200">
                  💳 Información de Crédito
                </h3>
                <div className="rounded-lg border border-orange-700/50 bg-orange-900/20 p-3">
                  <div className="grid grid-cols-2 gap-4">
                    {sale.credit && typeof sale.credit === "object" && (
                      <>
                        <div>
                          <p className="text-xs text-orange-300">
                            Monto Original
                          </p>
                          <p className="font-semibold text-white">
                            ${sale.credit.originalAmount?.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-orange-300">Pagado</p>
                          <p className="font-semibold text-green-400">
                            ${sale.credit.paidAmount?.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-orange-300">Pendiente</p>
                          <p className="font-semibold text-orange-400">
                            ${sale.credit.remainingAmount?.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-orange-300">Estado</p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              sale.credit.status === "pagado"
                                ? "bg-green-500/20 text-green-300"
                                : sale.credit.status === "parcial"
                                  ? "bg-yellow-500/20 text-yellow-300"
                                  : "bg-orange-500/20 text-orange-300"
                            }`}
                          >
                            {sale.credit.status === "pagado"
                              ? "Pagado"
                              : sale.credit.status === "parcial"
                                ? "Parcial"
                                : "Pendiente"}
                          </span>
                        </div>
                        {sale.credit.dueDate && (
                          <div className="col-span-2">
                            <p className="text-xs text-orange-300">
                              Fecha de Vencimiento
                            </p>
                            <p className="font-semibold text-white">
                              {new Date(sale.credit.dueDate).toLocaleDateString(
                                "es-ES"
                              )}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Estado y Fechas de Pago */}
            <div className="border-b border-gray-800 pb-4">
              <h3 className="mb-3 text-lg font-semibold text-gray-200">
                📅 Estado de Pago
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      sale.paymentStatus === "confirmado"
                        ? "bg-green-500/15 text-green-300"
                        : "bg-yellow-500/15 text-yellow-300"
                    }`}
                  >
                    {sale.paymentStatus === "confirmado"
                      ? "✅ Confirmado"
                      : "⏳ Pendiente"}
                  </span>
                  {sale.isCredit && (
                    <span className="rounded-full bg-orange-500/15 px-3 py-1 text-sm font-semibold text-orange-300">
                      💳 Crédito
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Fecha de venta:</p>
                    <p className="text-white">
                      {new Date(sale.saleDate).toLocaleString("es-ES")}
                    </p>
                  </div>
                  {sale.paymentConfirmedAt && (
                    <div>
                      <p className="text-gray-400">Pago confirmado:</p>
                      <p className="text-white">
                        {new Date(sale.paymentConfirmedAt).toLocaleString(
                          "es-ES"
                        )}
                      </p>
                    </div>
                  )}
                  {sale.createdAt && (
                    <div>
                      <p className="text-gray-400">Registrado:</p>
                      <p className="text-white">
                        {new Date(sale.createdAt).toLocaleString("es-ES")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Comprobante de Pago */}
            {sale.paymentProof && (
              <div className="border-b border-gray-800 pb-4">
                <h3 className="mb-3 text-lg font-semibold text-gray-200">
                  🧾 Comprobante de Pago
                </h3>
                <img
                  src={sale.paymentProof}
                  alt="Comprobante de pago"
                  className="max-h-64 rounded-lg border border-gray-800 object-contain"
                />
              </div>
            )}

            {/* Notas */}
            {sale.notes && (
              <div>
                <h3 className="mb-3 text-lg font-semibold text-gray-200">
                  📝 Notas
                </h3>
                <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                  <p className="text-gray-300">{sale.notes}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg bg-purple-600 px-6 py-2 text-white hover:bg-purple-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
