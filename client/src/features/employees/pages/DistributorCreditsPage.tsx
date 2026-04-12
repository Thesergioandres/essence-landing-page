import { useCallback, useEffect, useRef, useState } from "react";
import { creditService } from "../../credits/services";
import type { Credit } from "../../credits/types/credit.types";
import type { Customer } from "../../customers/types/customer.types";
import { saleService } from "../../sales/services";

export default function DistributorCredits() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [stats, setStats] = useState<{
    totalCredits: number;
    totalDebt?: number;
    overdue?: number;
    pendingCount?: number;
    totalPending?: number;
    totalCollected?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid">(
    "all"
  );

  // Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "transfer" | "card" | "other"
  >("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const syncedSalesRef = useRef<Set<string>>(new Set());

  const loadCredits = useCallback(async () => {
    try {
      setLoading(true);
      const statusFilter =
        filterStatus === "all"
          ? undefined
          : filterStatus === "paid"
            ? "paid"
            : "pending";
      const response = await creditService.getAll({ status: statusFilter });
      const list = response?.credits || [];
      setCredits(list);

      const totalDebt = list.reduce(
        (sum, credit) => sum + (credit.remainingAmount || 0),
        0
      );
      const totalCollected = list.reduce(
        (sum, credit) => sum + (credit.paidAmount || 0),
        0
      );
      const overdueCount = list.filter(
        credit => credit.status === "overdue"
      ).length;
      const pendingCount = list.filter(credit =>
        ["pending", "partial", "overdue"].includes(credit.status)
      ).length;

      setStats(
        response?.stats ?? {
          totalCredits: list.length,
          totalDebt,
          overdue: overdueCount,
          pendingCount,
          totalPending: totalDebt,
          totalCollected,
        }
      );
    } catch (error) {
      console.error("Error al cargar créditos:", error);
      setCredits([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    void loadCredits();
  }, [loadCredits]);

  useEffect(() => {
    const syncPaidSales = async () => {
      const candidates = credits.filter(
        credit => (credit.remainingAmount || 0) <= 0 && credit.sale
      );

      for (const credit of candidates) {
        const saleId = String(credit.sale || "");
        if (!saleId || syncedSalesRef.current.has(saleId)) continue;
        syncedSalesRef.current.add(saleId);
        try {
          await saleService.confirmPayment(saleId);
        } catch (error) {
          console.error("Error syncing paid sale:", error);
        }
      }
    };

    void syncPaidSales();
  }, [credits]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const openPaymentModal = (credit: Credit) => {
    setSelectedCredit(credit);
    setPaymentAmount("");
    setPaymentMethod("cash");
    setPaymentNotes("");
    setPaymentProof(null);
    setPaymentProofPreview(null);
    setMessage(null);
    setShowPaymentModal(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCredit) return;

    try {
      setSubmitting(true);
      setMessage(null);

      const response = await creditService.registerDistributorPayment(
        selectedCredit._id,
        {
          amount: parseFloat(paymentAmount),
          notes: paymentNotes,
        }
      );

      setMessage({ type: "success", text: response.message });

      // Actualizar el crédito en la lista
      setCredits(prev =>
        prev.map(c =>
          c._id === selectedCredit._id
            ? {
                ...c,
                remainingAmount: response.credit.remainingAmount,
                paidAmount: response.credit.paidAmount,
                status: response.credit.status,
              }
            : c
        )
      );

      // Actualizar estadísticas
      loadCredits();

      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        setShowPaymentModal(false);
        setSelectedCredit(null);
      }, 2000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Error al registrar el pago",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: "error", text: "La imagen no puede superar 5MB" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPaymentProof(base64);
        setPaymentProofPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Filtrar créditos
  const filteredCredits = credits.filter(credit => {
    if (filterStatus === "pending") {
      return ["pending", "partial", "overdue"].includes(credit.status);
    }
    if (filterStatus === "paid") {
      return credit.status === "paid";
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    const badges: Record<
      string,
      { label: string; className: string; icon: string }
    > = {
      pending: {
        label: "Pendiente",
        className: "bg-yellow-900/30 text-yellow-400",
        icon: "⏳",
      },
      partial: {
        label: "Pago Parcial",
        className: "bg-blue-900/30 text-blue-400",
        icon: "💳",
      },
      paid: {
        label: "Pagado",
        className: "bg-green-900/30 text-green-400",
        icon: "✓",
      },
      overdue: {
        label: "Vencido",
        className: "bg-red-900/30 text-red-400",
        icon: "⚠️",
      },
      cancelled: {
        label: "Cancelado",
        className: "bg-gray-900/30 text-gray-400",
        icon: "✕",
      },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${badge.className}`}
      >
        {badge.icon} {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white">Mis Cobros Pendientes</h1>
        <p className="mt-2 text-gray-400">
          Gestiona los créditos de tus ventas y registra abonos
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-blue-900/50 to-gray-800/50 p-5">
          <p className="text-sm text-gray-400">Total Créditos</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {stats?.totalCredits ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-orange-700/50 bg-gradient-to-br from-orange-900/30 to-gray-800/50 p-5">
          <p className="text-sm text-orange-300">Pendientes</p>
          <p className="mt-2 text-3xl font-bold text-orange-400">
            {stats?.pendingCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-red-700/50 bg-gradient-to-br from-red-900/30 to-gray-800/50 p-5">
          <p className="text-sm text-red-300">Por Cobrar</p>
          <p className="mt-2 text-2xl font-bold text-red-400">
            {formatCurrency(stats?.totalPending ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-green-700/50 bg-gradient-to-br from-green-900/30 to-gray-800/50 p-5">
          <p className="text-sm text-green-300">Cobrado</p>
          <p className="mt-2 text-2xl font-bold text-green-400">
            {formatCurrency(stats?.totalCollected ?? 0)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterStatus("all")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            filterStatus === "all"
              ? "bg-orange-600 text-white"
              : "border border-gray-700 text-gray-300 hover:bg-gray-800"
          }`}
        >
          Todos ({credits.length})
        </button>
        <button
          onClick={() => setFilterStatus("pending")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            filterStatus === "pending"
              ? "bg-orange-600 text-white"
              : "border border-gray-700 text-gray-300 hover:bg-gray-800"
          }`}
        >
          Pendientes ({stats?.pendingCount ?? 0})
        </button>
        <button
          onClick={() => setFilterStatus("paid")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            filterStatus === "paid"
              ? "bg-orange-600 text-white"
              : "border border-gray-700 text-gray-300 hover:bg-gray-800"
          }`}
        >
          Pagados ({credits.filter(c => c.status === "paid").length})
        </button>
      </div>

      {/* Credits List */}
      <div className="space-y-4">
        {filteredCredits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-600 p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="mt-4 text-lg text-gray-400">
              No hay créditos {filterStatus === "pending" ? "pendientes" : ""}
            </p>
          </div>
        ) : (
          filteredCredits.map(credit => {
            const customer = credit.customer as Customer;
            const isPending = ["pending", "partial", "overdue"].includes(
              credit.status
            );

            return (
              <div
                key={credit._id}
                className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">
                        {customer?.name || "Cliente"}
                      </h3>
                      {getStatusBadge(credit.status)}
                    </div>
                    {customer?.phone && (
                      <p className="mt-1 text-sm text-gray-400">
                        📞 {customer.phone}
                      </p>
                    )}
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-gray-500">Monto Original</p>
                        <p className="font-semibold text-white">
                          {formatCurrency(credit.originalAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Abonado</p>
                        <p className="font-semibold text-green-400">
                          {formatCurrency(credit.paidAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Pendiente</p>
                        <p className="font-semibold text-orange-400">
                          {formatCurrency(credit.remainingAmount)}
                        </p>
                      </div>
                    </div>
                    {credit.dueDate && (
                      <p className="mt-2 text-xs text-gray-500">
                        Vence: {formatDate(credit.dueDate)}
                      </p>
                    )}
                  </div>
                  {isPending && (
                    <button
                      onClick={() => openPaymentModal(credit)}
                      className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition hover:bg-orange-700"
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
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      Registrar Abono
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h2 className="mb-2 text-xl font-semibold text-white">
              Registrar Abono
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              Cliente:{" "}
              <span className="font-medium text-white">
                {(selectedCredit.customer as Customer)?.name}
              </span>
              <br />
              Saldo pendiente:{" "}
              <span className="font-semibold text-orange-400">
                {formatCurrency(selectedCredit.remainingAmount)}
              </span>
            </p>

            {message && (
              <div
                className={`mb-4 rounded-lg p-3 text-sm ${
                  message.type === "success"
                    ? "border border-green-700 bg-green-900/50 text-green-400"
                    : "border border-red-700 bg-red-900/50 text-red-400"
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Monto del Abono *
                </label>
                <input
                  type="number"
                  step="100"
                  min="100"
                  max={selectedCredit.remainingAmount}
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:ring-2 focus:ring-orange-500"
                  placeholder="0"
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
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:ring-2 focus:ring-orange-500"
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
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:ring-2 focus:ring-orange-500"
                  placeholder="Referencia o nota..."
                />
              </div>

              {/* Comprobante de pago */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Comprobante de Consignación
                </label>
                {paymentProofPreview ? (
                  <div className="relative">
                    <img
                      src={paymentProofPreview}
                      alt="Comprobante"
                      className="h-32 w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentProof(null);
                        setPaymentProofPreview(null);
                      }}
                      className="absolute right-2 top-2 rounded-full bg-red-600 p-1 text-white hover:bg-red-700"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-600 p-4 transition-colors hover:border-orange-500">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <div className="text-center">
                      <svg
                        className="mx-auto h-8 w-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p className="mt-1 text-sm text-gray-400">
                        Subir foto del comprobante
                      </p>
                    </div>
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedCredit(null);
                  }}
                  disabled={submitting}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !paymentAmount}
                  className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Procesando...
                    </>
                  ) : (
                    "Registrar Abono"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
