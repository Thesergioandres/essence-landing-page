import { AnimatePresence, m } from "framer-motion";
import { gsap } from "gsap";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import BusinessGate from "../../../components/BusinessGate";
import BusinessSelector from "../../../components/BusinessSelector";
import FeatureNavLink from "../../../components/FeatureNavLink";
import ReportIssueButton from "../../../components/ReportIssueButton";
import { useBusiness } from "../../../context/BusinessContext";
import { useBrandLogo } from "../../../hooks/useBrandLogo";
import { Button } from "../../../shared/components/ui";
import { useMotionProfile } from "../../../shared/config/motion.config";
import type { EmployeeStats } from "../../analytics/types/gamification.types";
import { authService } from "../../auth/services";
import { dispatchService } from "../../branches/services";
import { gamificationService } from "../../common/services";
import PriceCatalogModal from "../components/PriceCatalogModal";

const navLinkClasses = (isActive: boolean): string =>
  [
    "magnetic-nav-link group flex min-h-11 items-center gap-2 sm:gap-3 rounded-xl border px-3 py-2.5 text-xs transition-[border-color,background-color,color,box-shadow,transform] duration-400 sm:px-4 sm:py-3 sm:text-sm",
    isActive
      ? "border-cyan-400/55 bg-linear-to-r from-cyan-500/20 via-blue-500/15 to-white/0 text-cyan-100 shadow-[0_0_24px_rgba(56,189,248,0.3)]"
      : "border-white/0 text-gray-300 hover:border-white/15 hover:bg-white/5 hover:text-cyan-100 active:scale-[0.985]",
  ].join(" ");

