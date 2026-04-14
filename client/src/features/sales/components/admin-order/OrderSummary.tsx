/**
 * Order Summary Component
 * Live metrics calculation and order totals
 */

import { Calculator, CheckCircle, TrendingUp } from "lucide-react";
import type { OrderState } from "../../types/admin-order.types";

interface OrderSummaryProps {
  order: OrderState;
  isSubmitting?: boolean;
  onConfirm: () => void;
}

export function OrderSummary({
  order,
  isSubmitting,
  onConfirm,
}: OrderSummaryProps) {
  const {
    items,
    warranties,
    subtotal,
    shippingCost,
    discount,
    discountPercent,
    additionalCosts,
    grossProfit,
    netProfit,
    totalPayable,
    paymentMethod,
    deliveryMethod,
    isEmployeeSale,
    employeeProfitPercentage,
  } = order;

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalWarrantyItems = warranties.reduce((sum, w) => sum + w.quantity, 0);
  const warrantyLoss = isEmployeeSale
    ? 0
    : warranties.reduce((sum, warranty) => {
        if (warranty.type !== "total_loss") return sum;
        return sum + (warranty.unitCost || 0) * (warranty.quantity || 0);
      }, 0);
  const additionalCharges = additionalCosts.reduce(
    (sum, c) => sum + (c.amount > 0 ? c.amount : 0),
    0
  );
  const additionalAdjustments = additionalCosts.reduce(
    (sum, c) => sum + (c.amount < 0 ? Math.abs(c.amount) : 0),
    0
  );
  const effectiveDiscount =
    discount > 0 ? discount : (subtotal * discountPercent) / 100;
  const adminDue = isEmployeeSale
    ? items.reduce((sum, item) => {
        const unitPrice = Number(item.unitPrice || 0);
        const quantity = Number(item.quantity || 0);
        const hasEmployeePrice =
          typeof item.employeePrice === "number" &&
          !Number.isNaN(item.employeePrice);
        const unitDue = hasEmployeePrice
          ? Number(item.employeePrice || 0)
          : unitPrice * (1 - employeeProfitPercentage / 100);
        return sum + unitDue * quantity;
      }, 0)
    : 0;

  const canSubmit = items.length > 0 && !isSubmitting;

  return (
    <div className="bg-linear-to-br rounded-xl border border-gray-700 from-gray-800/50 to-gray-900/50 p-5">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Calculator className="h-5 w-5 text-purple-400" />
        Resumen del Pedido
      </h3>

      {/* Items Summary */}
      <div className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Productos ({totalItems} items)</span>
          <span className="text-white">${subtotal.toLocaleString()}</span>
        </div>

        {deliveryMethod === "delivery" && shippingCost > 0 && (
          <div className="flex justify-between text-gray-400">
            <span>Envío</span>
            <span className="text-white">
              +${shippingCost.toLocaleString()}
            </span>
          </div>
        )}

        {effectiveDiscount > 0 && (
          <div className="flex justify-between text-green-400">
            <span>
              Descuento {discountPercent > 0 ? `(${discountPercent}%)` : ""}
            </span>
            <span>-${effectiveDiscount.toLocaleString()}</span>
          </div>
        )}

        {warrantyLoss > 0 && (
          <div className="flex justify-between text-red-400">
            <span>Perdidas por garantia</span>
            <span>-${warrantyLoss.toLocaleString()}</span>
          </div>
        )}

        {additionalCharges > 0 && (
          <div className="flex justify-between text-orange-400">
            <span>Costos de la Empresa</span>
            <span>${additionalCharges.toLocaleString()}</span>
          </div>
        )}
        {additionalAdjustments > 0 && (
          <div className="flex justify-between text-green-400">
            <span>Ajustes</span>
            <span>-${additionalAdjustments.toLocaleString()}</span>
          </div>
        )}

        {isEmployeeSale && (
          <div className="flex justify-between text-sky-300">
            <span>Enviar al admin</span>
            <span>${Math.max(0, adminDue).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Total Payable */}
      <div className="mb-4 border-t border-gray-700 pt-4">
        <div className="flex items-end justify-between">
          <span className="text-gray-400">Total a Pagar</span>
          <span className="text-3xl font-bold text-white">
            ${totalPayable.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Profit Metrics */}
      <div className="mb-4 rounded-lg bg-gray-900/50 p-3">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-400">
          <TrendingUp className="h-4 w-4" />
          Métricas de Ganancia
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">
              {isEmployeeSale ? "Comision Bruta" : "Ganancia Bruta"}
            </p>
            <p
              className={`text-lg font-bold ${
                grossProfit >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              ${grossProfit.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {isEmployeeSale ? "Comision Neta" : "Ganancia Neta"}
            </p>
            <p
              className={`text-lg font-bold ${
                netProfit >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              ${netProfit.toLocaleString()}
            </p>
            {warrantyLoss > 0 && (
              <p className="text-xs text-red-400">
                -Costo de perdida: ${warrantyLoss.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Payment Info Badge */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            paymentMethod === "cash"
              ? "bg-green-500/20 text-green-400"
              : paymentMethod === "transfer"
                ? "bg-blue-500/20 text-blue-400"
                : "bg-yellow-500/20 text-yellow-400"
          }`}
        >
          {paymentMethod === "cash"
            ? "💵 Efectivo"
            : paymentMethod === "transfer"
              ? "💳 Transferencia"
              : "📅 Crédito/Fiado"}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            deliveryMethod === "pickup"
              ? "bg-gray-500/20 text-gray-400"
              : "bg-purple-500/20 text-purple-400"
          }`}
        >
          {deliveryMethod === "pickup" ? "🏪 Retiro" : "🚚 Envío"}
        </span>
        {totalWarrantyItems > 0 && (
          <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-medium text-orange-400">
            🛡️ {totalWarrantyItems} garantías
          </span>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={!canSubmit}
        className="bg-linear-to-r flex w-full items-center justify-center gap-2 rounded-xl from-purple-600 to-pink-600 py-4 font-bold text-white shadow-lg shadow-purple-900/20 transition hover:from-purple-700 hover:to-pink-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Procesando...
          </>
        ) : (
          <>
            <CheckCircle className="h-5 w-5" />
            Confirmar Pedido (${totalPayable.toLocaleString()})
          </>
        )}
      </button>

      {!canSubmit && items.length === 0 && (
        <p className="mt-2 text-center text-xs text-gray-500">
          Agrega productos al carrito para continuar
        </p>
      )}
    </div>
  );
}
