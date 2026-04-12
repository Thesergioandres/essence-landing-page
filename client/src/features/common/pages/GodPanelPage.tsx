import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { authService } from "../../auth/services";
import type { User } from "../../auth/types/auth.types";
import {
  globalSettingsService,
  issueService,
  userAccessService,
} from "../../common/services";
import type { IssueReport } from "../types/common.types";

interface DurationForm {
  days: number;
  months: number;
  years: number;
}

type PlanKey = "starter" | "pro" | "enterprise";
type AccountStatus = "active" | "pending" | "expired" | "suspended" | "paused";

interface PlanCardConfig {
  id: PlanKey;
  name: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  limits: {
    branches: number;
    employees: number;
  };
  features: {
    businessAssistant: boolean;
  };
}

interface SubscriptionBusinessRow {
  _id: string;
  name: string;
  status?: string;
  owner?: {
    _id: string;
    name: string;
    email: string;
    status?: string;
  } | null;
  plan: PlanKey;
  customLimits?: {
    branches?: number;
    employees?: number;
  } | null;
  limits?: {
    limits: { branches: number; employees: number };
    usage: { branches: number; employees: number };
  } | null;
}

type ActionKey =
  | "activate"
  | "extend"
  | "suspend"
  | "pause"
  | "resume"
  | "remove";

const statusBadgeStyles: Record<string, string> = {
  active: "border-green-500/40 bg-green-500/10 text-green-200",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  expired: "border-red-500/40 bg-red-500/10 text-red-200",
  suspended: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  paused: "border-sky-500/40 bg-sky-500/10 text-sky-200",
};

const defaultDuration: DurationForm = { days: 30, months: 0, years: 0 };
const PLAN_KEYS: PlanKey[] = ["starter", "pro", "enterprise"];

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

