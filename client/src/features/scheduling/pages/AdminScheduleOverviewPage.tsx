import { Building2, CalendarRange, RefreshCw, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, LoadingSpinner, toast } from "../../../shared/components/ui";
import { branchService } from "../../branches/services";
import type { Branch } from "../../business/types/business.types";
import { scheduleService } from "../services";
import type {
  EmployeeScheduleEntry,
  ScheduleDayOfWeek,
  ScheduleOverviewEmployee,
  ScheduleOverviewResponse,
} from "../types/schedule.types";

const DAYS: Array<{ key: ScheduleDayOfWeek; label: string }> = [
  { key: 0, label: "Lunes" },
  { key: 1, label: "Martes" },
  { key: 2, label: "Miercoles" },
  { key: 3, label: "Jueves" },
  { key: 4, label: "Viernes" },
  { key: 5, label: "Sabado" },
  { key: 6, label: "Domingo" },
];

const DAY_KEYS: ScheduleDayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

const buildEmptyOverview = (): ScheduleOverviewResponse => ({
  schedules: [],
  groupedByDay: {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  },
  total: 0,
  employees: [],
});

const isKnownDay = (value: number): value is ScheduleDayOfWeek =>
  DAY_KEYS.includes(value as ScheduleDayOfWeek);

const toEmployeeSummary = (
  entry: EmployeeScheduleEntry
): ScheduleOverviewEmployee => {
  if (typeof entry.employeeId === "string") {
    return {
      _id: entry.employeeId,
      name: "Colaborador",
      email: "",
    };
  }

  return {
    _id: entry.employeeId?._id || "unknown",
    name: entry.employeeId?.name || "Colaborador",
    email: entry.employeeId?.email || "",
  };
};

const getEmployeeId = (entry: EmployeeScheduleEntry) =>
  typeof entry.employeeId === "string"
    ? entry.employeeId
    : entry.employeeId?._id || "unknown";

const buildEmptyCells = (): Record<
  ScheduleDayOfWeek,
  EmployeeScheduleEntry[]
> => ({
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
});

