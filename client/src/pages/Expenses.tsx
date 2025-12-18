import { useEffect, useMemo, useState } from "react";
import { expenseService } from "../api/services";
import { Button } from "../components/Button";
import type { Expense } from "../types";
import {
  buildCacheKey,
  readSessionCache,
  writeSessionCache,
} from "../utils/requestCache";

const EXPENSES_CACHE_TTL_MS = 2 * 60 * 1000;
const EXPENSES_CACHE_KEY = buildCacheKey("expenses:list");

export default function Expenses() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [form, setForm] = useState({
    type: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
  });

  const total = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

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
        setForm(prev => ({
          ...prev,
          type: "",
          amount: "",
          expenseDate: new Date().toISOString().slice(0, 10),
        }));
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Gastos / Inversiones</h1>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900">Registrar gasto</h2>
        <p className="mt-1 text-sm text-gray-600">
          Registra inversiones como envíos, marketing, publicidad, etc.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tipo de gasto
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              type="text"
              placeholder="Ej: Envíos, Marketing, Publicidad..."
              value={form.type}
              onChange={e =>
                setForm(prev => ({ ...prev, type: e.target.value }))
              }
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Monto (COP)
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
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
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Fecha
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              type="date"
              value={form.expenseDate}
              onChange={e =>
                setForm(prev => ({ ...prev, expenseDate: e.target.value }))
              }
              required
            />
          </div>

          <div className="md:col-span-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit" loading={saving}>
                {editingId ? "Guardar cambios" : "Guardar gasto"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancelar edición
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Gastos registrados
          </h2>
          <div className="text-sm text-gray-700">
            Total:{" "}
            <span className="font-semibold">{formatCurrency(total)}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-purple-600" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-10 text-center text-gray-600">
            Aún no hay gastos registrados.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    Tipo de gasto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-600">
                    Monto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {expenses.map(exp => (
                  <tr key={exp._id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {new Date(exp.expenseDate).toLocaleDateString("es-CO")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {exp.type || exp.category || exp.description || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => startEdit(exp)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          type="button"
                          loading={deletingId === exp._id}
                          onClick={() => handleDelete(exp._id)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          className="text-sm text-purple-300 hover:text-purple-200"
          onClick={() => load()}
          type="button"
        >
          Recargar
        </button>
      </div>
    </div>
  );
}
