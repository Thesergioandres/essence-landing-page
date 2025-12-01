import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  analyticsService,
  categoryService,
  distributorService,
  productService,
  saleService,
  stockService,
} from "../api/services.ts";
import type { Category, MonthlyProfitData, Product, User } from "../types";

export default function Dashboard() {
  interface DashboardStats {
    totalProducts: number;
    totalCategories: number;
    lowStockProducts: number;
    featuredProducts: number;
    totalDistributors: number;
    activeDistributors: number;
    totalAlerts: number;
    totalSales: number;
    totalRevenue: number;
    categoryStats: Array<{ category: Category; count: number }>;
    recentProducts: Product[];
  }

  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalCategories: 0,
    lowStockProducts: 0,
    featuredProducts: 0,
    totalDistributors: 0,
    activeDistributors: 0,
    totalAlerts: 0,
    totalSales: 0,
    totalRevenue: 0,
    categoryStats: [],
    recentProducts: [],
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyProfitData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [fixingAdminSales, setFixingAdminSales] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const handleFixAdminSales = async () => {
    if (!confirm("¿Actualizar ventas admin?\n\n• Confirmar ventas pendientes\n• Recalcular ganancias correctamente\n• Mover solo ventas del MES ANTERIOR al mes actual\n\nNOTA: No afecta el histórico de ventas antiguas.")) {
      return;
    }

    try {
      setFixingAdminSales(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/sales/fix-admin-sales`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json"
        }
      });
      
      const data = await response.json();
      
      let message = `✅ ${data.message}\n\n`;
      message += `📊 Resumen:\n`;
      message += `• Total ventas admin: ${data.totalAdminSales}\n`;
      message += `• Confirmadas: ${data.confirmed}\n`;
      message += `• Pendientes: ${data.pending}\n`;
      message += `• Actualizadas: ${data.updated}\n`;
      if (data.datesUpdated > 0) {
        message += `• Fechas actualizadas: ${data.datesUpdated}\n`;
      }
      message += `\n${data.note}`;
      
      alert(message);
      
      // Recargar stats
      await loadStats();
    } catch (error) {
      console.error("Error actualizando ventas:", error);
      alert("❌ Error al actualizar ventas admin");
    } finally {
      setFixingAdminSales(false);
    }
  };

  const loadStats = async () => {
    try {
      const [products, categories, distributors, alerts, salesData, monthly] =
        await Promise.all([
          productService.getAll(),
          categoryService.getAll(),
          distributorService.getAll(),
          stockService.getAlerts(),
          saleService.getAllSales(),
          analyticsService.getMonthlyProfit(),
        ]);

      setMonthlyData(monthly);

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
        .map((cat: Category) => ({
          category: cat,
          count: categoryCount[cat._id] || 0,
        }))
        .sort(
          (a: { count: number }, b: { count: number }) => b.count - a.count
        );

      // Productos con stock bajo en bodega
      const lowStockProducts = products.filter(
        (p: Product) => (p.warehouseStock || 0) <= (p.lowStockAlert || 0)
      ).length;

      // Productos destacados
      const featuredProducts = products.filter(
        (p: Product) => p.featured
      ).length;

      // Distribuidores activos
      const activeDistributors = distributors.filter(
        (d: User) => d.active
      ).length;

      // Total de alertas (bodega + distribuidores)
      const totalAlerts =
        alerts.warehouseAlerts.length + alerts.distributorAlerts.length;

      setStats({
        totalProducts: products.length,
        totalCategories: categories.length,
        lowStockProducts,
        featuredProducts,
        totalDistributors: distributors.length,
        activeDistributors,
        totalAlerts,
        totalSales: salesData.stats.totalSales,
        totalRevenue: salesData.stats.totalRevenue,
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
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-400 sm:mt-2 sm:text-base">
            Vista general de tu catálogo de productos
          </p>
        </div>
        <button
          onClick={handleFixAdminSales}
          disabled={fixingAdminSales}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          title="Actualizar ventas admin y recalcular ganancias"
        >
          {fixingAdminSales ? "Actualizando..." : "🔧 Fix Ventas Admin"}
        </button>
      </div>

      {/* Resumen Financiero Mensual */}
      {monthlyData && (
        <div className="rounded-lg border border-gray-700 bg-gradient-to-br from-green-900/50 to-gray-800/50 p-4 backdrop-blur-lg sm:rounded-xl sm:p-6">
          <h2 className="mb-3 text-lg font-bold text-white sm:mb-4 sm:text-xl md:text-2xl">
            💰 Resumen del Mes
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <div>
              <p className="text-xs text-gray-400 sm:text-sm">Ganancia Total</p>
              <p className="mt-1 text-lg font-bold text-green-400 sm:mt-2 sm:text-xl md:text-2xl">
                {new Intl.NumberFormat("es-MX", {
                  style: "currency",
                  currency: "MXN",
                }).format(monthlyData.currentMonth.totalProfit)}
              </p>
              <p
                className={`mt-1 text-[10px] sm:text-xs ${monthlyData.growthPercentage >= 0 ? "text-green-500" : "text-red-500"}`}
              >
                {monthlyData.growthPercentage >= 0 ? "+" : ""}
                {monthlyData.growthPercentage.toFixed(2)}% vs mes anterior
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 sm:text-sm">Ingresos</p>
              <p className="mt-1 text-lg font-bold text-blue-400 sm:mt-2 sm:text-xl md:text-2xl">
                {new Intl.NumberFormat("es-MX", {
                  style: "currency",
                  currency: "MXN",
                }).format(monthlyData.currentMonth.revenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 sm:text-sm">Ventas</p>
              <p className="mt-1 text-lg font-bold text-purple-400 sm:mt-2 sm:text-xl md:text-2xl">
                {monthlyData.currentMonth.salesCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 sm:text-sm">
                Ticket Promedio
              </p>
              <p className="mt-1 text-lg font-bold text-orange-400 sm:mt-2 sm:text-xl md:text-2xl">
                {new Intl.NumberFormat("es-MX", {
                  style: "currency",
                  currency: "MXN",
                }).format(monthlyData.averageTicket)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
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

        {/* Total Distributors */}
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-blue-900/50 to-gray-800/50 p-6 backdrop-blur-lg transition hover:border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Distribuidores</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {stats.totalDistributors}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {stats.activeDistributors} activos
              </p>
            </div>
            <div className="rounded-full bg-blue-600/20 p-3">
              <svg
                className="h-8 w-8 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Sales */}
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-green-900/50 to-gray-800/50 p-6 backdrop-blur-lg transition hover:border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Ventas Totales</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {stats.totalSales}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                ${new Intl.NumberFormat("es-CO").format(stats.totalRevenue)}
              </p>
            </div>
            <div className="rounded-full bg-green-600/20 p-3">
              <svg
                className="h-8 w-8 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Stock Alerts */}
        <div
          className="cursor-pointer rounded-xl border border-gray-700 bg-gradient-to-br from-red-900/50 to-gray-800/50 p-6 backdrop-blur-lg transition hover:border-red-500"
          onClick={() => navigate("/admin/stock-management")}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Alertas de Stock</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {stats.totalAlerts}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {stats.lowStockProducts} productos en bodega
              </p>
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
                    $
                    {new Intl.NumberFormat("es-CO").format(
                      product.distributorPrice || 0
                    )}
                  </p>
                  <p className="text-sm text-gray-400">
                    Stock: {product.totalStock || 0}
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
