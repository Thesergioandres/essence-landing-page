import {
  Building2,
  Calendar,
  Clock,
  Edit,
  Gift,
  Loader2,
  Package,
  Percent,
  Plus,
  Search,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import api from "../api/axios";

interface Branch {
  _id: string;
  name: string;
}

interface Promotion {
  _id: string;
  name: string;
  description?: string;
  type: "bogo" | "discount" | "combo" | "volume" | "event";
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  minQuantity?: number;
  maxUses?: number;
  currentUses?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  applicableProducts?: { _id: string; name: string }[];
  branches?: { _id: string; name: string }[];
  createdAt: string;
}

interface PromotionFormData {
  name: string;
  description: string;
  type: string;
  discountType: string;
  discountValue: number;
  minQuantity: number;
  maxUses: number;
  startDate: string;
  endDate: string;
  branches: string[];
}

const typeLabels: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  bogo: {
    label: "2x1",
    icon: <Gift className="h-4 w-4" />,
    color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  },
  discount: {
    label: "Descuento",
    icon: <Percent className="h-4 w-4" />,
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  combo: {
    label: "Combo",
    icon: <Package className="h-4 w-4" />,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  volume: {
    label: "Por volumen",
    icon: <Tag className="h-4 w-4" />,
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  event: {
    label: "Evento especial",
    icon: <Calendar className="h-4 w-4" />,
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
};

export default function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState<PromotionFormData>({
    name: "",
    description: "",
    type: "discount",
    discountType: "percentage",
    discountValue: 10,
    minQuantity: 1,
    maxUses: 0,
    startDate: "",
    endDate: "",
    branches: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPromotions();
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await api.get<{ data: Branch[] } | Branch[]>(
        "/branches"
      );
      // El backend puede devolver { data: [...] } o directamente [...]
      const branchesData = Array.isArray(response.data)
        ? response.data
        : (response.data as { data: Branch[] })?.data || [];
      setBranches(Array.isArray(branchesData) ? branchesData : []);
    } catch (err) {
      console.error("[UI ERROR] branches_fetch_failed", err);
      setBranches([]); // Asegurar que siempre sea un array
    }
  };

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const { data } = await api.get<{ promotions: Promotion[] }>(
        "/promotions"
      );
      setPromotions(data.promotions || []);
      console.log("[UI INFO] promotions_loaded", {
        count: data.promotions?.length,
      });
    } catch (err) {
      console.error("[UI ERROR] promotions_fetch_failed", err);
      setError("Error al cargar promociones");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        maxUses: formData.maxUses || undefined,
      };

      if (editingPromo) {
        await api.put(`/promotions/${editingPromo._id}`, payload);
        console.log("[UI INFO] promotion_updated", { id: editingPromo._id });
      } else {
        await api.post("/promotions", payload);
        console.log("[UI INFO] promotion_created");
      }
      setShowModal(false);
      setEditingPromo(null);
      resetForm();
      fetchPromotions();
    } catch (err) {
      console.error("[UI ERROR] promotion_save_failed", err);
      setError("Error al guardar promoción");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      await api.patch(`/promotions/${id}/toggle`);
      setPromotions(prev =>
        prev.map(p => (p._id === id ? { ...p, isActive: !currentActive } : p))
      );
      console.log("[UI INFO] promotion_toggled", {
        id,
        newState: !currentActive,
      });
    } catch (err) {
      console.error("[UI ERROR] promotion_toggle_failed", err);
    }
  };

  const handleEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    // branches puede venir como array de objetos {_id, name} o como array de strings
    const branchIds = Array.isArray(promo.branches)
      ? promo.branches.map(b => (typeof b === "string" ? b : b._id))
      : [];
    setFormData({
      name: promo.name,
      description: promo.description || "",
      type: promo.type,
      discountType: promo.discountType || "percentage",
      discountValue: promo.discountValue || 10,
      minQuantity: promo.minQuantity || 1,
      maxUses: promo.maxUses || 0,
      startDate: promo.startDate ? promo.startDate.split("T")[0] : "",
      endDate: promo.endDate ? promo.endDate.split("T")[0] : "",
      branches: branchIds,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta promoción?")) return;

    try {
      await api.delete(`/promotions/${id}`);
      console.log("[UI INFO] promotion_deleted", { id });
      fetchPromotions();
    } catch (err) {
      console.error("[UI ERROR] promotion_delete_failed", err);
      setError("Error al eliminar promoción");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "discount",
      discountType: "percentage",
      discountValue: 10,
      minQuantity: 1,
      maxUses: 0,
      startDate: "",
      endDate: "",
      branches: [],
    });
  };

  const getPromoStatus = (promo: Promotion) => {
    if (!promo.isActive)
      return { label: "Inactiva", color: "bg-gray-100 text-gray-600" };
    const now = new Date();
    if (promo.startDate && new Date(promo.startDate) > now) {
      return { label: "Programada", color: "bg-yellow-100 text-yellow-700" };
    }
    if (promo.endDate && new Date(promo.endDate) < now) {
      return { label: "Expirada", color: "bg-red-100 text-red-700" };
    }
    if (
      promo.maxUses &&
      promo.currentUses &&
      promo.currentUses >= promo.maxUses
    ) {
      return { label: "Agotada", color: "bg-orange-100 text-orange-700" };
    }
    return { label: "Activa", color: "bg-green-100 text-green-700" };
  };

  const filteredPromotions = promotions.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || p.type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Promociones
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Gestiona descuentos, combos y ofertas especiales
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingPromo(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700"
        >
          <Plus className="h-5 w-5" />
          Nueva Promoción
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar promociones..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="all">Todos los tipos</option>
          <option value="bogo">2x1</option>
          <option value="discount">Descuento</option>
          <option value="combo">Combo</option>
          <option value="volume">Por volumen</option>
          <option value="event">Evento especial</option>
        </select>
      </div>

      {/* Lista de promociones */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPromotions.map(promo => {
          const typeInfo = typeLabels[promo.type] || typeLabels.discount;
          const status = getPromoStatus(promo);

          return (
            <div
              key={promo._id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${typeInfo.color}`}>
                    {typeInfo.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {promo.name}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${typeInfo.color}`}
                    >
                      {typeInfo.label}
                    </span>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${status.color}`}
                >
                  {status.label}
                </span>
              </div>

              {promo.description && (
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
                  {promo.description}
                </p>
              )}

              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                {promo.discountValue && (
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    {promo.discountType === "percentage"
                      ? `${promo.discountValue}% de descuento`
                      : `$${promo.discountValue} de descuento`}
                  </div>
                )}
                {promo.endDate && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Hasta {new Date(promo.endDate).toLocaleDateString()}
                  </div>
                )}
                {promo.maxUses && (
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    {promo.currentUses || 0} / {promo.maxUses} usos
                  </div>
                )}
                {Array.isArray(promo.branches) && promo.branches.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {promo.branches.length === 1
                      ? typeof promo.branches[0] === "string"
                        ? promo.branches[0]
                        : promo.branches[0].name
                      : `${promo.branches.length} sucursales`}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700">
                <button
                  onClick={() => handleToggle(promo._id, promo.isActive)}
                  className={`flex items-center gap-1 text-sm ${
                    promo.isActive ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {promo.isActive ? (
                    <ToggleRight className="h-5 w-5" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                  {promo.isActive ? "Activa" : "Inactiva"}
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(promo)}
                    className="rounded p-1.5 text-gray-500 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/30"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(promo._id)}
                    className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPromotions.length === 0 && (
        <div className="py-12 text-center">
          <Tag className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm || filterType !== "all"
              ? "No se encontraron promociones"
              : "Aún no hay promociones creadas"}
          </p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-800">
            <div className="border-b border-gray-200 p-6 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingPromo ? "Editar Promoción" : "Nueva Promoción"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tipo
                </label>
                <select
                  value={formData.type}
                  onChange={e =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="discount">Descuento</option>
                  <option value="bogo">2x1</option>
                  <option value="combo">Combo</option>
                  <option value="volume">Por volumen</option>
                  <option value="event">Evento especial</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tipo de descuento
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={e =>
                      setFormData({ ...formData, discountType: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="percentage">Porcentaje</option>
                    <option value="fixed">Monto fijo</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Valor
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.discountValue}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        discountValue: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={e =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={e =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Selector de sucursales */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Building2 className="mr-1 inline h-4 w-4" />
                  Sucursales aplicables
                </label>
                <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-700">
                  {branches.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay sucursales</p>
                  ) : (
                    <>
                      <label className="flex cursor-pointer items-center gap-2 rounded p-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                        <input
                          type="checkbox"
                          checked={formData.branches.length === 0}
                          onChange={() =>
                            setFormData({ ...formData, branches: [] })
                          }
                          className="rounded text-purple-600"
                        />
                        <span className="italic text-gray-500">
                          Todas las sucursales
                        </span>
                      </label>
                      {branches.map(branch => (
                        <label
                          key={branch._id}
                          className="flex cursor-pointer items-center gap-2 rounded p-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                          <input
                            type="checkbox"
                            checked={formData.branches.includes(branch._id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  branches: [...formData.branches, branch._id],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  branches: formData.branches.filter(
                                    id => id !== branch._id
                                  ),
                                });
                              }
                            }}
                            className="rounded text-purple-600"
                          />
                          <span className="text-gray-900 dark:text-white">
                            {branch.name}
                          </span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Deja vacío para aplicar en todas las sucursales
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingPromo(null);
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingPromo ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
