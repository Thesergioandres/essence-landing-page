import { AnimatePresence, m } from "framer-motion";
import { gsap } from "gsap";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  Menu,
  Package,
  Plus,
  Search,
  Shield,
  ShoppingBag,
  Star,
  Tag,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import BusinessGate from "../../../components/BusinessGate";
import BusinessSelector from "../../../components/BusinessSelector";
import FeatureNavLink from "../../../components/FeatureNavLink";
import ReportIssueButton from "../../../components/ReportIssueButton";
import { useBusiness } from "../../../context/BusinessContext";
import { useBrandLogo } from "../../../hooks/useBrandLogo";
import { useMotionProfile } from "../../../shared/config/motion.config";
import { authService } from "../../auth/services";
import { dispatchService } from "../../branches/services";
import type { BusinessFeatures } from "../../business/types/business.types";
import POSWidget from "../../gamification/components/POSWidget";
import NotificationPopup from "../../notifications/components/NotificationPopup";
import PriceCatalogModal from "../components/PriceCatalogModal";

const navLinkClasses = (isActive: boolean): string =>
  [
    "magnetic-nav-link group flex min-h-11 items-center gap-2 sm:gap-3 rounded-xl border px-3 py-2.5 text-xs transition-[border-color,background-color,color,box-shadow,transform] duration-400 sm:px-4 sm:py-3 sm:text-sm",
    isActive
      ? "border-cyan-400/55 bg-linear-to-r from-cyan-500/20 via-blue-500/15 to-white/0 text-cyan-100 shadow-[0_0_24px_rgba(56,189,248,0.3)]"
      : "border-white/0 text-gray-300 hover:border-white/15 hover:bg-white/5 hover:text-cyan-100 active:scale-[0.985]",
  ].join(" ");

interface SidebarItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  feature?: keyof BusinessFeatures;
  showPendingReceptionBadge?: boolean;
}

interface SidebarSection {
  id: string;
  label: string;
  items: SidebarItem[];
}

interface VisibleSidebarSection extends SidebarSection {
  filteredItems: SidebarItem[];
  forceExpand: boolean;
}

const normalizeSearchValue = (value: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const resolveEntityId = (value: unknown): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : "";
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const candidate = value as {
    _id?: unknown;
    id?: unknown;
    $oid?: unknown;
  };

  return (
    resolveEntityId(candidate._id) ||
    resolveEntityId(candidate.id) ||
    resolveEntityId(candidate.$oid) ||
    ""
  );
};

const resolveMembershipBusinessId = (membership: {
  business?: unknown;
}): string => {
  return resolveEntityId(membership.business);
};

