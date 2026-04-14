import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { Input } from "../../../shared/components/ui/Input";
import type { ProductFormData } from "../types/product.types";

interface ProductFormProps {
  initialData?: ProductFormData;
  onSubmit: (data: ProductFormData) => void;
  isLoading: boolean;
  categories: { _id: string; name: string }[];
  onCreateCategory?: (name: string) => Promise<void>;
}

export const ProductForm = ({
  initialData,
  onSubmit,
  isLoading,
  categories,
  onCreateCategory,
}: ProductFormProps) => {
  const [formData, setFormData] = useState<ProductFormData>(
    initialData || {
      name: "",
      description: "",
      purchasePrice: 0,
      clientPrice: 0,
      employeePrice: 0,
      suggestedPrice: 0,
      categoryId: categories[0]?._id || "",
      image: null,
    }
  );
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !onCreateCategory) return;

    setCreatingCategory(true);
    try {
      await onCreateCategory(newCategoryName.trim());
      setNewCategoryName("");
      setShowCategoryInput(false);
    } catch (error) {
      console.error("Error creating category:", error);
    } finally {
      setCreatingCategory(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Input
            label="Nombre"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-medium text-gray-300">
              Descripción
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-2 text-sm font-medium text-gray-300">
              Categoría
            </label>
            {!showCategoryInput ? (
              <div className="flex gap-2">
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleChange}
                  className="flex-1 rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {categories.map(c => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {onCreateCategory && (
                  <button
                    type="button"
                    onClick={() => setShowCategoryInput(true)}
                    className="rounded-lg border border-purple-500/40 bg-purple-600/20 px-4 py-2 text-sm font-semibold text-purple-50 transition hover:border-purple-400/70 hover:bg-purple-600/30"
                    title="Crear nueva categoría"
                  >
                    + Nueva
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="Nombre de la categoría"
                    className="flex-1 rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={creatingCategory || !newCategoryName.trim()}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
                  >
                    {creatingCategory ? "..." : "Crear"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCategoryInput(false);
                      setNewCategoryName("");
                    }}
                    className="rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label="Precio de Compra"
            name="purchasePrice"
            type="number"
            value={formData.purchasePrice}
            onChange={handleChange}
            required
          />
          <Input
            label="Precio Cliente"
            name="clientPrice"
            type="number"
            value={formData.clientPrice}
            onChange={handleChange}
            required
          />
          <Input
            label="Precio Employee"
            name="employeePrice"
            type="number"
            value={formData.employeePrice}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
      >
        {isLoading ? "Guardando..." : "Guardar Producto"}
      </button>
    </form>
  );
};
