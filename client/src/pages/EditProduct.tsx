import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  categoryService,
  productService,
} from "../api/services";
import type { Category, Product } from "../types";

interface FormState {
  name: string;
  description: string;
  purchasePrice: string;
  suggestedPrice: string;
  distributorPrice: string;
  clientPrice: string;
  distributorCommission: string;
  totalStock: string;
  warehouseStock: string;
  lowStockAlert: string;
  category: string;
  featured: boolean;
  ingredients: string;
  benefits: string;
}

export default function EditProduct() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<FormState | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cats = await categoryService.getAll();
        setCategories(cats);
      } catch (err) {
        console.error("Error al cargar categorías:", err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (id) {
      void loadProduct(id);
    }
  }, [id]);

  const loadProduct = async (productId: string) => {
    try {
      setLoading(true);
      const response = await productService.getById(productId);
      setProduct(response);
      setFormData({
        name: response.name,
        description: response.description,
        purchasePrice: response.purchasePrice?.toString() ?? "0",
        suggestedPrice: response.suggestedPrice?.toString() ?? "0",
        distributorPrice: response.distributorPrice?.toString() ?? "0",
        clientPrice: response.clientPrice?.toString() ?? "0",
        distributorCommission: response.distributorCommission?.toString() ?? "0",
        totalStock: response.totalStock?.toString() ?? "0",
        warehouseStock: response.warehouseStock?.toString() ?? "0",
        lowStockAlert: response.lowStockAlert?.toString() ?? "10",
        category:
          typeof response.category === "string"
            ? response.category
            : response.category._id,
        featured: response.featured,
        ingredients: response.ingredients?.join(", ") ?? "",
        benefits: response.benefits?.join(", ") ?? "",
      });
      setImagePreview(response.image?.url ?? null);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "No se pudo cargar el producto";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    if (!formData) return;

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

    // Auto-calcular suggestedPrice cuando cambia purchasePrice
    if (name === "purchasePrice") {
      const purchasePrice = parseFloat(value) || 0;
      const suggestedPrice = purchasePrice * 1.3;
      setFormData(current =>
        current
          ? {
              ...current,
              purchasePrice: value,
              suggestedPrice: suggestedPrice.toFixed(0),
            }
          : current
      );
    } else {
      setFormData(current =>
        current
          ? {
              ...current,
              [name]: fieldValue,
            }
          : current
      );
    }
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    if (!product?.image?.publicId) return;

    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData || !id) return;

    setError("");
    setSaving(true);

    try {
      const purchasePrice = Number(formData.purchasePrice);
      const suggestedPrice = Number(formData.suggestedPrice);
      const distributorPrice = Number(formData.distributorPrice);
      const clientPrice = Number(formData.clientPrice);
      const distributorCommission = Number(formData.distributorCommission);
      const totalStock = Number(formData.totalStock || 0);
      const warehouseStock = Number(formData.warehouseStock || 0);
      const lowStockAlert = Number(formData.lowStockAlert || 10);

      if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
        throw new Error("El precio de compra debe ser un número válido");
      }

      if (Number.isNaN(totalStock) || totalStock < 0) {
        throw new Error("El stock total debe ser un número válido");
      }

      const ingredients = formData.ingredients
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);

      const benefits = formData.benefits
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);

      await productService.update(id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        purchasePrice,
        suggestedPrice,
        distributorPrice,
        clientPrice,
        distributorCommission,
        totalStock,
        warehouseStock,
        lowStockAlert,
        category: formData.category,
        featured: formData.featured,
        ingredients,
        benefits,
        imageFile: imageFile || undefined,
      });

      navigate("/admin/products");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || "Error al actualizar el producto";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !formData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-white">Editar producto</h1>
        <p className="mt-2 text-gray-400">
          Modifica la información del producto seleccionado y guarda los
          cambios.
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
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Precio de Compra *
                  </label>
                  <input
                    type="number"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleChange}
                    required
                    min="0"
                    step="1"
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Costo base del producto</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-green-400">
                    Precio Sugerido (30% ganancia)
                  </label>
                  <input
                    type="number"
                    name="suggestedPrice"
                    value={formData.suggestedPrice}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    className="w-full rounded-lg border border-green-500 bg-green-900/20 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="mt-1 text-xs text-green-600">Auto-calculado: Compra × 1.3</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-blue-400">
                    Precio para Distribuidor
                  </label>
                  <input
                    type="number"
                    name="distributorPrice"
                    value={formData.distributorPrice}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    className="w-full rounded-lg border border-blue-500 bg-blue-900/20 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-blue-600">Precio que paga el distribuidor</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-purple-400">
                    Precio al Cliente Final
                  </label>
                  <input
                    type="number"
                    name="clientPrice"
                    value={formData.clientPrice}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    className="w-full rounded-lg border border-purple-500 bg-purple-900/20 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="mt-1 text-xs text-purple-600">Precio sugerido de venta</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-yellow-400">
                    Comisión Distribuidor
                  </label>
                  <input
                    type="number"
                    name="distributorCommission"
                    value={formData.distributorCommission}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    className="w-full rounded-lg border border-yellow-500 bg-yellow-900/20 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <p className="mt-1 text-xs text-yellow-600">Ganancia por unidad vendida</p>
                </div>

                <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-3">
                  <p className="text-xs text-gray-400 mb-1">Resumen de rentabilidad</p>
                  <div className="space-y-1 text-xs">
                    <p className="text-green-400">
                      Ganancia Admin: ${Number(formData.distributorPrice || 0) - Number(formData.purchasePrice || 0)}
                    </p>
                    <p className="text-yellow-400">
                      Ganancia Distribuidor: ${Number(formData.clientPrice || 0) - Number(formData.distributorPrice || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
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
                  />
                  <p className="mt-1 text-xs text-gray-500">Unidades totales</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Stock en Bodega *
                  </label>
                  <input
                    type="number"
                    name="warehouseStock"
                    value={formData.warehouseStock}
                    onChange={handleChange}
                    required
                    min="0"
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Disponible para asignar</p>
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
                  />
                  <p className="mt-1 text-xs text-gray-500">Umbral de alerta</p>
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
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Vista previa"
                    className="h-56 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute right-3 top-3 rounded-full bg-red-600/80 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-red-600"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-gray-600 text-gray-500">
                  Sin imagen
                </div>
              )}

              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-6 text-center text-sm text-gray-400 transition hover:border-purple-500 hover:text-purple-300">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <span className="font-medium text-white">
                  {imagePreview ? "Reemplazar imagen" : "Subir imagen"}
                </span>
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
            disabled={saving}
            className="rounded-lg bg-linear-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
