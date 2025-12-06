import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { categoryService } from "../api/services.ts";
import type { Category } from "../types";

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await categoryService.getAll();
      setCategories(data);
    } catch (err) {
      console.error("Error al cargar categorías:", err);
      setError("Error al cargar las categorías");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || "",
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", description: "" });
    }
    setShowModal(true);
    setError("");
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({ name: "", description: "" });
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    try {
      if (editingCategory) {
        await categoryService.update(editingCategory._id, formData);
      } else {
        await categoryService.create(formData);
      }

      await loadCategories();
      handleCloseModal();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al guardar la categoría";
      setError(message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar la categoría "${name}"?`)) {
      return;
    }

    try {
      await categoryService.delete(id);
      await loadCategories();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al eliminar la categoría";
      alert(message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-400">Cargando categorías...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">Categorías</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-400">
            Gestiona las categorías de productos
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto rounded-lg bg-linear-to-r from-purple-600 to-pink-600 px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white transition hover:from-purple-700 hover:to-pink-700"
        >
          + Nueva categoría
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-lg sm:rounded-xl border border-gray-700 bg-gray-800/50 p-8 sm:p-12 text-center">
          <p className="text-sm sm:text-base text-gray-400">
            No hay categorías registradas. Crea tu primera categoría.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(category => (
            <div
              key={category._id}
              className="rounded-lg sm:rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6 transition hover:border-purple-500"
            >
              <div className="mb-4">
                <h3 className="text-lg sm:text-xl font-semibold text-white">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="mt-2 text-xs sm:text-sm text-gray-400">
                    {category.description}
                  </p>
                )}
                <p className="mt-1 text-[10px] sm:text-xs text-gray-500">
                  Slug: {category.slug}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(category)}
                  className="flex-1 rounded-lg border border-gray-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white transition hover:border-purple-500 hover:bg-purple-500/10"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(category._id, category.name)}
                  className="flex-1 rounded-lg border border-red-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-red-400 transition hover:bg-red-500/10"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="mb-4 text-xl sm:text-2xl font-bold text-white">
              {editingCategory ? "Editar categoría" : "Nueva categoría"}
            </h2>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500 bg-red-500/10 p-3 text-xs sm:text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs sm:text-sm font-medium text-gray-300">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, name: e.target.value }))
                  }
                  required
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Nombre de la categoría"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs sm:text-sm font-medium text-gray-300">
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
                  rows={3}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Descripción de la categoría"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-gray-300 transition hover:border-purple-500 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-linear-to-r from-purple-600 to-pink-600 px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white transition hover:from-purple-700 hover:to-pink-700"
                >
                  {editingCategory ? "Actualizar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
