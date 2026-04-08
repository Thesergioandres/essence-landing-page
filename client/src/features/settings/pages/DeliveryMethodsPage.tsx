import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  buildCacheKey,
  readSessionCache,
  writeSessionCache,
} from "../../../utils/requestCache";
import { deliveryMethodService } from "../services";
import type { DeliveryMethod } from "../types/settings.types";

const DELIVERY_METHODS_CACHE_TTL_MS = 5 * 60 * 1000;
const DELIVERY_METHODS_CACHE_KEY = buildCacheKey("delivery-methods:list");

// Iconos disponibles para métodos de entrega
const AVAILABLE_ICONS = [
  { value: "hand", label: "🤝 Entrega Personal" },
  { value: "building", label: "🏢 Edificio" },
  { value: "truck", label: "🚚 Camión" },
  { value: "send", label: "📤 Enviar" },
  { value: "package", label: "📦 Paquete" },
  { value: "home", label: "🏠 Casa" },
  { value: "store", label: "🏪 Tienda" },
  { value: "map-pin", label: "📍 Ubicación" },
  { value: "bike", label: "🚴 Bicicleta" },
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

export default function DeliveryMethods() {
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<DeliveryMethod | null>(
    null
  );
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    defaultCost: 0,
    hasVariableCost: false,
    requiresAddress: false,
    estimatedTime: "",
    icon: "truck",
    color: "#3b82f6",
  });

  useEffect(() => {
    const cached = readSessionCache<DeliveryMethod[]>(
      DELIVERY_METHODS_CACHE_KEY,
      DELIVERY_METHODS_CACHE_TTL_MS
    );
    if (cached?.length) {
      setDeliveryMethods(cached);
      setLoading(false);
      void loadDeliveryMethods({ silent: true });
      return;
    }

    void loadDeliveryMethods();
  }, []);

  const loadDeliveryMethods = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const data = await deliveryMethodService.getAll();
      const methods = Array.isArray(data)
        ? data
        : (data as any)?.deliveryMethods || [];
      setDeliveryMethods(methods);
      writeSessionCache(DELIVERY_METHODS_CACHE_KEY, methods);
    } catch (err) {
      console.error("Error al cargar métodos de entrega:", err);
      setError("Error al cargar los métodos de entrega");
      setDeliveryMethods([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  const handleOpenModal = (method?: DeliveryMethod) => {
    if (method) {
      setEditingMethod(method);
      setFormData({
        name: method.name,
        description: method.description || "",
        defaultCost: method.defaultCost ?? 0,
        hasVariableCost: method.hasVariableCost ?? false,
        requiresAddress: method.requiresAddress ?? false,
        estimatedTime: method.estimatedTime || "",
        icon: method.icon || "truck",
        color: method.color || "#3b82f6",
      });
    } else {
      setEditingMethod(null);
      setFormData({
        name: "",
        description: "",
        defaultCost: 0,
        hasVariableCost: false,
        requiresAddress: false,
        estimatedTime: "",
        icon: "truck",
        color: "#3b82f6",
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
      defaultCost: 0,
      hasVariableCost: false,
      requiresAddress: false,
      estimatedTime: "",
      icon: "truck",
      color: "#3b82f6",
    });
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    try {
      if (editingMethod) {
        await deliveryMethodService.update(editingMethod._id, formData);
      } else {
        await deliveryMethodService.create(formData);
      }

      await loadDeliveryMethods();
      handleCloseModal();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al guardar el método de entrega";
      setError(message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar el método de entrega "${name}"?`)) {
      return;
    }

    try {
      await deliveryMethodService.delete(id);
      await loadDeliveryMethods();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al eliminar el método de entrega";
      alert(message);
    }
  };

  const handleToggleActive = async (method: DeliveryMethod) => {
    try {
      await deliveryMethodService.update(method._id, {
        isActive: !method.isActive,
      });
      await loadDeliveryMethods();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al actualizar el método de entrega";
      alert(message);
    }
  };

  const getIconEmoji = (iconValue: string) => {
    const icon = AVAILABLE_ICONS.find(i => i.value === iconValue);
    return icon?.label?.split(" ")[0] || "🚚";
  };

  const activeCount = deliveryMethods.filter(method => method.isActive).length;
  const variableCostCount = deliveryMethods.filter(
    method => method.hasVariableCost
  ).length;
  const requiresAddressCount = deliveryMethods.filter(
    method => method.requiresAddress
  ).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-400">Cargando métodos de entrega...</div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-6xl overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -right-16 top-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative space-y-6">
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-[0_24px_60px_-45px_rgba(56,189,248,0.55)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">
                Configuración logística
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
                Métodos de Entrega
              </h1>
              <p className="mt-2 text-sm text-slate-300 sm:text-base">
                Estandariza tiempos, costos y reglas para despachos y entregas.
              </p>
            </div>

            <button
              onClick={() => handleOpenModal()}
              className="bg-linear-to-r min-h-11 w-full rounded-xl from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-blue-400 hover:to-cyan-400 sm:w-auto sm:px-6 sm:text-base"
            >
              + Nuevo método
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-cyan-200">
              Activos: {activeCount}
            </span>
            <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-blue-200">
              Costo variable: {variableCostCount}
            </span>
            <span className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-indigo-200">
              Requieren dirección: {requiresAddressCount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">Total configurados</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {deliveryMethods.length}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">Métodos activos</p>
            <p className="mt-1 text-2xl font-semibold text-cyan-300">
              {activeCount}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">Con tiempo estimado</p>
            <p className="mt-1 text-2xl font-semibold text-blue-300">
              {deliveryMethods.filter(method => method.estimatedTime).length}
            </p>
          </div>
        </div>

        {deliveryMethods.length === 0 ? (
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-8 text-center sm:p-12">
            <p className="text-sm text-slate-300 sm:text-base">
              No hay métodos de entrega registrados. Crea tu primer método de
              entrega.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {deliveryMethods.map(method => (
              <div
                key={method._id}
                className={`rounded-xl border bg-slate-900/65 p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,1)] transition sm:p-6 ${
                  method.isActive
                    ? "border-slate-600/70 hover:-translate-y-0.5 hover:border-cyan-400/60"
                    : "border-slate-800/90 opacity-70"
                }`}
              >
                <div className="mb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                      style={{ backgroundColor: method.color || "#3b82f6" }}
                    >
                      {getIconEmoji(method.icon || "truck")}
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
                    {(method.defaultCost ?? 0) > 0 && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                        Costo: {formatCurrency(method.defaultCost ?? 0)}
                      </span>
                    )}
                    {method.hasVariableCost && (
                      <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-300">
                        Costo variable
                      </span>
                    )}
                    {method.requiresAddress && (
                      <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
                        Requiere dirección
                      </span>
                    )}
                    {method.estimatedTime && (
                      <span className="rounded-full bg-slate-700/70 px-2 py-0.5 text-xs text-slate-200">
                        ⏱️ {method.estimatedTime}
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
                  ? "Editar método de entrega"
                  : "Nuevo método de entrega"}
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
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 sm:px-4 sm:py-3 sm:text-base"
                    placeholder="Nombre del método de entrega"
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
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-4 sm:py-3 sm:text-base"
                    placeholder="Descripción del método de entrega"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-300 sm:text-sm">
                      Costo por defecto
                    </label>
                    <input
                      type="number"
                      value={formData.defaultCost}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          defaultCost: Number(e.target.value) || 0,
                        }))
                      }
                      min="0"
                      step="100"
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-4 sm:py-3 sm:text-base"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-300 sm:text-sm">
                      Tiempo estimado
                    </label>
                    <input
                      type="text"
                      value={formData.estimatedTime}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          estimatedTime: e.target.value,
                        }))
                      }
                      placeholder="Ej: 30 min, 1-2 días"
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-4 sm:py-3 sm:text-base"
                    />
                  </div>
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
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-4 sm:py-3 sm:text-base"
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
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-4 sm:py-3 sm:text-base"
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
                      checked={formData.hasVariableCost}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          hasVariableCost: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">
                      Costo variable (se ingresa en cada venta)
                    </span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.requiresAddress}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          requiresAddress: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">
                      Requiere dirección de entrega
                    </span>
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="min-h-11 flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-white sm:py-3 sm:text-base"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-linear-to-r min-h-11 flex-1 rounded-lg from-blue-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-blue-400 hover:to-cyan-400 sm:py-3 sm:text-base"
                  >
                    {editingMethod ? "Guardar cambios" : "Crear método"}
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
