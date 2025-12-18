import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authService } from "../api/services.ts";

const navLinkClasses = (isActive: boolean): string =>
  [
    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition text-sm",
    isActive
      ? "bg-purple-600/30 text-white shadow-lg shadow-purple-600/20"
      : "text-gray-300 hover:bg-purple-600/20 hover:text-purple-400",
  ].join(" ");

export default function DashboardLayout() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    authService.logout();
    navigate("/login");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="bg-linear-to-br min-h-screen from-gray-900 via-purple-900 to-gray-900">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-72 border-r border-gray-700 bg-gray-800/95 backdrop-blur-lg transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* Logo */}
          <div className="shrink-0 border-b border-gray-700 px-4 py-4 sm:py-6">
            <div className="flex items-center gap-3">
              <img
                src="/logo-essence.svg"
                alt="Essence Logo"
                className="h-10 w-10 drop-shadow-lg sm:h-12 sm:w-12"
              />
              <div>
                <h1 className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
                  ESSENCE
                </h1>
                <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">
                  Panel Admin
                </p>
              </div>
            </div>
          </div>

          {/* Navigation - Scrollable with better mobile handling */}
          <nav
            className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent flex-1 space-y-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
            style={{
              maxHeight: "calc(100vh - 200px)",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <NavLink
              to="/admin/register-sale"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Registrar Venta (Admin)
            </NavLink>
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Dashboard
            </NavLink>

            <NavLink
              to="/admin/products"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              Productos
            </NavLink>

            <NavLink
              to="/admin/categories"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              Categorías
            </NavLink>

            <NavLink
              to="/catalog"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Catálogo Completo
            </NavLink>

            <NavLink
              to="/admin/distributors"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Distribuidores
            </NavLink>

            <NavLink
              to="/admin/stock-management"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              Gestión de Stock
            </NavLink>

            <NavLink
              to="/admin/transfer-history"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              Historial de Transferencias
            </NavLink>

            <NavLink
              to="/admin/sales"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Ventas
            </NavLink>

            <NavLink
              to="/admin/expenses"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-10V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Gastos
            </NavLink>

            <NavLink
              to="/admin/special-sales"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
              Ventas Especiales
            </NavLink>

            <NavLink
              to="/admin/profit-history"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Historial de Ganancias
            </NavLink>

            <NavLink
              to="/admin/analytics"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Análisis
            </NavLink>

            <NavLink
              to="/admin/advanced-analytics"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
              Analíticas Avanzadas
            </NavLink>

            <NavLink
              to="/admin/business-assistant"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M9.663 17h4.673M12 3a7 7 0 00-4 12.742V17a2 2 0 002 2h4a2 2 0 002-2v-1.258A7 7 0 0012 3z"
                />
              </svg>
              Business Assistant
            </NavLink>

            <NavLink
              to="/admin/audit-logs"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Auditoría
            </NavLink>

            <NavLink
              to="/admin/rankings"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
              Rankings
            </NavLink>

            <NavLink
              to="/admin/gamification-config"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Config. Gamificación
            </NavLink>

            <NavLink
              to="/admin/defective-products"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Productos Defectuosos
            </NavLink>

            <NavLink
              to="/admin/add-product"
              className={({ isActive }): string => navLinkClasses(isActive)}
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Agregar Producto
            </NavLink>
          </nav>

          {/* User Info & Logout - Always visible at bottom */}
          <div className="shrink-0 border-t border-gray-700 bg-gray-800/90 p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-2 sm:mb-3 sm:gap-3">
              <div className="bg-linear-to-r flex h-9 w-9 shrink-0 items-center justify-center rounded-full from-purple-600 to-pink-600 sm:h-10 sm:w-10">
                <span className="text-xs font-bold text-white sm:text-sm">
                  {user?.name?.charAt(0) || "A"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white sm:text-sm">
                  {user?.name}
                </p>
                <p className="text-[10px] capitalize text-gray-400 sm:text-xs">
                  {user?.role}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600/20 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-600/30 active:scale-[0.98] sm:px-4 sm:py-2.5 sm:text-sm"
            >
              <svg
                className="h-4 w-4 sm:h-5 sm:w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="fixed left-0 right-0 top-0 z-20 h-14 border-b border-gray-700 bg-gray-800/95 backdrop-blur-lg lg:hidden">
        <div className="flex h-full items-center justify-between px-3 sm:px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-2 p-2 text-gray-300 transition hover:text-purple-400 active:scale-95"
            aria-label="Open menu"
          >
            <svg
              className="h-6 w-6"
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
          <h1 className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
            ESSENCE
          </h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Main Content */}
      <main className="min-h-screen pt-14 lg:ml-72 lg:pt-0">
        <div className="p-3 sm:p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
