import { useEffect, useMemo, useState } from "react";
import { expenseService } from "../../common/services";
import { Button } from "../../../shared/components/ui";
import type { Expense } from "../../../types";
import {
  buildCacheKey,
  readSessionCache,
  writeSessionCache,
} from "../../../utils/requestCache";

const EXPENSES_CACHE_TTL_MS = 2 * 60 * 1000;
const EXPENSES_CACHE_KEY = buildCacheKey("expenses:list");

// Categorías predefinidas con iconos
const EXPENSE_CATEGORIES = [
  {
    value: "envios",
    label: "📦 Envíos",
    color: "bg-blue-500/20 text-blue-300",
  },
  {
    value: "marketing",
    label: "📣 Marketing",
    color: "bg-purple-500/20 text-purple-300",
  },
  {
    value: "publicidad",
    label: "📺 Publicidad",
    color: "bg-pink-500/20 text-pink-300",
  },
  {
    value: "inventario",
    label: "📋 Inventario",
    color: "bg-green-500/20 text-green-300",
  },
  {
    value: "servicios",
    label: "⚡ Servicios",
    color: "bg-yellow-500/20 text-yellow-300",
  },
  {
    value: "personal",
    label: "👥 Personal",
    color: "bg-indigo-500/20 text-indigo-300",
  },
  {
    value: "tecnologia",
    label: "💻 Tecnología",
    color: "bg-cyan-500/20 text-cyan-300",
  },
  {
    value: "defectuoso",
    label: "💔 Pérdidas Defectuosos",
    color: "bg-red-500/20 text-red-300",
  },
  {
    value: "costo adicional",
    label: "💸 Costo Adicional Envío",
    color: "bg-orange-500/20 text-orange-300",
  },
  { value: "otros", label: "📎 Otros", color: "bg-gray-500/20 text-gray-300" },
];

const getCategoryStyle = (type: string) => {
  const cat = EXPENSE_CATEGORIES.find(
    c =>
      type?.toLowerCase().includes(c.value) ||
      c.value.includes(type?.toLowerCase() || "")
  );
  return cat?.color || "bg-gray-500/20 text-gray-300";
};

