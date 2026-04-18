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
  Globe,
  Menu,
  Package,
  Plus,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Star,
  Tag,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import BusinessGate from "../../../components/BusinessGate";
import BusinessSelector from "../../../components/BusinessSelector";
import FeatureNavLink from "../../../components/FeatureNavLink";
import ReportIssueButton from "../../../components/ReportIssueButton";
import { useBusiness } from "../../../context/BusinessContext";
import { useBrandLogo } from "../../../hooks/useBrandLogo";
import { useMotionProfile } from "../../../shared/config/motion.config";
import { authService } from "../../auth/services";
import type { User } from "../../auth/types/auth.types";
import { dispatchService } from "../../branches/services";
import DemoModeTour from "../../demo/DemoModeTour";
import DemoSandboxBanner from "../../demo/DemoSandboxBanner";
import { employeeService } from "../../employees/services";
import type { BusinessFeatures } from "../types/business.types";

const navLinkClasses = (isActive: boolean): string =>
  [
    "magnetic-nav-link group flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-300",
    isActive
      ? "border-purple-500/55 bg-purple-600/20 text-white shadow-lg shadow-purple-700/20"
      : "border-white/0 text-gray-300 hover:border-white/15 hover:bg-white/5 hover:text-purple-200",
  ].join(" ");

