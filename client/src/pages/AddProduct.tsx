import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  categoryService,
  productService,
  uploadService,
} from "../api/services.ts";
import type { Category } from "../types";

interface FormState {
  name: string;
  description: string;
  purchasePrice: string;
  suggestedPrice: string;
  distributorPrice: string;
  clientPrice: string;
  category: string;
  totalStock: string;
  lowStockAlert: string;
  featured: boolean;
  ingredients: string;
  benefits: string;
}

export default function AddProduct() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState<FormState>({
    name: "",
    description: "",
    purchasePrice: "",
    suggestedPrice: "",
    distributorPrice: "",
    clientPrice: "",
    category: "",
    totalStock: "",
    lowStockAlert: "10",
    featured: false,
    ingredients: "",
    benefits: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await categoryService.getAll();
        setCategories(data);
        // Establecer la primera categoría como predeterminada si existe
        if (data.length > 0 && !formData.category) {
          setFormData(prev => ({ ...prev, category: data[0]._id }));
        }
      } catch (err) {
        console.error("Error al cargar categorías:", err);
      }
    };
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const target = event.target;
    const name = (
      target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    ).name;
    const value = (
      target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    ).value;

    const fieldValue =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : value;

    setFormData(current => {
      const updated = {
        ...current,
        [name]: fieldValue,
      };

      // Calcular precio sugerido automáticamente (30%)
      if (name === "purchasePrice" && value) {
        const purchase = Number(value);
        if (!isNaN(purchase)) {
          updated.suggestedPrice = (purchase * 1.3).toFixed(2);
        }
      }

      // Calcular precio distribuidor automáticamente (80% del precio cliente)
      if (name === "clientPrice" && value) {
        const client = Number(value);
        if (!isNaN(client)) {
          updated.distributorPrice = Math.round(client * 0.8).toString();
        }
      }

      return updated;
    });
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const purchasePrice = Number(formData.purchasePrice);
      const distributorPrice = Number(formData.distributorPrice);
      const totalStock = Number(formData.totalStock || 0);
      const clientPrice = formData.clientPrice
        ? Number(formData.clientPrice)
        : undefined;

      if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
        throw new Error("El precio de compra debe ser un número válido");
      }

      if (Number.isNaN(distributorPrice) || distributorPrice < 0) {
        throw new Error("El precio de distribuidor debe ser un número válido");
      }

      if (Number.isNaN(totalStock) || totalStock < 0) {
        throw new Error("El stock debe ser un número válido");
      }

      const ingredients = formData.ingredients
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);

      const benefits = formData.benefits
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);

      let imageData: { url: string; publicId: string } | undefined;

      if (imageFile) {
        imageData = await uploadService.uploadImage(imageFile);
      }

      await productService.create({
        name: formData.name.trim(),
        description: formData.description.trim(),
        purchasePrice,
        suggestedPrice: Number(formData.suggestedPrice) || purchasePrice * 1.3,
        distributorPrice,
        clientPrice,
        category: formData.category,
        totalStock,
        lowStockAlert: Number(formData.lowStockAlert) || 10,
        featured: formData.featured,
        ingredients,
        benefits,
        image: imageData ?? null,
      });

      navigate("/admin/products");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || "Error al crear el producto";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-white">Agregar producto</h1>
        <p className="mt-2 text-gray-400">
          Completa la información para publicar un nuevo producto en el
          catálogo.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Información principal
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Nombre
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Nombre del producto"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Descripción
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows={4}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Describe el producto y sus beneficios"
                />
              </div>

              {/* Panel de Rentabilidad */}
              <div className="rounded-lg border border-purple-500/30 bg-purple-900/20 p-4">
                <h3 className="mb-3 text-sm font-semibold text-purple-300">
                  💰 Precios y Rentabilidad
                </h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-300">
                      Precio de Compra *
                    </label>
                    <input
                      type="number"
                      name="purchasePrice"
                      value={formData.purchasePrice}
                      onChange={handleChange}
                      required
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-green-300">
                      Precio Sugerido (30%) *
                    </label>
                    <input
                      type="number"
                      name="suggestedPrice"
                      value={formData.suggestedPrice}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-green-600 bg-green-900/20 px-4 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Calculado automático"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Se calcula automáticamente al ingresar precio de compra
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-blue-300">
                      Precio Distribuidor *
                    </label>
                    <input
                      type="number"
                      name="distributorPrice"
                      value={formData.distributorPrice}
                      onChange={handleChange}
                      required
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-blue-600 bg-blue-900/20 px-4 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Se calcula como 80% del precio cliente
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-300">
                      Precio Cliente *
                    </label>
                    <input
                      type="number"
                      name="clientPrice"
                      value={formData.clientPrice}
                      onChange={handleChange}
                      required
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Stock */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Stock Total *
                  </label>
                  <input
                    type="number"
                    name="totalStock"
                    value={formData.totalStock}
                    onChange={handleChange}
                    required
                    min="0"
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Cantidad total"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Irá automáticamente a bodega
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Alerta Stock Bajo
                  </label>
                  <input
                    type="number"
                    name="lowStockAlert"
                    value={formData.lowStockAlert}
                    onChange={handleChange}
                    min="0"
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="10"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Categoría
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Selecciona una categoría</option>
                    {categories.map(cat => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-3">
                  <input
                    id="featured"
                    type="checkbox"
                    name="featured"
                    checked={formData.featured}
                    onChange={handleChange}
                    className="h-5 w-5 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="featured" className="text-sm text-gray-300">
                    Destacar producto
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Imagen</h2>

            <div className="flex flex-col gap-4">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Vista previa"
                  className="h-56 w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-gray-600 text-gray-500">
                  Vista previa
                </div>
              )}

              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-6 text-center text-sm text-gray-400 transition hover:border-purple-500 hover:text-purple-300">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <span className="font-medium text-white">Subir imagen</span>
                <span>Formatos permitidos: JPG, PNG, WebP (máx. 5MB)</span>
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Información adicional
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Ingredientes (separados por coma)
              </label>
              <textarea
                name="ingredients"
                value={formData.ingredients}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ej: Nicotina, Propilenglicol, Glicerina"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Beneficios (separados por coma)
              </label>
              <textarea
                name="benefits"
                value={formData.benefits}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ej: Sabor intenso, Alta duración"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate("/admin/products")}
            className="rounded-lg border border-gray-700 px-6 py-3 font-semibold text-gray-300 transition hover:border-purple-500 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar producto"}
          </button>
        </div>
      </form>
    </div>
  );
}
