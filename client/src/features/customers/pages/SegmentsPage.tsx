import { Edit, Loader2, Plus, Search, Tag, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { segmentService } from "../../customers/services";

interface Segment {
  _id: string;
  name: string;
  key: string;
  description?: string;
  rules?: Record<string, unknown>;
  createdAt: string;
}

interface SegmentFormData {
  name: string;
  key: string;
  description: string;
}

export default function Segments() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [formData, setFormData] = useState<SegmentFormData>({
    name: "",
    key: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSegments();
  }, []);

  const loadSegments = async () => {
    try {
      setLoading(true);
      const data = await segmentService.getAll();
      setSegments(data.segments);
    } catch (err) {
      console.error("Error al cargar segmentos:", err);
      setError("Error al cargar los segmentos");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (editingSegment) {
        await segmentService.update(editingSegment._id, formData);
      } else {
        await segmentService.create({
          name: formData.name,
          key: formData.key,
          description: formData.description,
        });
      }
      setShowModal(false);
      resetForm();
      loadSegments();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al guardar el segmento";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el segmento "${name}"?`)) {
      return;
    }

    try {
      await segmentService.delete(id);
      loadSegments();
    } catch (err) {
      console.error("Error al eliminar:", err);
      setError("Error al eliminar el segmento");
    }
  };

  const openEditModal = (segment: Segment) => {
    setEditingSegment(segment);
    setFormData({
      name: segment.name,
      key: segment.key,
      description: segment.description || "",
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingSegment(null);
    setFormData({ name: "", key: "", description: "" });
    setError("");
  };

  const filteredSegments = segments.filter(
    segment =>
      segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      segment.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateKey = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Segmentos de Clientes
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Clasifica a tus clientes para campañas y análisis personalizados.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-pink-700"
        >
          <Plus className="h-5 w-5" />
          Nuevo Segmento
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar por nombre o clave..."
          className="w-full rounded-lg border border-gray-700 bg-gray-900/50 py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : filteredSegments.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center">
          <Tag className="mx-auto h-12 w-12 text-gray-600" />
          <h3 className="mt-4 text-lg font-medium text-white">
            No hay segmentos
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            {searchTerm
              ? "No se encontraron segmentos con ese término"
              : "Crea tu primer segmento para clasificar clientes"}
          </p>
          {!searchTerm && (
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" />
              Crear Segmento
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSegments.map(segment => (
            <div
              key={segment._id}
              className="rounded-lg border border-gray-700 bg-gray-800/50 p-5 transition hover:border-purple-500/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                    <Users className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{segment.name}</h3>
                    <p className="text-xs text-gray-500">
                      Clave:{" "}
                      <code className="text-purple-400">{segment.key}</code>
                    </p>
                  </div>
                </div>
              </div>

              {segment.description && (
                <p className="mt-3 line-clamp-2 text-sm text-gray-400">
                  {segment.description}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-gray-700 pt-4">
                <span className="text-xs text-gray-500">
                  Creado:{" "}
                  {new Date(segment.createdAt).toLocaleDateString("es-CO")}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(segment)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-700 hover:text-white"
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(segment._id, segment.name)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-red-500/20 hover:text-red-400"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-6">
            <h2 className="text-xl font-bold text-white">
              {editingSegment ? "Editar Segmento" : "Nuevo Segmento"}
            </h2>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Nombre del segmento *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => {
                    setFormData({
                      ...formData,
                      name: e.target.value,
                      key: editingSegment
                        ? formData.key
                        : generateKey(e.target.value),
                    });
                  }}
                  required
                  placeholder="Ej: Clientes VIP"
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Clave única *
                </label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      key: e.target.value.toLowerCase(),
                    })
                  }
                  required
                  placeholder="Ej: clientes_vip"
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Se usa internamente para identificar el segmento
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={e =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe las características de este segmento..."
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingSegment ? "Guardar Cambios" : "Crear Segmento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
