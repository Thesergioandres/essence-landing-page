import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { paymentMethodService, type PaymentMethod } from "../api/services.ts";
import {
  buildCacheKey,
  readSessionCache,
  writeSessionCache,
} from "../../../utils/requestCache";

const PAYMENT_METHODS_CACHE_TTL_MS = 5 * 60 * 1000;
const PAYMENT_METHODS_CACHE_KEY = buildCacheKey("payment-methods:list");

// Iconos disponibles para métodos de pago
const AVAILABLE_ICONS = [
  { value: "cash", label: "💵 Efectivo" },
  { value: "credit", label: "💳 Tarjeta" },
  { value: "transfer", label: "🏦 Transferencia" },
  { value: "mobile", label: "📱 Móvil" },
  { value: "crypto", label: "₿ Crypto" },
  { value: "check", label: "📝 Cheque" },
  { value: "wallet", label: "👛 Monedero" },
  { value: "qr", label: "📷 QR" },
];

// Colores disponibles
const AVAILABLE_COLORS = [
  { value: "#22c55e", label: "Verde" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#f59e0b", label: "Naranja" },
  { value: "#ef4444", label: "Rojo" },
  { value: "#8b5cf6", label: "Púrpura" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#6b7280", label: "Gris" },
];

export default function PaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(
    null
  );
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isCredit: false,
    requiresConfirmation: false,
    requiresProof: false,
    icon: "cash",
    color: "#22c55e",
  });

  useEffect(() => {
    const cached = readSessionCache<PaymentMethod[]>(
      PAYMENT_METHODS_CACHE_KEY,
      PAYMENT_METHODS_CACHE_TTL_MS
    );
    if (cached?.length) {
      setPaymentMethods(cached);
      setLoading(false);
      void loadPaymentMethods({ silent: true });
      return;
    }

    void loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const data = await paymentMethodService.getAll();
      const methods = data?.paymentMethods || [];
      setPaymentMethods(methods);
      writeSessionCache(PAYMENT_METHODS_CACHE_KEY, methods);
    } catch (err) {
      console.error("Error al cargar métodos de pago:", err);
      setError("Error al cargar los métodos de pago");
      setPaymentMethods([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  const handleOpenModal = (method?: PaymentMethod) => {
    if (method) {
      setEditingMethod(method);
      setFormData({
        name: method.name,
        description: method.description || "",
        isCredit: method.isCredit,
        requiresConfirmation: method.requiresConfirmation,
        requiresProof: method.requiresProof,
        icon: method.icon || "cash",
        color: method.color || "#22c55e",
      });
    } else {
      setEditingMethod(null);
      setFormData({
        name: "",
        description: "",
        isCredit: false,
        requiresConfirmation: false,
        requiresProof: false,
        icon: "cash",
        color: "#22c55e",
      });
    }
    setShowModal(true);
    setError("");
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingMethod(null);
    setFormData({
      name: "",
      description: "",
      isCredit: false,
      requiresConfirmation: false,
      requiresProof: false,
      icon: "cash",
      color: "#22c55e",
    });
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    try {
      if (editingMethod) {
        await paymentMethodService.update(editingMethod._id, formData);
      } else {
        await paymentMethodService.create(formData);
      }

      await loadPaymentMethods();
      handleCloseModal();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al guardar el método de pago";
      setError(message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar el método de pago "${name}"?`)) {
      return;
    }

    try {
      await paymentMethodService.delete(id);
      await loadPaymentMethods();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al eliminar el método de pago";
      alert(message);
    }
  };

  const handleToggleActive = async (method: PaymentMethod) => {
    try {
      await paymentMethodService.update(method._id, {
        isActive: !method.isActive,
      });
      await loadPaymentMethods();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al actualizar el método de pago";
      alert(message);
    }
  };

  const getIconEmoji = (iconValue: string) => {
    const icon = AVAILABLE_ICONS.find(i => i.value === iconValue);
    return icon?.label.split(" ")[0] || "💵";
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-400">Cargando métodos de pago...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 overflow-hidden sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            Métodos de Pago
          </h1>
          <p className="mt-1 text-sm text-gray-400 sm:mt-2 sm:text-base">
            Gestiona los métodos de pago de tu negocio
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-linear-to-r w-full rounded-lg from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 sm:w-auto sm:px-6 sm:py-3 sm:text-base"
        >
          + Nuevo método
        </button>
      </div>

      {paymentMethods.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center sm:rounded-xl sm:p-12">
          <p className="text-sm text-gray-400 sm:text-base">
            No hay métodos de pago registrados. Crea tu primer método de pago.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {paymentMethods.map(method => (
            <div
              key={method._id}
              className={`rounded-lg border bg-gray-800/50 p-4 transition sm:rounded-xl sm:p-6 ${
                method.isActive
                  ? "border-gray-700 hover:border-purple-500"
                  : "border-gray-800 opacity-60"
              }`}
            >
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                    style={{ backgroundColor: method.color || "#22c55e" }}
                  >
                    {getIconEmoji(method.icon || "cash")}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white sm:text-xl">
                      {method.name}
                    </h3>
                    {method.isSystem && (
                      <span className="text-xs text-gray-500">
                        Método del sistema
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleActive(method)}
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      method.isActive
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {method.isActive ? "Activo" : "Inactivo"}
                  </button>
                </div>

                {method.description && (
                  <p className="mt-2 text-xs text-gray-400 sm:text-sm">
                    {method.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {method.isCredit && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                      Crédito/Fiado
                    </span>
                  )}
                  {method.requiresConfirmation && (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                      Requiere confirmación
                    </span>
                  )}
                  {method.requiresProof && (
                    <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                      Requiere comprobante
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(method)}
                  className="flex-1 rounded-lg border border-gray-600 px-3 py-2 text-xs font-medium text-white transition hover:border-purple-500 hover:bg-purple-500/10 sm:px-4 sm:text-sm"
                >
                  Editar
                </button>
                {!method.isSystem && (
                  <button
                    onClick={() => handleDelete(method._id, method.name)}
                    className="flex-1 rounded-lg border border-red-600 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10 sm:px-4 sm:text-sm"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-gray-700 bg-gray-800 p-4 sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-white sm:text-2xl">
              {editingMethod ? "Editar método de pago" : "Nuevo método de pago"}
            </h2>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500 bg-red-500/10 p-3 text-xs text-red-400 sm:text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-300 sm:text-sm">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, name: e.target.value }))
                  }
                  required
                  disabled={editingMethod?.isSystem}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 sm:px-4 sm:py-3 sm:text-base"
                  placeholder="Nombre del método de pago"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-300 sm:text-sm">
                  Descripción (opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 sm:px-4 sm:py-3 sm:text-base"
                  placeholder="Descripción del método de pago"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-300 sm:text-sm">
                    Icono
                  </label>
                  <select
                    value={formData.icon}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, icon: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 sm:px-4 sm:py-3 sm:text-base"
                  >
                    {AVAILABLE_ICONS.map(icon => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-300 sm:text-sm">
                    Color
                  </label>
                  <select
                    value={formData.color}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        color: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 sm:px-4 sm:py-3 sm:text-base"
                  >
                    {AVAILABLE_COLORS.map(color => (
                      <option key={color.value} value={color.value}>
                        {color.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                <h3 className="text-sm font-medium text-white">Opciones</h3>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.isCredit}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        isCredit: e.target.checked,
                      }))
                    }
                    disabled={editingMethod?.isSystem}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-purple-600 focus:ring-2 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-sm text-white">Es crédito/fiado</span>
                    <p className="text-xs text-gray-400">
                      Marca si este método representa ventas a crédito
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.requiresConfirmation}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        requiresConfirmation: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-purple-600 focus:ring-2 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-sm text-white">
                      Requiere confirmación
                    </span>
                    <p className="text-xs text-gray-400">
                      El admin debe confirmar el pago manualmente
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.requiresProof}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        requiresProof: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-purple-600 focus:ring-2 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-sm text-white">
                      Requiere comprobante
                    </span>
                    <p className="text-xs text-gray-400">
                      El usuario debe adjuntar comprobante de pago
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:border-purple-500 hover:text-white sm:py-3 sm:text-base"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-linear-to-r flex-1 rounded-lg from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 sm:py-3 sm:text-base"
                >
                  {editingMethod ? "Actualizar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
