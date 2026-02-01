import { CheckCircle, Plus, ShoppingCart, Trash2 } from "lucide-react"; // Assuming lucide-react is installed
import type { FormEvent } from "react";
import { useState } from "react";
import LoadingSpinner from "../../../shared/components/ui/LoadingSpinner";
import { useProducts } from "../../inventory/hooks/useProducts";
import { useCart } from "../hooks/useCart";
import { useSaleSubmit } from "../hooks/useSaleSubmit";

export default function RegisterSalePage() {
  // 1. Data Sources
  const { products, loading: productsLoading } = useProducts();
  const { items, addItem, removeItem, clearCart, totalAmount } = useCart();
  const {
    submitSale,
    isLoading: isSubmitting,
    error,
    lastSale,
    resetSaleState,
  } = useSaleSubmit();

  // 2. Local UI State
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [paymentMethodId] = useState("cash"); // Hardcoded for MVF (Min Viable Feature)

  // 3. Handlers
  const handleAddToCart = () => {
    if (!selectedProductId) return;
    const product = products.find(p => p._id === selectedProductId);
    if (!product) return;

    addItem(product, quantity, product.clientPrice ?? 0); // Use clientPrice as default sale price
    setSelectedProductId("");
    setQuantity(1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    try {
      await submitSale({
        items: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          salePrice: i.salePrice,
        })),
        paymentMethodId,
        notes,
      });
      // On success, we don't clear cart immediately to show receipt or verify
      // But typically we show success screen then clear
    } catch (err) {
      console.error(err);
    }
  };

  const handleFinish = () => {
    clearCart();
    resetSaleState();
    setNotes("");
  };

  if (productsLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );

  // Success View (Receipt-like)
  if (lastSale?.success) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#070910] p-6 text-white">
        <div className="mb-4 rounded-full bg-green-500/10 p-4">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <h1 className="mb-2 text-3xl font-bold">¡Venta Exitosa!</h1>
        <p className="mb-8 text-gray-400">
          La transacción ha sido registrada correctamente.
        </p>

        <div className="w-full max-w-md space-y-4 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <div className="flex justify-between">
            <span className="text-gray-400">Total Pagado:</span>
            <span className="text-xl font-bold text-white">
              ${lastSale.data.totalAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Items:</span>
            <span className="text-white">{lastSale.data.totalItems}</span>
          </div>
          <div className="border-t border-gray-700 pt-4">
            <p className="text-center text-xs text-gray-500">
              ID Transacción: {lastSale.data.saleGroupId}
            </p>
          </div>
        </div>

        <button
          onClick={handleFinish}
          className="mt-8 rounded-lg bg-purple-600 px-8 py-3 font-bold transition hover:bg-purple-700"
        >
          Nueva Venta
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070910] p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Product Selection */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h1 className="text-3xl font-bold">Registrar Venta</h1>
            <p className="mt-1 text-gray-400">V2 Atomic Transaction System</p>
          </div>

          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/30 p-6 backdrop-blur-sm">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <Plus className="h-5 w-5 text-purple-400" /> Agregar Producto
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="md:col-span-3">
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Seleccionar Producto...</option>
                  {products.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.name} - ${p.clientPrice} (Stock: {p.totalStock})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!selectedProductId}
              className="mt-4 w-full rounded-lg bg-gray-700 py-3 font-medium text-white transition hover:bg-gray-600 disabled:opacity-50"
            >
              Agregar al Carrito
            </button>
          </div>

          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/30 p-6">
            <h2 className="mb-4 text-xl font-semibold">
              Notas / Observaciones
            </h2>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="h-24 w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Notas opcionales para esta venta..."
            />
          </div>
        </div>

        {/* Right Column: Cart & Checkout */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-2xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
              <ShoppingCart className="h-5 w-5 text-purple-400" /> Carrito (
              {items.length})
            </h2>

            {items.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-700 py-12 text-center text-gray-500">
                Tu carrito está vacío
              </div>
            ) : (
              <div className="mb-6 max-h-[400px] space-y-4 overflow-y-auto pr-2">
                {items.map(item => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-900/40 p-3"
                  >
                    <div>
                      <p className="font-medium text-white">{item.name}</p>
                      <p className="text-sm text-gray-400">
                        {item.quantity} x ${item.salePrice.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="ml-2 font-bold text-purple-300">
                        ${item.subtotal.toLocaleString()}
                      </span>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4 border-t border-gray-700 pt-4">
              <div className="flex items-end justify-between">
                <span className="text-gray-400">Total a Pagar</span>
                <span className="text-3xl font-bold text-white">
                  ${totalAmount.toLocaleString()}
                </span>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={items.length === 0 || isSubmitting}
                className="bg-linear-to-r w-full transform rounded-xl from-purple-600 to-pink-600 py-4 font-bold text-white shadow-lg shadow-purple-900/20 transition hover:from-purple-700 hover:to-pink-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? "Procesando..."
                  : `Confirmar Venta ($${totalAmount.toLocaleString()})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
