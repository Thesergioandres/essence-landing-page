import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { creditService } from "../api/services";
import CustomerSelector from "../components/CustomerSelector";
import type { Credit, CreditMetrics, Customer } from "../types";
import { logUI } from "../utils/logger";

type CreditStatus = "pending" | "partial" | "paid" | "overdue" | "cancelled";

const statusLabels: Record<CreditStatus, string> = {
  pending: "Pendiente",
  partial: "Pago Parcial",
  paid: "Pagado",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

const statusColors: Record<CreditStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export default function Credits() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [metrics, setMetrics] = useState<CreditMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null);

  // Form states
  const [newCredit, setNewCredit] = useState({
    customerId: "",
    amount: "",
    description: "",
    dueDate: "",
  });
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "transfer" | "card" | "other"
  >("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [creditsRes, metricsRes] = await Promise.all([
        creditService.getAll({ status: statusFilter || undefined }),
        creditService.getMetrics(),
      ]);
      setCredits(creditsRes.credits);
      setMetrics(metricsRes.metrics);
      logUI.info("debt_loaded", {
        module: "credits",
        count: creditsRes.credits.length,
      });
    } catch (err) {
      logUI.error("debt_load_failed", {
        module: "credits",
        error: err,
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await creditService.create({
        customerId: newCredit.customerId,
        amount: parseFloat(newCredit.amount),
        description: newCredit.description,
        dueDate: newCredit.dueDate || undefined,
      });
      logUI.info("Fiado creado", {
        module: "credits",
        amount: newCredit.amount,
      });
      setShowCreateModal(false);
      setNewCredit({
        customerId: "",
        amount: "",
        description: "",
        dueDate: "",
      });
      loadData();
    } catch (err) {
      logUI.error("debt_create_failed", { module: "credits", error: err });
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCredit) return;

    try {
      await creditService.registerPayment(selectedCredit._id, {
        amount: parseFloat(paymentAmount),
        paymentMethod,
        notes: paymentNotes,
      });
      logUI.info("debt_payment_registered", {
        module: "credits",
        creditId: selectedCredit._id,
        amount: paymentAmount,
      });
      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentNotes("");
      setSelectedCredit(null);
      loadData();
    } catch (err) {
      logUI.error("debt_payment_failed", { module: "credits", error: err });
    }
  };

  const openPaymentModal = (credit: Credit) => {
    setSelectedCredit(credit);
    setShowPaymentModal(true);
  };

  const handleDeleteCredit = async (creditId: string) => {
    if (
      !confirm(
        "¿Estás seguro de que deseas eliminar este crédito? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }

    try {
      await creditService.delete(creditId);
      logUI.info("debt_deleted", {
        module: "credits",
        creditId,
      });
      loadData();
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      const message =
        error.response?.data?.message || "Error al eliminar el crédito";
      alert(message);
      logUI.error("debt_delete_failed", { module: "credits", error: err });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Fiados / Créditos
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Gestiona los créditos otorgados a clientes
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Nuevo Fiado
        </button>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 shadow-sm">
            <p className="text-sm text-gray-400">Total Fiados</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {formatCurrency(metrics.total.totalRemainingAmount)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {metrics.total.totalCredits} créditos activos
            </p>
          </div>

          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 shadow-sm">
            <p className="text-sm text-red-300">Vencidos</p>
            <p className="mt-1 text-2xl font-bold text-red-400">
              {formatCurrency(metrics.overdue.amount)}
            </p>
            <p className="mt-1 text-xs text-red-300/60">
              {metrics.overdue.count} créditos
            </p>
          </div>

          <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-5 shadow-sm">
            <p className="text-sm text-green-300">Recuperado</p>
            <p className="mt-1 text-2xl font-bold text-green-400">
              {formatCurrency(metrics.total.totalPaidAmount)}
            </p>
            <p className="mt-1 text-xs text-green-300/60">
              Tasa: {metrics.recoveryRate}%
            </p>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 shadow-sm">
            <p className="text-sm text-gray-400">Original Total</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {formatCurrency(metrics.total.totalOriginalAmount)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="partial">Pago Parcial</option>
          <option value="overdue">Vencido</option>
          <option value="paid">Pagado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {/* Credits Table */}
      <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          </div>
        ) : credits.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            No hay créditos registrados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800/800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                    Monto Original
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                    Saldo Pendiente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                    Vencimiento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700 bg-gray-900/30">
                {credits.map(credit => {
                  const customer = credit.customer as Customer;
                  return (
                    <tr key={credit._id} className="hover:bg-gray-800/50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-white">
                            {customer?.name || "Cliente"}
                          </div>
                          <div className="text-sm text-gray-400">
                            {customer?.phone || customer?.email || ""}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-200">
                        {formatCurrency(credit.originalAmount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-white">
                        {formatCurrency(credit.remainingAmount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[credit.status]}`}
                        >
                          {statusLabels[credit.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-400">
                        {formatDate(credit.dueDate)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          {credit.status !== "paid" &&
                            credit.status !== "cancelled" && (
                              <>
                                <button
                                  onClick={() => openPaymentModal(credit)}
                                  className="font-medium text-indigo-600 hover:text-indigo-800"
                                >
                                  Registrar Pago
                                </button>
                                <span className="text-gray-300">|</span>
                                <button
                                  onClick={() => handleDeleteCredit(credit._id)}
                                  className="font-medium text-red-600 hover:text-red-800"
                                >
                                  Borrar
                                </button>
                                <span className="text-gray-300">|</span>
                              </>
                            )}
                          <Link
                            to={`/admin/credits/${credit._id}`}
                            className="font-medium text-gray-600 hover:text-gray-800"
                          >
                            Ver Detalles
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Debtors */}
      {metrics && metrics.topDebtors.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Principales Deudores
          </h3>
          <div className="space-y-3">
            {metrics.topDebtors.slice(0, 5).map((debtor, index) => (
              <div
                key={debtor.customerId}
                className="flex items-center justify-between border-b border-gray-700 py-2 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-xs font-medium text-gray-300">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {debtor.customerName}
                    </p>
                    <p className="text-xs text-gray-400">
                      {debtor.creditsCount} créditos
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-red-400">
                  {formatCurrency(debtor.totalDebt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Credit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Nuevo Fiado
            </h2>
            <form onSubmit={handleCreateCredit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Cliente
                </label>
                <CustomerSelector
                  value={newCredit.customerId}
                  onChange={(customerId, customer) => {
                    setNewCredit({ ...newCredit, customerId });
                    setSelectedCustomerName(customer?.name || "");
                  }}
                  placeholder="Buscar cliente por nombre o teléfono..."
                  required
                  allowCreate
                  onCreateSuccess={customer => {
                    logUI.info("customer_created_from_credit", {
                      module: "credits",
                      customerId: customer._id,
                    });
                  }}
                />
                {selectedCustomerName && (
                  <p className="mt-1 text-sm text-gray-500">
                    Cliente seleccionado:{" "}
                    <strong>{selectedCustomerName}</strong>
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Monto
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newCredit.amount}
                  onChange={e =>
                    setNewCredit({ ...newCredit, amount: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Fecha de Vencimiento (Opcional)
                </label>
                <input
                  type="date"
                  value={newCredit.dueDate}
                  onChange={e =>
                    setNewCredit({ ...newCredit, dueDate: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={newCredit.description}
                  onChange={e =>
                    setNewCredit({ ...newCredit, description: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Notas adicionales..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
                >
                  Crear Fiado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h2 className="mb-2 text-xl font-semibold text-white">
              Registrar Pago
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              Saldo pendiente:{" "}
              <span className="font-semibold text-white">
                {formatCurrency(selectedCredit.remainingAmount)}
              </span>
            </p>

            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Monto del Pago
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedCredit.remainingAmount}
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Método de Pago
                </label>
                <select
                  value={paymentMethod}
                  onChange={e =>
                    setPaymentMethod(e.target.value as typeof paymentMethod)
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Notas (Opcional)
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="Referencia o nota..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedCredit(null);
                  }}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
                >
                  Registrar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