export default function Expenses() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [form, setForm] = useState({
    type: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
  });

  // Métricas calculadas
  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const thisMonthExpenses = expenses.filter(e => {
      const d = new Date(e.expenseDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const lastMonthExpenses = expenses.filter(e => {
      const d = new Date(e.expenseDate);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });

    const totalThisMonth = thisMonthExpenses.reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );
    const totalLastMonth = lastMonthExpenses.reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );
    const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Agrupar por tipo
    const byType = expenses.reduce<Record<string, number>>((acc, e) => {
      const type = e.type || e.category || e.description || "Otros";
      acc[type] = (acc[type] || 0) + (Number(e.amount) || 0);
      return acc;
    }, {});

    const topCategories = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const growthPercent =
      totalLastMonth > 0
        ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100
        : totalThisMonth > 0
          ? 100
          : 0;

    return {
      total,
      totalThisMonth,
      totalLastMonth,
      countThisMonth: thisMonthExpenses.length,
      growthPercent,
      topCategories,
      averageExpense: expenses.length > 0 ? total / expenses.length : 0,
    };
  }, [expenses]);

  // Filtrar gastos por mes seleccionado
  const filteredExpenses = useMemo(() => {
    if (!filterMonth) return expenses;
    const [year, month] = filterMonth.split("-").map(Number);
    return expenses.filter(e => {
      const d = new Date(e.expenseDate);
      return d.getFullYear() === year && d.getMonth() === month - 1;
    });
  }, [expenses, filterMonth]);

  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );
  }, [filteredExpenses]);

  const load = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const res = await expenseService.getAll();
      setExpenses(res.expenses);
      writeSessionCache(EXPENSES_CACHE_KEY, res);
    } catch (error) {
      console.error("Error cargando gastos:", error);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    const cached = readSessionCache<{ expenses: Expense[] }>(
      EXPENSES_CACHE_KEY,
      EXPENSES_CACHE_TTL_MS
    );

    if (cached?.expenses?.length) {
      setExpenses(cached.expenses);
      setLoading(false);
      void load({ silent: true });
      return;
    }

    void load();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = Number(form.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert("Ingresa un monto válido");
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        const updated = await expenseService.update(editingId, {
          type: form.type,
          amount: parsedAmount,
          expenseDate: form.expenseDate,
        });

        setExpenses(prev => {
          const next = prev.map(e =>
            e._id === editingId ? updated.expense : e
          );
          writeSessionCache(EXPENSES_CACHE_KEY, { expenses: next });
          return next;
        });
        setEditingId(null);
        setForm({
          type: "",
          amount: "",
          expenseDate: new Date().toISOString().slice(0, 10),
        });
      } else {
        const created = await expenseService.create({
          type: form.type,
          amount: parsedAmount,
          expenseDate: form.expenseDate,
        });

        setExpenses(prev => {
          const next = [created.expense, ...prev];
          writeSessionCache(EXPENSES_CACHE_KEY, { expenses: next });
          return next;
        });
        setForm(prev => ({ ...prev, amount: "", type: "" }));
      }
    } catch (error) {
      console.error("Error registrando gasto:", error);
      alert("No se pudo registrar el gasto");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (expense: Expense) => {
    setEditingId(expense._id);
    setForm({
      type: expense.type || expense.category || expense.description || "",
      amount: String(expense.amount ?? ""),
      expenseDate: new Date(expense.expenseDate).toISOString().slice(0, 10),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({
      type: "",
      amount: "",
      expenseDate: new Date().toISOString().slice(0, 10),
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este gasto?")) return;

    try {
      setDeletingId(id);
      await expenseService.delete(id);
      setExpenses(prev => {
        const next = prev.filter(e => e._id !== id);
        writeSessionCache(EXPENSES_CACHE_KEY, { expenses: next });
        return next;
      });
      if (editingId === id) {
        cancelEdit();
      }
    } catch (error) {
      console.error("Error eliminando gasto:", error);
      alert("No se pudo eliminar el gasto");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            💸 Gastos e Inversiones
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Gestiona y analiza tus gastos operativos
          </p>
        </div>
        <button
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2 text-sm text-gray-300 transition hover:border-purple-500 hover:text-white"
          onClick={() => load()}
          type="button"
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Actualizar
        </button>
      </div>

      {/* Métricas Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-lg backdrop-blur-sm">
          <p className="text-xs text-gray-400 sm:text-sm">Gastos este mes</p>
          <p className="mt-1 text-xl font-bold text-rose-400 sm:text-2xl">
            {formatCurrency(metrics.totalThisMonth)}
          </p>
          <p
            className={`mt-1 text-xs ${metrics.growthPercent <= 0 ? "text-green-400" : "text-red-400"}`}
          >
            {metrics.growthPercent >= 0 ? "+" : ""}
            {metrics.growthPercent.toFixed(1)}% vs mes anterior
          </p>
        </div>

        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-lg backdrop-blur-sm">
          <p className="text-xs text-gray-400 sm:text-sm">Mes anterior</p>
          <p className="mt-1 text-xl font-bold text-amber-400 sm:text-2xl">
            {formatCurrency(metrics.totalLastMonth)}
          </p>
          <p className="mt-1 text-xs text-gray-500">Comparativo</p>
        </div>

        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-lg backdrop-blur-sm">
          <p className="text-xs text-gray-400 sm:text-sm">Total histórico</p>
          <p className="mt-1 text-xl font-bold text-purple-400 sm:text-2xl">
            {formatCurrency(metrics.total)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {expenses.length} registros
          </p>
        </div>

        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-lg backdrop-blur-sm">
          <p className="text-xs text-gray-400 sm:text-sm">Promedio por gasto</p>
          <p className="mt-1 text-xl font-bold text-cyan-400 sm:text-2xl">
            {formatCurrency(metrics.averageExpense)}
          </p>
          <p className="mt-1 text-xs text-gray-500">Ticket promedio</p>
        </div>
      </div>

      {/* Top Categorías */}
      {metrics.topCategories.length > 0 && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-lg backdrop-blur-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            📊 Distribución por Categoría
          </h2>
          <div className="space-y-3">
            {metrics.topCategories.map(([type, amount], idx) => {
              const percentage = (amount / metrics.total) * 100;
              return (
                <div key={type}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryStyle(type)}`}
                    >
                      {type}
                    </span>
                    <span className="font-medium text-gray-200">
                      {formatCurrency(amount)} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700">
                    <div
                      className={`h-full transition-all ${
                        idx === 0
                          ? "bg-rose-500"
                          : idx === 1
                            ? "bg-amber-500"
                            : idx === 2
                              ? "bg-purple-500"
                              : idx === 3
                                ? "bg-cyan-500"
                                : "bg-gray-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Formulario */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-lg backdrop-blur-sm sm:p-6">
        <h2 className="text-lg font-semibold text-white">
          {editingId ? "✏️ Editar gasto" : "➕ Registrar nuevo gasto"}
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Registra inversiones como envíos, marketing, publicidad, etc.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Categoría
              </label>
              <select
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-gray-100 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                value={form.type}
                onChange={e =>
                  setForm(prev => ({ ...prev, type: e.target.value }))
                }
                required
              >
                <option value="">Seleccionar...</option>
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.label.slice(2).trim()}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Monto (COP)
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-gray-100 placeholder:text-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Ej: 50000"
                value={form.amount}
                onChange={e =>
                  setForm(prev => ({ ...prev, amount: e.target.value }))
                }
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Fecha
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-gray-100 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                type="date"
                value={form.expenseDate}
                onChange={e =>
                  setForm(prev => ({ ...prev, expenseDate: e.target.value }))
                }
                required
              />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" loading={saving} className="flex-1">
                {editingId ? "Guardar" : "Agregar"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700"
                  onClick={cancelEdit}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Lista de Gastos */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-lg backdrop-blur-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-white">
            📋 Historial de Gastos
          </h2>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
            />
            <div className="text-sm text-gray-300">
              Total:{" "}
              <span className="font-bold text-rose-400">
                {formatCurrency(filteredTotal)}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-purple-600" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mb-3 text-4xl">📭</div>
            <p className="text-gray-400">No hay gastos en este período.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full divide-y divide-gray-700">
                <thead className="sticky top-0 bg-gray-900/70 backdrop-blur">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Categoría
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                      Monto
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {filteredExpenses.map(exp => (
                    <tr
                      key={exp._id}
                      className="transition hover:bg-gray-900/30"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-200">
                        {new Date(exp.expenseDate).toLocaleDateString("es-CO", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getCategoryStyle(exp.type || exp.category || exp.description || "")}`}
                        >
                          {exp.type ||
                            exp.category ||
                            exp.description ||
                            "Sin categoría"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-rose-400">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(exp)}
                            className="rounded-md border border-gray-600 px-2.5 py-1 text-xs text-gray-300 transition hover:border-purple-500 hover:text-white"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(exp._id)}
                            disabled={deletingId === exp._id}
                            className="rounded-md border border-red-600/50 px-2.5 py-1 text-xs text-red-400 transition hover:border-red-500 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {deletingId === exp._id ? "..." : "Eliminar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {filteredExpenses.map(exp => (
                <div
                  key={exp._id}
                  className="rounded-lg border border-gray-700 bg-gray-900/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500">
                        {new Date(exp.expenseDate).toLocaleDateString("es-CO", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryStyle(exp.type || exp.category || exp.description || "")}`}
                      >
                        {exp.type ||
                          exp.category ||
                          exp.description ||
                          "Sin categoría"}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-rose-400">
                      {formatCurrency(exp.amount)}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(exp)}
                      className="rounded-md border border-gray-600 px-3 py-1.5 text-xs text-gray-300 transition hover:border-purple-500"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(exp._id)}
                      disabled={deletingId === exp._id}
                      className="rounded-md border border-red-600/50 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {deletingId === exp._id ? "..." : "Eliminar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
