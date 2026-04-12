import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { gamificationService } from "../../common/services";
import {
  categoryService,
  productService,
} from "../../inventory/services/inventory.service";
import type { Category } from "../types/product.types";

interface FormState {
  name: string;
  description: string;
  purchasePrice: string;
  suggestedPrice: string;
  employeePrice: string;
  clientPrice: string;
  category: string;
  totalStock: string;
  lowStockAlert: string;
  featured: boolean;
  ingredients: string;
  benefits: string;
}

export default function AddProduct() {
  const maxImageBytes = 10 * 1024 * 1024;
  const navigate = useNavigate();
  const location = useLocation();
  const firstSegment = location.pathname.split("/").filter(Boolean)[0] || "";
  const areaBase = firstSegment ? `/${firstSegment}` : "/admin";
  const productsRoute = `${areaBase}/products`;
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState<FormState>({
    name: "",
    description: "",
    purchasePrice: "",
    suggestedPrice: "",
    employeePrice: "",
    clientPrice: "",
    category: "",
    totalStock: "",
    lowStockAlert: "10",
    featured: false,
    ingredients: "",
    benefits: "",
  });
  const [employeeManual, setEmployeeManual] = useState(false);
  const [baseCommissionPercentage, setBaseCommissionPercentage] =
    useState<number>(20);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

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
    let isActive = true;
    const loadConfig = async () => {
      try {
        const config = await gamificationService.getConfig();
        if (!isActive) return;
        setBaseCommissionPercentage(config.baseCommissionPercentage ?? 20);
      } catch (err) {
        console.error("Error al cargar comision base:", err);
      }
    };
    loadConfig();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    if (employeeManual || !formData.clientPrice) return;
    const client = Number(formData.clientPrice);
    if (Number.isNaN(client)) return;
    const autoPrice = Math.round(
      client * (1 - (baseCommissionPercentage || 0) / 100)
    );
    setFormData(current => ({
      ...current,
      employeePrice: autoPrice.toString(),
    }));
  }, [baseCommissionPercentage, employeeManual, formData.clientPrice]);

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

    if (name === "employeePrice") {
      setEmployeeManual(value !== "");
    }

    setFormData(current => {
      const updated = {
        ...current,
        [name]: fieldValue,
      };

      // Calcular precio sugerido automáticamente (30%)
      if (name === "purchasePrice" && value) {
        const purchase = Number(value);
        if (!isNaN(purchase)) {
          updated.suggestedPrice = Math.round(purchase * 1.3).toString();
        }
      }

      // Calcular precio empleado automáticamente segun comision base
      if (name === "clientPrice" && value && !employeeManual) {
        const client = Number(value);
        if (!isNaN(client)) {
          updated.employeePrice = Math.round(
            client * (1 - (baseCommissionPercentage || 0) / 100)
          ).toString();
        }
      }

      return updated;
    });
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      if (file.size > maxImageBytes) {
        setError("Imagen muy pesada. Maximo 10MB.");
        setImageFile(null);
        setImagePreview(null);
        event.target.value = "";
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    setCreatingCategory(true);
    try {
      const newCategory = await categoryService.create({
        name: newCategoryName.trim(),
      });
      setCategories(prev => [...prev, newCategory]);
      setFormData(prev => ({ ...prev, category: newCategory._id }));
      setNewCategoryName("");
      setShowCategoryInput(false);
    } catch (error) {
      console.error("Error creating category:", error);
      setError("No se pudo crear la categoría");
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const purchasePrice = Number(formData.purchasePrice);
      const employeePrice = Number(formData.employeePrice);
      const totalStock = Number(formData.totalStock || 0);
      const clientPrice = formData.clientPrice
        ? Number(formData.clientPrice)
        : undefined;

      if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
        throw new Error("El precio de compra debe ser un número válido");
      }

      if (Number.isNaN(employeePrice) || employeePrice < 0) {
        throw new Error("El precio de empleado debe ser un número válido");
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

      await productService.create({
        name: formData.name.trim(),
        description: formData.description.trim(),
        purchasePrice,
        suggestedPrice: Number(formData.suggestedPrice) || purchasePrice * 1.3,
        employeePrice,
        employeePriceManual: employeeManual,
        clientPrice,
        category: formData.category,
        totalStock,
        lowStockAlert: Number(formData.lowStockAlert) || 10,
        featured: formData.featured,
        ingredients,
        benefits,
        imageFile: imageFile || undefined,
      });

      navigate(productsRoute);
    } catch (err) {
      const errorPayload = (err as { response?: { data?: any } })?.response
        ?.data;
      const rawMessage =
        errorPayload?.message || (err instanceof Error ? err.message : "");
      const isImageError =
        Boolean(imageFile) &&
        (errorPayload?.code === "LIMIT_FILE_SIZE" ||
          /image|imagen|upload|archivo|file|cloudinary|multipart/i.test(
            rawMessage
          ));
      if (errorPayload?.code === "LIMIT_FILE_SIZE") {
        setError("Imagen muy pesada. Maximo 10MB.");
      } else if (isImageError) {
        const reason = rawMessage || "el servidor no pudo procesar el archivo.";
        setError(
          `Error al subir imagen: ${reason} Verifica formato (JPG/PNG/WEBP), peso < 10MB y que no este corrupto.`
        );
      } else {
        const message =
          err instanceof Error
            ? err.message
            : errorPayload?.message || "Error al crear el producto";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 overflow-hidden">
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
                      Precio Empleado *
                    </label>
                    <input
                      type="number"
                      name="employeePrice"
                      value={formData.employeePrice}
                      onChange={handleChange}
                      required
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-blue-600 bg-blue-900/20 px-4 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Se calcula automáticamente (editable)"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Se calcula segun la comision base, pero puedes ajustarlo
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
                    />
                  </div>
                </div>

                {/* Profit & ROI Summary */}
                <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    📊 Mi Rentabilidad (ROI)
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* B2B: Selling to Employee */}
                    <div>
                      <p className="text-[10px] uppercase text-gray-500">
                        Venta a Empleado (B2B)
                      </p>
                      {(() => {
                        const cost = Number(formData.purchasePrice) || 0;
                        const price = Number(formData.employeePrice) || 0;
                        const profit = price - cost;
                        const roi =
                          cost > 0 ? Math.round((profit / cost) * 100) : 0;
                        const isPositive = profit > 0;

                        return (
                          <p
                            className={`text-sm font-bold ${isPositive ? "text-blue-400" : "text-red-400"}`}
                          >
                            ${profit.toLocaleString()}{" "}
                            <span className="text-xs font-normal opacity-80">
                              ({roi}%)
                            </span>
                          </p>
                        );
                      })()}
                    </div>

                    {/* B2C: Selling to Client Directly */}
                    <div>
                      <p className="text-[10px] uppercase text-gray-500">
                        Venta a Cliente (Directa)
                      </p>
                      {(() => {
                        const cost = Number(formData.purchasePrice) || 0;
                        const price = Number(formData.clientPrice) || 0;
                        const profit = price - cost;
                        const roi =
                          cost > 0 ? Math.round((profit / cost) * 100) : 0;
                        const isPositive = profit > 0;

                        return (
                          <p
                            className={`text-sm font-bold ${isPositive ? "text-purple-400" : "text-red-400"}`}
                          >
                            ${profit.toLocaleString()}{" "}
                            <span className="text-xs font-normal opacity-80">
                              ({roi}%)
                            </span>
                          </p>
                        );
                      })()}
                    </div>
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
                  {!showCategoryInput ? (
                    <div className="flex gap-2">
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        required
                        className="flex-1 rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Selecciona una categoría</option>
                        {categories.map(cat => (
                          <option key={cat._id} value={cat._id}>
                            {cat.name.toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCategoryInput(true)}
                        className="whitespace-nowrap rounded-lg border border-purple-500/40 bg-purple-600/20 px-4 py-2 text-sm font-semibold text-purple-50 transition hover:border-purple-400/70 hover:bg-purple-600/30"
                        title="Crear nueva categoría"
                      >
                        + Nueva
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          placeholder="Nombre de la categoría"
                          className="flex-1 rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
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
            onClick={() => navigate(productsRoute)}
            className="rounded-lg border border-gray-700 px-6 py-3 font-semibold text-gray-300 transition hover:border-purple-500 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-linear-to-r rounded-lg from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar producto"}
          </button>
        </div>
      </form>
    </div>
  );
}
