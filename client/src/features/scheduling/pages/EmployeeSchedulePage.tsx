import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, LoadingSpinner, toast } from "../../../shared/components/ui";
import { branchService } from "../../branches/services";
import type { Branch } from "../../business/types/business.types";
import { scheduleService } from "../services";
import type {
  EmployeeScheduleEntry,
  ScheduleDayOfWeek,
  ScheduleEntryInput,
  ScheduleStatus,
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

interface AvailabilityBlockDraft {
  clientId: string;
  sedeId: string;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
}

const createClientId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

const createEmptyBlock = (): AvailabilityBlockDraft => ({
  clientId: createClientId(),
  sedeId: "",
  startTime: "09:00",
  endTime: "18:00",
  status: "available",
});

const buildEmptyDraft = (): Record<
  ScheduleDayOfWeek,
  AvailabilityBlockDraft[]
> => ({
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
});

const toMinutes = (time: string) => {
  const parts = String(time).split(":");
  if (parts.length !== 2) {
    return null;
  }

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
};

const isKnownDay = (value: number): value is ScheduleDayOfWeek =>
  DAY_KEYS.includes(value as ScheduleDayOfWeek);

const mapScheduleToDraft = (
  schedules: EmployeeScheduleEntry[]
): Record<ScheduleDayOfWeek, AvailabilityBlockDraft[]> => {
  const draft = buildEmptyDraft();

  for (const entry of schedules) {
    const dayOfWeek = Number(entry.dayOfWeek);

    if (!isKnownDay(dayOfWeek)) {
      continue;
    }

    draft[dayOfWeek].push({
      clientId: entry._id || createClientId(),
      sedeId:
        typeof entry.sedeId === "string"
          ? entry.sedeId
          : entry.sedeId?._id || "",
      startTime: entry.startTime,
      endTime: entry.endTime,
      status: entry.status || "available",
    });
  }

  for (const day of DAY_KEYS) {
    draft[day].sort((left, right) =>
      left.startTime.localeCompare(right.startTime)
    );
  }

  return draft;
};

const groupConfirmedByDay = (
  entries: EmployeeScheduleEntry[]
): Record<ScheduleDayOfWeek, EmployeeScheduleEntry[]> => {
  const grouped: Record<ScheduleDayOfWeek, EmployeeScheduleEntry[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };

  for (const entry of entries) {
    const day = Number(entry.dayOfWeek);
    if (!isKnownDay(day)) {
      continue;
    }
    grouped[day].push(entry);
  }

  for (const day of DAY_KEYS) {
    grouped[day].sort((left, right) =>
      left.startTime.localeCompare(right.startTime)
    );
  }

  return grouped;
};

const getDayLabel = (day: ScheduleDayOfWeek) =>
  DAYS.find(item => item.key === day)?.label || "Dia";

const validateDraft = (
  draft: Record<ScheduleDayOfWeek, AvailabilityBlockDraft[]>
) => {
  for (const day of DAY_KEYS) {
    const blocks = draft[day];

    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      const order = index + 1;

      if (!block.sedeId) {
        return `Selecciona una sede en ${getDayLabel(day)} (bloque ${order})`;
      }

      const startMinutes = toMinutes(block.startTime);
      const endMinutes = toMinutes(block.endTime);

      if (startMinutes === null || endMinutes === null) {
        return `Formato horario invalido en ${getDayLabel(day)} (bloque ${order})`;
      }

      if (startMinutes >= endMinutes) {
        return `Rango invalido en ${getDayLabel(day)} (bloque ${order})`;
      }
    }

    const sortedByTime = [...blocks]
      .map(block => ({
        ...block,
        startMinutes: toMinutes(block.startTime) || 0,
        endMinutes: toMinutes(block.endTime) || 0,
      }))
      .sort((left, right) => left.startMinutes - right.startMinutes);

    for (let index = 1; index < sortedByTime.length; index += 1) {
      const previous = sortedByTime[index - 1];
      const current = sortedByTime[index];

      if (previous.endMinutes > current.startMinutes) {
        return `Hay solapamiento en ${getDayLabel(day)} entre ${previous.startTime}-${previous.endTime} y ${current.startTime}-${current.endTime}`;
      }
    }
  }

  return null;
};