export default function AdminScheduleOverviewPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [overview, setOverview] =
    useState<ScheduleOverviewResponse>(buildEmptyOverview);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedBranchId, setLastLoadedBranchId] = useState<string | null>(
    null
  );

  const fetchOverview = async (branchId: string) => {
    const data = await scheduleService.getOverview(
      branchId ? { sedeId: branchId } : undefined
    );
    setOverview(data);
    setLastLoadedBranchId(branchId || "");
  };

  const loadData = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const branchList = await branchService.getAll();
      setBranches(branchList);

      const fallbackBranch = selectedBranchId || branchList[0]?._id || "";
      if (fallbackBranch !== selectedBranchId) {
        setSelectedBranchId(fallbackBranch);
      }

      await fetchOverview(fallbackBranch);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "No se pudo cargar el calendario"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData("initial");
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (selectedBranchId === lastLoadedBranchId) {
      return;
    }

    const reloadByBranch = async () => {
      try {
        await fetchOverview(selectedBranchId);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message ||
            "No se pudo filtrar el calendario por sede"
        );
      }
    };

    reloadByBranch();
  }, [selectedBranchId, loading, lastLoadedBranchId]);

  const employeeRows = useMemo(() => {
    const employees = overview.employees?.length
      ? overview.employees
      : Array.from(
          new Map(
            overview.schedules.map(entry => {
              const employee = toEmployeeSummary(entry);
              return [employee._id, employee] as const;
            })
          ).values()
        );

    const matrix = new Map<
      string,
      Record<ScheduleDayOfWeek, EmployeeScheduleEntry[]>
    >();

    for (const employee of employees) {
      matrix.set(employee._id, buildEmptyCells());
    }

    for (const entry of overview.schedules) {
      const employeeId = getEmployeeId(entry);
      const dayOfWeek = Number(entry.dayOfWeek);

      if (!isKnownDay(dayOfWeek)) {
        continue;
      }

      if (!matrix.has(employeeId)) {
        matrix.set(employeeId, buildEmptyCells());
      }

      matrix.get(employeeId)?.[dayOfWeek].push(entry);
    }

    for (const row of matrix.values()) {
      for (const day of DAY_KEYS) {
        row[day].sort((left, right) =>
          left.startTime.localeCompare(right.startTime)
        );
      }
    }

    return employees
      .map(employee => ({
        employee,
        cells: matrix.get(employee._id) || buildEmptyCells(),
      }))
      .sort((left, right) =>
        left.employee.name.localeCompare(right.employee.name)
      );
  }, [overview]);

  const selectedBranchName =
    branches.find(branch => branch._id === selectedBranchId)?.name || "Todas";

  if (loading) {
    return (
      <main className="min-h-[60vh] pb-32">
        <div className="mx-auto flex max-w-5xl items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-32 pt-4 sm:px-6 lg:px-8">
      <section className="bg-linear-to-br rounded-3xl border border-white/10 from-slate-950 via-slate-900 to-cyan-950 p-6 shadow-[0_24px_80px_rgba(8,47,73,0.35)] transition-all duration-300 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-200">
              <CalendarRange className="h-4 w-4" />
              Matriz Consolidada
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
              Disponibilidad del Equipo
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              Filtra por sede y visualiza cobertura semanal por colaborador.
            </p>
          </div>

          <Button
            onClick={() => loadData("refresh")}
            disabled={refreshing}
            className="min-h-11 rounded-xl border border-cyan-300/30 bg-cyan-500/20 px-4 text-cyan-100 hover:bg-cyan-500/30"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Bloques
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {overview.total}
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Colaboradores
            </p>
            <p className="mt-1 text-2xl font-semibold text-cyan-200">
              {employeeRows.length}
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Sede filtrada
            </p>
            <p className="mt-1 text-base font-semibold text-white">
              {selectedBranchName}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 shadow-xl sm:p-6">
        <label className="space-y-1 text-xs text-slate-400">
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Filtrar por sede
          </span>
          <select
            value={selectedBranchId}
            onChange={event => setSelectedBranchId(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition-all duration-300 focus:border-cyan-400/70"
          >
            {branches.map(branch => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 shadow-xl sm:p-6">
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] table-fixed border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="w-56 rounded-l-xl border border-slate-800 bg-slate-900 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Colaborador
                </th>
                {DAYS.map(day => (
                  <th
                    key={`head-${day.key}`}
                    className="border border-slate-800 bg-slate-900 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300 last:rounded-r-xl"
                  >
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {employeeRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={DAYS.length + 1}
                    className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400"
                  >
                    Sin colaboradores o disponibilidad para esta sede.
                  </td>
                </tr>
              ) : (
                employeeRows.map(row => (
                  <tr key={`row-${row.employee._id}`}>
                    <td className="rounded-l-xl border border-slate-800 bg-slate-900/70 px-3 py-3 align-top">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <Users className="h-4 w-4 text-cyan-300" />
                            {row.employee.name}
                          </p>
                          {row.employee.email && (
                            <p className="text-xs text-slate-400">
                              {row.employee.email}
                            </p>
                          )}
                        </div>

                        <Link
                          to={`/admin/schedules/edit/${row.employee._id}`}
                          className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-200 transition-all hover:bg-cyan-500/20"
                        >
                          Editar
                        </Link>
                      </div>
                    </td>

                    {DAYS.map((day, dayIndex) => {
                      const entries = row.cells[day.key];

                      return (
                        <td
                          key={`cell-${row.employee._id}-${day.key}`}
                          className={`border border-slate-800 bg-slate-900/60 px-2 py-2 align-top ${
                            dayIndex === DAYS.length - 1 ? "rounded-r-xl" : ""
                          }`}
                        >
                          {entries.length === 0 ? (
                            <span className="inline-flex min-h-11 items-center rounded-lg border border-dashed border-slate-700 px-2.5 py-1 text-xs text-slate-500">
                              -
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {entries.map(entry => (
                                <span
                                  key={entry._id}
                                  className={`inline-flex min-h-11 items-center rounded-lg px-2.5 py-1 text-xs font-medium ${
                                    entry.status === "booked"
                                      ? "border border-amber-300/30 bg-amber-500/15 text-amber-100"
                                      : "border border-cyan-300/30 bg-cyan-500/15 text-cyan-100"
                                  }`}
                                >
                                  {entry.startTime}-{entry.endTime}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
