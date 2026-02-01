import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Footer from "../../../components/Footer";
import Navbar from "../../../components/Navbar";
import ProductCard from "../../../components/ProductCard";
import { productService } from "../../inventory/services";
import { useDebounce } from "../hooks";
import { LoadingSpinner } from "../../../shared/components/ui";
import type { Product } from "../../../types";

interface ProductWithStock extends Product {
  distributorStock?: number;
}

export default function DistributorCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || ""
  );
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "all"
  );
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: 0,
  });
  const [maxPrice, setMaxPrice] = useState(0);
  const hideChrome = useMemo(
    () =>
      searchParams.has("bare") ||
      (searchParams.has("category") && !searchParams.has("full")),
    [searchParams]
  );

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await productService.getDistributorProducts();
        const productsList = Array.isArray(response)
          ? response
          : response.data || [];

        setProducts(productsList);

        const maxClientPrice = Math.max(
          0,
          ...productsList.map(
            (p: ProductWithStock) => Number(p.clientPrice) || 0
          )
        );
        setMaxPrice(maxClientPrice || 0);
        setPriceRange({ min: 0, max: maxClientPrice || 0 });

        const uniqueCategories = Array.from(
          new Set(
            (productsList || []).map((p: ProductWithStock) =>
              typeof p.category === "string" ? p.category : p.category.name
            )
          )
        );
        setCategories(uniqueCategories as string[]);
      } catch (error) {
        console.error("Error al cargar productos:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term)
      );
    }

    if (selectedCategory !== "all") {
      list = list.filter(p => {
        const categoryName =
          typeof p.category === "string" ? p.category : p.category.name;
        return categoryName === selectedCategory;
      });
    }

    if (inStockOnly) {
      list = list.filter(p => (p.distributorStock ?? 0) > 0);
    }

    if (featuredOnly) {
      list = list.filter(p => p.featured);
    }

    list = list.filter(p => {
      const price = Number(p.clientPrice) || 0;
      return price >= priceRange.min && price <= priceRange.max;
    });

    switch (sortBy) {
      case "price-asc":
        list.sort((a, b) => (a.clientPrice || 0) - (b.clientPrice || 0));
        break;
      case "price-desc":
        list.sort((a, b) => (b.clientPrice || 0) - (a.clientPrice || 0));
        break;
      case "stock":
        list.sort(
          (a, b) => (b.distributorStock || 0) - (a.distributorStock || 0)
        );
        break;
      case "featured":
        list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        break;
      default:
        list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [
    products,
    debouncedSearchTerm,
    selectedCategory,
    inStockOnly,
    featuredOnly,
    priceRange,
    sortBy,
  ]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (sortBy !== "name") params.set("sort", sortBy);
    if (inStockOnly) params.set("stock", "1");
    if (featuredOnly) params.set("featured", "1");
    if (priceRange.min) params.set("min", String(priceRange.min));
    if (priceRange.max && priceRange.max !== maxPrice)
      params.set("max", String(priceRange.max));
    setSearchParams(params, { replace: true });
  }, [
    searchTerm,
    selectedCategory,
    sortBy,
    inStockOnly,
    featuredOnly,
    priceRange,
    maxPrice,
    setSearchParams,
  ]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" message="Cargando catálogo..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {!hideChrome && <Navbar />}

      {!hideChrome && (
        <header className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.25),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.25),transparent_25%),radial-gradient(circle_at_40%_80%,rgba(14,165,233,0.2),transparent_25%)]" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-[1.4fr,1fr]">
              <div className="space-y-4 sm:space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-teal-100 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400"></span>
                  </span>
                  Catálogo del distribuidor
                </div>

                <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Productos asignados, listos para vender.
                </h1>

                <p className="max-w-2xl text-base leading-relaxed text-gray-300 sm:text-lg">
                  Busca, filtra y prioriza lo que tienes en stock. Ordena por
                  precio o inventario y comparte tu catálogo con un clic.
                </p>

                <div className="flex flex-wrap gap-3">
                  <div className="rounded-full border border-teal-400/30 bg-teal-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-teal-100">
                    Filtros rápidos
                  </div>
                  <div className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100">
                    Vista grid/lista
                  </div>
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100">
                    Stock y precio
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">
                      Productos en catálogo
                    </p>
                    <p className="text-4xl font-bold text-white">
                      {products.length}
                    </p>
                  </div>
                  <div className="rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
                    Actualizado
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>Categorías</span>
                    <span className="font-semibold text-white">
                      {categories.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>Con stock</span>
                    <span className="font-semibold text-emerald-300">
                      {
                        products.filter(p => (p.distributorStock ?? 0) > 0)
                          .length
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>Valor máx. cliente</span>
                    <span className="font-semibold text-white">
                      {maxPrice ? maxPrice.toLocaleString() : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      <main
        className={`mx-auto max-w-7xl space-y-6 px-4 ${hideChrome ? "py-6" : "py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16"}`}
      >
        <div className="scrollbar-hide mb-8 overflow-x-auto">
          <div className="flex min-w-max gap-2 pb-2 sm:gap-3">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 sm:px-6 sm:py-3 sm:text-base ${
                selectedCategory === "all"
                  ? "scale-105 bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-lg shadow-teal-500/50"
                  : "border border-gray-700/50 bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              Todas
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 sm:px-6 sm:py-3 sm:text-base ${
                  selectedCategory === cat
                    ? "scale-105 bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-lg shadow-teal-500/50"
                    : "border border-gray-700/50 bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-lg sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar productos por nombre o descripción"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-gray-900/60 px-4 py-3 pl-12 text-white placeholder-gray-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                />
                <svg
                  className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <svg
                      className="h-5 w-5"
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
                )}
              </div>
            </div>

            <div className="w-full lg:w-56">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-gray-900/60 px-4 py-3 text-white focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
              >
                <option value="name">Ordenar: A-Z</option>
                <option value="price-asc">Precio: Menor a mayor</option>
                <option value="price-desc">Precio: Mayor a menor</option>
                <option value="stock">Stock: Mayor a menor</option>
                <option value="featured">Destacados primero</option>
              </select>
            </div>

            <div className="flex w-fit gap-2 rounded-xl border border-white/10 bg-gray-900/70 p-1.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-2.5 transition-all ${
                  viewMode === "grid"
                    ? "bg-teal-500 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-lg p-2.5 transition-all ${
                  viewMode === "list"
                    ? "bg-teal-500 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="flex items-center justify-between rounded-lg border border-white/10 bg-gray-900/60 px-4 py-3 text-sm text-gray-200">
              <span className="flex flex-col">
                <span className="font-semibold text-white">Solo con stock</span>
                <span className="text-xs text-gray-400">
                  Oculta asignaciones agotadas
                </span>
              </span>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={e => setInStockOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-500 text-teal-500 focus:ring-teal-500"
              />
            </label>

            <label className="flex items-center justify-between rounded-lg border border-white/10 bg-gray-900/60 px-4 py-3 text-sm text-gray-200">
              <span className="flex flex-col">
                <span className="font-semibold text-white">
                  Solo destacados
                </span>
                <span className="text-xs text-gray-400">
                  Prioriza productos destacados
                </span>
              </span>
              <input
                type="checkbox"
                checked={featuredOnly}
                onChange={e => setFeaturedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-500 text-teal-500 focus:ring-teal-500"
              />
            </label>

            <div className="rounded-lg border border-white/10 bg-gray-900/60 px-4 py-3 text-sm text-gray-200">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">Rango de precio</p>
                  <p className="text-xs text-gray-400">Precio cliente</p>
                </div>
                <span className="text-xs text-gray-400">
                  Max {maxPrice ? maxPrice.toLocaleString() : 0}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="number"
                  min={0}
                  max={priceRange.max}
                  value={priceRange.min}
                  onChange={e =>
                    setPriceRange(prev => ({
                      ...prev,
                      min: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-1/2 rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-white focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder="Mín"
                />
                <input
                  type="number"
                  min={priceRange.min}
                  max={maxPrice || undefined}
                  value={priceRange.max}
                  onChange={e =>
                    setPriceRange(prev => ({
                      ...prev,
                      max: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-1/2 rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-white focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                  placeholder="Máx"
                />
              </div>
            </div>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-gray-300">
            <svg
              className="mb-4 h-10 w-10 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 13h6m-6 4h6M5 7h.01M19 7h.01M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z"
              />
            </svg>
            <p className="text-xl font-semibold text-white">Sin resultados</p>
            <p className="mt-2 text-sm text-gray-400">
              Ajusta los filtros o busca por otro término.
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-6 ${
              viewMode === "grid"
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1"
            }`}
          >
            {filteredProducts.map(product => (
              <ProductCard
                key={product._id}
                product={product}
                viewMode={viewMode}
                showDistributorPrice={true}
              />
            ))}
          </div>
        )}
      </main>

      {!hideChrome && <Footer />}
    </div>
  );
}