const getBranchName = (entry: EmployeeScheduleEntry, branches: Branch[]) => {
  if (typeof entry.sedeId !== "string") {
    return entry.sedeId?.name || "Sede";
  }

  return branches.find(branch => branch._id === entry.sedeId)?.name || "Sede";
};

export default function EmployeeSchedulePage() {
  const { employeeId } = useParams<{ employeeId?: string }>();
  const isEditingOther = Boolean(employeeId);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [draft, setDraft] =
    useState<Record<ScheduleDayOfWeek, AvailabilityBlockDraft[]>>(
      buildEmptyDraft
    );
  const [confirmedEntries, setConfirmedEntries] = useState<
    EmployeeScheduleEntry[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);

    try {
      const [branchList, schedules] = await Promise.all([
        branchService.getAll(),
        isEditingOther
          ? scheduleService.getEmployeeSchedule(employeeId!)
          : scheduleService.getMySchedule(),
      ]);

      setBranches(branchList);
      setConfirmedEntries(schedules);
      setDraft(mapScheduleToDraft(schedules));
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "No se pudo cargar la disponibilidad semanal"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalBlocks = useMemo(
    () => DAY_KEYS.reduce<number>((acc, day) => acc + draft[day].length, 0),
    [draft]
  );

  const activeDays = useMemo(
    () => DAY_KEYS.filter(day => draft[day].length > 0).length,
    [draft]
  );

  const confirmedByDay = useMemo(
    () => groupConfirmedByDay(confirmedEntries),
    [confirmedEntries]
  );

  const addBlock = (day: ScheduleDayOfWeek) => {
    setDraft(previous => ({
      ...previous,
      [day]: [...previous[day], createEmptyBlock()],
    }));
  };

  const updateBlock = (
    day: ScheduleDayOfWeek,
    clientId: string,
    patch: Partial<AvailabilityBlockDraft>
  ) => {
    setDraft(previous => ({
      ...previous,
      [day]: previous[day].map(block =>
        block.clientId === clientId ? { ...block, ...patch } : block
      ),
    }));
  };

  const removeBlock = (day: ScheduleDayOfWeek, clientId: string) => {
    setDraft(previous => ({
      ...previous,
      [day]: previous[day].filter(block => block.clientId !== clientId),
    }));
  };

  const buildPayload = (): ScheduleEntryInput[] => {
    const entries: ScheduleEntryInput[] = [];

    for (const day of DAY_KEYS) {
      for (const block of draft[day]) {
        entries.push({
          dayOfWeek: day,
          sedeId: block.sedeId,
          startTime: block.startTime,
          endTime: block.endTime,
          status: block.status,
        });
      }
    }

    return entries.sort((left, right) => {
      if (left.dayOfWeek !== right.dayOfWeek) {
        return left.dayOfWeek - right.dayOfWeek;
      }
      return left.startTime.localeCompare(right.startTime);
    });
  };

  const handleSave = async () => {
    const validationMessage = validateDraft(draft);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    try {
      setSaving(true);
      const payload = buildPayload();
      const saved = isEditingOther
        ? await scheduleService.saveEmployeeSchedule(employeeId!, payload)
        : await scheduleService.saveAvailability(payload);

      setDraft(mapScheduleToDraft(saved));
      setConfirmedEntries(saved);
      toast.success("Disponibilidad guardada correctamente");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "No se pudo guardar la disponibilidad"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-[60vh] pb-32">
        <div className="mx-auto flex max-w-4xl items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-32 pt-4 sm:px-6">
      <section className="bg-linear-to-br rounded-3xl border border-white/10 from-slate-950 via-slate-900 to-cyan-950 p-6 shadow-[0_24px_80px_rgba(8,47,73,0.35)] transition-all duration-300 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-200">
              <CalendarDays className="h-4 w-4" />
              Planificador de Disponibilidad
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
              Selector de Horario Semanal
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              Agrega varios bloques por dia y guarda tu disponibilidad real.
            </p>
          </div>

          <div className="grid min-w-[210px] gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Dias con turnos
            </p>
            <p className="text-2xl font-semibold text-white">{activeDays}/7</p>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Bloques semanales
            </p>
            <p className="text-xl font-semibold text-cyan-200">{totalBlocks}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/90 p-4 shadow-xl sm:p-6">
        {DAYS.map(day => {
          const blocks = draft[day.key];

          return (
            <article
              key={day.key}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition-all duration-300 hover:border-cyan-500/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-100">
                  {day.label}
                </h2>

                <Button
                  onClick={() => addBlock(day.key)}
                  className="min-h-11 rounded-xl border border-cyan-300/30 bg-cyan-500/20 px-4 text-cyan-100 hover:bg-cyan-500/30"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar bloque
                </Button>
              </div>

              {blocks.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-3 text-sm text-slate-400">
                  Sin bloques definidos para este dia.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {blocks.map((block, index) => {
                    const isBooked = block.status === "booked";

                    return (
                      <div
                        key={block.clientId}
                        className="rounded-xl border border-slate-800 bg-slate-900/80 p-3"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                            Bloque {index + 1}
                          </p>

                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                isBooked
                                  ? "border border-amber-300/30 bg-amber-500/20 text-amber-100"
                                  : "border border-emerald-300/30 bg-emerald-500/20 text-emerald-100"
                              }`}
                            >
                              {isBooked ? "Reservado" : "Disponible"}
                            </span>

                            <button
                              type="button"
                              disabled={isBooked}
                              onClick={() =>
                                removeBlock(day.key, block.clientId)
                              }
                              className="inline-flex min-h-11 items-center rounded-lg border border-red-400/30 bg-red-500/10 px-3 text-xs font-medium text-red-200 transition-all duration-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Borrar
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="space-y-1 text-xs text-slate-400">
                            <span>Sede</span>
                            <select
                              disabled={isBooked}
                              value={block.sedeId}
                              onChange={event =>
                                updateBlock(day.key, block.clientId, {
                                  sedeId: event.target.value,
                                })
                              }
                              className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition-all duration-300 focus:border-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              <option value="">Selecciona una sede</option>
                              {branches.map(branch => (
                                <option key={branch._id} value={branch._id}>
                                  {branch.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="space-y-1 text-xs text-slate-400">
                            <span>Inicio</span>
                            <input
                              disabled={isBooked}
                              type="time"
                              value={block.startTime}
                              onChange={event =>
                                updateBlock(day.key, block.clientId, {
                                  startTime: event.target.value,
                                })
                              }
                              className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition-all duration-300 focus:border-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-45"
                            />
                          </label>

                          <label className="space-y-1 text-xs text-slate-400">
                            <span>Fin</span>
                            <input
                              disabled={isBooked}
                              type="time"
                              value={block.endTime}
                              onChange={event =>
                                updateBlock(day.key, block.clientId, {
                                  endTime: event.target.value,
                                })
                              }
                              className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition-all duration-300 focus:border-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-45"
                            />
                          </label>
                        </div>

                        {isBooked && (
                          <p className="mt-2 text-xs text-amber-200/90">
                            Este bloque esta reservado y no se puede editar.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="min-h-11 rounded-xl border border-cyan-300/30 bg-cyan-500/20 px-5 text-cyan-100 hover:bg-cyan-500/30"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Guardando..." : "Guardar Disponibilidad"}
        </Button>
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 shadow-xl sm:p-6">
        <header className="mb-4 flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <h2 className="text-lg font-semibold text-white">
            Bloques confirmados
          </h2>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-100">
            {confirmedEntries.length} registrados
          </span>
        </header>

        {confirmedEntries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
            Aun no tienes disponibilidad confirmada.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {DAYS.map(day => {
              const entries = confirmedByDay[day.key];

              return (
                <article
                  key={`confirmed-${day.key}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3"
                >
                  <h3 className="text-sm font-semibold text-slate-100">
                    {day.label}
                  </h3>

                  {entries.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Sin bloques confirmados.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {entries.map(entry => (
                        <li
                          key={`confirmed-item-${entry._id}`}
                          className="rounded-xl border border-slate-800 bg-slate-900 p-2.5"
                        >
                          <p className="inline-flex items-center gap-1.5 text-sm text-cyan-200">
                            <Clock3 className="h-4 w-4" />
                            {entry.startTime} - {entry.endTime}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {getBranchName(entry, branches)}
                          </p>
                          <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-100">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {entry.status === "booked"
                              ? "Reservado"
                              : "Confirmado"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
