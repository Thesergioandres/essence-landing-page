import {
  Check,
  ChevronDown,
  Loader2,
  Package,
  Search,
  SortAsc,
  SortDesc,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { categoryService, productService } from "../api/services";

interface Product {
  _id: string;
  name: string;
  category?: { _id: string; name: string } | string;
  totalStock?: number;
  purchasePrice?: number;
  suggestedPrice?: number;
  image?: { url: string };
}

interface Category {
  _id: string;
  name: string;
}

type SortOption =
  | "name-asc"
  | "name-desc"
  | "stock-asc"
  | "stock-desc"
  | "price-asc"
  | "price-desc";

interface ProductSelectorProps {
  value: string;
  onChange: (productId: string, product?: Product) => void;
  placeholder?: string;
  disabled?: boolean;
  showStock?: boolean;
  className?: string;
  excludeProductIds?: string[]; // IDs de productos a excluir del selector
}

export default function ProductSelector({
  value,
  onChange,
  placeholder = "Seleccionar producto...",
  disabled = false,
  showStock = true,
  className = "",
  excludeProductIds = [],
}: ProductSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [showFilters, setShowFilters] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar productos y categorías
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        productService.getAll({ limit: 1000 }),
        categoryService.getAll(),
      ]);
      setProducts((productsRes.data || []) as Product[]);
      setCategories(categoriesRes || []);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Enfocar búsqueda al abrir
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Producto seleccionado
  const selectedProduct = useMemo(
    () => products.find(p => p._id === value),
    [products, value]
  );

  // Obtener nombre de categoría
  const getCategoryName = (product: Product): string => {
    if (!product.category) return "";
    if (typeof product.category === "string") {
      const cat = categories.find(c => c._id === product.category);
      return cat?.name || "";
    }
    return product.category.name || "";
  };

  const getCategoryId = (product: Product): string => {
    if (!product.category) return "";
    if (typeof product.category === "string") return product.category;
    return product.category._id || "";
  };

  // Filtrar y ordenar productos
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Excluir productos ya agregados
    if (excludeProductIds.length > 0) {
      result = result.filter(p => !excludeProductIds.includes(p._id));
    }

    // Filtrar por búsqueda
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        p =>
          p.name.toLowerCase().includes(searchLower) ||
          getCategoryName(p).toLowerCase().includes(searchLower)
      );
    }

    // Filtrar por categoría
    if (selectedCategory) {
      result = result.filter(p => getCategoryId(p) === selectedCategory);
    }

    // Ordenar
    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "stock-asc":
          return (a.totalStock || 0) - (b.totalStock || 0);
        case "stock-desc":
          return (b.totalStock || 0) - (a.totalStock || 0);
        case "price-asc":
          return (a.suggestedPrice || 0) - (b.suggestedPrice || 0);
        case "price-desc":
          return (b.suggestedPrice || 0) - (a.suggestedPrice || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [
    products,
    search,
    selectedCategory,
    sortBy,
    categories,
    excludeProductIds,
  ]);

  const handleSelect = (product: Product) => {
    onChange(product._id, product);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("", undefined);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex w-full items-center justify-between rounded-lg border bg-gray-700 px-3 py-2.5 text-left transition ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:border-purple-500"
        } ${isOpen ? "border-purple-500 ring-2 ring-purple-500/20" : "border-gray-600"}`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {selectedProduct ? (
            <>
              {selectedProduct.image?.url ? (
                <img
                  src={selectedProduct.image.url}
                  alt=""
                  className="h-6 w-6 rounded object-cover"
                />
              ) : (
                <Package className="h-5 w-5 text-gray-400" />
              )}
              <span className="truncate text-white">
                {selectedProduct.name}
              </span>
              {showStock && (
                <span
                  className={`ml-1 text-xs ${
                    (selectedProduct.totalStock || 0) > 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  ({selectedProduct.totalStock || 0})
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 hover:bg-gray-600"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
          <ChevronDown
            className={`h-5 w-5 text-gray-400 transition ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 shadow-xl">
          {/* Search */}
          <div className="border-b border-gray-700 p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full rounded-lg border border-gray-600 bg-gray-700 py-2 pl-9 pr-4 text-sm text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Filters Toggle */}
          <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
            >
              {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
              <ChevronDown
                className={`h-3 w-3 transition ${showFilters ? "rotate-180" : ""}`}
              />
            </button>
            <span className="text-xs text-gray-500">
              {filteredProducts.length} productos
            </span>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="space-y-2 border-b border-gray-700 p-2">
              {/* Category Filter */}
              <div>
                <label className="mb-1 block text-xs text-gray-400">
                  Categoría
                </label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="mb-1 block text-xs text-gray-400">
                  Ordenar por
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setSortBy(
                        sortBy === "name-asc" ? "name-desc" : "name-asc"
                      )
                    }
                    className={`flex items-center justify-center gap-1 rounded border px-2 py-1.5 text-xs transition ${
                      sortBy.startsWith("name")
                        ? "border-purple-500 bg-purple-500/20 text-purple-300"
                        : "border-gray-600 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    Nombre
                    {sortBy === "name-asc" ? (
                      <SortAsc className="h-3 w-3" />
                    ) : sortBy === "name-desc" ? (
                      <SortDesc className="h-3 w-3" />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSortBy(
                        sortBy === "stock-desc" ? "stock-asc" : "stock-desc"
                      )
                    }
                    className={`flex items-center justify-center gap-1 rounded border px-2 py-1.5 text-xs transition ${
                      sortBy.startsWith("stock")
                        ? "border-purple-500 bg-purple-500/20 text-purple-300"
                        : "border-gray-600 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    Stock
                    {sortBy === "stock-asc" ? (
                      <SortAsc className="h-3 w-3" />
                    ) : sortBy === "stock-desc" ? (
                      <SortDesc className="h-3 w-3" />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSortBy(
                        sortBy === "price-asc" ? "price-desc" : "price-asc"
                      )
                    }
                    className={`flex items-center justify-center gap-1 rounded border px-2 py-1.5 text-xs transition ${
                      sortBy.startsWith("price")
                        ? "border-purple-500 bg-purple-500/20 text-purple-300"
                        : "border-gray-600 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    Precio
                    {sortBy === "price-asc" ? (
                      <SortAsc className="h-3 w-3" />
                    ) : sortBy === "price-desc" ? (
                      <SortDesc className="h-3 w-3" />
                    ) : null}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Products List */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                No se encontraron productos
              </div>
            ) : (
              <div className="py-1">
                {filteredProducts.map(product => (
                  <button
                    key={product._id}
                    type="button"
                    onClick={() => handleSelect(product)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-gray-700 ${
                      value === product._id ? "bg-purple-500/20" : ""
                    }`}
                  >
                    {product.image?.url ? (
                      <img
                        src={product.image.url}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-700">
                        <Package className="h-4 w-4 text-gray-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-white">
                          {product.name}
                        </span>
                        {value === product._id && (
                          <Check className="h-4 w-4 text-purple-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {getCategoryName(product) && (
                          <span className="text-gray-400">
                            {getCategoryName(product)}
                          </span>
                        )}
                        {showStock && (
                          <span
                            className={
                              (product.totalStock || 0) > 0
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            Stock: {product.totalStock || 0}
                          </span>
                        )}
                      </div>
                    </div>
                    {product.suggestedPrice && (
                      <span className="text-sm text-gray-400">
                        ${product.suggestedPrice.toLocaleString()}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
