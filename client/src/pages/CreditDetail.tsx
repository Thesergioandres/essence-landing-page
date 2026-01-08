import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { creditService } from "../api/services";
import type { Credit, CreditPayment, Customer } from "../types";

export default function CreditDetail() {
  const { id } = useParams<{ id: string }>();
  const [credit, setCredit] = useState<Credit | null>(null);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    loadCreditDetail();
  }, [id]);

  const loadCreditDetail = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await creditService.getById(id);
      setCredit(response.credit);
      setPayments(response.payments || []);
    } catch (err) {
      setError("No se pudo cargar el detalle del crédito");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      pending: {
        label: "Pendiente",
        className: "bg-yellow-100 text-yellow-800",
      },
      partial: {
        label: "Pago Parcial",
        className: "bg-blue-100 text-blue-800",
      },
      paid: { label: "Pagado", className: "bg-green-100 text-green-800" },
      overdue: { label: "Vencido", className: "bg-red-100 text-red-800" },
      cancelled: {
        label: "Cancelado",
        className: "bg-gray-100 text-gray-800",
      },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span
        className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${badge.className}`}
      >
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !credit) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          {error || "Crédito no encontrado"}
        </div>
        <Link
          to="/admin/credits"
          className="mt-4 inline-block text-indigo-600 hover:text-indigo-800"
        >
          ← Volver a créditos
        </Link>
      </div>
    );
  }

  const customer = credit.customer as Customer;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/admin/credits"
            className="mb-2 inline-block text-sm text-indigo-600 hover:text-indigo-800"
          >
            ← Volver a créditos
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Detalle del Crédito
          </h1>
        </div>
        <div>{getStatusBadge(credit.status)}</div>
      </div>

      {/* Credit Information */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Main Info Card */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Información del Crédito
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-sm text-gray-600">Cliente:</span>
              <span className="text-sm font-medium text-gray-900">
                {customer?.name || "Sin cliente"}
              </span>
            </div>
            {customer?.phone && (
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-sm text-gray-600">Teléfono:</span>
                <span className="text-sm font-medium text-gray-900">
                  {customer.phone}
                </span>
              </div>
            )}
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-sm text-gray-600">Monto Original:</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(credit.originalAmount)}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-sm text-gray-600">Monto Pagado:</span>
              <span className="text-sm font-semibold text-green-600">
                {formatCurrency(credit.paidAmount)}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-sm text-gray-600">Saldo Pendiente:</span>
              <span className="text-lg font-bold text-red-600">
                {formatCurrency(credit.remainingAmount)}
              </span>
            </div>
            {credit.dueDate && (
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-sm text-gray-600">Vencimiento:</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(credit.dueDate)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <span className="text-sm text-gray-600">Creado:</span>
              <span className="text-sm text-gray-500">
                {formatDate(credit.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Items Card */}
        {credit.items && credit.items.length > 0 && (
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Productos
            </h2>
            <div className="space-y-3">
              {credit.items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="font-medium text-gray-900">
                    {item.productName}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-gray-600">
                    <span>
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {credit.description && (
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">
              Descripción
            </h2>
            <p className="text-sm text-gray-600">{credit.description}</p>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Historial de Pagos ({payments.length})
        </h2>
        {payments.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            No hay pagos registrados
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Método
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Notas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {payments.map(payment => (
                  <tr key={payment._id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {formatDate(payment.paymentDate)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-green-600">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {payment.paymentMethod === "cash" && "Efectivo"}
                      {payment.paymentMethod === "transfer" && "Transferencia"}
                      {payment.paymentMethod === "card" && "Tarjeta"}
                      {payment.paymentMethod === "other" && "Otro"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {payment.notes || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
