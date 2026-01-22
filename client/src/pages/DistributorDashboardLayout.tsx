import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authService } from "../api/services.ts";
import BusinessGate from "../components/BusinessGate";
import BusinessSelector from "../components/BusinessSelector";
import FeatureNavLink from "../components/FeatureNavLink";
import ReportIssueButton from "../components/ReportIssueButton";

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
    <div className="bg-linear-to-br min-h-screen from-gray-900 via-blue-900 to-gray-900">
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
                <h1 className="bg-linear-to-r from-blue-400 to-cyan-400 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
                  ESSENCE
                </h1>
                <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">
                  Panel Distribuidor
                </p>
              </div>
            </div>
            <BusinessSelector />
          </div>

          {/* Navigation - Scrollable */}
          <nav
            className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent flex-1 space-y-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
            style={{
              maxHeight: "calc(100vh - 200px)",
              WebkitOverflowScrolling: "touch",
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
              to="/distributor/share-catalog"
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
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Compartir Catálogo
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
              to="/distributor/credits"
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
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Mis Cobros
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

            <FeatureNavLink
              to="/distributor/defective-reports"
              feature="defectiveProducts"
              className={(isActive: boolean): string =>
                navLinkClasses(isActive)
              }
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
            </FeatureNavLink>
          </nav>

          {/* User Info & Logout - Always visible */}
          <div className="shrink-0 border-t border-gray-700 bg-gray-800/90 p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-2 sm:mb-3 sm:gap-3">
              <div className="bg-linear-to-r flex h-9 w-9 shrink-0 items-center justify-center rounded-full from-blue-600 to-cyan-600 sm:h-10 sm:w-10">
                <span className="text-xs font-bold text-white sm:text-sm">
                  {user?.name?.charAt(0) || "D"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white sm:text-sm">
                  {user?.name}
                </p>
                <p className="text-[10px] text-gray-400 sm:text-xs">
                  Distribuidor
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
      <div className="mobile-header-safe fixed left-0 right-0 top-0 z-20 border-b border-gray-700 bg-gray-800/95 backdrop-blur-lg lg:hidden">
        <div className="safe-x flex h-full items-center justify-between px-3 sm:px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-2 p-2 text-gray-300 transition hover:text-blue-400 active:scale-95"
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
          <h1 className="bg-linear-to-r from-blue-400 to-cyan-400 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
            ESSENCE
          </h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Main Content */}
      <main className="content-with-safe-header min-h-screen lg:ml-72 lg:pt-0">
        <div className="safe-x p-3 sm:p-4 md:p-6 lg:p-8">
          <BusinessGate>
            <Outlet />
          </BusinessGate>
        </div>
      </main>

      <ReportIssueButton />
    </div>
  );
}
