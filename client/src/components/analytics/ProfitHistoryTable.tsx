import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ProfitHistoryAdminEmployee,
  ProfitHistoryAdminEntry,
  ProfitHistoryAdminOverview,
} from "../../features/analytics/types/analytics.types";
import { profitHistoryService } from "../../features/common/services";
import { useFeature } from "../FeatureSection";
import InfoTooltip from "../InfoTooltip";

interface ProfitHistoryTableProps {
  dateRange: { startDate: string; endDate: string };
  hideFinancialData?: boolean;
  scopeEmployeeId?: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const isValidObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

export default function ProfitHistoryTable({
  dateRange,
  hideFinancialData = false,
  scopeEmployeeId = "",
}: ProfitHistoryTableProps) {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<ProfitHistoryAdminOverview | null>(
    null
  );
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [limit, setLimit] = useState(150);

  const employeesEnabled = useFeature("employees");

  useEffect(() => {
    if (scopeEmployeeId && selectedEmployee !== scopeEmployeeId) {
      setSelectedEmployee(scopeEmployeeId);
    }
  }, [scopeEmployeeId, selectedEmployee]);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const employeeFilter = scopeEmployeeId
        ? scopeEmployeeId
        : selectedEmployee || undefined;

      const data = await profitHistoryService.getAdminOverview({
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
        employeeId: employeeFilter,
        limit,
      });
      setOverview(data);
    } catch (error) {
      console.error("Error cargando historial", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedEmployee, limit, scopeEmployeeId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const employees = useMemo<ProfitHistoryAdminEmployee[]>(() => {
    if (!overview) return [];
    return overview.employees;
  }, [overview]);

  const employeeOptions = useMemo(() => {
    const seen = new Set<string>();
    return employees.filter(dist => {
      const allow = dist.id === "admin" || isValidObjectId(dist.id);
      if (!allow) return false;
      if (seen.has(dist.id)) return false;
      seen.add(dist.id);
      return true;
    });
  }, [employees]);

  const emptyColSpan = hideFinancialData ? 4 : employeesEnabled ? 7 : 5;

  return (
    <div className="space-y-6">
      {/* Filtros Internos de la Tabla (Employee / Límite) */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        {employeesEnabled && !hideFinancialData && (
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Filtrar por Employee
            </label>
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            >
              <option value="">Todos</option>
              <option value="admin">Solo ventas admin</option>
              {employeeOptions
                .filter(d => d.id !== "admin")
                .map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.email ? `(${d.email})` : ""}
                  </option>
                ))}
            </select>
          </div>
        )}
        {hideFinancialData && (
          <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
            Vista privada activa: mostrando solo tus ganancias.
          </div>
        )}
        <div className="w-32">
          <label className="mb-1 block text-sm font-medium text-gray-300">
            Filas
          </label>
          <input
            type="number"
            min={20}
            max={500}
            value={limit}
            onChange={e => setLimit(Number(e.target.value) || 0)}
            className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          />
        </div>
        <div className="ml-auto">
          <button
            onClick={loadOverview}
            className="rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-100 transition hover:border-purple-400 hover:text-white"
          >
            Recargar Tabla
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/70 shadow-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-950/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Fecha
                  <InfoTooltip text="Fecha del movimiento o venta." />
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Venta / Evento
                  <InfoTooltip text="Tipo de transaccion registrada." />
                </th>
                {employeesEnabled && !hideFinancialData && (
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Employee
                    <InfoTooltip text="Employee asociado a la venta." />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Producto
                  <InfoTooltip text="Producto o concepto asociado a la transaccion." />
                </th>
                {employeesEnabled && !hideFinancialData && (
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Ganancia Dist
                    <InfoTooltip text="Comision del employee en la transaccion." />
                  </th>
                )}
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {hideFinancialData ? "Mis Ganancias" : "Ganancia Admin"}
                  <InfoTooltip
                    text={
                      hideFinancialData
                        ? "Ganancia personal del usuario actual."
                        : "Suma de la utilidad de tus ventas directas + la diferencia del precio B2B de tus employees."
                    }
                  />
                </th>
                {!hideFinancialData && (
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Total
                    <InfoTooltip text="Suma de ganancia admin y comision de employee." />
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/30">
              {loading && (
                <tr>
                  <td
                    colSpan={emptyColSpan}
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"></div>
                      Cargando transacciones...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && (!overview || overview.entries.length === 0) && (
                <tr>
                  <td
                    colSpan={emptyColSpan}
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    No se encontraron transacciones en este rango.
                  </td>
                </tr>
              )}

              {!loading &&
                overview?.entries.map((entry: ProfitHistoryAdminEntry) => (
                  <tr
                    key={entry.id}
                    className="transition-colors hover:bg-gray-800/50"
                  >
                    {/** En modo privado priorizamos comisión; si no existe, usar admin/total. */}
                    {(() => {
                      const ownProfit =
                        (entry.employeeProfit || 0) > 0
                          ? entry.employeeProfit
                          : (entry.adminProfit ?? entry.totalProfit ?? 0);

                      return (
                        <>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-300">
                            {formatDateTime(entry.date)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium text-white">
                                {entry.saleId || entry.id}
                              </span>
                              {entry.eventName && (
                                <span className="text-xs text-purple-300">
                                  {entry.eventName}
                                </span>
                              )}
                              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                <span
                                  className={
                                    entry.source === "special"
                                      ? "text-pink-400"
                                      : "text-emerald-400"
                                  }
                                >
                                  ●
                                </span>
                                {entry.source === "special"
                                  ? "Especial"
                                  : "Normal"}
                              </span>
                            </div>
                          </td>
                          {employeesEnabled && !hideFinancialData && (
                            <td className="px-6 py-4 text-sm text-gray-300">
                              {entry.employeeName ? (
                                <div className="flex flex-col">
                                  <span className="text-white">
                                    {entry.employeeName}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {entry.employeeEmail || "Admin"}
                                  </span>
                                </div>
                              ) : (
                                <span className="italic text-gray-500">
                                  Directo
                                </span>
                              )}
                            </td>
                          )}
                          <td className="px-6 py-4 text-sm text-gray-300">
                            {entry.productName || "-"}
                          </td>
                          {employeesEnabled && !hideFinancialData && (
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-cyan-400">
                              {formatCurrency(entry.employeeProfit)}
                            </td>
                          )}
                          <td
                            className={`whitespace-nowrap px-6 py-4 text-right text-sm font-medium ${hideFinancialData ? "text-cyan-300" : "text-emerald-400"}`}
                          >
                            {formatCurrency(
                              hideFinancialData
                                ? ownProfit
                                : (entry.adminProfit ?? 0)
                            )}
                          </td>
                          {!hideFinancialData && (
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-purple-300">
                              {formatCurrency(
                                entry.totalProfit ??
                                  (entry.adminProfit || 0) +
                                    (entry.employeeProfit || 0)
                              )}
                            </td>
                          )}
                        </>
                      );
                    })()}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
