import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { Input } from "../../../shared/components/ui/Input";
import type { ProductFormData } from "../types/product.types";

interface ProductFormProps {
  initialData?: ProductFormData;
  onSubmit: (data: ProductFormData) => void;
  isLoading: boolean;
  categories: { _id: string; name: string }[];
}

export const ProductForm = ({
  initialData,
  onSubmit,
  isLoading,
  categories,
}: ProductFormProps) => {
  const [formData, setFormData] = useState<ProductFormData>(
    initialData || {
      name: "",
      description: "",
      purchasePrice: 0,
      clientPrice: 0,
      distributorPrice: 0,
      suggestedPrice: 0,
      categoryId: categories[0]?._id || "",
      image: null,
    }
  );

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
            <select
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {categories.map(c => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
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
            label="Precio Distribuidor"
            name="distributorPrice"
            type="number"
            value={formData.distributorPrice}
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
