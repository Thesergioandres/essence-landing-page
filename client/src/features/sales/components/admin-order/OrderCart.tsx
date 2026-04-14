/**
 * Order Cart Component
 * Advanced cart with editable prices, quantity controls, and profit calculations
 */

import { Edit2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import type { OrderItem } from "../../types/admin-order.types";

interface OrderCartProps {
  items: OrderItem[];
  onUpdateItem: (
    itemId: string,
    updates: { quantity?: number; unitPrice?: number }
  ) => void;
  onRemoveItem: (itemId: string) => void;
  multiplierBadges?: Record<string, string[]>;
  isEmployeeSale?: boolean;
}

export function OrderCart({
  items,
  onUpdateItem,
  onRemoveItem,
  multiplierBadges,
  isEmployeeSale,
}: OrderCartProps) {
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState("");
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>(
    {}
  );

  const handlePriceEdit = (item: OrderItem) => {
    setEditingPrice(item.id);
    setTempPrice(item.unitPrice.toString());
  };

  const handlePriceSave = (itemId: string) => {
    const newPrice = parseFloat(tempPrice);
    if (!isNaN(newPrice) && newPrice > 0) {
      onUpdateItem(itemId, { unitPrice: newPrice });
    }
    setEditingPrice(null);
    setTempPrice("");
  };

  const handleQuantityChange = (item: OrderItem, delta: number) => {
    const newQty = Math.max(
      1,
      Math.min(item.quantity + delta, item.availableStock)
    );
    onUpdateItem(item.id, { quantity: newQty });
    setQuantityInputs(prev => {
      if (!prev[item.id]) return prev;
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  };

  const handleQuantityInputChange = (item: OrderItem, value: string) => {
    setQuantityInputs(prev => ({ ...prev, [item.id]: value }));

    if (value.trim() === "") return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const nextQty = Math.max(1, Math.min(parsed, item.availableStock));
    onUpdateItem(item.id, { quantity: nextQty });
  };

  const handleQuantityBlur = (item: OrderItem) => {
    const raw = quantityInputs[item.id];
    if (typeof raw === "undefined") return;

    if (raw.trim() === "") {
      onUpdateItem(item.id, { quantity: 1 });
    } else {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        const nextQty = Math.max(1, Math.min(parsed, item.availableStock));
        onUpdateItem(item.id, { quantity: nextQty });
      } else {
        onUpdateItem(item.id, { quantity: 1 });
      }
    }

    setQuantityInputs(prev => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-700 py-12 text-center">
        <ShoppingCart className="mb-3 h-12 w-12 text-gray-600" />
        <p className="text-gray-500">El carrito está vacío</p>
        <p className="mt-1 text-sm text-gray-600">
          Selecciona productos del inventario
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <div
          key={item.id}
          className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4"
        >
          {/* Product Header */}
          <div className="mb-3 flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h4 className="truncate font-medium text-white">
                {item.productName}
              </h4>
              <p className="text-xs text-gray-500">
                {item.category || "Sin categoría"}
              </p>
              {multiplierBadges?.[item.productId]?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {multiplierBadges[item.productId].map((badge, index) => (
                    <span
                      key={`${item.productId}-bonus-${index}`}
                      className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-200"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onRemoveItem(item.id)}
              className="ml-2 rounded-lg p-1.5 text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Quantity & Price Row */}
          <div className="mb-3 grid grid-cols-2 gap-4">
            {/* Quantity Controls */}
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Cantidad
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(item, -1)}
                  disabled={item.quantity <= 1}
                  className="rounded-lg border border-gray-600 bg-gray-700 p-1.5 transition hover:bg-gray-600 disabled:opacity-50"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={item.availableStock}
                  value={
                    Object.prototype.hasOwnProperty.call(
                      quantityInputs,
                      item.id
                    )
                      ? quantityInputs[item.id]
                      : String(item.quantity)
                  }
                  onChange={e =>
                    handleQuantityInputChange(item, e.target.value)
                  }
                  onBlur={() => handleQuantityBlur(item)}
                  className="w-14 rounded-lg border border-gray-600 bg-gray-800/60 px-2 py-1 text-center text-base font-bold text-white outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => handleQuantityChange(item, 1)}
                  disabled={item.quantity >= item.availableStock}
                  className="rounded-lg border border-gray-600 bg-gray-700 p-1.5 transition hover:bg-gray-600 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Stock disponible: {item.availableStock}
              </p>
            </div>

            {/* Price Editor */}
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Precio Unit.
              </label>
              {editingPrice === item.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={tempPrice}
                    onChange={e => setTempPrice(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") handlePriceSave(item.id);
                      if (e.key === "Escape") setEditingPrice(null);
                    }}
                    className="w-24 rounded-lg border border-purple-500 bg-gray-900 px-3 py-1.5 text-white outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handlePriceSave(item.id)}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handlePriceEdit(item)}
                  className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-700/50 px-3 py-1.5 text-white transition hover:border-purple-500"
                >
                  <span className="font-bold">
                    ${item.unitPrice.toLocaleString()}
                  </span>
                  <Edit2 className="h-3 w-3 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Calculations Row */}
          <div className="flex items-center justify-between rounded-lg bg-gray-900/50 px-3 py-2">
            <div className="text-sm">
              <span className="text-gray-400">Subtotal: </span>
              <span className="font-bold text-white">
                ${item.subtotal.toLocaleString()}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-400">
                {isEmployeeSale ? "Comision: " : "Ganancia: "}
              </span>
              <span
                className={`font-bold ${
                  item.grossProfit >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                ${item.grossProfit.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
