import { gsap } from "gsap";
import {
  Activity,
  AlertTriangle,
  Archive,
  BadgeDollarSign,
  Ban,
  CalendarClock,
  CheckCircle2,
  CirclePause,
  Clock3,
  MoreHorizontal,
  PencilLine,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { authService } from "../../auth/services";
import type { User } from "../../auth/types/auth.types";
import {
  issueService,
  type BusinessSubscriptionRow,
  userAccessService,
} from "../../common/services";
import { useGodSubscriptions, type AccountStatus } from "../hooks/useGodSubscriptions";
import type { IssueReport } from "../types/common.types";

interface DurationForm {
  days: number;
  months: number;
  years: number;
}

type ActionKey =
  | "activate"
  | "extend"
  | "suspend"
  | "pause"
  | "resume"
  | "remove";

interface PlanActionConfirmation {
  type: "archive" | "delete";
  planId: string;
}

interface KpiCardConfig {
  label: string;
  value: number;
  helper: string;
  progress: number;
  tone: string;
  icon: ComponentType<{ className?: string }>;
}

// Base plans are now manageable
const defaultDuration: DurationForm = { days: 30, months: 0, years: 0 };

const statusBadgeStyles: Record<string, string> = {
  active: "border-green-500/40 bg-green-500/10 text-green-200",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  expired: "border-red-500/40 bg-red-500/10 text-red-200",
  suspended: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  paused: "border-sky-500/40 bg-sky-500/10 text-sky-200",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  return date.toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatStatus = (status?: string) => {
  if (!status) return "-";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const normalizeOverrideValue = (value: string): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
};

const normalizeFeatureListInput = (value: string): string[] => {
  return [...new Set(
    value
      .split(/[\n,]/g)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 20)
  )];
};

export default function GodPanel() {
  const currentUser = authService.getCurrentUser();
  const navigate = useNavigate();

  const {
    subscriptionsLoading,
    subscriptionAction,
    subscriptionRows,
    setRowDraft,
    maintenanceMode,
    setMaintenanceMode,
    defaultPlan,
    setPlanAsDefault,
    planConfigs,
    subscriptionSummary,
    isGlobalSettingsDirty,
    isRowDirty,
    createPlan,
    updatePlanConfig,
    archivePlan,
    deletePlan,
    loadSubscriptions,
    saveGlobalPlans,
    updateBusinessPlan,
    resetGlobalDraft,
    getEffectiveLimits,
    getPlanOptionsForRow,
  } = useGodSubscriptions();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [durations, setDurations] = useState<Record<string, DurationForm>>({});

  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [issueStatus, setIssueStatus] = useState<
    "all" | "open" | "reviewing" | "closed"
  >("open");
  const [issueAction, setIssueAction] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"users" | "issues" | "subscriptions">(
    "users",
  );

  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState<
    "all" | AccountStatus
  >("all");

  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionPlanFilter, setSubscriptionPlanFilter] = useState("all");
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<
    "all" | AccountStatus
  >("all");
  const [subscriptionOnlyOverrides, setSubscriptionOnlyOverrides] =
    useState(false);
  const [openBusinessActionMenuId, setOpenBusinessActionMenuId] = useState<
    string | null
  >(null);

  const [planDrawerId, setPlanDrawerId] = useState<string | null>(null);
  const [confirmPlanAction, setConfirmPlanAction] =
    useState<PlanActionConfirmation | null>(null);

  const [confirmSuspendUser, setConfirmSuspendUser] = useState<User | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null);

  const tabPanelRef = useRef<HTMLDivElement | null>(null);
  const planCardsRef = useRef<HTMLDivElement | null>(null);

  const selectedPlan = planDrawerId ? planConfigs[planDrawerId] : null;

  const planAnimationKey = useMemo(
    () => Object.keys(planConfigs).sort().join("|"),
    [planConfigs],
  );

  const counts = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        const status = user.status || "pending";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { active: 0, pending: 0, expired: 0, suspended: 0, paused: 0 } as Record<
        string,
        number
      >,
    );
  }, [users]);

  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase();

    return users.filter(user => {
      const status = (user.status || "pending") as AccountStatus;
      const statusMatches =
        userStatusFilter === "all" ? true : status === userStatusFilter;
      if (!statusMatches) return false;

      if (!search) return true;

      const haystack = [
        user.name,
        user.email,
        user.phone,
        user.selectedPlan,
        user._id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [userSearch, userStatusFilter, users]);

  const filteredSubscriptionRows = useMemo(() => {
    const search = subscriptionSearch.trim().toLowerCase();

    return subscriptionRows.filter(row => {
      const planMatches =
        subscriptionPlanFilter === "all"
          ? true
          : row.plan === subscriptionPlanFilter;

      const rowStatus = (row.status || "pending") as AccountStatus;
      const statusMatches =
        subscriptionStatusFilter === "all"
          ? true
          : rowStatus === subscriptionStatusFilter;

      const hasOverrides =
        Boolean(row.customLimits?.branches) || Boolean(row.customLimits?.employees);
      const overrideMatches = subscriptionOnlyOverrides ? hasOverrides : true;

      if (!planMatches || !statusMatches || !overrideMatches) return false;
      if (!search) return true;

      const haystack = [
        row.name,
        row.owner?.name,
        row.owner?.email,
        row._id,
        row.plan,
        planConfigs[row.plan]?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [
    planConfigs,
    subscriptionOnlyOverrides,
    subscriptionPlanFilter,
    subscriptionRows,
    subscriptionSearch,
    subscriptionStatusFilter,
  ]);

  const userTotal = Math.max(users.length, 1);

  const userKpis = useMemo<KpiCardConfig[]>(
    () => [
      {
        label: "Activos",
        value: counts.active,
        helper: "Con acceso vigente",
        progress: Math.round((counts.active / userTotal) * 100),
        tone:
          "from-emerald-400/25 via-emerald-500/12 to-transparent border-emerald-300/30",
        icon: CheckCircle2,
      },
      {
        label: "Pendientes",
        value: counts.pending,
        helper: "Esperando activación",
        progress: Math.round((counts.pending / userTotal) * 100),
        tone:
          "from-amber-300/25 via-amber-500/12 to-transparent border-amber-300/30",
        icon: Clock3,
      },
      {
        label: "Suspendidos",
        value: counts.suspended,
        helper: "Bloqueados manualmente",
        progress: Math.round((counts.suspended / userTotal) * 100),
        tone:
          "from-orange-300/25 via-orange-500/12 to-transparent border-orange-300/30",
        icon: Ban,
      },
      {
        label: "Pausados",
        value: counts.paused,
        helper: "Congelados por ciclo",
        progress: Math.round((counts.paused / userTotal) * 100),
        tone: "from-sky-300/25 via-sky-500/12 to-transparent border-sky-300/30",
        icon: CirclePause,
      },
      {
        label: "Expirados",
        value: counts.expired,
        helper: "Requieren renovación",
        progress: Math.round((counts.expired / userTotal) * 100),
        tone: "from-rose-300/25 via-rose-500/12 to-transparent border-rose-300/30",
        icon: AlertTriangle,
      },
    ],
    [
      counts.active,
      counts.expired,
      counts.pending,
      counts.paused,
      counts.suspended,
      userTotal,
    ],
  );

  const subscriptionKpis = useMemo<KpiCardConfig[]>(
    () => [
      {
        label: "Negocios",
        value: subscriptionSummary.total,
        helper: "Instancias administradas",
        progress: 100,
        tone: "from-sky-400/25 via-sky-500/12 to-transparent border-sky-300/30",
        icon: Users,
      },
      {
        label: "Activos",
        value: subscriptionSummary.byStatus.active,
        helper: "Con acceso productivo",
        progress:
          subscriptionSummary.total > 0
            ? Math.round(
                (subscriptionSummary.byStatus.active / subscriptionSummary.total) *
                  100,
              )
            : 0,
        tone:
          "from-emerald-400/25 via-emerald-500/12 to-transparent border-emerald-300/30",
        icon: Activity,
      },
      {
        label: "Pendientes",
        value: subscriptionSummary.byStatus.pending,
        helper: "En onboarding o validación",
        progress:
          subscriptionSummary.total > 0
            ? Math.round(
                (subscriptionSummary.byStatus.pending /
                  subscriptionSummary.total) *
                  100,
              )
            : 0,
        tone:
          "from-amber-300/25 via-amber-500/12 to-transparent border-amber-300/30",
        icon: CalendarClock,
      },
      {
        label: "Expirados",
        value: subscriptionSummary.byStatus.expired,
        helper: "Pendientes de renovación",
        progress:
          subscriptionSummary.total > 0
            ? Math.round(
                (subscriptionSummary.byStatus.expired /
                  subscriptionSummary.total) *
                  100,
              )
            : 0,
        tone: "from-rose-300/25 via-rose-500/12 to-transparent border-rose-300/30",
        icon: BadgeDollarSign,
      },
    ],
    [subscriptionSummary],
  );

  useEffect(() => {
    if (currentUser?.role !== "god") {
      navigate("/login", { replace: true });
      return;
    }

    const loadUsers = async () => {
      try {
        const data = await userAccessService.list();
        setUsers(data.filter(user => user.role === "super_admin"));
      } catch (err) {
        console.error("god panel list error", err);
        setError("No se pudieron cargar los usuarios");
      } finally {
        setLoading(false);
      }
    };

    void loadUsers();
  }, [currentUser?.role, navigate]);

  useEffect(() => {
    const loadIssues = async () => {
      setIssuesLoading(true);
      setIssuesError(null);

      try {
        const response = await issueService.list(
          issueStatus === "all" ? { limit: 50 } : { status: issueStatus, limit: 50 },
        );
        setIssues(response.data as unknown as IssueReport[]);
      } catch (err) {
        console.error("god panel issues error", err);
        setIssuesError("No se pudieron cargar los reportes");
      } finally {
        setIssuesLoading(false);
      }
    };

    void loadIssues();
  }, [issueStatus]);

  useEffect(() => {
    if (activeTab !== "subscriptions") return;

    void loadSubscriptions().catch(err => {
      console.error("god panel subscriptions error", err);
      setError("No se pudo cargar gestión de suscripciones");
    });
  }, [activeTab, loadSubscriptions]);

  useEffect(() => {
    const context = gsap.context(() => {
      const target = tabPanelRef.current?.querySelector(".god-tab-panel");
      if (target) {
        gsap.fromTo(
          target,
          { autoAlpha: 0, y: 16 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.38,
            ease: "power2.out",
          },
        );
      }
    }, tabPanelRef);

    return () => context.revert();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "subscriptions") return;

    const context = gsap.context(() => {
      const targets = planCardsRef.current?.querySelectorAll(".god-plan-card");
      if (targets && targets.length > 0) {
        gsap.fromTo(
          targets,
          { autoAlpha: 0, y: 20, scale: 0.98 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.45,
            stagger: 0.06,
            ease: "power2.out",
          },
        );
      }
    }, planCardsRef);

    return () => context.revert();
  }, [activeTab, planAnimationKey]);

  const onDurationChange = (
    userId: string,
    field: keyof DurationForm,
    value: string,
  ) => {
    const numeric = Math.max(0, Number(value) || 0);
    setDurations(prev => ({
      ...prev,
      [userId]: {
        ...defaultDuration,
        ...prev[userId],
        [field]: numeric,
      },
    }));
  };

  const getDuration = (userId: string): DurationForm => {
    return durations[userId] || defaultDuration;
  };

  const updateUser = (userId: string, updated: User) => {
    setUsers(prev => prev.map(item => (item._id === userId ? updated : item)));
  };

  const handleAction = async (userId: string, action: ActionKey) => {
    setError(null);
    setFeedback(null);

    const duration = getDuration(userId);
    const key = `${action}-${userId}`;
    setActionKey(key);

    try {
      let updatedUser: User | null = null;

      switch (action) {
        case "activate":
          updatedUser = await userAccessService.activate(userId, duration);
          break;
        case "extend":
          updatedUser = await userAccessService.extend(userId, duration);
          break;
        case "suspend":
          updatedUser = await userAccessService.suspend(userId);
          break;
        case "pause":
          updatedUser = await userAccessService.pause(userId);
          break;
        case "resume":
          updatedUser = await userAccessService.resume(userId);
          break;
        case "remove": {
          const deleteStats = await userAccessService.remove(userId);
          setUsers(prev => prev.filter(item => item._id !== userId));
          setFeedback(
            `Eliminado: ${deleteStats.deletedBusinesses} empresas, ${deleteStats.deletedEmployeeUsers} empleados, ${deleteStats.deletedProducts} productos, ${deleteStats.deletedSales} ventas`,
          );
          setConfirmDeleteUser(null);
          return;
        }
      }

      if (updatedUser) {
        updateUser(userId, updatedUser);
        setFeedback("Cambios guardados");
      }
    } catch (err: any) {
      console.error("god panel action error", err);
      const msg =
        err.response?.data?.message || err.message || "No se pudo completar la acción";
      setError(msg);
    } finally {
      setActionKey(null);
    }
  };

  const handleUpdateIssueStatus = async (
    issueId: string,
    status: "open" | "reviewing" | "closed",
  ) => {
    setIssueAction(issueId);
    try {
      const { report } = await issueService.updateStatus(issueId, status);
      setIssues(prev =>
        prev.map(item =>
          item._id === issueId ? (report as unknown as IssueReport) : item,
        ),
      );
    } catch (err) {
      console.error("god panel issues update error", err);
      setIssuesError("No se pudo actualizar el estado");
    } finally {
      setIssueAction(null);
    }
  };

  const handleSaveGlobalPlans = async () => {
    setError(null);
    setFeedback(null);

    try {
      await saveGlobalPlans();
      setFeedback("Dashboard SaaS actualizado correctamente");
      setPlanDrawerId(null);
    } catch (err: any) {
      console.error("save global settings error", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudieron guardar los planes globales";
      setError(msg);
    }
  };

  const handleSaveBusinessSubscription = async (row: BusinessSubscriptionRow) => {
    setError(null);
    setFeedback(null);

    try {
      await updateBusinessPlan(row);
      setFeedback(`Suscripción actualizada para ${row.name}`);
      setOpenBusinessActionMenuId(null);
    } catch (err: any) {
      console.error("update business subscription error", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudo actualizar la suscripción del negocio";
      setError(msg);
    }
  };

  const handleCreatePlan = () => {
    const nextPlanId = createPlan();
    setPlanDrawerId(nextPlanId);
    setFeedback("Nuevo plan en borrador creado");
  };

  const handleConfirmPlanAction = () => {
    if (!confirmPlanAction) return;

    const planId = confirmPlanAction.planId;
    const planName = planConfigs[planId]?.name || planId;

    if (confirmPlanAction.type === "archive") {
      const result = archivePlan(planId);
      if (!result.ok) {
        setError(result.message || "No se pudo archivar el plan");
      } else {
        setFeedback(`Plan archivado: ${planName}`);
      }
    }

    if (confirmPlanAction.type === "delete") {
      const result = deletePlan(planId);
      if (!result.ok) {
        setError(result.message || "No se pudo eliminar el plan");
      } else {
        setFeedback(`Plan eliminado: ${planName}`);
        if (planDrawerId === planId) {
          setPlanDrawerId(null);
        }
      }
    }

    setConfirmPlanAction(null);
  };

  const updateRowCustomLimit = (
    rowId: string,
    field: "branches" | "employees",
    rawValue: string,
  ) => {
    setRowDraft(rowId, current => {
      const nextValue = normalizeOverrideValue(rawValue);
      const nextLimits = {
        ...(current.customLimits || {}),
        [field]: nextValue,
      };

      const cleaned = {
        ...(nextLimits.branches ? { branches: nextLimits.branches } : {}),
        ...(nextLimits.employees ? { employees: nextLimits.employees } : {}),
      };

      return {
        ...current,
        customLimits: Object.keys(cleaned).length > 0 ? cleaned : undefined,
      };
    });
  };

  const refreshEverything = async () => {
    setLoading(true);
    setError(null);

    try {
      const usersResponse = await userAccessService.list();
      setUsers(usersResponse.filter(user => user.role === "super_admin"));

      if (activeTab === "subscriptions") {
        await loadSubscriptions();
      }

      if (activeTab === "issues") {
        const issuesResponse = await issueService.list(
          issueStatus === "all" ? { limit: 50 } : { status: issueStatus, limit: 50 },
        );
        setIssues(issuesResponse.data as unknown as IssueReport[]);
      }

      setFeedback("Centro de mando actualizado");
    } catch (err: any) {
      console.error("god panel refresh error", err);
      const msg = err.response?.data?.message || err.message || "No se pudo refrescar";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (currentUser?.role !== "god") {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="animate-pulse rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-6 py-4">
          Cargando panel GOD...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(16,185,129,0.08),transparent_50%),linear-gradient(to_bottom_right,#020617,#0f172a,#111827)] px-4 py-10 pb-32 text-white">
      <div className="mx-auto max-w-7xl space-y-8 font-['Space_Grotesk',ui-sans-serif]">
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/65 px-6 py-6 shadow-[0_20px_90px_-40px_rgba(34,211,238,0.5)] backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-cyan-300/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-emerald-300/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
                Modo GOD
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Command Center SaaS
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Gobierno de usuarios, suscripciones y operación crítica con flujos
                seguros y trazables.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {feedback && (
                <span className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                  {feedback}
                </span>
              )}
              {error && (
                <span className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {error}
                </span>
              )}

              <button
                onClick={() => void refreshEverything()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-50 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-200/60 hover:bg-cyan-500/25"
              >
                <RefreshCw className="h-4 w-4" />
                Refrescar
              </button>

              <button
                onClick={() => {
                  authService.logout();
                  navigate("/login/god", { replace: true });
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/12"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-900/55 p-2 backdrop-blur xl:grid-cols-3">
          {[
            {
              key: "users",
              label: "Usuarios",
              subtitle: "Acceso y vigencias",
              icon: Users,
            },
            {
              key: "issues",
              label: "Reportes",
              subtitle: "Errores internos",
              icon: AlertTriangle,
            },
            {
              key: "subscriptions",
              label: "Suscripciones",
              subtitle: "Planes y negocios",
              icon: BadgeDollarSign,
            },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`group rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                  isActive
                    ? "border-cyan-300/45 bg-cyan-500/20 shadow-[0_8px_30px_-20px_rgba(34,211,238,0.8)]"
                    : "border-white/10 bg-white/5 hover:border-cyan-300/30 hover:bg-cyan-500/10"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{tab.label}</p>
                    <p className="text-xs text-slate-300">{tab.subtitle}</p>
                  </div>
                  <Icon className="h-4 w-4 text-cyan-100/90" />
                </div>
              </button>
            );
          })}
        </div>

        <div ref={tabPanelRef}>
          {activeTab === "users" && (
            <div className="god-tab-panel space-y-6">
              <section className="rounded-2xl border border-white/10 bg-slate-900/55 p-4 backdrop-blur">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    value={userSearch}
                    onChange={event => setUserSearch(event.target.value)}
                    placeholder="Buscar por nombre, email, teléfono, plan o ID..."
                    className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none"
                  />
                  <select
                    value={userStatusFilter}
                    onChange={event =>
                      setUserStatusFilter(event.target.value as "all" | AccountStatus)
                    }
                    className="min-h-11 rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="active">Activos</option>
                    <option value="pending">Pendientes</option>
                    <option value="expired">Expirados</option>
                    <option value="suspended">Suspendidos</option>
                    <option value="paused">Pausados</option>
                  </select>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Mostrando {filteredUsers.length} de {users.length} super admins.
                </p>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {userKpis.map(card => (
                  <KpiInsightCard key={card.label} {...card} />
                ))}
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-900/65 shadow-xl shadow-black/40">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-white/3 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                      Usuarios
                    </p>
                    <h2 className="text-lg font-bold text-white">Super admins</h2>
                    <p className="text-xs text-slate-400">
                      Ajusta vigencias y estado con confirmación para acciones críticas.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  {filteredUsers.map(user => {
                    const duration = getDuration(user._id);
                    const isSelf = currentUser?._id === user._id;
                    const loadingThis = actionKey?.endsWith(user._id) || false;

                    return (
                      <div
                        key={user._id}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm shadow-black/20 transition-all duration-300 hover:border-cyan-300/35 hover:bg-cyan-500/4"
                      >
                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-12 space-y-2 sm:col-span-8">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-white">
                                {user._id.slice(-6)}
                              </span>
                              <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-cyan-100">
                                {user.role}
                              </span>
                              <span className="text-slate-500">•</span>
                              <span>{user.email}</span>
                              {user.phone && (
                                <span className="text-slate-500">· {user.phone}</span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <div>
                                <p className="text-base font-semibold text-white">{user.name}</p>
                                <p className="text-xs text-slate-400">Super admin</p>
                              </div>

                              <span
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                                  statusBadgeStyles[user.status || "pending"] ||
                                  "border-gray-500/40 bg-gray-500/10 text-gray-200"
                                }`}
                              >
                                <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                                {formatStatus(user.status)}
                              </span>

                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                                Expira: {formatDateTime(user.subscriptionExpiresAt)}
                              </span>

                              {user.selectedPlan && (
                                <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                                  Plan solicitado: {user.selectedPlan}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="col-span-12 flex flex-wrap items-center gap-2 sm:col-span-4 sm:justify-end">
                            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs">
                              <label className="text-slate-300">D</label>
                              <input
                                type="number"
                                min={0}
                                value={duration.days}
                                onChange={event =>
                                  onDurationChange(user._id, "days", event.target.value)
                                }
                                className="w-12 rounded bg-transparent px-2 py-1 text-white outline-none"
                              />
                              <label className="text-slate-300">M</label>
                              <input
                                type="number"
                                min={0}
                                value={duration.months}
                                onChange={event =>
                                  onDurationChange(user._id, "months", event.target.value)
                                }
                                className="w-12 rounded bg-transparent px-2 py-1 text-white outline-none"
                              />
                              <label className="text-slate-300">A</label>
                              <input
                                type="number"
                                min={0}
                                value={duration.years}
                                onChange={event =>
                                  onDurationChange(user._id, "years", event.target.value)
                                }
                                className="w-12 rounded bg-transparent px-2 py-1 text-white outline-none"
                              />
                            </div>

                            {user.status !== "active" && (
                              <ActionButton
                                label="Activar"
                                tone="primary"
                                disabled={isSelf}
                                loading={
                                  loadingThis && actionKey?.startsWith("activate")
                                }
                                onClick={() => void handleAction(user._id, "activate")}
                              />
                            )}

                            <ActionButton
                              label="Extender"
                              tone="muted"
                              disabled={isSelf}
                              loading={loadingThis && actionKey?.startsWith("extend")}
                              onClick={() => void handleAction(user._id, "extend")}
                            />

                            {user.status === "active" && (
                              <ActionButton
                                label="Pausar"
                                tone="info"
                                disabled={isSelf}
                                loading={loadingThis && actionKey?.startsWith("pause")}
                                onClick={() => void handleAction(user._id, "pause")}
                              />
                            )}

                            {user.status === "paused" && (
                              <ActionButton
                                label="Reanudar"
                                tone="success"
                                disabled={isSelf}
                                loading={loadingThis && actionKey?.startsWith("resume")}
                                onClick={() => void handleAction(user._id, "resume")}
                              />
                            )}

                            {user.status !== "suspended" && (
                              <ActionButton
                                label="Suspender"
                                tone="warning"
                                disabled={isSelf}
                                loading={
                                  loadingThis && actionKey?.startsWith("suspend")
                                }
                                onClick={() => setConfirmSuspendUser(user)}
                              />
                            )}

                            <ActionButton
                              label="Eliminar"
                              tone="danger"
                              disabled={isSelf}
                              loading={loadingThis && actionKey?.startsWith("remove")}
                              onClick={() => setConfirmDeleteUser(user)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/20 bg-black/20 px-4 py-8 text-center text-sm text-slate-400">
                      No hay usuarios que coincidan con el filtro actual.
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === "subscriptions" && (
            <div className="god-tab-panel space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {subscriptionKpis.map(card => (
                  <KpiInsightCard key={card.label} {...card} />
                ))}
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-900/65 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                      Configuración SaaS
                    </p>
                    <h2 className="text-xl font-bold text-white">
                      Dashboard de gestión de productos
                    </h2>
                    <p className="text-xs text-slate-400">
                      Planes editables en side-drawer con CRUD completo y vista de impacto
                      en tiempo real.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100">
                      <input
                        type="checkbox"
                        checked={maintenanceMode}
                        onChange={event => setMaintenanceMode(event.target.checked)}
                      />
                      Modo mantenimiento
                    </label>

                    <button
                      onClick={handleCreatePlan}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-50 transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-500/25"
                    >
                      <Plus className="h-4 w-4" />
                      Nuevo plan
                    </button>
                  </div>
                </div>

                {subscriptionsLoading ? (
                  <SubscriptionsSkeleton />
                ) : (
                  <div className="space-y-4">
                    {error && (
                      <div className="flex items-center gap-3 rounded-xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-100 shadow-lg shadow-red-900/10">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
                        <p>{error}</p>
                        <button
                          onClick={() => setError(null)}
                          className="ml-auto text-xs font-bold uppercase tracking-wider text-red-300 hover:text-white"
                        >
                          Cerrar
                        </button>
                      </div>
                    )}

                    {feedback && (
                      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-sm text-emerald-100 shadow-lg shadow-emerald-900/10">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                        <p>{feedback}</p>
                        <button
                          onClick={() => setFeedback(null)}
                          className="ml-auto text-xs font-bold uppercase tracking-wider text-emerald-300 hover:text-white"
                        >
                          Cerrar
                        </button>
                      </div>
                    )}

                    <div ref={planCardsRef} className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {Object.values(planConfigs)
                      .sort((a, b) => a.monthlyPrice - b.monthlyPrice)
                      .map(plan => {
                        const businessesInPlan = subscriptionSummary.byPlan[plan.id] || 0;
                        const isArchived = plan.status === "archived";
                        const isDefault = defaultPlan === plan.id;

                        return (
                          <article
                            key={plan.id}
                            className={`god-plan-card rounded-2xl border bg-white/5 p-4 shadow-lg shadow-black/30 ${
                              isArchived
                                ? "border-amber-300/35"
                                : "border-cyan-300/25"
                            }`}
                          >
                            <div className="mb-3 flex items-start justify-between gap-2">
                              <div>
                                <p className="text-base font-bold text-white">{plan.name}</p>
                                <p className="text-xs text-slate-400">{plan.id}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {isDefault && (
                                  <span className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                                    Default
                                  </span>
                                )}
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                                    isArchived
                                      ? "border-amber-300/40 bg-amber-500/10 text-amber-100"
                                      : "border-cyan-300/40 bg-cyan-500/10 text-cyan-100"
                                  }`}
                                >
                                  {isArchived ? "Archivado" : "Activo"}
                                </span>
                              </div>
                            </div>

                            <p className="mb-3 min-h-10 text-xs text-slate-300">
                              {plan.description || "Sin descripción configurada."}
                            </p>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                                  Mensual
                                </p>
                                <p className="text-sm font-semibold text-white">
                                  {plan.currency} {plan.monthlyPrice}
                                </p>
                              </div>
                              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                                  Anual
                                </p>
                                <p className="text-sm font-semibold text-white">
                                  {plan.currency} {plan.yearlyPrice}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                              <div className="flex items-center justify-between text-xs text-slate-300">
                                <span>Sedes</span>
                                <strong>{plan.limits.branches}</strong>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                                <span>Employees</span>
                                <strong>{plan.limits.employees}</strong>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                                <span>Business Assistant</span>
                                <strong>
                                  {plan.features.businessAssistant ? "Sí" : "No"}
                                </strong>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                                <span>Negocios en plan</span>
                                <strong>{businessesInPlan}</strong>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => setPlanDrawerId(plan.id)}
                                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/12"
                              >
                                <PencilLine className="h-4 w-4" />
                                Editar
                              </button>

                              <button
                                onClick={() =>
                                  setConfirmPlanAction({
                                    type: "archive",
                                    planId: plan.id,
                                  })
                                }
                                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-500/20"
                              >
                                <Archive className="h-4 w-4" />
                                Archivar
                              </button>

                              <button
                                onClick={() =>
                                  setConfirmPlanAction({
                                    type: "delete",
                                    planId: plan.id,
                                  })
                                }
                                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                Eliminar
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    disabled={!isGlobalSettingsDirty}
                    onClick={() => {
                      resetGlobalDraft();
                      setFeedback("Cambios de planes descartados");
                    }}
                    className="inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Restablecer
                  </button>
                  <button
                    disabled={
                      subscriptionAction === "global-settings" || !isGlobalSettingsDirty
                    }
                    onClick={() => void handleSaveGlobalPlans()}
                    className="inline-flex min-h-11 items-center rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-50 transition-all duration-300 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {subscriptionAction === "global-settings"
                      ? "Guardando..."
                      : "Guardar dashboard SaaS"}
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-900/65 p-5">
                <div className="mb-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-white">
                      Negocios y suscripción
                    </h3>
                    <button
                      onClick={() =>
                        void loadSubscriptions()
                          .then(() => setFeedback("Suscripciones recargadas"))
                          .catch(() =>
                            setError("No se pudo refrescar la grilla de suscripciones"),
                          )
                      }
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition-all duration-300 hover:bg-white/10"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refrescar
                    </button>
                  </div>

                  <div className="grid gap-2 xl:grid-cols-5">
                    <input
                      value={subscriptionSearch}
                      onChange={event => setSubscriptionSearch(event.target.value)}
                      placeholder="Buscar negocio, owner, email o ID..."
                      className="min-h-11 rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none xl:col-span-2"
                    />

                    <select
                      value={subscriptionPlanFilter}
                      onChange={event => setSubscriptionPlanFilter(event.target.value)}
                      className="min-h-11 rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                    >
                      <option value="all">Todos los planes</option>
                      {Object.values(planConfigs).map(plan => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} ({plan.id})
                        </option>
                      ))}
                    </select>

                    <select
                      value={subscriptionStatusFilter}
                      onChange={event =>
                        setSubscriptionStatusFilter(
                          event.target.value as "all" | AccountStatus,
                        )
                      }
                      className="min-h-11 rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                    >
                      <option value="all">Todos los estados</option>
                      <option value="active">Activo</option>
                      <option value="pending">Pendiente</option>
                      <option value="expired">Expirado</option>
                      <option value="suspended">Suspendido</option>
                      <option value="paused">Pausado</option>
                    </select>

                    <label className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-xs font-semibold text-slate-200">
                      <input
                        type="checkbox"
                        checked={subscriptionOnlyOverrides}
                        onChange={event => setSubscriptionOnlyOverrides(event.target.checked)}
                      />
                      Solo overrides
                    </label>
                  </div>

                  <p className="text-xs text-slate-400">
                    Mostrando {filteredSubscriptionRows.length} de {subscriptionRows.length}{" "}
                    negocios.
                  </p>
                </div>

                {subscriptionsLoading ? (
                  <SubscriptionsSkeleton />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="min-w-[1120px] divide-y divide-white/10 text-sm">
                      <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-300">
                        <tr>
                          <th className="px-3 py-3">Negocio</th>
                          <th className="px-3 py-3">Estado</th>
                          <th className="px-3 py-3">Plan</th>
                          <th className="px-3 py-3">Uso / Límite</th>
                          <th className="px-3 py-3">Overrides</th>
                          <th className="px-3 py-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 bg-slate-950/40 text-slate-100">
                        {filteredSubscriptionRows.map(row => {
                          const dirty = isRowDirty(row);
                          const effectiveLimits = getEffectiveLimits(row);
                          const usageBranches = row.limits?.usage?.branches || 0;
                          const usageEmployees = row.limits?.usage?.employees || 0;

                          const branchesPressure = Math.min(
                            100,
                            Math.round(
                              (usageBranches / Math.max(effectiveLimits.branches, 1)) *
                                100,
                            ),
                          );
                          const employeesPressure = Math.min(
                            100,
                            Math.round(
                              (usageEmployees / Math.max(effectiveLimits.employees, 1)) *
                                100,
                            ),
                          );

                          return (
                            <tr key={row._id} className="hover:bg-cyan-500/4">
                              <td className="px-3 py-3 align-top">
                                <p className="font-semibold text-white">{row.name}</p>
                                <p className="text-xs text-slate-400">
                                  {row.owner?.email || "Sin owner"}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">ID: {row._id}</p>
                              </td>
                              <td className="px-3 py-3 align-top">
                                <span
                                  className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                                    statusBadgeStyles[row.status || "pending"] ||
                                    "border-gray-500/40 bg-gray-500/10 text-gray-200"
                                  }`}
                                >
                                  <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                                  {formatStatus(row.status)}
                                </span>
                                {dirty && (
                                  <span className="mt-2 inline-flex rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                                    Cambios
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <select
                                  value={row.plan}
                                  onChange={event =>
                                    setRowDraft(row._id, current => ({
                                      ...current,
                                      plan: event.target.value,
                                    }))
                                  }
                                  className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-950/75 px-2 py-2 text-xs text-white focus:border-cyan-300 focus:outline-none"
                                >
                                  {getPlanOptionsForRow(row.plan).map(planOption => (
                                    <option key={planOption.id} value={planOption.id}>
                                      {planOption.name} ({planOption.id})
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-2 text-[11px] text-slate-500">
                                  Default: {defaultPlan}
                                </p>
                              </td>
                              <td className="px-3 py-3 align-top">
                                <div className="space-y-2 text-xs">
                                  <div>
                                    <div className="mb-1 flex justify-between text-slate-300">
                                      <span>Sedes</span>
                                      <span>
                                        {usageBranches}/{effectiveLimits.branches}
                                      </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                      <div
                                        className="h-full rounded-full bg-emerald-400/80"
                                        style={{ width: `${branchesPressure}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="mb-1 flex justify-between text-slate-300">
                                      <span>Employees</span>
                                      <span>
                                        {usageEmployees}/{effectiveLimits.employees}
                                      </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                      <div
                                        className="h-full rounded-full bg-cyan-400/80"
                                        style={{ width: `${employeesPressure}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 align-top">
                                <div className="grid gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    placeholder="Sedes"
                                    value={row.customLimits?.branches ?? ""}
                                    onChange={event =>
                                      updateRowCustomLimit(
                                        row._id,
                                        "branches",
                                        event.target.value,
                                      )
                                    }
                                    className="min-h-11 rounded-xl border border-white/15 bg-slate-950/75 px-2 py-2 text-xs text-white focus:border-cyan-300 focus:outline-none"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    placeholder="Employees"
                                    value={row.customLimits?.employees ?? ""}
                                    onChange={event =>
                                      updateRowCustomLimit(
                                        row._id,
                                        "employees",
                                        event.target.value,
                                      )
                                    }
                                    className="min-h-11 rounded-xl border border-white/15 bg-slate-950/75 px-2 py-2 text-xs text-white focus:border-cyan-300 focus:outline-none"
                                  />
                                </div>
                              </td>
                              <td className="relative px-3 py-3 align-top">
                                <button
                                  onClick={() =>
                                    setOpenBusinessActionMenuId(prev =>
                                      prev === row._id ? null : row._id,
                                    )
                                  }
                                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-slate-200 transition-all duration-300 hover:bg-white/10"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>

                                {openBusinessActionMenuId === row._id && (
                                  <div className="absolute right-3 top-16 z-20 w-52 rounded-xl border border-white/15 bg-slate-950/95 p-2 shadow-2xl shadow-black/70">
                                    <button
                                      onClick={() =>
                                        void handleSaveBusinessSubscription(row)
                                      }
                                      disabled={
                                        subscriptionAction === `subscription-${row._id}` ||
                                        !isRowDirty(row)
                                      }
                                      className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-xs font-semibold text-cyan-100 transition-all duration-300 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Guardar cambios
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRowDraft(row._id, current => ({
                                          ...current,
                                          customLimits: undefined,
                                        }));
                                        setOpenBusinessActionMenuId(null);
                                      }}
                                      className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-xs font-semibold text-slate-100 transition-all duration-300 hover:bg-white/10"
                                    >
                                      Reset overrides
                                    </button>
                                    <button
                                      onClick={() => {
                                        void navigator.clipboard
                                          .writeText(row._id)
                                          .then(() =>
                                            setFeedback(`ID copiado: ${row._id.slice(-6)}`),
                                          )
                                          .catch(() =>
                                            setError("No se pudo copiar el ID"),
                                          );
                                        setOpenBusinessActionMenuId(null);
                                      }}
                                      className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-xs font-semibold text-slate-100 transition-all duration-300 hover:bg-white/10"
                                    >
                                      Copiar ID
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {filteredSubscriptionRows.length === 0 && !subscriptionsLoading && (
                  <div className="mt-3 rounded-xl border border-dashed border-white/20 bg-black/20 px-4 py-8 text-center text-sm text-slate-400">
                    No hay negocios que coincidan con el filtro actual.
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === "issues" && (
            <div className="god-tab-panel rounded-2xl border border-white/10 bg-slate-900/65 p-6 shadow-xl shadow-black/40">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                    Reportes internos
                  </p>
                  <h2 className="text-xl font-bold">Buzón de fallos</h2>
                  <p className="text-sm text-slate-400">
                    Logs, contexto y capturas enviados desde la app.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={issueStatus}
                    onChange={event =>
                      setIssueStatus(
                        event.target.value as "all" | "open" | "reviewing" | "closed",
                      )
                    }
                    className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                  >
                    <option value="all">Todos</option>
                    <option value="open">Abiertos</option>
                    <option value="reviewing">En revisión</option>
                    <option value="closed">Cerrados</option>
                  </select>
                  <button
                    onClick={() =>
                      void issueService
                        .list(
                          issueStatus === "all"
                            ? { limit: 50 }
                            : { status: issueStatus, limit: 50 },
                        )
                        .then(response => {
                          setIssues(response.data as unknown as IssueReport[]);
                          setFeedback("Reportes actualizados");
                        })
                        .catch(() => {
                          setIssuesError("No se pudieron cargar los reportes");
                        })
                    }
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-50 transition-all duration-300 hover:bg-cyan-500/25"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refrescar
                  </button>
                </div>
              </div>

              {issuesError && (
                <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                  {issuesError}
                </div>
              )}

              {issuesLoading ? (
                <div className="flex h-48 items-center justify-center text-sm text-slate-300">
                  Cargando reportes...
                </div>
              ) : issues.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">
                  No hay reportes con este filtro.
                </div>
              ) : (
                <div className="space-y-3">
                  {issues.map(report => (
                    <div
                      key={report._id}
                      className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/20"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-cyan-200">
                              {report.user?.role || "-"}
                            </span>
                            <span>{report.user?.name || "Usuario"}</span>
                            <span className="text-slate-500">•</span>
                            <span>
                              {report.createdAt
                                ? new Date(report.createdAt).toLocaleString("es-ES", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })
                                : "-"}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-white">{report.message}</p>
                          {report.clientContext?.url && (
                            <p className="text-xs text-slate-400">
                              URL: {report.clientContext.url}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                              report.status === "open"
                                ? "bg-red-500/20 text-red-200"
                                : report.status === "reviewing"
                                  ? "bg-amber-500/20 text-amber-100"
                                  : "bg-emerald-500/20 text-emerald-100"
                            }`}
                          >
                            {report.status}
                          </span>

                          <button
                            disabled={issueAction === report._id}
                            onClick={() =>
                              void handleUpdateIssueStatus(report._id, "open")
                            }
                            className="min-h-11 rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition-all duration-300 hover:border-white/40 hover:bg-white/10 disabled:opacity-50"
                          >
                            Reabrir
                          </button>

                          <button
                            disabled={issueAction === report._id}
                            onClick={() =>
                              void handleUpdateIssueStatus(report._id, "reviewing")
                            }
                            className="min-h-11 rounded-lg border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-50 transition-all duration-300 hover:border-amber-300/60 hover:bg-amber-500/30 disabled:opacity-50"
                          >
                            Revisando
                          </button>

                          <button
                            disabled={issueAction === report._id}
                            onClick={() =>
                              void handleUpdateIssueStatus(report._id, "closed")
                            }
                            className="min-h-11 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-50 transition-all duration-300 hover:border-emerald-300/60 hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>

                      {(report.logs?.length ?? 0) > 0 && (
                        <details className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200">
                          <summary className="cursor-pointer text-slate-300">
                            Ver logs ({report.logs?.length})
                          </summary>
                          <pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-300">
                            {report.logs?.join("\n")}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedPlan && (
          <div className="fixed inset-0 z-50 flex">
            <button
              onClick={() => setPlanDrawerId(null)}
              className="h-full w-full bg-black/70"
            />

            <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-white/15 bg-slate-950/95 p-6 shadow-2xl shadow-black/80 backdrop-blur-xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                    Editor de plan
                  </p>
                  <h3 className="text-xl font-bold text-white">{selectedPlan.name}</h3>
                  <p className="text-xs text-slate-400">ID: {selectedPlan.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleSaveGlobalPlans()}
                    disabled={
                      subscriptionAction === "global-settings" || !isGlobalSettingsDirty
                    }
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-50 transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-cyan-900/10"
                  >
                    {subscriptionAction === "global-settings" ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Guardar
                  </button>
                  <button
                    onClick={() => setPlanDrawerId(null)}
                    className="min-h-11 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/12 transition-all duration-300"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                    Nombre
                  </span>
                  <input
                    type="text"
                    value={selectedPlan.name}
                    onChange={event =>
                      updatePlanConfig(selectedPlan.id, { name: event.target.value })
                    }
                    className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                    Descripción
                  </span>
                  <textarea
                    rows={3}
                    value={selectedPlan.description || ""}
                    onChange={event =>
                      updatePlanConfig(selectedPlan.id, {
                        description: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                      Precio mensual
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={selectedPlan.monthlyPrice}
                      onChange={event =>
                        updatePlanConfig(selectedPlan.id, {
                          monthlyPrice: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                      className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                      Precio anual
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={selectedPlan.yearlyPrice}
                      onChange={event =>
                        updatePlanConfig(selectedPlan.id, {
                          yearlyPrice: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                      className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                      Límite sedes
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={selectedPlan.limits.branches}
                      onChange={event =>
                        updatePlanConfig(selectedPlan.id, current => ({
                          limits: {
                            ...current.limits,
                            branches: Math.max(1, Number(event.target.value) || 1),
                          },
                        }))
                      }
                      className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                      Límite employees
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={selectedPlan.limits.employees}
                      onChange={event =>
                        updatePlanConfig(selectedPlan.id, current => ({
                          limits: {
                            ...current.limits,
                            employees: Math.max(1, Number(event.target.value) || 1),
                          },
                        }))
                      }
                      className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                      Moneda
                    </span>
                    <input
                      type="text"
                      value={selectedPlan.currency}
                      onChange={event =>
                        updatePlanConfig(selectedPlan.id, {
                          currency: event.target.value.toUpperCase(),
                        })
                      }
                      className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                    />
                  </label>

                  <label className="inline-flex min-h-11 items-center justify-between rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-slate-100">
                    Business Assistant
                    <input
                      type="checkbox"
                      checked={selectedPlan.features.businessAssistant}
                      onChange={event =>
                        updatePlanConfig(selectedPlan.id, current => ({
                          features: {
                            ...current.features,
                            businessAssistant: event.target.checked,
                          },
                        }))
                      }
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                    Features list (línea o coma)
                  </span>
                  <textarea
                    rows={4}
                    value={selectedPlan.featuresList.join("\n")}
                    onChange={event =>
                      updatePlanConfig(selectedPlan.id, {
                        featuresList: normalizeFeatureListInput(event.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => {
                      const changed = setPlanAsDefault(selectedPlan.id);
                      if (!changed) {
                        setError("Solo planes activos pueden ser predeterminados");
                      } else {
                        setFeedback(`Plan predeterminado: ${selectedPlan.name}`);
                      }
                    }}
                    disabled={selectedPlan.status === "archived"}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition-all duration-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {defaultPlan === selectedPlan.id
                      ? "Plan predeterminado"
                      : "Marcar como predeterminado"}
                  </button>

                  <button
                    onClick={() =>
                      setConfirmPlanAction({ type: "archive", planId: selectedPlan.id })
                    }
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 transition-all duration-300 hover:bg-amber-500/20"
                  >
                    Archivar plan
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => void handleSaveGlobalPlans()}
                    disabled={
                      subscriptionAction === "global-settings" || !isGlobalSettingsDirty
                    }
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/45 bg-cyan-500/25 px-4 py-3 text-sm font-bold text-cyan-50 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/60 hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-50 shadow-xl shadow-cyan-900/20"
                  >
                    {subscriptionAction === "global-settings" ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                    Guardar Cambios en Plan
                  </button>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300">
                  Los cambios de límites se reflejan al instante en la tabla de
                  "Negocios y suscripción" para validar impacto antes de guardar.
                </div>
              </div>
            </aside>
          </div>
        )}

        {confirmSuspendUser && (
          <ConfirmDialog
            title="Suspender usuario"
            description={`Confirma la suspensión de ${confirmSuspendUser.name}. El acceso se bloqueará inmediatamente.`}
            tone="warning"
            confirmLabel="Sí, suspender"
            onCancel={() => setConfirmSuspendUser(null)}
            onConfirm={() => {
              void handleAction(confirmSuspendUser._id, "suspend");
              setConfirmSuspendUser(null);
            }}
          />
        )}

        {confirmDeleteUser && (
          <ConfirmDialog
            title="Eliminar usuario"
            description={`Se eliminará la cuenta ${confirmDeleteUser.email} y toda su data asociada. Esta acción no se puede deshacer.`}
            tone="danger"
            confirmLabel="Sí, eliminar"
            onCancel={() => setConfirmDeleteUser(null)}
            onConfirm={() => {
              void handleAction(confirmDeleteUser._id, "remove");
              setConfirmDeleteUser(null);
            }}
          />
        )}

        {confirmPlanAction && (
          <ConfirmDialog
            title={
              confirmPlanAction.type === "archive"
                ? "Archivar plan"
                : "Eliminar plan"
            }
            description={
              confirmPlanAction.type === "archive"
                ? "El plan dejará de estar disponible para nuevas asignaciones."
                : "Esta acción elimina el plan del catálogo si no tiene negocios asignados."
            }
            tone={confirmPlanAction.type === "archive" ? "warning" : "danger"}
            confirmLabel={
              confirmPlanAction.type === "archive" ? "Archivar" : "Eliminar"
            }
            onCancel={() => setConfirmPlanAction(null)}
            onConfirm={handleConfirmPlanAction}
          />
        )}
      </div>
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  tone: "primary" | "muted" | "warning" | "danger" | "success" | "info";
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

function KpiInsightCard({
  label,
  value,
  helper,
  progress,
  tone,
  icon: Icon,
}: KpiCardConfig) {
  return (
    <div className={`bg-linear-to-br rounded-2xl border ${tone} p-4 shadow-lg shadow-black/25`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-200">{label}</p>
        <Icon className="h-4 w-4 text-white/80" />
      </div>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{helper}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/12">
        <div
          className="h-full rounded-full bg-white/80"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  tone,
  disabled,
  loading,
  onClick,
}: ActionButtonProps) {
  const styles: Record<ActionButtonProps["tone"], string> = {
    primary: "border-cyan-400/40 bg-cyan-500/20 text-cyan-50",
    muted: "border-white/20 bg-white/5 text-white",
    warning: "border-amber-500/40 bg-amber-500/20 text-amber-50",
    danger: "border-red-500/40 bg-red-500/15 text-red-100",
    success: "border-emerald-500/40 bg-emerald-500/20 text-emerald-100",
    info: "border-sky-500/40 bg-sky-500/20 text-sky-100",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-300 active:scale-[0.98] ${
        styles[tone]
      } ${disabled ? "opacity-50" : "hover:border-white/60 hover:bg-white/10"}`}
    >
      {loading && (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
      )}
      <span>{label}</span>
    </button>
  );
}

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  tone: "warning" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  tone,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const toneStyles =
    tone === "danger"
      ? "border-red-500/35 bg-red-500/10 text-red-100"
      : "border-amber-400/35 bg-amber-500/10 text-amber-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-950/95 p-5 shadow-2xl shadow-black/70">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <AlertTriangle className="h-5 w-5 text-amber-300" />
          {title}
        </div>
        <p className="text-sm text-slate-300">{description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:bg-white/12"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-300 hover:brightness-110 ${toneStyles}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionsSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`skeleton-plan-${index}`}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="h-4 w-24 rounded bg-white/12" />
            <div className="mt-3 h-3 w-40 rounded bg-white/10" />
            <div className="mt-4 h-14 rounded-xl bg-white/8" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`skeleton-row-${index}`}
            className="mb-3 h-12 rounded-xl bg-white/8 last:mb-0"
          />
        ))}
      </div>
    </div>
  );
}
