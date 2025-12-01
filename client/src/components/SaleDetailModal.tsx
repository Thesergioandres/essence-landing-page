import type { Sale } from "../types";

interface SaleDetailModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export default function SaleDetailModal({ sale, onClose }: SaleDetailModalProps) {
  if (!sale) return null;

  const product = typeof sale.product === "object" ? sale.product : null;
  const distributor = typeof sale.distributor === "object" ? sale.distributor : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Detalle de Venta</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* Información del Producto */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-700">Producto</h3>
              <div className="flex items-center gap-4">
                {product?.image?.url && (
                  <img
                    src={product.image.url}
                    alt={product.name}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-lg">{product?.name || "N/A"}</p>
                  <p className="text-sm text-gray-600">{product?.description}</p>
                </div>
              </div>
            </div>

            {/* Información del Distribuidor */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-700">
                {distributor ? "Distribuidor" : "Vendedor"}
              </h3>
              <div className="space-y-2">
                <p className="text-gray-900 font-medium">
                  {distributor?.name || "Admin"}
                </p>
                {distributor && (
                  <>
                    <p className="text-gray-600">{distributor.email}</p>
                    {distributor.phone && (
                      <p className="text-gray-600">{distributor.phone}</p>
                    )}
                    {distributor.address && (
                      <p className="text-gray-600">{distributor.address}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Información de Precios y Cantidades */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-700">Detalles de la Venta</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Cantidad</p>
                  <p className="text-lg font-semibold">{sale.quantity} unidades</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Precio de Compra</p>
                  <p className="text-lg font-semibold">${sale.purchasePrice.toLocaleString()}</p>
                </div>
                {distributor && (
                  <div>
                    <p className="text-sm text-gray-600">Precio Distribuidor</p>
                    <p className="text-lg font-semibold">${sale.distributorPrice.toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Precio de Venta</p>
                  <p className="text-lg font-semibold text-purple-600">
                    ${sale.salePrice.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Venta</p>
                  <p className="text-xl font-bold text-purple-600">
                    ${(sale.salePrice * sale.quantity).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Ganancia Admin</p>
                  <p className="text-xl font-bold text-green-600">
                    ${sale.adminProfit.toLocaleString()}
                  </p>
                </div>
                {distributor && sale.distributorProfit > 0 && (
                  <div>
                    <p className="text-sm text-gray-600">Ganancia Distribuidor</p>
                    <p className="text-xl font-bold text-blue-600">
                      ${sale.distributorProfit.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Información de Pago */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-700">Estado de Pago</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      sale.paymentStatus === "confirmado"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {sale.paymentStatus === "confirmado" ? "Confirmado" : "Pendiente"}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Fecha de venta: {new Date(sale.saleDate).toLocaleString("es-ES")}
                </p>
                {sale.paymentConfirmedAt && (
                  <p className="text-sm text-gray-600">
                    Pago confirmado: {new Date(sale.paymentConfirmedAt).toLocaleString("es-ES")}
                  </p>
                )}
              </div>
            </div>

            {/* Comprobante de Pago */}
            {sale.paymentProof && (
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Comprobante de Pago</h3>
                <img
                  src={sale.paymentProof}
                  alt="Comprobante de pago"
                  className="max-w-full rounded-lg border"
                />
              </div>
            )}

            {/* Notas */}
            {sale.notes && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Notas</h3>
                <p className="text-gray-600">{sale.notes}</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