export default function EmployeeDashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getCurrentUser();
  const { businessId, memberships } = useBusiness();
  const brandLogo = useBrandLogo();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : true
  );
  const [employeeStats, setEmployeeStats] =
    useState<EmployeeStats | null>(null);
  const [pendingReceptionCount, setPendingReceptionCount] = useState(0);
  const isImpersonating = authService.isImpersonating();
  const viewAnimationKey = `${location.pathname}${location.search}`;
  const { motionProfile } = useMotionProfile();

  const activeMemberships = memberships.filter(
    membership => membership.status === "active"
  );

  const currentMembership =
    activeMemberships.find(
      membership => membership.business?._id === businessId
    ) ?? (activeMemberships.length === 1 ? activeMemberships[0] : null);
  const brandName = currentMembership?.business?.name?.trim() || "Essence";

  const hasPermission = (module: string, action: string) =>
    currentMembership?.permissions?.[module]?.[action] === true;

  const canManageSalesFromTeam = hasPermission("sales", "update");
  const canViewInventoryFromTeam = hasPermission("inventory", "read");
  const canManageStockFromTeam =
    hasPermission("inventory", "update") ||
    hasPermission("inventory", "create");
  const canViewTransferHistoryFromTeam = hasPermission("transfers", "read");
  const canViewAnalyticsFromTeam = hasPermission("analytics", "read");
  const canViewExpensesFromTeam = hasPermission("expenses", "read");
  const canManageTeamFromTeam = hasPermission("config", "update");
  const canViewPromotionsFromTeam = hasPermission("promotions", "read");
  const canViewProvidersFromTeam = hasPermission("inventory", "read");
  const canViewCustomersFromTeam = hasPermission("clients", "read");

  const handleLogout = () => {
    authService.logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    if (!user?._id) return;
    let isActive = true;

    const loadGamification = async () => {
      try {
        const statsRes = await gamificationService
          .getEmployeeStats(user._id, { recalculate: true })
          .catch(() => null);

        if (!isActive) return;
        setEmployeeStats((statsRes as any)?.stats ?? statsRes ?? null);
      } catch (error) {
        console.error("Error loading gamification widget:", error);
      }
    };

    loadGamification();
    return () => {
      isActive = false;
    };
  }, [user?._id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncViewport = () => {
      setIsMobileViewport(window.innerWidth < 1024);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!businessId) {
      setPendingReceptionCount(0);
      return;
    }

    let isActive = true;

    const syncPendingReceptions = async () => {
      try {
        const count = await dispatchService.getPendingReceptionCount();
        if (isActive) {
          setPendingReceptionCount(count);
        }
      } catch {
        if (isActive) {
          setPendingReceptionCount(0);
        }
      }
    };

    syncPendingReceptions();
    const intervalId = window.setInterval(syncPendingReceptions, 45000);
    window.addEventListener("dispatch-updated", syncPendingReceptions);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      window.removeEventListener("dispatch-updated", syncPendingReceptions);
    };
  }, [businessId]);

  useEffect(() => {
    const isFinePointer = window.matchMedia("(pointer:fine)").matches;
    if (!isFinePointer) return;

    const links = Array.from(
      document.querySelectorAll<HTMLElement>(".magnetic-nav-link")
    );

    const cleanups = links.map(link => {
      const icon = link.querySelector<SVGElement>("svg");
      if (!icon) return () => undefined;

      const handleMove = (event: MouseEvent) => {
        const bounds = link.getBoundingClientRect();
        const offsetX =
          ((event.clientX - bounds.left) / bounds.width - 0.5) * 8;
        const offsetY =
          ((event.clientY - bounds.top) / bounds.height - 0.5) * 7;

        gsap.to(icon, {
          x: offsetX,
          y: offsetY,
          duration: 0.22,
          ease: "power2.out",
          overwrite: "auto",
        });
      };

      const handleLeave = () => {
        gsap.to(icon, {
          x: 0,
          y: 0,
          duration: 0.4,
          ease: "power3.out",
          overwrite: "auto",
        });
      };

      link.addEventListener("mousemove", handleMove);
      link.addEventListener("mouseleave", handleLeave);

      return () => {
        link.removeEventListener("mousemove", handleMove);
        link.removeEventListener("mouseleave", handleLeave);
      };
    });

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [desktopSidebarOpen, sidebarOpen]);

  if (!user) {
    return null;
  }

  const totalPoints = employeeStats?.totalPoints || 0;
  const currentLevel = employeeStats?.currentLevel || "Sin rango";

  return (
    <div className="bg-app-employee-shell max-w-screen h-screen overflow-hidden overflow-x-hidden bg-[radial-gradient(circle_at_14%_16%,rgba(14,116,144,0.2),transparent_42%),radial-gradient(circle_at_88%_14%,rgba(30,58,138,0.2),transparent_46%),linear-gradient(140deg,#04070d_0%,#090f1b_46%,#050912_100%)]">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/65 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-gray-900/92 duration-400 fixed left-0 z-40 w-72 border-r border-white/10 shadow-[0_0_36px_rgba(8,47,73,0.45)] backdrop-blur-xl transition-transform ease-in-out ${
          isImpersonating ? "top-10 h-[calc(100vh-2.5rem)]" : "top-0 h-screen"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${desktopSidebarOpen ? "lg:translate-x-0" : "lg:-translate-x-full"}`}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* Logo */}
          <div className="bg-white/2 shrink-0 border-b border-white/10 px-4 py-4 sm:py-6">
            <div className="flex items-center gap-3">
              <img
                src={brandLogo}
                alt={`Logo de ${brandName}`}
                className="h-10 w-10 rounded-lg bg-white/5 p-1 drop-shadow-lg sm:h-12 sm:w-12"
              />
              <div>
                <h1 className="bg-linear-to-r from-cyan-300 via-blue-300 to-slate-200 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
                  {brandName.toUpperCase()}
                </h1>
                <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">
                  Panel Empleado
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDesktopSidebarOpen(false)}
              className="mb-2 hidden w-full items-center justify-center gap-2 rounded-xl border-white/15 bg-white/5 text-gray-200 hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-cyan-100 lg:inline-flex"
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
              Ocultar menú
            </Button>
            <NavLink
              to="/staff/dashboard"
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
              to="/staff/products"
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
              to="/staff/catalog"
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
              to="/staff/advertising"
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
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Publicidad
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
              to="/staff/share-catalog"
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
              to="/staff/transfer-stock"
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
              to="/staff/request-dispatch"
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Solicitar Pedido
            </NavLink>

            <NavLink
              to="/staff/my-shipments"
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
                  d="M9 17H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2m-2 4h.01M9 21h6"
                />
              </svg>
              <span className="flex items-center gap-2">
                Recibir Mercancía
                {pendingReceptionCount > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                    {pendingReceptionCount}
                  </span>
                )}
              </span>
            </NavLink>

            <NavLink
              to="/staff/register-sale"
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
              to="/staff/register-promotion"
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
                  d="M5 12h14M12 5l7 7-7 7"
                />
              </svg>
              Venta Promocion
            </NavLink>

            <NavLink
              to="/staff/sales"
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
              to="/staff/credits"
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
              to="/staff/stats"
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
              to="/staff/level"
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
                  d="M9 4l3 3 3-3m-6 5h6m-6 4h6m-6 4h6"
                />
              </svg>
              🏆 Mi Nivel
            </NavLink>

            <FeatureNavLink
              to="/staff/defective-reports"
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
            <FeatureNavLink
              to="/staff/warranties"
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
                  d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
                />
              </svg>
              Garantias
            </FeatureNavLink>

            {(canManageSalesFromTeam ||
              canViewInventoryFromTeam ||
              canManageStockFromTeam ||
              canViewTransferHistoryFromTeam ||
              canViewAnalyticsFromTeam ||
              canViewExpensesFromTeam ||
              canManageTeamFromTeam ||
              canViewPromotionsFromTeam ||
              canViewProvidersFromTeam ||
              canViewCustomersFromTeam) && (
              <>
                <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500 sm:pb-1 sm:pt-3 sm:text-[11px] sm:tracking-[0.18em]">
                  Operativo equipo
                </p>

                {(canViewInventoryFromTeam ||
                  canManageStockFromTeam ||
                  canViewTransferHistoryFromTeam) && (
                  <p className="px-3 pb-0.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-600 sm:pb-1 sm:pt-2 sm:text-[10px] sm:tracking-[0.14em]">
                    Inventario
                  </p>
                )}

                {canManageStockFromTeam && canViewInventoryFromTeam && (
                  <NavLink
                    to="/staff/operativo/stock-management"
                    className={({ isActive }): string =>
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
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
                      />
                    </svg>
                    Gestión de stock
                  </NavLink>
                )}

                {canViewInventoryFromTeam && (
                  <NavLink
                    to="/staff/operativo/global-inventory"
                    className={({ isActive }): string =>
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
                        d="M3 7h18M3 12h18M3 17h18"
                      />
                    </svg>
                    Inventario global
                  </NavLink>
                )}

                {canViewInventoryFromTeam && (
                  <NavLink
                    to="/staff/operativo/branches"
                    className={({ isActive }): string =>
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
                        d="M3 21h18M5 21V7l8-4 8 4v14M9 9h.01M9 13h.01M9 17h.01M13 9h.01M13 13h.01M13 17h.01M17 9h.01M17 13h.01M17 17h.01"
                      />
                    </svg>
                    Sedes
                  </NavLink>
                )}

                {canViewTransferHistoryFromTeam && (
                  <NavLink
                    to="/staff/operativo/transfer-history"
                    className={({ isActive }): string =>
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
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                    Historial de transferencias
                  </NavLink>
                )}

                {canManageSalesFromTeam && (
                  <>
                    <p className="px-3 pb-0.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-600 sm:pb-1 sm:pt-2 sm:text-[10px] sm:tracking-[0.14em]">
                      Ventas
                    </p>
                    <NavLink
                      to="/staff/operativo/sales"
                      className={({ isActive }): string =>
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
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"
                        />
                      </svg>
                      Ventas del equipo
                    </NavLink>
                  </>
                )}

                {(canViewPromotionsFromTeam ||
                  canViewProvidersFromTeam ||
                  canViewCustomersFromTeam) && (
                  <p className="px-3 pb-0.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-600 sm:pb-1 sm:pt-2 sm:text-[10px] sm:tracking-[0.14em]">
                    Clientes y promociones
                  </p>
                )}

                {canViewPromotionsFromTeam && (
                  <NavLink
                    to="/staff/operativo/promotions"
                    className={({ isActive }): string =>
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
                        d="M5 12h14M12 5l7 7-7 7"
                      />
                    </svg>
                    Promociones
                  </NavLink>
                )}

                {canViewProvidersFromTeam && (
                  <NavLink
                    to="/staff/operativo/providers"
                    className={({ isActive }): string =>
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
                        d="M20 13V7a2 2 0 00-2-2h-4m-2 0H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2h-4m-2 0H6a2 2 0 01-2-2v-4m16 0H4"
                      />
                    </svg>
                    Proveedores
                  </NavLink>
                )}

                {canViewCustomersFromTeam && (
                  <NavLink
                    to="/staff/operativo/customers"
                    className={({ isActive }): string =>
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
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.084-1.284-.24-1.885M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.084-1.284.24-1.885m0 0a5.002 5.002 0 019.52 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Clientes
                  </NavLink>
                )}

                {(canViewAnalyticsFromTeam || canViewExpensesFromTeam) && (
                  <p className="px-3 pb-0.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-600 sm:pb-1 sm:pt-2 sm:text-[10px] sm:tracking-[0.14em]">
                    Analítica
                  </p>
                )}

                {canViewAnalyticsFromTeam && (
                  <NavLink
                    to="/staff/operativo/analytics"
                    className={({ isActive }): string =>
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
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10"
                      />
                    </svg>
                    Analíticas del negocio
                  </NavLink>
                )}

                {canViewExpensesFromTeam && (
                  <NavLink
                    to="/staff/operativo/expenses"
                    className={({ isActive }): string =>
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
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2"
                      />
                    </svg>
                    Gastos del negocio
                  </NavLink>
                )}

                {canManageTeamFromTeam && (
                  <>
                    <p className="px-3 pb-0.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-600 sm:pb-1 sm:pt-2 sm:text-[10px] sm:tracking-[0.14em]">
                      Configuración
                    </p>
                    <NavLink
                      to="/staff/operativo/team"
                      className={({ isActive }): string =>
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
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7"
                        />
                      </svg>
                      Equipo y permisos
                    </NavLink>
                  </>
                )}
              </>
            )}
          </nav>

          {/* User Info & Logout - Always visible */}
          <div className="shrink-0 border-t border-white/10 bg-gray-900/90 p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-2 sm:mb-3 sm:gap-3">
              <div className="bg-linear-to-r flex h-9 w-9 shrink-0 items-center justify-center rounded-full from-cyan-500/90 to-blue-600/90 shadow-[0_0_16px_rgba(14,116,144,0.5)] sm:h-10 sm:w-10">
                <span className="text-xs font-bold text-white sm:text-sm">
                  {user?.name?.charAt(0) || "D"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white sm:text-sm">
                  {user?.name}
                </p>
                <p className="text-[10px] text-gray-400 sm:text-xs">
                  Empleado
                </p>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-100">
                {currentLevel}
              </span>
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-200">
                {totalPoints.toLocaleString()} pts
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/15 px-3 py-2 text-xs font-medium text-red-200 transition-all duration-300 hover:border-red-300/40 hover:bg-red-500/25 active:scale-[0.98] sm:px-4 sm:py-2.5 sm:text-sm"
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
      <div
        className={`mobile-header-safe bg-gray-900/92 fixed left-0 right-0 z-20 border-b border-white/10 backdrop-blur-xl lg:hidden ${
          isImpersonating ? "top-10" : "top-0"
        }`}
      >
        <div className="safe-x flex h-full items-center justify-between px-3 sm:px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-2 flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-gray-300 transition-all duration-300 hover:bg-white/5 hover:text-cyan-200 active:scale-95"
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
          <h1 className="bg-linear-to-r from-cyan-300 via-blue-300 to-slate-200 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
            ESSENCE
          </h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Main Content */}
      <main
        className={`content-with-safe-header duration-400 h-screen overflow-y-auto overflow-x-hidden transition-all lg:pt-0 ${
          isMobileViewport ? "pb-24 pb-32" : "pb-12"
        } ${desktopSidebarOpen ? "lg:ml-72" : "lg:ml-0"}`}
      >
        <div className="safe-x p-4 pb-28 sm:p-6 sm:pb-28 md:p-8 lg:p-10 lg:pb-32">
          {!desktopSidebarOpen && (
            <div className="mb-4 hidden lg:block">
              <button
                onClick={() => setDesktopSidebarOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-gray-100 transition-all duration-300 hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-cyan-100"
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
                Mostrar menú
              </button>
            </div>
          )}
          <div className="mb-4 flex justify-end">
            <PriceCatalogModal />
          </div>
          <BusinessGate>
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={viewAnimationKey}
                className="essence-view-shell"
                initial={{
                  opacity: 0,
                  y: motionProfile.viewEnterY,
                  scale: motionProfile.viewEnterScale,
                  filter: `blur(${motionProfile.viewEnterBlur}px)`,
                }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  y: motionProfile.viewExitY,
                  scale: motionProfile.viewExitScale,
                  filter: `blur(${motionProfile.viewExitBlur}px)`,
                }}
                transition={{
                  duration: motionProfile.viewDuration,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Outlet />
              </m.div>
            </AnimatePresence>
          </BusinessGate>
        </div>
      </main>

      <div
        className={`bg-gray-900/88 duration-400 z-120 fixed bottom-3 left-1/2 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl border border-white/10 p-2 shadow-[0_18px_32px_rgba(2,6,23,0.55)] backdrop-blur-xl transition-all lg:hidden ${
          sidebarOpen
            ? "pointer-events-none translate-y-4 opacity-0"
            : "opacity-100"
        }`}
      >
        <div className="grid grid-cols-3 gap-2">
          <NavLink
            to="/staff/sales"
            className={({ isActive }): string =>
              [
                "magnetic-nav-link flex min-h-11 min-w-11 flex-col items-center justify-center rounded-xl border px-2 py-2 text-[11px] font-semibold transition-all duration-300",
                isActive
                  ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100 shadow-[0_0_16px_rgba(56,189,248,0.24)]"
                  : "border-white/0 text-gray-300 hover:border-white/15 hover:bg-white/5 hover:text-cyan-100",
              ].join(" ")
            }
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
              />
            </svg>
            Mis Ventas
          </NavLink>

          <NavLink
            to="/staff/products"
            className={({ isActive }): string =>
              [
                "magnetic-nav-link flex min-h-11 min-w-11 flex-col items-center justify-center rounded-xl border px-2 py-2 text-[11px] font-semibold transition-all duration-300",
                isActive
                  ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100 shadow-[0_0_16px_rgba(56,189,248,0.24)]"
                  : "border-white/0 text-gray-300 hover:border-white/15 hover:bg-white/5 hover:text-cyan-100",
              ].join(" ")
            }
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
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
              />
            </svg>
            Inventario
          </NavLink>

          <NavLink
            to="/staff/my-shipments"
            className={({ isActive }): string =>
              [
                "magnetic-nav-link relative flex min-h-11 min-w-11 flex-col items-center justify-center rounded-xl border px-2 py-2 text-[10px] font-semibold leading-tight transition-all duration-300",
                isActive
                  ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100 shadow-[0_0_16px_rgba(56,189,248,0.24)]"
                  : "border-white/0 text-gray-300 hover:border-white/15 hover:bg-white/5 hover:text-cyan-100",
              ].join(" ")
            }
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
                d="M9 17H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2m-2 4h.01M9 21h6"
              />
            </svg>
            <span className="text-center">Recibir Mercancía</span>
            {pendingReceptionCount > 0 && (
              <span className="absolute right-2 top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                {pendingReceptionCount}
              </span>
            )}
          </NavLink>
        </div>
      </div>

      <ReportIssueButton />
    </div>
  );
}
