import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { categoryService, productService } from "../api/services";
// Footer y Navbar ocultos para vista pública del catálogo
import Footer from "../components/Footer";
import LoadingSpinner from "../components/LoadingSpinner";
import Navbar from "../components/Navbar";
import ProductCard from "../components/ProductCard";
import { useDebounce } from "../hooks";
import type { Category, Product } from "../types";

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
  const publicBusinessId = useMemo(
    () =>
      searchParams.get("businessId") ||
      import.meta.env.VITE_PUBLIC_BUSINESS_ID ||
      null,
    [searchParams]
  );
  const hideChrome = import.meta.env.PROD
    ? true
    : searchParams.has("bare") ||
      (searchParams.has("category") && !searchParams.has("full"));
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: 0,
  });
  const [maxPrice, setMaxPrice] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, categoriesData] = await Promise.all([
          productService.getAll(
            publicBusinessId ? { businessId: publicBusinessId } : {}
          ),
          categoryService.getAll(
            publicBusinessId ? { businessId: publicBusinessId } : {}
          ),
        ]);
        const productsList = Array.isArray(productsData)
          ? productsData
          : productsData.data || [];

        setProducts(productsList);
        setCategories(categoriesData);

        const maxClientPrice = Math.max(
          0,
          ...productsList.map((p: Product) => Number(p.clientPrice) || 0)
        );
        setMaxPrice(maxClientPrice || 0);
        setPriceRange({ min: 0, max: maxClientPrice || 0 });
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [publicBusinessId]);

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Filter by search term
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term)
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(p => p.category._id === selectedCategory);
    }

    if (inStockOnly) {
      filtered = filtered.filter(p => (p.totalStock ?? 0) > 0);
    }

    if (featuredOnly) {
      filtered = filtered.filter(p => p.featured);
    }

    filtered = filtered.filter(p => {
      const price = Number(p.clientPrice) || 0;
      return price >= priceRange.min && price <= priceRange.max;
    });

    // Sort products
    switch (sortBy) {
      case "price-asc":
        filtered.sort((a, b) => (a.clientPrice || 0) - (b.clientPrice || 0));
        break;
      case "price-desc":
        filtered.sort((a, b) => (b.clientPrice || 0) - (a.clientPrice || 0));
        break;
      case "name":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "featured":
        filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        break;
    }

    return filtered;
  }, [
    products,
    debouncedSearchTerm,
    selectedCategory,
    sortBy,
    inStockOnly,
    featuredOnly,
    priceRange,
  ]);

  useEffect(() => {
    // Update URL params
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

  return (
    <div className="min-h-screen bg-gray-950">
      {!hideChrome && <Navbar />}

      {!hideChrome && (
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(88,28,135,0.35),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(219,39,119,0.35),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(59,130,246,0.25),transparent_30%)]" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-[1.4fr,1fr]">
              <div className="space-y-4 sm:space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-blue-100 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-300 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400"></span>
                  </span>
                  Nuevo catálogo inteligente
                </div>

                <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Eleva tu selección con filtros inteligentes y vista inmersiva.
                </h1>

                <p className="max-w-2xl text-base leading-relaxed text-gray-300 sm:text-lg">
                  Busca, filtra y explora productos premium con una experiencia
                  visual más cuidada. Haz foco en lo destacado, stock disponible
                  y precios al instante.
                </p>

                <div className="flex flex-wrap gap-3">
                  <div className="rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-100">
                    Filtros dinamicos
                  </div>
                  <div className="rounded-full border border-pink-400/30 bg-pink-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-pink-100">
                    Vistas grid/lista
                  </div>
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100">
                    Precios en vivo
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
                  <div className="rounded-full bg-gradient-to-r from-blue-500 to-pink-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
                    Actualizado
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>Categorias</span>
                    <span className="font-semibold text-white">
                      {categories.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>Destacados</span>
                    <span className="font-semibold text-white">
                      {products.filter(p => p.featured).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>Stock disponible</span>
                    <span className="font-semibold text-emerald-300">
                      {products.filter(p => (p.totalStock ?? 0) > 0).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`mx-auto max-w-7xl space-y-6 px-4 ${hideChrome ? "py-6" : "py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16"}`}
      >
        {/* Category Pills */}
        <div className="scrollbar-hide mb-8 overflow-x-auto">
          <div className="flex min-w-max gap-2 pb-2 sm:gap-3">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 sm:px-6 sm:py-3 sm:text-base ${
                selectedCategory === "all"
                  ? "scale-105 bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50"
                  : "border border-gray-700/50 bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              Todos
            </button>
            {categories.map((cat, index) => (
              <button
                key={cat._id}
                onClick={() => setSelectedCategory(cat._id)}
                className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 sm:px-6 sm:py-3 sm:text-base ${
                  selectedCategory === cat._id
                    ? "scale-105 bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50"
                    : "border border-gray-700/50 bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Controls */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr,1fr] lg:items-center">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
                />
              </svg>
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full rounded-xl border border-white/10 bg-gray-900/70 px-11 py-3 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="rounded-xl border border-white/10 bg-gray-900/70 px-4 py-3 text-sm text-white transition hover:border-blue-500 focus:border-blue-500 focus:outline-none"
            >
              <option value="name">Ordenar: A-Z</option>
              <option value="price-asc">Precio: Menor a Mayor</option>
              <option value="price-desc">Precio: Mayor a Menor</option>
              <option value="featured">Destacados primero</option>
            </select>

            <div className="flex rounded-xl border border-white/10 bg-gray-900/60 p-1.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-2.5 transition-all ${
                  viewMode === "grid"
                    ? "bg-blue-600 text-white shadow-lg"
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
                    ? "bg-blue-600 text-white shadow-lg"
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-gray-900/60 px-4 py-3 text-sm text-gray-200 transition hover:border-blue-500/50">
              <div>
                <p className="font-semibold text-white">Solo con stock</p>
                <p className="text-xs text-gray-400">
                  Oculta productos agotados
                </p>
              </div>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={e => setInStockOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-500 text-blue-500 focus:ring-blue-500"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-gray-900/60 px-4 py-3 text-sm text-gray-200 transition hover:border-pink-500/50">
              <div>
                <p className="font-semibold text-white">Solo destacados</p>
                <p className="text-xs text-gray-400">Prioriza lo que brilla</p>
              </div>
              <input
                type="checkbox"
                checked={featuredOnly}
                onChange={e => setFeaturedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-500 text-pink-500 focus:ring-pink-500"
              />
            </label>

            <div className="rounded-lg border border-white/10 bg-gray-900/60 px-4 py-3 text-sm text-gray-200">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">Rango de precio</p>
                  <p className="text-xs text-gray-400">Cliente</p>
                </div>
                <span className="text-xs text-gray-400">
                  Max {maxPrice ? maxPrice.toLocaleString() : 0}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex-1">
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
                    className="w-full rounded-md border border-white/10 bg-gray-800/80 px-2 py-1 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <span className="text-gray-500">-</span>
                <div className="flex-1">
                  <input
                    type="number"
                    min={priceRange.min}
                    max={maxPrice || undefined}
                    value={priceRange.max}
                    onChange={e =>
                      setPriceRange(prev => ({
                        ...prev,
                        max: Number(e.target.value) || maxPrice,
                      }))
                    }
                    className="w-full rounded-md border border-white/10 bg-gray-800/80 px-2 py-1 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Count */}
        {!loading && (
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-gray-400 sm:text-base">
              {filteredProducts.length > 0 ? (
                <>
                  <span className="font-semibold text-white">
                    {filteredProducts.length}
                  </span>{" "}
                  producto{filteredProducts.length !== 1 ? "s" : ""} encontrado
                  {filteredProducts.length !== 1 ? "s" : ""}
                </>
              ) : (
                "No se encontraron productos"
              )}
            </p>
            {(searchTerm ||
              selectedCategory !== "all" ||
              sortBy !== "name") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                  setSortBy("name");
                  setInStockOnly(false);
                  setFeaturedOnly(false);
                  setPriceRange({ min: 0, max: maxPrice });
                }}
                className="flex items-center gap-1.5 text-sm text-purple-400 transition-colors hover:text-purple-300"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* Products Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner
              size="lg"
              variant="dots"
              message="Cargando productos..."
            />
          </div>
        ) : filteredProducts.length > 0 ? (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "flex flex-col gap-4"
            }
          >
            {filteredProducts.map((product, index) => (
              <div
                key={product._id}
                className="animate-fade-in-up"
                style={{
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: "both",
                }}
              >
                <ProductCard product={product} viewMode={viewMode} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full border border-white/10 bg-white/5 p-6">
              <svg
                className="h-16 w-16 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-semibold text-white">
              No encontramos productos
            </h3>
            <p className="mb-6 text-gray-400">
              Intenta ajustar tus filtros de búsqueda
            </p>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSortBy("name");
                setInStockOnly(false);
                setFeaturedOnly(false);
                setPriceRange({ min: 0, max: maxPrice });
              }}
              className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-medium text-white transition-all hover:shadow-lg hover:shadow-purple-500/50"
            >
              Ver todos los productos
            </button>
          </div>
        )}
      </div>

      {!hideChrome && <Footer />}
    </div>
  );
}
