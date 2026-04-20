import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  categoryService,
  productService,
} from "../../inventory/services/inventory.service";
import type { Category, Product } from "../types/product.types";

interface FormState {
  name: string;
  description: string;
  purchasePrice: string;
  suggestedPrice: string;
  employeePrice: string;
  clientPrice: string;
  totalStock: string;
  warehouseStock: string;
  lowStockAlert: string;
  category: string;
  featured: boolean;
  ingredients: string;
  benefits: string;
}

const calculateAutomaticEmployeePrice = (
  salePriceRaw: number,
  baseCommissionPercentageRaw: number
) => {
  if (!Number.isFinite(salePriceRaw) || salePriceRaw < 0) {
    return 0;
  }

  const normalizedCommission = Math.min(
    95,
    Math.max(0, Number(baseCommissionPercentageRaw) || 0)
  );

  const commissionAmount = salePriceRaw * (normalizedCommission / 100);
  return Number((salePriceRaw - commissionAmount).toFixed(2));
};

export default function EditProduct() {
  const navigate = useNavigate();
  const location = useLocation();
  const firstSegment = location.pathname.split("/").filter(Boolean)[0] || "";
  const areaBase = firstSegment ? `/${firstSegment}` : "/admin";
  const productsRoute = `${areaBase}/products`;
  const { id } = useParams<{ id: string }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<FormState | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [employeeManual, setEmployeeManual] = useState(false);
  const [baseCommissionPercentage, setBaseCommissionPercentage] =
    useState<number>(20);

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

  const salePriceForPricing = useMemo(() => {
    const clientPrice = Number(formData?.clientPrice);
    if (Number.isFinite(clientPrice) && clientPrice >= 0) {
      return clientPrice;
    }

    const suggestedPrice = Number(formData?.suggestedPrice);
    if (Number.isFinite(suggestedPrice) && suggestedPrice >= 0) {
      return suggestedPrice;
    }

    return 0;
  }, [formData?.clientPrice, formData?.suggestedPrice]);

  const automaticEmployeePrice = useMemo(
    () =>
      calculateAutomaticEmployeePrice(
        salePriceForPricing,
        baseCommissionPercentage
      ),
    [baseCommissionPercentage, salePriceForPricing]
  );

  const effectiveEmployeePrice = useMemo(() => {
    if (!employeeManual) {
      return automaticEmployeePrice;
    }

    const manualPrice = Number(formData?.employeePrice);
    if (!Number.isFinite(manualPrice) || manualPrice < 0) {
      return 0;
    }

    return manualPrice;
  }, [automaticEmployeePrice, employeeManual, formData?.employeePrice]);

  const handleAutomaticEmployeeModeChange = (automaticMode: boolean) => {
    setEmployeeManual(!automaticMode);
    setFormData(current => {
      if (!current) {
        return current;
      }

      if (automaticMode) {
        return {
          ...current,
          employeePrice: "",
        };
      }

      if (current.employeePrice) {
        return current;
      }

      return {
        ...current,
        employeePrice:
          automaticEmployeePrice > 0 ? automaticEmployeePrice.toString() : "",
      };
    });
  };

  const loadProduct = async (productId: string) => {
    try {
      setLoading(true);
      const response = await productService.getById(productId);
      setProduct(response);
      const manualValue =
        typeof response.employeePriceManualValue === "number"
          ? response.employeePriceManualValue
          : response.employeePrice;
      const isManual =
        response.employeePriceManual === true &&
        Number.isFinite(Number(manualValue));

      setEmployeeManual(isManual);
      setFormData({
        name: response.name,
        description: response.description,
        purchasePrice: response.purchasePrice?.toString() ?? "0",
        suggestedPrice: response.suggestedPrice?.toString() ?? "0",
        employeePrice: isManual ? String(manualValue ?? "") : "",
        clientPrice: response.clientPrice?.toString() ?? "0",
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
      const purchasePrice = Number(value) || 0;
      const suggestedPrice = Math.round(purchasePrice * 1.3);
      setFormData(current =>
        current
          ? {
              ...current,
              purchasePrice: value,
              suggestedPrice: suggestedPrice.toString(),
            }
          : current
      );
      return;
    }

    if (name === "employeePrice") {
      setEmployeeManual(true);
      setFormData(current =>
        current
          ? {
              ...current,
              employeePrice: value,
            }
          : current
      );
      return;
    }

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
      const manualEmployeePrice = employeeManual
        ? Number(formData.employeePrice)
        : null;
      const clientPrice = Number(formData.clientPrice);
      const totalStock = Number(formData.totalStock || 0);
      const warehouseStock = Number(formData.warehouseStock || 0);
      const lowStockAlert = Number(formData.lowStockAlert || 10);

      if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
        throw new Error("El precio de compra debe ser un número válido");
      }

      if (Number.isNaN(totalStock) || totalStock < 0) {
        throw new Error("El stock total debe ser un número válido");
      }

      if (
        employeeManual &&
        (manualEmployeePrice === null ||
          Number.isNaN(manualEmployeePrice) ||
          manualEmployeePrice < 0)
      ) {
        throw new Error("El precio de empleado debe ser un número válido");
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
        ...(employeeManual
          ? { employeePrice: manualEmployeePrice as number }
          : {}),
        employeePriceManual: employeeManual,
        clientPrice,
        totalStock,
        warehouseStock,
        lowStockAlert,
        category: formData.category,
        featured: formData.featured,
        ingredients,
        benefits,
        imageFile: imageFile || undefined,
      });

      navigate(productsRoute);
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
                    Precio de Compra Base *
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
                  <p className="mt-1 text-xs text-gray-500">
                    Costo inicial del producto
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-blue-400">
                    Costo Promedio Ponderado
                  </label>
                  <input
                    type="text"
                    value={
                      product?.averageCost
                        ? `$${product.averageCost.toLocaleString()}`
                        : "No calculado"
                    }
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-blue-500/50 bg-blue-900/20 px-4 py-3 text-blue-300"
                  />
                  <p className="mt-1 text-xs text-blue-500">
                    Promedio según entradas de inventario (solo lectura)
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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
                  <p className="mt-1 text-xs text-green-600">
                    Auto-calculado: Precio de compra × 1.3
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-blue-400">
                      Precio para empleado
                    </label>
                    <label className="inline-flex items-center gap-2 text-[11px] font-medium text-blue-200">
                      <input
                        type="checkbox"
                        checked={!employeeManual}
                        onChange={event =>
                          handleAutomaticEmployeeModeChange(
                            event.target.checked
                          )
                        }
                        className="h-3.5 w-3.5 rounded border border-blue-500 bg-blue-950/40"
                      />
                      Automatico ({baseCommissionPercentage}%)
                    </label>
                  </div>
                  <input
                    type="number"
                    name="employeePrice"
                    value={
                      employeeManual
                        ? formData.employeePrice
                        : automaticEmployeePrice > 0
                          ? automaticEmployeePrice.toString()
                          : ""
                    }
                    onChange={handleChange}
                    disabled={!employeeManual}
                    min="0"
                    step="1"
                    className="w-full rounded-lg border border-blue-500 bg-blue-900/20 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-80"
                  />
                  <p className="mt-1 text-xs text-blue-600">
                    Automatico: precio de venta - (precio de venta x comision).
                    Manual fija un valor persistente.
                  </p>
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
                  <p className="mt-1 text-xs text-purple-600">
                    Precio sugerido de venta
                  </p>
                </div>

                <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    📊 Mi Rentabilidad (ROI)
                    {product?.averageCost && product.averageCost > 0 && (
                      <span className="ml-1 font-normal lowercase text-blue-400"></span>
                    )}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* B2B: Selling to Employee */}
                    <div>
                      <p className="text-[10px] uppercase text-gray-500">
                        Venta a empleado (B2B)
                      </p>
                      {(() => {
                        const cost =
                          (product?.averageCost && product.averageCost > 0
                            ? product.averageCost
                            : Number(formData.purchasePrice)) || 0;
                        const price = effectiveEmployeePrice;
                        const profit = price - cost;
                        const roi =
                          cost > 0 ? Math.round((profit / cost) * 100) : 0;
                        const isPositive = profit > 0;

                        return (
                          <p
                            className={`text-sm font-bold ${isPositive ? "text-blue-400" : "text-red-400"}`}
                          >
                            ${new Intl.NumberFormat("es-CO").format(profit)}{" "}
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
                        const cost =
                          (product?.averageCost && product.averageCost > 0
                            ? product.averageCost
                            : Number(formData.purchasePrice)) || 0;
                        const price = Number(formData.clientPrice) || 0;
                        const profit = price - cost;
                        const roi =
                          cost > 0 ? Math.round((profit / cost) * 100) : 0;
                        const isPositive = profit > 0;

                        return (
                          <p
                            className={`text-sm font-bold ${isPositive ? "text-purple-400" : "text-red-400"}`}
                          >
                            ${new Intl.NumberFormat("es-CO").format(profit)}{" "}
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

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Stock Total
                  </label>
                  <input
                    type="number"
                    name="totalStock"
                    value={formData.totalStock}
                    onChange={handleChange}
                    min="0"
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="mt-1 text-xs text-amber-400">
                    Cualquier ajuste genera un registro automatico en el
                    historial.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Stock en Bodega
                  </label>
                  <input
                    type="number"
                    name="warehouseStock"
                    value={formData.warehouseStock}
                    onChange={handleChange}
                    min="0"
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="mt-1 text-xs text-amber-400">
                    El sistema recalcula el total global automaticamente.
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
            onClick={() => navigate(productsRoute)}
            className="rounded-lg border border-gray-700 px-6 py-3 font-semibold text-gray-300 transition hover:border-purple-500 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-linear-to-r rounded-lg from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
