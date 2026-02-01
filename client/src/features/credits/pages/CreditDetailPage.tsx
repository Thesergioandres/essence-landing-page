import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { creditService } from "../../credits/services";
import type {
  Credit,
  CreditPayment,
  CreditProfitInfo,
  Customer,
  Sale,
  User,
} from "../../../types";

export default function CreditDetail() {
  const { id } = useParams<{ id: string }>();
  const [credit, setCredit] = useState<Credit | null>(null);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [profitInfo, setProfitInfo] = useState<CreditProfitInfo | null>(null);
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
      setProfitInfo(response.profitInfo || null);
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
  const sale = credit.sale as Sale | undefined;
  const createdBy = credit.createdBy as User | undefined;
  const distributor = sale?.distributor as User | undefined;

  return (
    <div className="space-y-6 overflow-hidden p-6">
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

        {/* Responsable Card */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Responsable del Crédito
          </h2>
          <div className="space-y-3">
            {distributor ? (
              <>
                <div className="flex items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white">
                    {distributor.name?.charAt(0).toUpperCase() || "D"}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {distributor.name}
                    </p>
                    <p className="text-sm text-indigo-600">Distribuidor</p>
                  </div>
                </div>
                {distributor.email && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span className="text-sm text-gray-900">
                      {distributor.email}
                    </span>
                  </div>
                )}
                {distributor.phone && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-sm text-gray-600">Teléfono:</span>
                    <span className="text-sm text-gray-900">
                      {distributor.phone}
                    </span>
                  </div>
                )}
              </>
            ) : createdBy ? (
              <>
                <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-600 text-white">
                    {createdBy.name?.charAt(0).toUpperCase() || "A"}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {createdBy.name}
                    </p>
                    <p className="text-sm text-gray-500">Administrador</p>
                  </div>
                </div>
                {createdBy.email && (
                  <div className="flex justify-between pt-2">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span className="text-sm text-gray-900">
                      {createdBy.email}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Sin información</p>
            )}
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

      {/* Profit Information Card */}
      {profitInfo && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-green-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            Información Financiera
          </h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Información del producto */}
            <div className="rounded-lg bg-gray-50 p-4">
              <h3 className="mb-2 text-xs font-medium uppercase text-gray-500">
                Venta
              </h3>
              <p className="text-sm font-medium text-gray-900">
                {profitInfo.productName || "Producto"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {profitInfo.quantity} x {formatCurrency(profitInfo.unitPrice)}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                Total: {formatCurrency(profitInfo.totalSaleAmount)}
              </p>
            </div>

            {/* Costos */}
            <div className="rounded-lg bg-red-50 p-4">
              <h3 className="mb-2 text-xs font-medium uppercase text-red-600">
                Costos
              </h3>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Costo unitario:</span>
                  <span className="text-red-600">
                    {formatCurrency(profitInfo.unitCost)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-600">Costo total:</span>
                  <span className="text-red-700">
                    {formatCurrency(profitInfo.totalCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Ganancias */}
            <div className="rounded-lg bg-green-50 p-4">
              <h3 className="mb-2 text-xs font-medium uppercase text-green-600">
                Ganancias
              </h3>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ganancia Admin:</span>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(profitInfo.adminProfit)}
                  </span>
                </div>
                {profitInfo.isDistributorSale && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ganancia Distrib.:</span>
                    <span className="text-indigo-600">
                      {formatCurrency(profitInfo.distributorProfit)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-green-200 pt-1 text-sm font-bold">
                  <span className="text-gray-700">Ganancia Total:</span>
                  <span className="text-green-800">
                    {formatCurrency(profitInfo.totalProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Margen */}
            <div className="rounded-lg bg-blue-50 p-4">
              <h3 className="mb-2 text-xs font-medium uppercase text-blue-600">
                Rentabilidad
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Margen:</span>
                  <span className="text-lg font-bold text-blue-700">
                    {Number(profitInfo.profitMarginPercentage || 0).toFixed(1)}%
                  </span>
                </div>
                {profitInfo.isDistributorSale && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Comisión Distrib.:</span>
                    <span className="text-indigo-600">
                      {Number(profitInfo.distributorProfitPercentage || 0)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Estado de la ganancia */}
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {profitInfo.profitRealized ? (
                  <>
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-green-700">
                      Ganancia Realizada
                    </span>
                  </>
                ) : (
                  <>
                    <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                    <span className="text-sm font-medium text-yellow-700">
                      Ganancia Pendiente (crédito sin pagar completamente)
                    </span>
                  </>
                )}
              </div>

              {profitInfo.isDistributorSale &&
                profitInfo.amountDistributorOwesToAdmin !== undefined &&
                profitInfo.amountDistributorOwesToAdmin > 0 && (
                  <div className="rounded-lg bg-indigo-100 px-4 py-2">
                    <span className="text-sm text-indigo-800">
                      El distribuidor debe entregar:{" "}
                      <strong>
                        {formatCurrency(
                          profitInfo.amountDistributorOwesToAdmin
                        )}
                      </strong>
                    </span>
                  </div>
                )}
            </div>

            {/* Barra de progreso de ganancia */}
            {!profitInfo.profitRealized && profitInfo.totalProfit > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-gray-500">
                  <span>Progreso de pago</span>
                  <span>
                    {profitInfo.originalAmount > 0
                      ? (
                          (profitInfo.paidAmount / profitInfo.originalAmount) *
                          100
                        ).toFixed(0)
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-yellow-400 to-green-500 transition-all"
                    style={{
                      width: `${
                        profitInfo.originalAmount > 0
                          ? (profitInfo.paidAmount /
                              profitInfo.originalAmount) *
                            100
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Cuando el crédito esté completamente pagado, la ganancia de{" "}
                  {formatCurrency(profitInfo.totalProfit)} se considerará
                  realizada.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
                    Registrado Por
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Comprobante
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
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {typeof payment.registeredBy === "object"
                        ? payment.registeredBy?.name || "Sistema"
                        : "Sistema"}
                    </td>
                    <td className="px-6 py-4">
                      {payment.paymentProof ? (
                        <button
                          onClick={() => {
                            const modal = document.createElement("div");
                            modal.className =
                              "fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4";
                            modal.onclick = () => modal.remove();
                            modal.innerHTML = `
                              <img 
                                src="${payment.paymentProof}" 
                                alt="Comprobante" 
                                class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
                              />
                            `;
                            document.body.appendChild(modal);
                          }}
                          className="group relative"
                        >
                          <img
                            src={payment.paymentProof}
                            alt="Comprobante"
                            className="h-12 w-12 rounded-lg object-cover transition group-hover:scale-105"
                          />
                          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-xs text-white opacity-0 transition group-hover:opacity-100">
                            Ver
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
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
