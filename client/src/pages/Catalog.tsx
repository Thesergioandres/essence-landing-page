import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { categoryService, productService } from "../api/services";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import ProductCard from "../components/ProductCard";
import type { Category, Product } from "../types";

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || ""
  );
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "all"
  );
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "name");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, categoriesData] = await Promise.all([
          productService.getAll(),
          categoryService.getAll(),
        ]);
        setProducts(productsData.data || productsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    let filtered = [...products];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(p => p.category._id === selectedCategory);
    }

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

    setFilteredProducts(filtered);

    // Update URL params
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (sortBy !== "name") params.set("sort", sortBy);
    setSearchParams(params, { replace: true });
  }, [products, searchTerm, selectedCategory, sortBy, setSearchParams]);

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <Navbar />

      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-16 sm:py-20 md:py-24">
        {/* Header */}
        <div className="mb-6 sm:mb-8 md:mb-12 text-center">
          <h1 className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-3xl sm:text-4xl md:text-5xl font-bold text-transparent">
            Catálogo de Productos
          </h1>
          <p className="mt-2 sm:mt-3 md:mt-4 text-sm sm:text-base md:text-lg text-gray-400">
            Explora todos nuestros productos de vaping
          </p>
        </div>

        {/* Filters */}
        <div className="mb-5 sm:mb-6 md:mb-8 space-y-3 sm:space-y-4 rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-5 md:p-6 backdrop-blur-lg">
          {/* Search */}
          <div>
            <label
              htmlFor="search"
              className="mb-2 block text-sm sm:text-base font-medium text-gray-300"
            >
              Buscar
            </label>
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full rounded-lg border border-gray-600 bg-gray-700/50 px-4 py-3 sm:py-3.5 text-base text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-12"
            />
          </div>

          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            {/* Category Filter */}
            <div>
              <label
                htmlFor="category"
                className="mb-2 block text-sm sm:text-base font-medium text-gray-300"
              >
                Categoría
              </label>
              <select
                id="category"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700/50 px-4 py-3 sm:py-3.5 text-base text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-12"
              >
                <option value="all">Todas las categorías</option>
                {categories.map(cat => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label
                htmlFor="sort"
                className="mb-2 block text-sm sm:text-base font-medium text-gray-300"
              >
                Ordenar por
              </label>
              <select
                id="sort"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700/50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="name">Nombre (A-Z)</option>
                <option value="price-asc">Precio: Menor a Mayor</option>
                <option value="price-desc">Precio: Mayor a Menor</option>
                <option value="featured">Destacados</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-500"></div>
          </div>
        ) : filteredProducts.length > 0 ? (
          <>
            <p className="mb-4 sm:mb-6 text-sm sm:text-base text-gray-400">
              {filteredProducts.length} producto
              {filteredProducts.length !== 1 ? "s" : ""} encontrado
              {filteredProducts.length !== 1 ? "s" : ""}
            </p>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map(product => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          </>
        ) : (
          <div className="py-12 text-center">
            <p className="text-lg sm:text-xl text-gray-400">No se encontraron productos</p>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSortBy("name");
              }}
              className="mt-4 text-sm sm:text-base text-purple-400 hover:text-purple-300"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
