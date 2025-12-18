import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { categoryService } from "../api/services.ts";
import type { Category } from "../types";
import {
  buildCacheKey,
  readSessionCache,
  writeSessionCache,
} from "../utils/requestCache";

const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;
const CATEGORIES_CACHE_KEY = buildCacheKey("categories:list");

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
    const cached = readSessionCache<Category[]>(
      CATEGORIES_CACHE_KEY,
      CATEGORIES_CACHE_TTL_MS
    );
    if (cached?.length) {
      setCategories(cached);
      setLoading(false);
      void loadCategories({ silent: true });
      return;
    }

    void loadCategories();
  }, []);

  const loadCategories = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const data = await categoryService.getAll();
      setCategories(data);
      writeSessionCache(CATEGORIES_CACHE_KEY, data);
    } catch (err) {
      console.error("Error al cargar categorías:", err);
      setError("Error al cargar las categorías");
    } finally {
      if (!opts?.silent) setLoading(false);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            Categorías
          </h1>
          <p className="mt-1 text-sm text-gray-400 sm:mt-2 sm:text-base">
            Gestiona las categorías de productos
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-linear-to-r w-full rounded-lg from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 sm:w-auto sm:px-6 sm:py-3 sm:text-base"
        >
          + Nueva categoría
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center sm:rounded-xl sm:p-12">
          <p className="text-sm text-gray-400 sm:text-base">
            No hay categorías registradas. Crea tu primera categoría.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {categories.map(category => (
            <div
              key={category._id}
              className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 transition hover:border-purple-500 sm:rounded-xl sm:p-6"
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white sm:text-xl">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="mt-2 text-xs text-gray-400 sm:text-sm">
                    {category.description}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-gray-500 sm:text-xs">
                  Slug: {category.slug}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(category)}
                  className="flex-1 rounded-lg border border-gray-600 px-3 py-2 text-xs font-medium text-white transition hover:border-purple-500 hover:bg-purple-500/10 sm:px-4 sm:text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(category._id, category.name)}
                  className="flex-1 rounded-lg border border-red-600 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10 sm:px-4 sm:text-sm"
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
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-gray-700 bg-gray-800 p-4 sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-white sm:text-2xl">
              {editingCategory ? "Editar categoría" : "Nueva categoría"}
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
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 sm:px-4 sm:py-3 sm:text-base"
                  placeholder="Nombre de la categoría"
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
                  rows={3}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 sm:px-4 sm:py-3 sm:text-base"
                  placeholder="Descripción de la categoría"
                />
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
