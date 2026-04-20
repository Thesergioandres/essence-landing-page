import {
  Activity,
  Lock,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBusiness } from "../../../context/BusinessContext";
import { useSession } from "../../../hooks/useSession";
import { Button, LoadingSpinner, toast } from "../../../shared/components/ui";
import { staffService } from "../services";
import type { StaffMemberRow } from "../types/staff.types";

const normalizeText = (value: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const formatRole = (role: string) => {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin" || normalized === "super_admin") {
    return "Administrador";
  }
  if (normalized === "god") {
    return "Desarrollador";
  }
  if (normalized === "viewer") {
    return "Consulta";
  }
  return "Empleado";
};

const COMMISSION_ELIGIBLE_ROLES = new Set(["employee", "operativo"]);

const normalizeRole = (role: unknown) => {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return normalized === "superadmin" ? "super_admin" : normalized;
};

const isOwnerRole = (role: unknown) => {
  const normalized = normalizeRole(role);
  return normalized === "god" || normalized === "super_admin";
};

const isCommissionApplicableRole = (role: unknown) =>
  COMMISSION_ELIGIBLE_ROLES.has(normalizeRole(role));

const toDraftMap = (rows: StaffMemberRow[]) =>
  rows.reduce<Record<string, string>>((accumulator, row) => {
    accumulator[row.employeeId] = String(
      Number.isFinite(Number(row.baseCommissionPercentage))
        ? row.baseCommissionPercentage
        : 20
    );
    return accumulator;
  }, {});

