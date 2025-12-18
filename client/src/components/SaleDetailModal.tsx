import type { Sale } from "../types";

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
  if (!sale) return null;

  const product = typeof sale.product === "object" ? sale.product : null;
  const distributor =
    typeof sale.distributor === "object" ? sale.distributor : null;
  const rankInfo = getRankInfo(sale.distributorProfitPercentage, !!distributor);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-gray-800 bg-gray-900">
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Detalle de Venta
              </h2>
              <p className="mt-1 font-mono text-sm text-gray-400">
                ID:{" "}
                <span className="font-semibold text-blue-400">
                  {sale.saleId || sale._id}
                </span>
              </p>
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
                Producto
              </h3>
              <div className="flex items-center gap-4">
                {product?.image?.url && (
                  <img
                    src={product.image.url}
                    alt={product.name}
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                )}
                <div>
                  <p className="text-lg font-medium text-white">
                    {product?.name || "N/A"}
                  </p>
                  <p className="text-sm text-gray-400">
                    {product?.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Información del Distribuidor */}
            <div className="border-b border-gray-800 pb-4">
              <h3 className="mb-3 text-lg font-semibold text-gray-200">
                {distributor ? "Distribuidor" : "Vendedor"}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <p className="font-medium text-white">
                    {distributor?.name || "Admin"}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${rankInfo.color}`}
                  >
                    {rankInfo.emoji} {rankInfo.rank}
                  </span>
                </div>
                {distributor && (
                  <>
                    <p className="text-gray-300">{distributor.email}</p>
                    {distributor.phone && (
                      <p className="text-gray-300">{distributor.phone}</p>
                    )}
                    {distributor.address && (
                      <p className="text-gray-300">{distributor.address}</p>
                    )}
                  </>
                )}
                {sale.distributorProfitPercentage && (
                  <p className="text-sm text-gray-400">
                    Comisión: {sale.distributorProfitPercentage}%
                  </p>
                )}
              </div>
            </div>

            {/* Información de Precios y Cantidades */}
            <div className="border-b border-gray-800 pb-4">
              <h3 className="mb-3 text-lg font-semibold text-gray-200">
                Detalles de la Venta
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Cantidad</p>
                  <p className="text-lg font-semibold text-white">
                    {sale.quantity} unidades
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Precio de Compra</p>
                  <p className="text-lg font-semibold text-white">
                    ${sale.purchasePrice.toLocaleString()}
                  </p>
                </div>
                {distributor && (
                  <div>
                    <p className="text-sm text-gray-400">Precio Distribuidor</p>
                    <p className="text-lg font-semibold text-white">
                      ${sale.distributorPrice.toLocaleString()}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-400">Precio de Venta</p>
                  <p className="text-lg font-semibold text-purple-300">
                    ${sale.salePrice.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total Venta</p>
                  <p className="text-xl font-bold text-purple-300">
                    ${(sale.salePrice * sale.quantity).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Ganancia Admin</p>
                  <p className="text-xl font-bold text-green-600">
                    ${sale.adminProfit.toLocaleString()}
                  </p>
                </div>
                {distributor && sale.distributorProfit > 0 && (
                  <div>
                    <p className="text-sm text-gray-400">
                      Ganancia Distribuidor
                    </p>
                    <p className="text-xl font-bold text-blue-600">
                      ${sale.distributorProfit.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Información de Pago */}
            <div className="border-b border-gray-800 pb-4">
              <h3 className="mb-3 text-lg font-semibold text-gray-200">
                Estado de Pago
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      sale.paymentStatus === "confirmado"
                        ? "bg-green-500/15 text-green-300"
                        : "bg-yellow-500/15 text-yellow-300"
                    }`}
                  >
                    {sale.paymentStatus === "confirmado"
                      ? "Confirmado"
                      : "Pendiente"}
                  </span>
                </div>
                <p className="text-sm text-gray-300">
                  Fecha de venta:{" "}
                  {new Date(sale.saleDate).toLocaleString("es-ES")}
                </p>
                {sale.paymentConfirmedAt && (
                  <p className="text-sm text-gray-300">
                    Pago confirmado:{" "}
                    {new Date(sale.paymentConfirmedAt).toLocaleString("es-ES")}
                  </p>
                )}
              </div>
            </div>

            {/* Comprobante de Pago */}
            {sale.paymentProof && (
              <div className="border-b border-gray-800 pb-4">
                <h3 className="mb-3 text-lg font-semibold text-gray-200">
                  Comprobante de Pago
                </h3>
                <img
                  src={sale.paymentProof}
                  alt="Comprobante de pago"
                  className="max-w-full rounded-lg border border-gray-800"
                />
              </div>
            )}

            {/* Notas */}
            {sale.notes && (
              <div>
                <h3 className="mb-3 text-lg font-semibold text-gray-200">
                  Notas
                </h3>
                <p className="text-gray-300">{sale.notes}</p>
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