interface SidebarItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  feature?: keyof BusinessFeatures;
  showDispatchBadge?: boolean;
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

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getCurrentUser();
  const userRole = user?.role;
  const { business, businessId, memberships, features } = useBusiness();
  const logoUrl = useBrandLogo();
  const brandLogo = (
    business?.logoUrl?.trim() ||
    logoUrl ||
    "/erp-logo.png"
  ).trim();
  const brandName = business?.name || "Selecciona un negocio";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    principal: true,
    "ventas-clientes": true,
    "inventario-catalogo": true,
    operaciones: true,
    "marketing-engagement": true,
    "administracion-equipo": true,
    configuracion: true,
  });
  const [employees, setEmployees] = useState<User[]>([]);
  const [loadingImpersonation, setLoadingImpersonation] = useState(false);
  const [pendingDispatchCount, setPendingDispatchCount] = useState(0);
  const isImpersonating = authService.isImpersonating();
  const floatingToggleTopClass = isImpersonating ? "top-56" : "top-44";
  const viewAnimationKey = `${location.pathname}${location.search}`;
  const { motionProfile } = useMotionProfile();

  const menuSections = useMemo<SidebarSection[]>(
    () => [
      {
        id: "principal",
        label: "Principal",
        items: [
          {
            id: "business-assistant",
            label: "Business Assistant",
            to: "/admin/business-assistant",
            icon: BookOpen,
            feature: "assistant",
          },
          {
            id: "analytics",
            label: "Análisis",
            to: "/admin/analytics",
            icon: BarChart3,
            feature: "reports",
          },
          {
            id: "public-page",
            label: "Mi Página Pública",
            to: "/admin/public-page",
            icon: Globe,
          },
        ],
      },
      {
        id: "ventas-clientes",
        label: "Ventas & Clientes",
        items: [
          {
            id: "register-sale",
            label: "Registrar Venta",
            to: "/admin/register-sale",
            icon: Plus,
          },
          {
            id: "register-promotion",
            label: "Venta Promoción",
            to: "/admin/register-promotion",
            icon: Tag,
          },
          {
            id: "sales",
            label: "Ventas",
            to: "/admin/sales",
            icon: ShoppingBag,
          },
          {
            id: "special-sales",
            label: "Ventas Especiales",
            to: "/admin/special-sales",
            icon: Star,
            feature: "sales",
          },
          {
            id: "customers",
            label: "Clientes",
            to: "/admin/customers",
            icon: Users,
          },
          {
            id: "credits",
            label: "Fiados / Créditos",
            to: "/admin/credits",
            icon: CreditCard,
            feature: "credits",
          },
          {
            id: "warranties",
            label: "Garantías",
            to: "/admin/warranties",
            icon: Shield,
            feature: "defectiveProducts",
          },
        ],
      },
      {
        id: "inventario-catalogo",
        label: "Inventario & Catálogo",
        items: [
          {
            id: "catalog",
            label: "Catálogo Completo",
            to: "/catalog",
            icon: BookOpen,
          },
          {
            id: "products",
            label: "Productos",
            to: "/admin/products",
            icon: Package,
          },
          {
            id: "add-product",
            label: "Agregar Producto",
            to: "/admin/add-product",
            icon: Plus,
          },
          {
            id: "price-list",
            label: "Lista de Precios",
            to: "/admin/price-list",
            icon: FileText,
          },
          {
            id: "categories",
            label: "Categorías",
            to: "/admin/categories",
            icon: Tag,
          },
          {
            id: "providers",
            label: "Proveedores",
            to: "/admin/providers",
            icon: Building2,
          },
          {
            id: "defective-products",
            label: "Productos Defectuosos",
            to: "/admin/defective-products",
            icon: AlertTriangle,
            feature: "defectiveProducts",
          },
        ],
      },
      {
        id: "operaciones",
        label: "Operaciones",
        items: [
          {
            id: "branches",
            label: "Sedes",
            to: "/admin/branches",
            icon: Building2,
            feature: "branches",
          },
          {
            id: "inventory-entries",
            label: "Recepción de Mercancía",
            to: "/admin/inventory-entries",
            icon: FileText,
            feature: "inventory",
          },
          {
            id: "stock-management",
            label: "Gestión de Stock",
            to: "/admin/stock-management",
            icon: Package,
            feature: "inventory",
          },
          {
            id: "global-inventory",
            label: "Inventario Global",
            to: "/admin/global-inventory",
            icon: BarChart3,
            feature: "inventory",
          },
          {
            id: "transfer-history",
            label: "Historial de Transferencias",
            to: "/admin/transfer-history",
            icon: Activity,
            feature: "transfers",
          },
          {
            id: "dispatch",
            label: "Central de Despachos",
            to: "/admin/dispatch",
            icon: ShoppingBag,
            feature: "transfers",
            showDispatchBadge: true,
          },
          {
            id: "expenses",
            label: "Gastos",
            to: "/admin/expenses",
            icon: CreditCard,
            feature: "expenses",
          },
        ],
      },
      {
        id: "marketing-engagement",
        label: "Marketing & Engagement",
        items: [
          {
            id: "promotions",
            label: "Promociones",
            to: "/admin/promotions",
            icon: Tag,
            feature: "promotions",
          },
          {
            id: "advertising",
            label: "Publicidad",
            to: "/admin/advertising",
            icon: Star,
          },
          {
            id: "gamification",
            label: "Gamificación",
            to: "/admin/gamification",
            icon: Target,
            feature: "gamification",
          },
          {
            id: "rankings",
            label: "Rankings",
            to: "/admin/rankings",
            icon: Trophy,
            feature: "gamification",
          },
        ],
      },
      {
        id: "administracion-equipo",
        label: "Administración & Equipo",
        items: [
          {
            id: "employees",
            label: "Empleados",
            to: "/admin/employees",
            icon: Users,
            feature: "employees",
          },
          {
            id: "team",
            label: "Equipo y Permisos",
            to: "/admin/team",
            icon: Shield,
          },
          {
            id: "notifications",
            label: "Notificaciones",
            to: "/admin/notifications",
            icon: Bell,
          },
          {
            id: "audit",
            label: "Auditoría",
            to: "/admin/audit",
            icon: Activity,
            feature: "reports",
          },
          {
            id: "payment-methods",
            label: "Métodos de Pago",
            to: "/admin/payment-methods",
            icon: CreditCard,
            feature: "sales",
          },
          {
            id: "delivery-methods",
            label: "Métodos de Entrega",
            to: "/admin/delivery-methods",
            icon: ShoppingBag,
            feature: "sales",
          },
        ],
      },
      {
        id: "configuracion",
        label: "Configuración",
        items: [
          {
            id: "business-settings",
            label: "Configurar negocio",
            to: "/admin/business-settings",
            icon: Settings,
          },
          {
            id: "user-settings",
            label: "Preferencias de animación",
            to: "/admin/user-settings",
            icon: Settings,
          },
          {
            id: "create-business",
            label: "Crear nuevo negocio",
            to: "/admin/create-business",
            icon: Plus,
          },
        ],
      },
    ],
    []
  );

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

  const currentMembership = useMemo(
    () =>
      memberships.find(
        membership =>
          membership.status === "active" &&
          membership.business?._id === businessId
      ) ?? null,
    [memberships, businessId]
  );

  const canReadTransfersFromMembership =
    currentMembership?.permissions?.transfers?.read === true ||
    currentMembership?.permissions?.transfers?.update === true ||
    currentMembership?.permissions?.transfers?.create === true;

  const canSyncPendingDispatches =
    Boolean(business?._id) &&
    features.transfers !== false &&
    (["admin", "super_admin", "god"].includes(userRole || "") ||
      canReadTransfersFromMembership);

  useEffect(() => {
    const syncViewport = () => {
      setIsDesktopViewport(window.innerWidth >= 1024);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (isDesktopViewport) {
      setSidebarOpen(false);
    }
  }, [isDesktopViewport]);

  useEffect(() => {
    if (!userRole || !businessId) {
      setEmployees([]);
      return;
    }

    const loadEmployees = async () => {
      try {
        const response = await employeeService.getAll({ active: true });
        const items = response?.data || [];
        setEmployees(
          items.filter(
            item => item.role === "employee" && item.active !== false
          )
        );
      } catch (error) {
        console.error("Error cargando empleados para suplantación:", error);
        setEmployees([]);
      }
    };

    if (["admin", "super_admin", "god"].includes(userRole)) {
      loadEmployees();
    } else {
      setEmployees([]);
    }
  }, [userRole, businessId]);

  useEffect(() => {
    if (!canSyncPendingDispatches) {
      setPendingDispatchCount(prev => (prev === 0 ? prev : 0));
      return;
    }

    let active = true;

    const syncPendingDispatches = async () => {
      try {
        const count = Number((await dispatchService.getPendingCount()) || 0);
        if (active) {
          setPendingDispatchCount(prev => (prev === count ? prev : count));
        }
      } catch {
        if (active) {
          setPendingDispatchCount(prev => (prev === 0 ? prev : 0));
        }
      }
    };

    syncPendingDispatches();
    const intervalId = window.setInterval(syncPendingDispatches, 60000);
    window.addEventListener("dispatch-updated", syncPendingDispatches);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("dispatch-updated", syncPendingDispatches);
    };
  }, [canSyncPendingDispatches]);

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
          ((event.clientY - bounds.top) / bounds.height - 0.5) * 8;

        gsap.to(icon, {
          x: offsetX,
          y: offsetY,
          duration: 0.2,
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

  const handleSidebarVisibilityToggle = () => {
    if (isDesktopViewport) {
      setDesktopSidebarOpen(prev => !prev);
      return;
    }

    setSidebarOpen(prev => !prev);
  };

  const handleSectionToggle = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? true),
    }));
  };

  const handleLogout = () => {
    authService.logout();
    navigate("/login", { replace: true });
  };

  const handleImpersonateEmployee = async (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    const employeeId = event.target.value;
    if (!employeeId || loadingImpersonation) return;

    setLoadingImpersonation(true);
    try {
      await authService.impersonate(employeeId);
    } catch (error: any) {
      console.error("Error al suplantar employee:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo iniciar modo de suplantación"
      );
      setLoadingImpersonation(false);
    }
  };

  const renderSidebarItem = (item: SidebarItem) => {
    const Icon = item.icon;

    const content = (
      <>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        {item.showDispatchBadge && pendingDispatchCount > 0 && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-gray-900">
            {pendingDispatchCount}
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="bg-app-admin-shell max-w-screen h-screen overflow-hidden overflow-x-hidden">
      <DemoModeTour />
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-app-admin-sidebar duration-400 fixed left-0 z-50 w-72 border-r border-white/10 shadow-[0_0_42px_rgba(2,6,23,0.55)] backdrop-blur-xl transition-transform ease-in-out ${
          isImpersonating ? "top-10 h-[calc(100vh-2.5rem)]" : "top-0 h-screen"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${desktopSidebarOpen ? "lg:translate-x-0" : "lg:-translate-x-full"}`}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* Logo */}
          <div className="shrink-0 border-b border-gray-800 px-4 py-4 sm:py-6">
            <div className="flex items-center gap-3">
              <img
                src={brandLogo}
                alt={brandName}
                className="h-10 w-10 rounded-lg bg-white/5 drop-shadow-lg sm:h-12 sm:w-12"
              />
              <div>
                <h1 className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
                  {brandName}
                </h1>
                <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">
                  Panel Admin
                </p>
              </div>
            </div>
            <BusinessSelector />

            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={handleSidebarVisibilityToggle}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 transition duration-300 hover:border-purple-400/60 hover:text-purple-200"
              >
                <Menu className="h-4 w-4" />
                {isDesktopViewport
                  ? desktopSidebarOpen
                    ? "Ocultar menú"
                    : "Mostrar menú"
                  : sidebarOpen
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
                  className="focus:outline-hidden h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-gray-100 placeholder:text-gray-500 focus:border-purple-400/60"
                />
              </label>
            </div>
          </div>

          {/* Navigation */}
          <nav
            className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
            style={{
              WebkitOverflowScrolling: "touch",
            }}
          >
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

      {!desktopSidebarOpen && (
        <button
          type="button"
          onClick={() => setDesktopSidebarOpen(true)}
          className={`fixed left-0 ${floatingToggleTopClass} bg-app-admin-sidebar z-50 hidden h-12 w-12 items-center justify-center rounded-r-xl border border-l-0 border-white/20 text-gray-200 shadow-lg shadow-black/35 transition duration-300 hover:text-purple-200 lg:flex`}
          aria-label="Mostrar sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className={`fixed left-0 ${floatingToggleTopClass} bg-app-admin-sidebar z-50 flex h-12 w-12 items-center justify-center rounded-r-xl border border-l-0 border-white/20 text-gray-200 shadow-lg shadow-black/35 transition duration-300 hover:text-purple-200 lg:hidden`}
          aria-label="Mostrar sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Header (mobile + desktop) */}
      <div
        className={`bg-app-admin-header mobile-header-safe fixed left-0 right-0 z-30 border-b border-gray-800 backdrop-blur-lg lg:h-16 ${
          isImpersonating ? "top-10" : "top-0"
        }`}
      >
        <div
          className={`safe-x duration-400 flex h-full items-center justify-between px-3 transition-[margin] ease-in-out sm:px-5 lg:px-8 ${
            desktopSidebarOpen ? "lg:ml-72" : "lg:ml-0"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img
                src={brandLogo}
                alt={brandName}
                className="h-9 w-9 rounded-lg bg-white/5 drop-shadow"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Identidad
                </p>
                <p className="text-sm font-bold text-white">{brandName}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              defaultValue=""
              onChange={handleImpersonateEmployee}
              disabled={loadingImpersonation || employees.length === 0}
              className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200 transition hover:border-purple-400/60 hover:text-white lg:block"
            >
              <option value="" className="bg-gray-900 text-gray-200">
                {loadingImpersonation
                  ? "Iniciando soporte..."
                  : "Entrar como empleado"}
              </option>
              {employees.map(employee => (
                <option
                  key={employee._id}
                  value={employee._id}
                  className="bg-gray-900 text-gray-200"
                >
                  {employee.name}
                </option>
              ))}
            </select>
            <div className="hidden items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-100 lg:flex">
              <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
              Multi-negocio activo
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main
        className={`content-with-safe-header duration-400 h-screen overflow-y-auto overflow-x-hidden pb-24 transition-all ease-in-out md:pb-28 lg:pt-20 ${
          desktopSidebarOpen ? "lg:ml-72" : "lg:ml-0"
        }`}
      >
        <div className="mx-auto w-full max-w-screen-2xl p-4 pb-32 md:p-6 lg:p-8">
          <DemoSandboxBanner />
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

      <ReportIssueButton />
    </div>
  );
}
