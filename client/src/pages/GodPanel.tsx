import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { authService, issueService, userAccessService } from "../api/services";
import type { IssueReport, User } from "../types";

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

const statusBadgeStyles: Record<string, string> = {
  active: "border-green-500/40 bg-green-500/10 text-green-200",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  expired: "border-red-500/40 bg-red-500/10 text-red-200",
  suspended: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  paused: "border-sky-500/40 bg-sky-500/10 text-sky-200",
};

const defaultDuration: DurationForm = { days: 30, months: 0, years: 0 };

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

  const loadIssues = async (
    status: "all" | "open" | "reviewing" | "closed" = "open"
  ) => {
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const res = await issueService.list(
        status === "all" ? { limit: 50 } : { status, limit: 50 }
      );
      setIssues(res.data);
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

  useEffect(() => {
    if (currentUser?.role !== "god") {
      navigate("/login", { replace: true });
      return;
    }

    const load = async () => {
      try {
        const data = await userAccessService.list();
        setUsers(data.filter(u => u.role === "super_admin"));
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

  const updateIssueStatus = async (
    id: string,
    status: "open" | "reviewing" | "closed"
  ) => {
    setIssueAction(id);
    try {
      const { report } = await issueService.updateStatus(id, status);
      setIssues(prev => prev.map(item => (item._id === id ? report : item)));
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
        case "remove":
          await userAccessService.remove(userId);
          setUsers(prev => prev.filter(u => u._id !== userId));
          setFeedback("Usuario eliminado");
          setConfirmUser(null);
          return;
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
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 shadow-xl shadow-purple-900/20 backdrop-blur lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-purple-200/80">
              Modo GOD
            </p>
            <h1 className="text-2xl font-bold sm:text-3xl">
              Control total de usuarios
            </h1>
            <p className="mt-1 text-sm text-gray-300">
              Activa, suspende, extiende y administra suscripciones manuales.
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
                  setFeedback("Lista actualizada");
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
              className={`rounded-xl border border-white/10 bg-gradient-to-br ${card.tone} px-4 py-4 shadow-lg shadow-black/20`}
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
            {users.map(user => {
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
                          <span className="text-gray-500">· {user.phone}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">
                            {user.name}
                          </p>
                          <p className="text-xs text-gray-400">Super admin</p>
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
                          Expira: {formatDateTime(user.subscriptionExpiresAt)}
                        </span>
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
                            onDurationChange(user._id, "days", e.target.value)
                          }
                          className="w-12 rounded bg-transparent px-2 py-1 text-white outline-none"
                        />
                        <label className="text-gray-300">M</label>
                        <input
                          type="number"
                          min={0}
                          value={duration.months}
                          onChange={e =>
                            onDurationChange(user._id, "months", e.target.value)
                          }
                          className="w-12 rounded bg-transparent px-2 py-1 text-white outline-none"
                        />
                        <label className="text-gray-300">A</label>
                        <input
                          type="number"
                          min={0}
                          value={duration.years}
                          onChange={e =>
                            onDurationChange(user._id, "years", e.target.value)
                          }
                          className="w-12 rounded bg-transparent px-2 py-1 text-white outline-none"
                        />
                      </div>

                      <ActionButton
                        label="Activar"
                        tone="primary"
                        disabled={isSelf}
                        loading={
                          loadingThis && actionKey?.startsWith("activate")
                        }
                        onClick={() => handleAction(user._id, "activate")}
                      />
                      <ActionButton
                        label="Extender"
                        tone="muted"
                        disabled={isSelf}
                        loading={loadingThis && actionKey?.startsWith("extend")}
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
                        loading={loadingThis && actionKey?.startsWith("remove")}
                        onClick={() => setConfirmUser(user)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Issues internos */}
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
                        onClick={() => updateIssueStatus(report._id, "closed")}
                        className="rounded-lg border border-green-400/40 bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-50 transition hover:border-green-300/60 hover:bg-green-500/30 disabled:opacity-50"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>

                  {report.logs?.length > 0 && (
                    <details className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-200">
                      <summary className="cursor-pointer text-gray-300">
                        Ver logs ({report.logs.length})
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-[11px] text-gray-300">
                        {report.logs.join("\n")}
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
        {confirmUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/90 p-6 shadow-2xl shadow-black/40">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-200/80">
                Confirmar eliminación
              </p>
              <h3 className="mt-2 text-lg font-bold text-white">
                ¿Eliminar al usuario {confirmUser.name}?
              </h3>
              <p className="mt-1 text-sm text-gray-300">
                Se borrará su cuenta y todo lo creado por él (negocios,
                productos, categorías, ventas, distribuidores, analíticas
                asociadas).
              </p>
              <div className="mt-4 flex justify-end gap-2 text-sm">
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
                  className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/20 px-4 py-2 font-semibold text-red-100 transition hover:border-red-400/60 hover:bg-red-500/30 disabled:opacity-50"
                >
                  {actionKey?.startsWith("remove") &&
                  actionKey?.endsWith(confirmUser._id) ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-red-100/70 border-t-transparent" />
                  ) : null}
                  <span>Eliminar definitivamente</span>
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
