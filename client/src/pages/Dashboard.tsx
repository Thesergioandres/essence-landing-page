import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { categoryService, productService } from "../api/services.ts";
import type { Category, Product } from "../types";

export default function Dashboard() {
  interface DashboardStats {
    totalProducts: number;
    totalCategories: number;
    lowStockProducts: number;
    featuredProducts: number;
    categoryStats: Array<{ category: Category; count: number }>;
    recentProducts: Product[];
  }

  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalCategories: 0,
    lowStockProducts: 0,
    featuredProducts: 0,
    categoryStats: [],
    recentProducts: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [products, categories] = await Promise.all([
        productService.getAll(),
        categoryService.getAll(),
      ]);

      // Contar productos por categoría
      const categoryCount = products.reduce<Record<string, number>>(
        (acc, product) => {
          const categoryId =
            typeof product.category === "string"
              ? product.category
              : product.category._id;
          acc[categoryId] = (acc[categoryId] || 0) + 1;
          return acc;
        },
        {}
      );

      // Crear array de estadísticas por categoría
      const categoryStats = categories
        .map(cat => ({
          category: cat,
          count: categoryCount[cat._id] || 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Productos con stock bajo (menos de 10)
      const lowStockProducts = products.filter(p => p.stock < 10).length;

      // Productos destacados
      const featuredProducts = products.filter(p => p.featured).length;

      setStats({
        totalProducts: products.length,
        totalCategories: categories.length,
        lowStockProducts,
        featuredProducts,
        categoryStats,
        recentProducts: products.slice(0, 5),
      });
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white">Dashboard</h1>
        <p className="mt-2 text-gray-400">
          Vista general de tu catálogo de productos
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Products */}
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-purple-900/50 to-gray-800/50 p-6 backdrop-blur-lg transition hover:border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Productos</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {stats.totalProducts}
              </p>
            </div>
            <div className="rounded-full bg-purple-600/20 p-3">
              <svg
                className="h-8 w-8 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Categories */}
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-pink-900/50 to-gray-800/50 p-6 backdrop-blur-lg transition hover:border-pink-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Categorías</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {stats.totalCategories}
              </p>
            </div>
            <div className="rounded-full bg-pink-600/20 p-3">
              <svg
                className="h-8 w-8 text-pink-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Featured Products */}
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-yellow-900/50 to-gray-800/50 p-6 backdrop-blur-lg transition hover:border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Destacados</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {stats.featuredProducts}
              </p>
            </div>
            <div className="rounded-full bg-yellow-600/20 p-3">
              <svg
                className="h-8 w-8 text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Low Stock */}
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-red-900/50 to-gray-800/50 p-6 backdrop-blur-lg transition hover:border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Stock Bajo</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {stats.lowStockProducts}
              </p>
              <p className="text-xs text-gray-500">Menos de 10 unidades</p>
            </div>
            <div className="rounded-full bg-red-600/20 p-3">
              <svg
                className="h-8 w-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Stats */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 backdrop-blur-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            Productos por Categoría
          </h2>
          <button
            onClick={() => navigate("/admin/categories")}
            className="rounded-lg border border-purple-500 px-4 py-2 text-sm font-medium text-purple-400 transition hover:bg-purple-500/10"
          >
            Gestionar Categorías
          </button>
        </div>

        {stats.categoryStats.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-600 p-8 text-center">
            <p className="text-gray-400">
              No hay categorías aún.{" "}
              <button
                onClick={() => navigate("/admin/categories")}
                className="font-semibold text-purple-400 hover:text-purple-300"
              >
                Crea tu primera categoría
              </button>
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.categoryStats.map(({ category, count }) => (
              <div
                key={category._id}
                className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 transition hover:border-purple-500"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="mt-1 text-xs text-gray-500">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-2xl font-bold text-purple-400">
                      {count}
                    </p>
                    <p className="text-xs text-gray-500">
                      {count === 1 ? "producto" : "productos"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Products */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 backdrop-blur-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Productos Recientes</h2>
          <button
            onClick={() => navigate("/admin/products")}
            className="text-sm text-purple-400 hover:text-purple-300"
          >
            Ver todos →
          </button>
        </div>
        <div className="space-y-3">
          {stats.recentProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-600 p-8 text-center">
              <p className="text-gray-400">
                No hay productos aún.{" "}
                <button
                  onClick={() => navigate("/admin/add-product")}
                  className="font-semibold text-purple-400 hover:text-purple-300"
                >
                  Crea tu primer producto
                </button>
              </p>
            </div>
          ) : (
            stats.recentProducts.map(product => (
              <div
                key={product._id}
                className="flex items-center gap-4 rounded-lg border border-gray-700 bg-gray-900/50 p-4 transition hover:border-purple-500"
              >
                {product.image?.url ? (
                  <img
                    src={product.image.url}
                    alt={product.name}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-700">
                    <svg
                      className="h-8 w-8 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{product.name}</h3>
                  <p className="text-sm text-gray-400">
                    {typeof product.category === "string"
                      ? product.category
                      : product.category.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-purple-400">
                    ${product.price}
                  </p>
                  <p className="text-sm text-gray-400">
                    Stock: {product.stock}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
