import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  categoryService,
  productService,
  uploadService,
} from "../api/services.ts";
import type { Category, Product } from "../types";

interface FormState {
  name: string;
  description: string;
  price: string;
  category: string;
  stock: string;
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
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
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
        price: response.price.toString(),
        category:
          typeof response.category === "string"
            ? response.category
            : response.category._id,
        stock: response.stock?.toString() ?? "0",
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

    setFormData(current =>
      current
        ? {
            ...current,
            [name]: fieldValue,
          }
        : current
    );
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setImageToDelete(product?.image?.publicId ?? null);
    }
  };

  const handleRemoveImage = () => {
    if (!product?.image?.publicId) return;

    setImageFile(null);
    setImagePreview(null);
    setImageToDelete(product.image.publicId);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData || !id) return;

    setError("");
    setSaving(true);

    try {
      const price = Number(formData.price);
      const stock = Number(formData.stock || 0);

      if (Number.isNaN(price) || price < 0) {
        throw new Error("El precio debe ser un número válido");
      }

      if (Number.isNaN(stock) || stock < 0) {
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

      let imageData: { url: string; publicId: string } | null | undefined;

      if (imageFile) {
        imageData = await uploadService.uploadImage(imageFile);
      } else if (!imagePreview) {
        imageData = null;
      }

      await productService.update(id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price,
        category: formData.category,
        stock,
        featured: formData.featured,
        ingredients,
        benefits,
        image: imageData,
      });

      if (imageToDelete) {
        try {
          await uploadService.deleteImage(imageToDelete);
        } catch (deleteError) {
          console.warn("No se pudo eliminar la imagen anterior", deleteError);
        }
      }

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
                    Precio
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Stock
                  </label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    min="0"
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
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
            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