export default function GodPanel() {
  const currentUser = authService.getCurrentUser();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [durations, setDurations] = useState<Record<string, DurationForm>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [issueStatus, setIssueStatus] = useState<
    "all" | "open" | "reviewing" | "closed"
  >("open");
  const [issueAction, setIssueAction] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);

  const [activeTab, setActiveTab] = useState<
    "users" | "issues" | "subscriptions"
  >("users");
  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState<
    "all" | AccountStatus
  >("all");
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionRows, setSubscriptionRows] = useState<
    SubscriptionBusinessRow[]
  >([]);
  const [initialSubscriptionRows, setInitialSubscriptionRows] = useState<
    SubscriptionBusinessRow[]
  >([]);
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionPlanFilter, setSubscriptionPlanFilter] = useState<
    "all" | PlanKey
  >("all");
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<
    "all" | AccountStatus
  >("all");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [initialMaintenanceMode, setInitialMaintenanceMode] = useState(false);
  const [planConfigs, setPlanConfigs] = useState<
    Record<PlanKey, PlanCardConfig>
  >({
    starter: {
      id: "starter",
      name: "Starter",
      description: "",
      monthlyPrice: 19,
      yearlyPrice: 190,
      currency: "USD",
      limits: { branches: 1, employees: 2 },
      features: { businessAssistant: false },
    },
    pro: {
      id: "pro",
      name: "Pro",
      description: "",
      monthlyPrice: 49,
      yearlyPrice: 490,
      currency: "USD",
      limits: { branches: 3, employees: 10 },
      features: { businessAssistant: false },
    },
    enterprise: {
      id: "enterprise",
      name: "Enterprise",
      description: "",
      monthlyPrice: 99,
      yearlyPrice: 990,
      currency: "USD",
      limits: { branches: 10, employees: 50 },
      features: { businessAssistant: true },
    },
  });
  const [initialPlanConfigs, setInitialPlanConfigs] =
    useState<Record<PlanKey, PlanCardConfig>>(planConfigs);

  const loadIssues = async (
    status: "all" | "open" | "reviewing" | "closed" = "open"
  ) => {
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const res = await issueService.list(
        status === "all" ? { limit: 50 } : { status, limit: 50 }
      );
      setIssues(res.data as any);
    } catch (err) {
      console.error("god panel issues error", err);
      setIssuesError("No se pudieron cargar los reportes");
    } finally {
      setIssuesLoading(false);
    }
  };

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
      >
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

      if (!planMatches || !statusMatches) return false;

      if (!search) return true;
      const haystack = [row.name, row.owner?.name, row.owner?.email, row._id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [
    subscriptionPlanFilter,
    subscriptionRows,
    subscriptionSearch,
    subscriptionStatusFilter,
  ]);

  const subscriptionSummary = useMemo(() => {
    const byPlan: Record<PlanKey, number> = {
      starter: 0,
      pro: 0,
      enterprise: 0,
    };
    const byStatus: Record<AccountStatus, number> = {
      active: 0,
      pending: 0,
      expired: 0,
      suspended: 0,
      paused: 0,
    };

    subscriptionRows.forEach(row => {
      byPlan[row.plan] += 1;
      const status = (row.status || "pending") as AccountStatus;
      byStatus[status] = (byStatus[status] || 0) + 1;
    });

    return {
      total: subscriptionRows.length,
      byPlan,
      byStatus,
    };
  }, [subscriptionRows]);

  const isGlobalSettingsDirty = useMemo(() => {
    return (
      maintenanceMode !== initialMaintenanceMode ||
      JSON.stringify(planConfigs) !== JSON.stringify(initialPlanConfigs)
    );
  }, [
    initialMaintenanceMode,
    initialPlanConfigs,
    maintenanceMode,
    planConfigs,
  ]);

  const isRowDirty = (row: SubscriptionBusinessRow) => {
    const original = initialSubscriptionRows.find(item => item._id === row._id);
    if (!original) return true;
    return (
      original.plan !== row.plan ||
      JSON.stringify(original.customLimits || {}) !==
        JSON.stringify(row.customLimits || {})
    );
  };

  useEffect(() => {
    if (currentUser?.role !== "god") {
      navigate("/login", { replace: true });
      return;
    }

    const load = async () => {
      try {
        const data = await userAccessService.list();
        setUsers(data.filter(u => u.role === "super_admin")); // Only super_admins can access the app
      } catch (err) {
        console.error("god panel list error", err);
        setError("No se pudieron cargar los usuarios");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentUser?.role, navigate]);

  useEffect(() => {
    void loadIssues(issueStatus);
  }, [issueStatus]);

  const loadSubscriptions = async () => {
    setSubscriptionsLoading(true);
    try {
      const [rows, settings] = await Promise.all([
        globalSettingsService.listBusinessSubscriptions(),
        globalSettingsService.getPublicSettings(),
      ]);
      setSubscriptionRows(rows as any);
      setInitialSubscriptionRows(rows as any);
      const newMaintenanceMode = Boolean(settings.maintenanceMode);
      setMaintenanceMode(newMaintenanceMode);
      setInitialMaintenanceMode(newMaintenanceMode);
      setPlanConfigs(settings.plans as any);
      setInitialPlanConfigs(settings.plans as any);
    } catch (err) {
      console.error("god panel subscriptions error", err);
      setError("No se pudo cargar gestión de suscripciones");
    } finally {
      setSubscriptionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "subscriptions") {
      void loadSubscriptions();
    }
  }, [activeTab]);

  const updateBusinessPlan = async (
    businessId: string,
    payload: {
      plan?: "starter" | "pro" | "enterprise";
      customLimits?: { branches?: number; employees?: number };
    }
  ) => {
    setIssueAction(`subscription-${businessId}`);
    try {
      await globalSettingsService.updateBusinessSubscription(
        businessId,
        payload
      );
      await loadSubscriptions();
      setFeedback("Suscripción de negocio actualizada");
    } catch (err) {
      console.error("update business subscription error", err);
      setError("No se pudo actualizar la suscripción del negocio");
    } finally {
      setIssueAction(null);
    }
  };

  const saveGlobalPlans = async () => {
    setIssueAction("global-settings");
    try {
      await globalSettingsService.updateGlobalSettings({
        maintenanceMode,
        plans: planConfigs,
      });
      setFeedback("Planes globales actualizados");
      await loadSubscriptions();
    } catch (err) {
      console.error("save global settings error", err);
      setError("No se pudieron guardar los planes globales");
    } finally {
      setIssueAction(null);
    }
  };

  const updateIssueStatus = async (
    id: string,
    status: "open" | "reviewing" | "closed"
  ) => {
    setIssueAction(id);
    try {
      const { report } = await issueService.updateStatus(id, status);
      setIssues(
        prev => prev.map(item => (item._id === id ? report : item)) as any
      );
    } catch (err) {
      console.error("god panel issues update error", err);
      setIssuesError("No se pudo actualizar el estado");
    } finally {
      setIssueAction(null);
    }
  };

  // Bloqueo defensivo en caso de que el navigate aún no haya redirigido
  if (currentUser?.role !== "god") {
    return <Navigate to="/login" replace />;
  }

  const onDurationChange = (
    userId: string,
    field: keyof DurationForm,
    value: string
  ) => {
    const numeric = Math.max(0, Number(value) || 0);
    setDurations(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        ...defaultDuration,
        [field]: numeric,
      },
    }));
  };

  const getDuration = (userId: string): DurationForm => {
    return durations[userId] || defaultDuration;
  };

  const updateUser = (userId: string, updated: User) => {
    setUsers(prev => prev.map(u => (u._id === userId ? updated : u)));
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
          setUsers(prev => prev.filter(u => u._id !== userId));
          setFeedback(
            `✅ Eliminado: ${deleteStats.deletedBusinesses} empresas, ` +
              `${deleteStats.deletedEmployeeUsers} empleados, ` +
              `${deleteStats.deletedProducts} productos, ` +
              `${deleteStats.deletedSales} ventas, ` +
              `${deleteStats.deletedCustomers} clientes, ` +
              `${deleteStats.deletedCredits} créditos`
          );
          setConfirmUser(null);
          return;
        }
      }

      if (updatedUser) {
        updateUser(userId, updatedUser);
        setFeedback("Cambios guardados");
      }
    } catch (err) {
      console.error("god panel action error", err);
      setError("No se pudo completar la acción");
    } finally {
      setActionKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="animate-pulse rounded-xl border border-white/10 bg-white/5 px-6 py-4">
          Cargando panel GOD...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-linear-to-br min-h-screen from-gray-950 via-gray-900 to-slate-900 px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 shadow-xl shadow-purple-900/20 backdrop-blur lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-purple-200/80">
              Modo GOD
            </p>
            <h1 className="text-2xl font-bold sm:text-3xl">
              Panel de Administración
            </h1>
            <p className="mt-1 text-sm text-gray-300">
              Gestión de usuarios y reportes de fallos del sistema.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {feedback && (
              <span className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-200">
                {feedback}
              </span>
            )}
            {error && (
              <span className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </span>
            )}
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const data = await userAccessService.list();
                  setUsers(data.filter(u => u.role === "super_admin"));
                  setFeedback("Datos actualizados");
                } catch (err) {
                  console.error("god panel refresh error", err);
                  setError("No se pudo refrescar");
                } finally {
                  setLoading(false);
                }
              }}
              className="rounded-lg border border-purple-500/40 bg-purple-600/20 px-4 py-2 text-sm font-semibold text-purple-50 transition hover:border-purple-400/70 hover:bg-purple-600/30"
            >
              Refrescar
            </button>
            <button
              onClick={() => {
                authService.logout();
                navigate("/login/god", { replace: true });
              }}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/20"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Tabs de navegación */}
        <div className="flex gap-2 rounded-lg border border-white/10 bg-white/5 p-1">
          {[
            { key: "users", label: "👥 Usuarios" },
            { key: "issues", label: "🐛 Reportes de Fallos" },
            { key: "subscriptions", label: "💳 Suscripciones" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-purple-600/40 text-white"
                  : "text-gray-300 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Usuarios (contenido existente) */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  value={userSearch}
                  onChange={event => setUserSearch(event.target.value)}
                  placeholder="Buscar por nombre, email, teléfono, plan o ID..."
                  className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:border-purple-400 focus:outline-none"
                />
                <select
                  value={userStatusFilter}
                  onChange={event =>
                    setUserStatusFilter(
                      event.target.value as "all" | AccountStatus
                    )
                  }
                  className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white focus:border-purple-400 focus:outline-none"
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="pending">Pendientes</option>
                  <option value="expired">Expirados</option>
                  <option value="suspended">Suspendidos</option>
                  <option value="paused">Pausados</option>
                </select>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Mostrando {filteredUsers.length} de {users.length} super admins.
              </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                {
                  label: "Activos",
                  value: counts.active,
                  tone: "from-emerald-500/30 to-emerald-700/20",
                },
                {
                  label: "Pendientes",
                  value: counts.pending,
                  tone: "from-amber-400/30 to-amber-600/20",
                },
                {
                  label: "Expirados",
                  value: counts.expired,
                  tone: "from-red-500/25 to-red-700/20",
                },
                {
                  label: "Suspendidos",
                  value: counts.suspended,
                  tone: "from-orange-500/25 to-orange-700/20",
                },
                {
                  label: "Pausados",
                  value: counts.paused,
                  tone: "from-sky-500/25 to-sky-700/20",
                },
              ].map(card => (
                <div
                  key={card.label}
                  className={`bg-linear-to-br rounded-xl border border-white/10 ${card.tone} px-4 py-4 shadow-lg shadow-black/20`}
                >
                  <p className="text-xs uppercase tracking-[0.22em] text-gray-200/80">
                    {card.label}
                  </p>
                  <p className="mt-1 text-3xl font-bold">{card.value}</p>
                </div>
              ))}
            </section>

            <div className="rounded-2xl border border-white/10 bg-gray-900/70 shadow-2xl shadow-purple-900/20">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200/80">
                    Usuarios
                  </p>
                  <h2 className="text-lg font-bold text-white">Super admins</h2>
                  <p className="text-xs text-gray-400">
                    Ajusta vigencias y estado sin perder de vista la info clave.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    <span>{counts.active} activos</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span>{counts.pending} pendientes</span>
                  </div>
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
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm shadow-black/10 transition hover:border-purple-500/30 hover:bg-purple-500/5"
                    >
                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-12 space-y-2 sm:col-span-8">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-white">
                              {user._id.slice(-6)}
                            </span>
                            <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-purple-100">
                              {user.role}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span>{user.email}</span>
                            {user.phone && (
                              <span className="text-gray-500">
                                · {user.phone}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <div>
                              <p className="text-base font-semibold text-white">
                                {user.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                Super admin
                              </p>
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
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-200">
                              Expira:{" "}
                              {formatDateTime(user.subscriptionExpiresAt)}
                            </span>
                            {user.selectedPlan && (
                              <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1 text-xs font-semibold text-fuchsia-100">
                                Plan solicitado: {user.selectedPlan}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="col-span-12 flex flex-wrap items-center gap-2 sm:col-span-4 sm:justify-end">
                          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs">
                            <label className="text-gray-300">D</label>
                            <input
                              type="number"
                              min={0}
                              value={duration.days}
                              onChange={e =>
                                onDurationChange(
                                  user._id,
                                  "days",
                                  e.target.value
                                )
                              }
                              className="w-12 rounded bg-transparent px-2 py-1 text-white outline-none"
                            />
                            <label className="text-gray-300">M</label>
                            <input
                              type="number"
                              min={0}
                              value={duration.months}
                              onChange={e =>
                                onDurationChange(
                                  user._id,
                                  "months",
                                  e.target.value
                                )
                              }
                              className="w-12 rounded bg-transparent px-2 py-1 text-white outline-none"
                            />
                            <label className="text-gray-300">A</label>
                            <input
                              type="number"
                              min={0}
                              value={duration.years}
                              onChange={e =>
                                onDurationChange(
                                  user._id,
                                  "years",
                                  e.target.value
                                )
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
                              onClick={() => handleAction(user._id, "activate")}
                            />
                          )}
                          <ActionButton
                            label="Extender"
                            tone="muted"
                            disabled={isSelf}
                            loading={
                              loadingThis && actionKey?.startsWith("extend")
                            }
                            onClick={() => handleAction(user._id, "extend")}
                          />
                          {user.status === "active" && (
                            <ActionButton
                              label="Pausar"
                              tone="info"
                              disabled={isSelf}
                              loading={
                                loadingThis && actionKey?.startsWith("pause")
                              }
                              onClick={() => handleAction(user._id, "pause")}
                            />
                          )}
                          {user.status === "paused" && (
                            <ActionButton
                              label="Reanudar"
                              tone="success"
                              disabled={isSelf}
                              loading={
                                loadingThis && actionKey?.startsWith("resume")
                              }
                              onClick={() => handleAction(user._id, "resume")}
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
                              onClick={() => handleAction(user._id, "suspend")}
                            />
                          )}
                          <ActionButton
                            label="Eliminar"
                            tone="danger"
                            disabled={isSelf}
                            loading={
                              loadingThis && actionKey?.startsWith("remove")
                            }
                            onClick={() => setConfirmUser(user)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/20 bg-black/20 px-4 py-8 text-center text-sm text-gray-400">
                    No hay usuarios que coincidan con el filtro actual.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "subscriptions" && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Negocios"
                value={subscriptionSummary.total}
                helper="Total gestionados"
              />
              <MetricCard
                label="Activos"
                value={subscriptionSummary.byStatus.active}
                helper="Con acceso vigente"
              />
              <MetricCard
                label="Pendientes"
                value={subscriptionSummary.byStatus.pending}
                helper="Pendientes de activación"
              />
              <MetricCard
                label="Expirados"
                value={subscriptionSummary.byStatus.expired}
                helper="Requieren renovación"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-gray-900/70 p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200/80">
                    Configuración SaaS
                  </p>
                  <h2 className="text-xl font-bold">Planes globales</h2>
                  <p className="text-xs text-gray-400">
                    Configura precios y límites por plan. Los cambios no se
                    publican hasta guardar.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={e => setMaintenanceMode(e.target.checked)}
                  />
                  Modo mantenimiento
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {PLAN_KEYS.map(planKey => {
                  const plan = planConfigs[planKey];
                  return (
                    <div
                      key={planKey}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">
                          Plan: {plan.name}
                        </p>
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-gray-300">
                          {plan.id}
                        </span>
                      </div>

                      <div className="mb-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
                        Negocios en este plan:{" "}
                        {subscriptionSummary.byPlan[planKey]}
                      </div>

                      <div className="mt-3 space-y-3 text-xs">
                        <label className="block space-y-1">
                          <span className="text-gray-300">Nombre</span>
                          <input
                            type="text"
                            value={plan.name}
                            onChange={e =>
                              setPlanConfigs(prev => ({
                                ...prev,
                                [planKey]: {
                                  ...prev[planKey],
                                  name: e.target.value,
                                },
                              }))
                            }
                            className="w-full rounded border border-white/15 bg-black/20 px-2 py-1 text-white"
                            placeholder="Nombre del plan"
                          />
                        </label>

                        <label className="block space-y-1">
                          <span className="text-gray-300">Descripción</span>
                          <input
                            type="text"
                            value={plan.description || ""}
                            onChange={e =>
                              setPlanConfigs(prev => ({
                                ...prev,
                                [planKey]: {
                                  ...prev[planKey],
                                  description: e.target.value,
                                },
                              }))
                            }
                            className="w-full rounded border border-white/15 bg-black/20 px-2 py-1 text-white"
                            placeholder="Descripción corta"
                          />
                        </label>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="block space-y-1">
                            <span className="text-gray-300">
                              Precio mensual
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={plan.monthlyPrice}
                              onChange={e =>
                                setPlanConfigs(prev => ({
                                  ...prev,
                                  [planKey]: {
                                    ...prev[planKey],
                                    monthlyPrice: Number(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="w-full rounded border border-white/15 bg-black/20 px-2 py-1 text-white"
                              placeholder="0"
                            />
                          </label>

                          <label className="block space-y-1">
                            <span className="text-gray-300">Precio anual</span>
                            <input
                              type="number"
                              min={0}
                              value={plan.yearlyPrice}
                              onChange={e =>
                                setPlanConfigs(prev => ({
                                  ...prev,
                                  [planKey]: {
                                    ...prev[planKey],
                                    yearlyPrice: Number(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="w-full rounded border border-white/15 bg-black/20 px-2 py-1 text-white"
                              placeholder="0"
                            />
                          </label>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="block space-y-1">
                            <span className="text-gray-300">Sedes</span>
                            <input
                              type="number"
                              min={0}
                              value={plan.limits.branches}
                              onChange={e =>
                                setPlanConfigs(prev => ({
                                  ...prev,
                                  [planKey]: {
                                    ...prev[planKey],
                                    limits: {
                                      ...prev[planKey].limits,
                                      branches: Math.max(
                                        1,
                                        Number(e.target.value) || 1
                                      ),
                                    },
                                  },
                                }))
                              }
                              className="w-full rounded border border-white/15 bg-black/20 px-2 py-1 text-white"
                              placeholder="1"
                            />
                          </label>

                          <label className="block space-y-1">
                            <span className="text-gray-300">
                              Empleados
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={plan.limits.employees}
                              onChange={e =>
                                setPlanConfigs(prev => ({
                                  ...prev,
                                  [planKey]: {
                                    ...prev[planKey],
                                    limits: {
                                      ...prev[planKey].limits,
                                      employees: Math.max(
                                        1,
                                        Number(e.target.value) || 1
                                      ),
                                    },
                                  },
                                }))
                              }
                              className="w-full rounded border border-white/15 bg-black/20 px-2 py-1 text-white"
                              placeholder="1"
                            />
                          </label>
                        </div>

                        <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <span className="text-gray-300">
                            Business Assistant habilitado
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(plan.features?.businessAssistant)}
                            onChange={e =>
                              setPlanConfigs(prev => ({
                                ...prev,
                                [planKey]: {
                                  ...prev[planKey],
                                  features: {
                                    ...(prev[planKey].features || {
                                      businessAssistant: false,
                                    }),
                                    businessAssistant: e.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                        </label>

                        <label className="block space-y-1">
                          <span className="text-gray-300">Moneda</span>
                          <input
                            type="text"
                            value={plan.currency}
                            onChange={e =>
                              setPlanConfigs(prev => ({
                                ...prev,
                                [planKey]: {
                                  ...prev[planKey],
                                  currency: e.target.value.toUpperCase(),
                                },
                              }))
                            }
                            className="w-full rounded border border-white/15 bg-black/20 px-2 py-1 text-white"
                            placeholder="Moneda (USD, COP...)"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  disabled={!isGlobalSettingsDirty}
                  onClick={() => {
                    setPlanConfigs(initialPlanConfigs);
                    setMaintenanceMode(initialMaintenanceMode);
                    setFeedback("Cambios de planes descartados");
                  }}
                  className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Restablecer
                </button>
                <button
                  disabled={
                    issueAction === "global-settings" || !isGlobalSettingsDirty
                  }
                  onClick={saveGlobalPlans}
                  className="rounded-lg border border-purple-500/40 bg-purple-600/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-600/40 disabled:opacity-50"
                >
                  Guardar planes
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-gray-900/70 p-5">
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-white">
                    Negocios y suscripción
                  </h3>
                  <button
                    onClick={() => void loadSubscriptions()}
                    className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-white/10"
                  >
                    Refrescar
                  </button>
                </div>

                <div className="grid gap-2 md:grid-cols-4">
                  <input
                    value={subscriptionSearch}
                    onChange={event =>
                      setSubscriptionSearch(event.target.value)
                    }
                    placeholder="Buscar negocio, owner, email o ID..."
                    className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:border-purple-400 focus:outline-none md:col-span-2"
                  />
                  <select
                    value={subscriptionPlanFilter}
                    onChange={event =>
                      setSubscriptionPlanFilter(
                        event.target.value as "all" | PlanKey
                      )
                    }
                    className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white focus:border-purple-400 focus:outline-none"
                  >
                    <option value="all">Todos los planes</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                  <select
                    value={subscriptionStatusFilter}
                    onChange={event =>
                      setSubscriptionStatusFilter(
                        event.target.value as "all" | AccountStatus
                      )
                    }
                    className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white focus:border-purple-400 focus:outline-none"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="active">Activo</option>
                    <option value="pending">Pendiente</option>
                    <option value="expired">Expirado</option>
                    <option value="suspended">Suspendido</option>
                    <option value="paused">Pausado</option>
                  </select>
                </div>

                <p className="text-xs text-gray-400">
                  Mostrando {filteredSubscriptionRows.length} de{" "}
                  {subscriptionRows.length} negocios.
                </p>
              </div>

              {subscriptionsLoading ? (
                <div className="py-8 text-center text-sm text-gray-300">
                  Cargando suscripciones...
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSubscriptionRows.map(row => {
                    const dirty = isRowDirty(row);
                    return (
                      <div
                        key={row._id}
                        className="rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">
                                {row.name}
                              </p>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                                  statusBadgeStyles[row.status || "pending"] ||
                                  "border-gray-500/40 bg-gray-500/10 text-gray-200"
                                }`}
                              >
                                {formatStatus(row.status)}
                              </span>
                              {dirty && (
                                <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                                  Cambios pendientes
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              {row.owner?.email || "Sin owner"}
                            </p>
                          </div>
                          <div className="text-xs text-gray-300">
                            Uso sedes: {row.limits?.usage?.branches || 0}/
                            {row.limits?.limits?.branches || 0} · Dist:{" "}
                            {row.limits?.usage?.employees || 0}/
                            {row.limits?.limits?.employees || 0}
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                          <select
                            value={row.plan}
                            onChange={e =>
                              setSubscriptionRows(prev =>
                                prev.map(item =>
                                  item._id === row._id
                                    ? {
                                        ...item,
                                        plan: e.target.value as PlanKey,
                                      }
                                    : item
                                )
                              )
                            }
                            className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                          >
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                          <input
                            type="number"
                            min={1}
                            placeholder="Override sedes"
                            value={row.customLimits?.branches ?? ""}
                            onChange={e =>
                              setSubscriptionRows(prev =>
                                prev.map(item =>
                                  item._id === row._id
                                    ? {
                                        ...item,
                                        customLimits: {
                                          ...(item.customLimits || {}),
                                          branches:
                                            Number(e.target.value) || undefined,
                                        },
                                      }
                                    : item
                                )
                              )
                            }
                            className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={1}
                              placeholder="Override dist"
                              value={row.customLimits?.employees ?? ""}
                              onChange={e =>
                                setSubscriptionRows(prev =>
                                  prev.map(item =>
                                    item._id === row._id
                                      ? {
                                          ...item,
                                          customLimits: {
                                            ...(item.customLimits || {}),
                                            employees:
                                              Number(e.target.value) ||
                                              undefined,
                                          },
                                        }
                                      : item
                                  )
                                )
                              }
                              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                            />
                            <button
                              onClick={() =>
                                setSubscriptionRows(prev =>
                                  prev.map(item =>
                                    item._id === row._id
                                      ? {
                                          ...item,
                                          customLimits: undefined,
                                        }
                                      : item
                                  )
                                )
                              }
                              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-100 hover:bg-white/10"
                            >
                              Reset
                            </button>
                            <button
                              disabled={
                                issueAction === `subscription-${row._id}` ||
                                !dirty
                              }
                              onClick={() =>
                                updateBusinessPlan(row._id, {
                                  plan: row.plan,
                                  customLimits: row.customLimits || {},
                                })
                              }
                              className="rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-600/30 disabled:opacity-50"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredSubscriptionRows.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/20 bg-black/20 px-4 py-8 text-center text-sm text-gray-400">
                      No hay negocios que coincidan con el filtro actual.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Issues internos */}
        {activeTab === "issues" && (
          <div className="rounded-2xl border border-white/10 bg-gray-900/70 p-6 shadow-2xl shadow-purple-900/20">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200/80">
                  Reportes internos
                </p>
                <h2 className="text-xl font-bold">Buzón de fallos</h2>
                <p className="text-sm text-gray-400">
                  Logs, contexto y capturas enviados desde la app.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={issueStatus}
                  onChange={e => setIssueStatus(e.target.value as any)}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-400 focus:outline-none"
                >
                  <option value="all">Todos</option>
                  <option value="open">Abiertos</option>
                  <option value="reviewing">En revisión</option>
                  <option value="closed">Cerrados</option>
                </select>
                <button
                  onClick={() => loadIssues(issueStatus)}
                  className="rounded-lg border border-purple-500/40 bg-purple-500/20 px-3 py-2 text-sm font-semibold text-purple-50 transition hover:border-purple-300/60 hover:bg-purple-500/30"
                >
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
              <div className="flex h-48 items-center justify-center text-sm text-gray-300">
                Cargando reportes...
              </div>
            ) : issues.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-gray-400">
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
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-purple-200">
                            {report.user?.role || "-"}
                          </span>
                          <span>{report.user?.name || "Usuario"}</span>
                          <span className="text-gray-500">•</span>
                          <span>
                            {report.createdAt
                              ? new Date(report.createdAt).toLocaleString(
                                  "es-ES",
                                  {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  }
                                )
                              : "-"}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white">
                          {report.message}
                        </p>
                        {report.clientContext?.url && (
                          <p className="text-xs text-gray-400">
                            URL: {report.clientContext.url}
                          </p>
                        )}
                        {report.clientContext?.appVersion && (
                          <p className="text-xs text-gray-500">
                            Versión: {report.clientContext.appVersion}
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
                                : "bg-green-500/20 text-green-100"
                          }`}
                        >
                          {report.status}
                        </span>
                        <button
                          disabled={issueAction === report._id}
                          onClick={() => updateIssueStatus(report._id, "open")}
                          className="rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/40 hover:bg-white/10 disabled:opacity-50"
                        >
                          Reabrir
                        </button>
                        <button
                          disabled={issueAction === report._id}
                          onClick={() =>
                            updateIssueStatus(report._id, "reviewing")
                          }
                          className="rounded-lg border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-50 transition hover:border-amber-300/60 hover:bg-amber-500/30 disabled:opacity-50"
                        >
                          Revisando
                        </button>
                        <button
                          disabled={issueAction === report._id}
                          onClick={() =>
                            updateIssueStatus(report._id, "closed")
                          }
                          className="rounded-lg border border-green-400/40 bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-50 transition hover:border-green-300/60 hover:bg-green-500/30 disabled:opacity-50"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>

                    {(report.logs?.length ?? 0) > 0 && (
                      <details className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-200">
                        <summary className="cursor-pointer text-gray-300">
                          Ver logs ({report.logs?.length})
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap text-[11px] text-gray-300">
                          {report.logs?.join("\n")}
                        </pre>
                      </details>
                    )}
                    {report.stackTrace && (
                      <details className="mt-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-200">
                        <summary className="cursor-pointer text-gray-300">
                          Stacktrace
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap text-[11px] text-gray-300">
                          {report.stackTrace}
                        </pre>
                      </details>
                    )}
                    {report.screenshotUrl && (
                      <a
                        href={report.screenshotUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-xs text-purple-200 hover:text-purple-100"
                      >
                        Ver captura ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {confirmUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-gray-900/95 p-6 shadow-2xl shadow-red-500/10">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg border border-red-500/40 bg-red-500/20 p-2">
                  <svg
                    className="h-6 w-6 text-red-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-200/80">
                    ⚠️ ELIMINACIÓN PERMANENTE
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">
                    Eliminar usuario: {confirmUser.name}
                  </h3>
                </div>
              </div>

              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                <p className="mb-2 text-sm font-semibold text-red-200">
                  Esta acción eliminará permanentemente:
                </p>
                <ul className="space-y-1.5 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>
                      La cuenta de usuario <strong>{confirmUser.email}</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Todas las empresas donde es propietario</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>
                      Todos los empleados vinculados a esas empresas
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>
                      Productos, categorías, ventas, clientes, créditos
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>
                      Inventarios, sucursales, gastos y toda la data operativa
                    </span>
                  </li>
                </ul>
              </div>

              <p className="mt-4 text-center text-sm font-bold text-red-200">
                ⚠️ Esta operación NO se puede deshacer
              </p>

              <div className="mt-6 flex justify-end gap-2 text-sm">
                <button
                  onClick={() => setConfirmUser(null)}
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 font-semibold text-gray-200 transition hover:border-white/30 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  disabled={
                    !!(
                      actionKey?.startsWith("remove") &&
                      actionKey?.endsWith(confirmUser._id)
                    )
                  }
                  onClick={() => handleAction(confirmUser._id, "remove")}
                  className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-600/80 px-4 py-2 font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  {actionKey?.startsWith("remove") &&
                  actionKey?.endsWith(confirmUser._id) ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : null}
                  <span>Confirmar eliminación permanente</span>
                </button>
              </div>
            </div>
          </div>
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

interface MetricCardProps {
  label: string;
  value: number;
  helper: string;
}

function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-300">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{helper}</p>
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
    primary: "border-purple-500/40 bg-purple-500/20 text-purple-50",
    muted: "border-white/20 bg-white/5 text-white",
    warning: "border-amber-500/40 bg-amber-500/20 text-amber-50",
    danger: "border-red-500/40 bg-red-500/15 text-red-100",
    success: "border-green-500/40 bg-green-500/20 text-green-100",
    info: "border-sky-500/40 bg-sky-500/20 text-sky-100",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition active:scale-[0.98] ${
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
