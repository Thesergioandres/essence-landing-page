import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  buildCacheKey,
  readSessionCache,
  writeSessionCache,
} from "../../../utils/requestCache";
import { paymentMethodService } from "../services";
import type { PaymentMethod } from "../types/settings.types";

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
      const methods = Array.isArray(data)
        ? data
        : (data as any)?.paymentMethods || [];
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
        isCredit: method.isCredit ?? false,
        requiresConfirmation: method.requiresConfirmation ?? false,
        requiresProof: method.requiresProof ?? false,
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
    return icon?.label?.split(" ")[0] || "💵";
  };

  const activeCount = paymentMethods.filter(method => method.isActive).length;
  const creditCount = paymentMethods.filter(method => method.isCredit).length;
  const proofCount = paymentMethods.filter(
    method => method.requiresProof
  ).length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-400">Cargando métodos de pago...</div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-6xl overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -right-16 top-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative space-y-6">
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-[0_24px_60px_-45px_rgba(16,185,129,0.55)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">
                Configuración comercial
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
                Métodos de Pago
              </h1>
              <p className="mt-2 text-sm text-slate-300 sm:text-base">
                Activa, ordena y personaliza cómo reciben pagos tus sedes.
              </p>
            </div>

            <button
              onClick={() => handleOpenModal()}
              className="bg-linear-to-r min-h-11 w-full rounded-xl from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-emerald-400 hover:to-cyan-400 sm:w-auto sm:px-6 sm:text-base"
            >
              + Nuevo método
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              Activos: {activeCount}
            </span>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-cyan-200">
              Crédito: {creditCount}
            </span>
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-200">
              Con comprobante: {proofCount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">Total configurados</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {paymentMethods.length}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">Métodos activos</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">
              {activeCount}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">Requieren validación</p>
            <p className="mt-1 text-2xl font-semibold text-cyan-300">
              {
                paymentMethods.filter(
                  method => method.requiresConfirmation || method.requiresProof
                ).length
              }
            </p>
          </div>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-8 text-center sm:p-12">
            <p className="text-sm text-slate-300 sm:text-base">
              No hay métodos de pago registrados. Crea tu primer método de pago.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {paymentMethods.map(method => (
              <div
                key={method._id}
                className={`rounded-xl border bg-slate-900/65 p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,1)] transition sm:p-6 ${
                  method.isActive
                    ? "border-slate-600/70 hover:-translate-y-0.5 hover:border-emerald-400/60"
                    : "border-slate-800/90 opacity-70"
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
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        method.isActive
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {method.isActive ? "Activo" : "Inactivo"}
                    </button>
                  </div>

                  {method.description && (
                    <p className="mt-2 text-xs text-slate-300 sm:text-sm">
                      {method.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {method.isCredit && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                        Crédito/Fiado
                      </span>
                    )}
                    {method.requiresConfirmation && (
                      <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-300">
                        Requiere confirmación
                      </span>
                    )}
                    {method.requiresProof && (
                      <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-xs text-fuchsia-300">
                        Requiere comprobante
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(method)}
                    className="min-h-11 flex-1 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-white transition hover:border-cyan-400 hover:bg-cyan-500/10 sm:px-4 sm:text-sm"
                  >
                    Editar
                  </button>
                  {!method.isSystem && (
                    <button
                      onClick={() => handleDelete(method._id, method.name)}
                      className="min-h-11 flex-1 rounded-lg border border-red-600/70 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10 sm:px-4 sm:text-sm"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-600/60 bg-slate-900 p-4 shadow-2xl sm:p-6">
              <h2 className="mb-4 text-xl font-bold text-white sm:text-2xl">
                {editingMethod
                  ? "Editar método de pago"
                  : "Nuevo método de pago"}
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
                      <span className="text-sm text-white">
                        Es crédito/fiado
                      </span>
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
                    className="min-h-11 flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-white sm:py-3 sm:text-base"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-linear-to-r min-h-11 flex-1 rounded-lg from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-emerald-400 hover:to-cyan-400 sm:py-3 sm:text-base"
                  >
                    {editingMethod ? "Actualizar" : "Crear"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