const resolveMembershipBusinessName = (membership: {
  business?: unknown;
}): string => {
  if (!membership.business || typeof membership.business !== "object") {
    return "";
  }

  const business = membership.business as { name?: unknown };
  return typeof business.name === "string" ? business.name : "";
};

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
  const [pendingReceptionCount, setPendingReceptionCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    principal: true,
    "inventario-catalogo": true,
    operaciones: true,
    "ventas-cobros": true,
    postventa: true,
    "operativo-equipo": true,
  });
  const isImpersonating = authService.isImpersonating();
  const viewAnimationKey = `${location.pathname}${location.search}`;
  const { motionProfile } = useMotionProfile();

  const activeMemberships = memberships.filter(
    membership => membership.status === "active"
  );

  const currentMembership =
    activeMemberships.find(
      membership => resolveMembershipBusinessId(membership) === businessId
    ) ?? (activeMemberships.length === 1 ? activeMemberships[0] : null);
  const brandName =
    resolveMembershipBusinessName(currentMembership || {}) || "Essence";

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

  const menuSections = useMemo<SidebarSection[]>(() => {
    const sections: SidebarSection[] = [
      {
        id: "principal",
        label: "Principal",
        items: [
          {
            id: "dashboard",
            label: "Dashboard",
            to: "/staff/dashboard",
            icon: BarChart3,
          },
          {
            id: "stats",
            label: "Estadísticas",
            to: "/staff/stats",
            icon: Activity,
          },
          {
            id: "notifications",
            label: "Notificaciones",
            to: "/staff/notifications",
            icon: Bell,
          },
          {
            id: "ranking",
            label: "Ranking & Puntos",
            to: "/staff/ranking",
            icon: Trophy,
          },
        ],
      },
      {
        id: "inventario-catalogo",
        label: "Inventario & Catálogo",
        items: [
          {
            id: "products",
            label: "Mis Productos",
            to: "/staff/products",
            icon: Package,
          },
          {
            id: "catalog",
            label: "Mi Catálogo",
            to: "/staff/catalog",
            icon: BookOpen,
          },
          {
            id: "advertising",
            label: "Publicidad",
            to: "/staff/advertising",
            icon: Star,
          },
          {
            id: "full-catalog",
            label: "Catálogo Completo",
            to: "/catalog",
            icon: BookOpen,
          },
          {
            id: "share-catalog",
            label: "Compartir Catálogo",
            to: "/staff/share-catalog",
            icon: Tag,
          },
        ],
      },
      {
        id: "operaciones",
        label: "Operaciones",
        items: [
          {
            id: "transfer-stock",
            label: "Transferir Inventario",
            to: "/staff/transfer-stock",
            icon: Activity,
          },
          {
            id: "request-dispatch",
            label: "Solicitar Pedido",
            to: "/staff/request-dispatch",
            icon: FileText,
          },
          {
            id: "my-shipments",
            label: "Recibir Mercancía",
            to: "/staff/my-shipments",
            icon: ShoppingBag,
            showPendingReceptionBadge: true,
          },
          {
            id: "weekly-schedule",
            label: "Mi Disponibilidad",
            to: "/staff/schedule",
            icon: Activity,
          },
          {
            id: "contracts",
            label: "Mis Contratos",
            to: "/staff/contracts",
            icon: FileText,
          },
        ],
      },
      {
        id: "ventas-cobros",
        label: "Ventas & Cobros",
        items: [
          {
            id: "register-sale",
            label: "Registrar Venta",
            to: "/staff/register-sale",
            icon: Plus,
          },
          {
            id: "register-promotion",
            label: "Venta Promoción",
            to: "/staff/register-promotion",
            icon: Tag,
          },
          {
            id: "sales",
            label: "Mis Ventas",
            to: "/staff/sales",
            icon: FileText,
          },
          {
            id: "credits",
            label: "Mis Cobros",
            to: "/staff/credits",
            icon: CreditCard,
          },
        ],
      },
      {
        id: "postventa",
        label: "Postventa",
        items: [
          {
            id: "defective-reports",
            label: "Productos Defectuosos",
            to: "/staff/defective-reports",
            icon: AlertTriangle,
            feature: "defectiveProducts",
          },
          {
            id: "warranties",
            label: "Garantias",
            to: "/staff/warranties",
            icon: Shield,
            feature: "defectiveProducts",
          },
        ],
      },
    ];

    const teamItems: SidebarItem[] = [];

    if (canManageStockFromTeam && canViewInventoryFromTeam) {
      teamItems.push({
        id: "team-stock-management",
        label: "Gestión de stock",
        to: "/staff/operativo/stock-management",
        icon: Package,
      });
    }

    if (canViewInventoryFromTeam) {
      teamItems.push(
        {
          id: "team-global-inventory",
          label: "Inventario global",
          to: "/staff/operativo/global-inventory",
          icon: BarChart3,
        },
        {
          id: "team-branches",
          label: "Sedes",
          to: "/staff/operativo/branches",
          icon: Building2,
        }
      );
    }

    if (canViewTransferHistoryFromTeam) {
      teamItems.push({
        id: "team-transfer-history",
        label: "Historial de transferencias",
        to: "/staff/operativo/transfer-history",
        icon: Activity,
      });
    }

    if (canManageSalesFromTeam) {
      teamItems.push({
        id: "team-sales",
        label: "Ventas del equipo",
        to: "/staff/operativo/sales",
        icon: ShoppingBag,
      });
    }

    if (canViewPromotionsFromTeam) {
      teamItems.push({
        id: "team-promotions",
        label: "Promociones",
        to: "/staff/operativo/promotions",
        icon: Tag,
      });
    }

    if (canViewProvidersFromTeam) {
      teamItems.push({
        id: "team-providers",
        label: "Proveedores",
        to: "/staff/operativo/providers",
        icon: Building2,
      });
    }

    if (canViewCustomersFromTeam) {
      teamItems.push({
        id: "team-customers",
        label: "Clientes",
        to: "/staff/operativo/customers",
        icon: Users,
      });
    }

    if (canViewAnalyticsFromTeam) {
      teamItems.push({
        id: "team-analytics",
        label: "Analíticas del negocio",
        to: "/staff/operativo/analytics",
        icon: BarChart3,
      });
    }

    if (canViewExpensesFromTeam) {
      teamItems.push({
        id: "team-expenses",
        label: "Gastos del negocio",
        to: "/staff/operativo/expenses",
        icon: CreditCard,
      });
    }

    if (canManageTeamFromTeam) {
      teamItems.push({
        id: "team-permissions",
        label: "Equipo y permisos",
        to: "/staff/operativo/team",
        icon: Shield,
      });
    }

    if (teamItems.length > 0) {
      sections.push({
        id: "operativo-equipo",
        label: "Operativo Equipo",
        items: teamItems,
      });
    }

    return sections;
  }, [
    canManageStockFromTeam,
    canViewInventoryFromTeam,
    canViewTransferHistoryFromTeam,
    canManageSalesFromTeam,
    canViewPromotionsFromTeam,
    canViewProvidersFromTeam,
    canViewCustomersFromTeam,
    canViewAnalyticsFromTeam,
    canViewExpensesFromTeam,
    canManageTeamFromTeam,
  ]);

  const normalizedSearchTerm = useMemo(
    () => normalizeSearchValue(searchTerm),
    [searchTerm]
  );

  const visibleSections = useMemo<VisibleSidebarSection[]>(
    () =>
      menuSections
        .map(section => {
          const sectionLabel = normalizeSearchValue(section.label);
          const sectionMatches =
            normalizedSearchTerm.length > 0 &&
            sectionLabel.includes(normalizedSearchTerm);

          const filteredItems =
            normalizedSearchTerm.length === 0 || sectionMatches
              ? section.items
              : section.items.filter(item =>
                  normalizeSearchValue(item.label).includes(
                    normalizedSearchTerm
                  )
                );

          return {
            ...section,
            filteredItems,
            forceExpand:
              normalizedSearchTerm.length > 0 && filteredItems.length > 0,
          };
        })
        .filter(section => section.filteredItems.length > 0),
    [menuSections, normalizedSearchTerm]
  );

  const showNoResults =
    normalizedSearchTerm.length > 0 && visibleSections.length === 0;

  const handleSidebarVisibilityToggle = () => {
    if (isMobileViewport) {
      setSidebarOpen(prev => !prev);
      return;
    }

    setDesktopSidebarOpen(prev => !prev);
  };

  const handleSectionToggle = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? true),
    }));
  };

  const renderSidebarItem = (item: SidebarItem) => {
    const Icon = item.icon;

    const content = (
      <>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        {item.showPendingReceptionBadge && pendingReceptionCount > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
            {pendingReceptionCount}
          </span>
        )}
      </>
    );

    if (item.feature) {
      return (
        <FeatureNavLink
          key={item.id}
          to={item.to}
          feature={item.feature}
          className={(isActive: boolean): string => navLinkClasses(isActive)}
        >
          {content}
        </FeatureNavLink>
      );
    }

    return (
      <NavLink
        key={item.id}
        to={item.to}
        className={({ isActive }): string => navLinkClasses(isActive)}
      >
        {content}
      </NavLink>
    );
  };

  const handleLogout = () => {
    authService.logout();
    navigate("/login", { replace: true });
  };

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
    if (!isMobileViewport) {
      setSidebarOpen(false);
    }
  }, [isMobileViewport]);

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
  }, [desktopSidebarOpen, sidebarOpen, visibleSections, searchTerm]);

  if (!user) {
    return null;
  }

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
                referrerPolicy="no-referrer"
              />
              <div>
                <h1 className="bg-linear-to-r from-cyan-300 via-blue-300 to-slate-200 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
                  {brandName.toUpperCase()}
                </h1>
                <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">
                  Panel Employee
                </p>
              </div>
            </div>
            <BusinessSelector />
          </div>

          {/* Navigation - Scrollable */}
          <nav
            className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
            style={{
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleSidebarVisibilityToggle}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 transition duration-300 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-cyan-100"
              >
                <Menu className="h-4 w-4" />
                {isMobileViewport
                  ? sidebarOpen
                    ? "Ocultar menú"
                    : "Mostrar menú"
                  : desktopSidebarOpen
                    ? "Ocultar menú"
                    : "Mostrar menú"}
              </button>

              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Filtrar secciones..."
                  className="focus:outline-hidden h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-gray-100 placeholder:text-gray-500 focus:border-cyan-400/60"
                />
              </label>
            </div>

            {showNoResults ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-gray-400">
                No encontramos coincidencias para tu búsqueda.
              </div>
            ) : (
              visibleSections.map(section => {
                const isExpanded =
                  section.forceExpand || (expandedSections[section.id] ?? true);

                return (
                  <section
                    key={section.id}
                    className="bg-white/3 rounded-2xl border border-white/10"
                  >
                    <button
                      type="button"
                      onClick={() => handleSectionToggle(section.id)}
                      disabled={section.forceExpand}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                        {section.label}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="space-y-1 px-2 pb-2">
                        {section.filteredItems.map(renderSidebarItem)}
                      </div>
                    )}
                  </section>
                );
              })
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
                <p className="text-[10px] text-gray-400 sm:text-xs">Employee</p>
              </div>
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
          isMobileViewport ? "pb-32" : "pb-12"
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

      <NotificationPopup />

      {/* Gamification Widget - Floating points & ranking indicator */}
      <POSWidget />

      <ReportIssueButton />
    </div>
  );
}