export default function EmployeeManagementPage() {
  const navigate = useNavigate();
  const { business } = useBusiness();
  const { user } = useSession();
  const [rows, setRows] = useState<StaffMemberRow[]>([]);
  const [draftRates, setDraftRates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const autoSaveTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  const businessId = business?._id;
  const currentUserId = String(user?._id || "");

  const loadRows = async (mode: "initial" | "refresh" = "initial") => {
    if (!businessId) {
      setRows([]);
      setDraftRates({});
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await staffService.getUnifiedStaff(businessId);
      setRows(data);
      setDraftRates(toDraftMap(data));
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "No se pudo cargar el staff"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRows("initial");
  }, [businessId]);

  useEffect(
    () => () => {
      Object.values(autoSaveTimersRef.current).forEach(timer => {
        clearTimeout(timer);
      });
      autoSaveTimersRef.current = {};
    },
    []
  );

  const filteredRows = useMemo(() => {
    const normalizedSearchTerm = normalizeText(searchTerm);

    if (!normalizedSearchTerm) {
      return rows;
    }

    return rows.filter(row => {
      const hayCoincidenciaNombre = normalizeText(row.name).includes(
        normalizedSearchTerm
      );
      const hayCoincidenciaEmail = normalizeText(row.email).includes(
        normalizedSearchTerm
      );
      const hayCoincidenciaRol = normalizeText(row.role).includes(
        normalizedSearchTerm
      );

      return (
        hayCoincidenciaNombre || hayCoincidenciaEmail || hayCoincidenciaRol
      );
    });
  }, [rows, searchTerm]);

  const totals = useMemo(
    () => ({
      active: rows.filter(row => row.active).length,
      fixed: rows.filter(
        row => row.commissionApplicable && row.isCommissionFixed
      ).length,
      total: rows.length,
    }),
    [rows]
  );

  const handleRateChange = (employeeId: string, value: string) => {
    setDraftRates(previous => ({
      ...previous,
      [employeeId]: value,
    }));
  };

  const clearAutoSaveTimer = (employeeId: string) => {
    const timer = autoSaveTimersRef.current[employeeId];
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    delete autoSaveTimersRef.current[employeeId];
  };

  const saveRate = async (
    employeeId: string,
    options: { rawValue?: string; notifyOnInvalid?: boolean } = {}
  ) => {
    const row = rows.find(item => item.employeeId === employeeId);
    if (!row) {
      return;
    }

    if (!row.commissionApplicable || !isCommissionApplicableRole(row.role)) {
      if (options.notifyOnInvalid !== false) {
        toast.error("La comisión base solo aplica a perfiles operativos.");
      }
      return;
    }

    const rawValue = options.rawValue ?? draftRates[employeeId];
    if (String(rawValue ?? "").trim() === "") {
      return;
    }

    const parsedRate = Number(rawValue);

    if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 95) {
      if (options.notifyOnInvalid !== false) {
        toast.error("La comision base debe estar entre 0 y 95");
      }
      return;
    }

    if (
      Math.abs(parsedRate - Number(row.baseCommissionPercentage || 0)) < 0.001
    ) {
      return;
    }

    try {
      setSavingRowId(employeeId);
      const updatedRate = await staffService.updateBaseCommissionPercentage(
        employeeId,
        parsedRate,
        {
          targetRole: row.role,
        }
      );

      setRows(previous =>
        previous.map(item =>
          item.employeeId === employeeId
            ? {
                ...item,
                baseCommissionPercentage: updatedRate,
              }
            : item
        )
      );

      setDraftRates(previous => ({
        ...previous,
        [employeeId]: String(updatedRate),
      }));
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "No se pudo actualizar la comision base"
      );
    } finally {
      setSavingRowId(null);
    }
  };

  const scheduleRateAutoSave = (employeeId: string, value: string) => {
    clearAutoSaveTimer(employeeId);

    autoSaveTimersRef.current[employeeId] = setTimeout(() => {
      void saveRate(employeeId, {
        rawValue: value,
        notifyOnInvalid: false,
      });
      clearAutoSaveTimer(employeeId);
    }, 650);
  };

  const flushRateSave = (employeeId: string) => {
    clearAutoSaveTimer(employeeId);
    void saveRate(employeeId, { notifyOnInvalid: true });
  };

  if (loading) {
    return (
      <main className="min-h-[60vh] pb-32">
        <div className="mx-auto flex max-w-6xl items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-32 pt-4 sm:px-6 lg:px-8">
      <section className="bg-linear-to-br rounded-3xl border border-white/10 from-slate-950 via-slate-900 to-cyan-950 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.45)] transition-all duration-300 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-200">
              <Users className="h-4 w-4" />
              Centro de Staff
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Equipo Unificado: Team + Employees
            </h1>
            <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
              Administra en una sola tabla los perfiles activos del negocio y
              ajusta la comision base por colaborador sin saltar entre modulos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => navigate("/admin/staff/new")}
              className="min-h-11 rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 text-emerald-100 hover:bg-emerald-500/30"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Crear empleado
            </Button>

            <Button
              onClick={() => loadRows("refresh")}
              disabled={refreshing}
              className="min-h-11 rounded-xl border border-cyan-300/30 bg-cyan-500/20 px-4 text-cyan-100 hover:bg-cyan-500/30"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Activos
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {totals.active}
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Comision fija blindada
            </p>
            <p className="mt-1 text-2xl font-semibold text-cyan-200">
              {totals.fixed}
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Total
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {totals.total}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/90 shadow-xl backdrop-blur">
        <div className="border-b border-slate-800 p-4 sm:p-6">
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-200 transition-all duration-300 focus-within:border-cyan-400/60">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre, correo o rol"
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 sm:px-6">Colaborador</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Comision base %</th>
                <th className="px-4 py-3">Politica</th>
                <th className="px-4 py-3 text-right">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/90 text-slate-200">
              {filteredRows.map(row => {
                const isSaving = savingRowId === row.employeeId;
                const isRateLocked = row.isCommissionFixed;
                const canEditCommission =
                  row.commissionApplicable &&
                  isCommissionApplicableRole(row.role);
                const isSelfOwnerProfile =
                  Boolean(currentUserId) &&
                  String(row.employeeId) === currentUserId &&
                  isOwnerRole(row.role);
                const showCommissionAsNotApplicable =
                  !canEditCommission || row.isManagementRole;
                const hideSync =
                  showCommissionAsNotApplicable || isSelfOwnerProfile;
                const draftValue = Number(draftRates[row.employeeId]);
                const hasPendingChanges =
                  canEditCommission &&
                  Number.isFinite(draftValue) &&
                  Math.abs(
                    draftValue - Number(row.baseCommissionPercentage || 0)
                  ) >= 0.001;

                return (
                  <tr
                    key={row.employeeId}
                    className="transition-all duration-300 hover:bg-slate-900/70"
                  >
                    <td className="px-4 py-4 align-middle sm:px-6">
                      <p className="font-medium text-white">{row.name}</p>
                      <p className="text-xs text-slate-400">{row.email}</p>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-200">
                        {formatRole(row.role)}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          row.active
                            ? "border border-emerald-300/40 bg-emerald-500/15 text-emerald-200"
                            : "border border-rose-300/30 bg-rose-500/10 text-rose-200"
                        }`}
                      >
                        {row.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="flex min-h-11 w-36 items-center rounded-xl border border-slate-700 bg-slate-900/70 px-2">
                        {canEditCommission ? (
                          <>
                            <input
                              value={draftRates[row.employeeId] ?? ""}
                              onChange={event => {
                                const nextValue = event.target.value;
                                handleRateChange(row.employeeId, nextValue);
                                scheduleRateAutoSave(row.employeeId, nextValue);
                              }}
                              onBlur={() => flushRateSave(row.employeeId)}
                              onKeyDown={event => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  flushRateSave(row.employeeId);
                                }
                              }}
                              type="number"
                              min={0}
                              max={95}
                              step={0.1}
                              className="h-10 w-full bg-transparent text-right text-sm text-slate-100 outline-none"
                              aria-label={`Comision base de ${row.name}`}
                            />
                            <span className="pl-2 text-xs text-slate-500">
                              %
                            </span>
                          </>
                        ) : (
                          <span className="w-full text-right text-sm font-semibold text-slate-500">
                            -
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      {showCommissionAsNotApplicable ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/50 bg-slate-800/50 px-3 py-1 text-xs text-slate-400">
                          No aplica
                        </span>
                      ) : isRateLocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-500/15 px-3 py-1 text-xs text-amber-200">
                          <Lock className="h-3.5 w-3.5" />
                          Comision fija
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                          <Activity className="h-3.5 w-3.5" />
                          Comision variable
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right align-middle">
                      {hideSync ? (
                        <span className="inline-flex min-h-11 items-center rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 text-xs text-slate-500">
                          -
                        </span>
                      ) : isSaving ? (
                        <span className="inline-flex min-h-11 items-center rounded-xl border border-cyan-300/40 bg-cyan-500/15 px-3 text-xs text-cyan-100">
                          Guardando...
                        </span>
                      ) : hasPendingChanges ? (
                        <span className="inline-flex min-h-11 items-center rounded-xl border border-amber-300/35 bg-amber-500/15 px-3 text-xs text-amber-100">
                          Pendiente...
                        </span>
                      ) : (
                        <span className="inline-flex min-h-11 items-center rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-3 text-xs text-emerald-100">
                          Sin cambios
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredRows.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No hay coincidencias para tu busqueda.
          </div>
        )}
      </section>
    </main>
  );
}
