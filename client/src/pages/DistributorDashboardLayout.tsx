import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authService } from "../api/services.ts";

const navLinkClasses = (isActive: boolean): string =>
  [
    "flex items-center gap-2 sm:gap-3 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 transition text-xs sm:text-sm min-h-11",
    isActive
      ? "bg-blue-600/30 text-white shadow-lg shadow-blue-600/20"
      : "text-gray-300 hover:bg-blue-600/20 hover:text-blue-400 active:scale-95",
  ].join(" ");

export default function DistributorDashboardLayout() {
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
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 z-40 h-screen w-72 border-r border-gray-700 bg-gray-800/95 backdrop-blur-lg transition-transform duration-300 lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="flex h-full flex-col overflow-hidden">
          {/* Logo */}
          <div className="shrink-0 px-4 py-4 sm:py-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <img 
                src="/logo-essence.svg" 
                alt="Essence Logo" 
                className="h-10 w-10 sm:h-12 sm:w-12 drop-shadow-lg"
              />
              <div>
                <h1 className="bg-linear-to-r from-blue-400 to-cyan-400 bg-clip-text text-2xl sm:text-3xl font-bold text-transparent">
                  ESSENCE
                </h1>
                <p className="mt-0.5 text-xs sm:text-sm text-gray-400">Panel Distribuidor</p>
              </div>
            </div>
          </div>

          {/* Navigation - Scrollable */}
          <nav className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
            style={{ 
              maxHeight: 'calc(100vh - 200px)',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <NavLink
              to="/distributor/dashboard"
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
              to="/distributor/products"
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
              Mis Productos
            </NavLink>

            <NavLink
              to="/distributor/catalog"
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
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                />
              </svg>
              Mi Catálogo
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
              to="/distributor/transfer-stock"
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
              Transferir Inventario
            </NavLink>

            <NavLink
              to="/distributor/register-sale"
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
              Registrar Venta
            </NavLink>

            <NavLink
              to="/distributor/sales"
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              Mis Ventas
            </NavLink>

            <NavLink
              to="/distributor/stats"
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
              Estadísticas
            </NavLink>

            <NavLink
              to="/distributor/defective-reports"
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
          </nav>

          {/* User Info & Logout - Always visible */}
          <div className="shrink-0 border-t border-gray-700 p-3 sm:p-4 bg-gray-800/90">
            <div className="mb-2 sm:mb-3 flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-linear-to-r from-blue-600 to-cyan-600 shrink-0">
                <span className="text-xs sm:text-sm font-bold text-white">
                  {user?.name?.charAt(0) || "D"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-[10px] sm:text-xs text-gray-400">Distribuidor</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600/20 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-red-400 transition hover:bg-red-600/30 active:scale-[0.98] min-h-11"
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-gray-800/95 backdrop-blur-lg border-b border-gray-700 h-14">
        <div className="flex items-center justify-between px-3 sm:px-4 h-full">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-300 hover:text-blue-400 transition active:scale-95 -ml-2"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="bg-linear-to-r from-blue-400 to-cyan-400 bg-clip-text text-lg sm:text-xl font-bold text-transparent">
            ESSENCE
          </h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen pt-14 lg:pt-0">
        <div className="p-3 sm:p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
