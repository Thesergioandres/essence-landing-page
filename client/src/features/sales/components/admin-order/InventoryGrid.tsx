/**
 * Inventory Grid Component
 * Shows available products with stock for quick selection
 */

import { AlertTriangle, Package, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  LocationType,
  ProductWithStock,
} from "../../types/admin-order.types";

const sanitizeIdString = (raw: string): string | null => {
  const trimmed = String(raw || "").trim();
  if (
    !trimmed ||
    trimmed === "[object Object]" ||
    trimmed === "undefined" ||
    trimmed === "null"
  ) {
    return null;
  }

  const objectIdMatch = trimmed.match(/[a-fA-F0-9]{24}/);
  if (objectIdMatch) {
    return objectIdMatch[0].toLowerCase();
  }

  return trimmed;
};

const resolveEntityId = (value: unknown): string | null => {
  if (typeof value === "string") {
    return sanitizeIdString(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    _id?: unknown;
    id?: unknown;
    $oid?: unknown;
    oid?: unknown;
    toHexString?: () => string;
    toString?: () => string;
  };

  const fromToHex =
    typeof candidate.toHexString === "function"
      ? sanitizeIdString(candidate.toHexString())
      : null;

  const nested =
    resolveEntityId(candidate._id) ||
    resolveEntityId(candidate.id) ||
    resolveEntityId(candidate.$oid) ||
    resolveEntityId(candidate.oid);

  if (fromToHex) {
    return fromToHex;
  }

  if (nested) {
    return nested;
  }

  if (typeof candidate.toString === "function") {
    return sanitizeIdString(candidate.toString());
  }

  return null;
};

const toStableProductKey = (
  product: ProductWithStock,
  index: number
): string => {
  const resolvedId = resolveEntityId(product._id);
  if (resolvedId) {
    return resolvedId;
  }

  const categoryName =
    typeof product.category === "object"
      ? product.category?.name || "uncategorized"
      : product.category || "uncategorized";

  return `${product.name}-${categoryName}-${index}`;
};

interface InventoryGridProps {
  products: ProductWithStock[];
  locationType: LocationType;
  loading?: boolean;
  onAddProduct: (product: ProductWithStock, quantity: number) => void;
}

export function InventoryGrid({
  products,
  locationType,
  loading,
  onAddProduct,
}: InventoryGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      const catName =
        typeof p.category === "object" ? p.category?.name : p.category;
      if (catName) cats.add(catName);
    });
    return Array.from(cats);
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const term = normalize(searchTerm);

    return products.filter(p => {
      // Setup detailed matching
      const name = normalize(p.name);
      // const sku = p.sku ? normalize(p.sku) : ""; // TODO: Add SKU to types
      const catName =
        typeof p.category === "object" ? p.category?.name : p.category;

      const matchesSearch = name.includes(term);
      const matchesCategory =
        selectedCategory === "all" || catName === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Get stock for current location
  const getStock = (product: ProductWithStock) => {
    if (locationType === "warehouse") {
      return product.warehouseStock || 0;
    }
    if (locationType === "employee") {
      return product.employeeStock || 0;
    }
    return product.branchStock ?? product.totalStock ?? 0;
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-700/50 bg-gray-800/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Package className="h-5 w-5 text-purple-400" />
        Inventario Disponible
      </h3>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-2 text-white placeholder-gray-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        />
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-2 text-white outline-none focus:border-purple-500"
        >
          <option value="all">Todas las categorías</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      <div className="grid max-h-[400px] gap-3 overflow-y-auto pr-2 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.map((product, index) => {
          const stock = getStock(product);
          const isLowStock = stock > 0 && stock <= 5;
          const isOutOfStock = stock <= 0;

          return (
            <div
              key={toStableProductKey(product, index)}
              className={`relative rounded-lg border p-3 transition ${
                isOutOfStock
                  ? "border-gray-700 bg-gray-800/20 opacity-50"
                  : "border-gray-700 bg-gray-800/50 hover:border-purple-500/50"
              }`}
            >
              {/* Product Image */}
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {product.image?.url ? (
                    <img
                      src={product.image.url}
                      alt={product.name}
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700">
                      <Package className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-medium text-white">
                      {product.name}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {(typeof product.category === "object"
                        ? product.category?.name
                        : product.category) || "Sin categoría"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Price & Stock */}
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-bold text-green-400">
                  ${product.clientPrice.toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  {isLowStock && (
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  )}
                  <span
                    className={`text-xs ${
                      isOutOfStock
                        ? "text-red-400"
                        : isLowStock
                          ? "text-yellow-400"
                          : "text-gray-400"
                    }`}
                  >
                    Stock: {stock}
                  </span>
                </div>
              </div>

              {/* Add Button */}
              <button
                type="button"
                onClick={() => onAddProduct(product, 1)}
                disabled={isOutOfStock}
                className="flex w-full items-center justify-center gap-1 rounded-lg bg-purple-600/20 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="flex h-32 items-center justify-center text-gray-500">
          No se encontraron productos
        </div>
      )}
    </div>
  );
}
