import { useCallback, useEffect, useState } from "react";
import type { User } from "../features/auth/types/auth.types";
import { distributorService } from "../features/distributors/services";
import { productService } from "../features/inventory/services/inventory.service";
import type { Product } from "../features/inventory/types/product.types";
import { specialSaleService } from "../features/sales/services";

interface Distribution {
  name: string;
  amount: number;
  percentage: string;
  notes?: string;
  useExisting?: boolean; // true = selector, false = input manual
  distributorId?: string; // ID del distribuidor seleccionado
}

interface ProductItem {
  productId?: string;
  productName: string;
  quantity: number;
  specialPrice: number;
  cost: number;
}

interface SpecialSaleFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editData?: any;
}

export default function SpecialSaleForm({
  onSuccess,
  onCancel,
  editData,
}: SpecialSaleFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingDistributors, setLoadingDistributors] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [distributors, setDistributors] = useState<User[]>([]);
  const [productItems, setProductItems] = useState<ProductItem[]>([
    { productName: "", quantity: 1, specialPrice: 0, cost: 0 },
  ]);
  const [distribution, setDistribution] = useState<Distribution[]>([
    { name: "", amount: 0, percentage: "", useExisting: true },
  ]);
  const [observations, setObservations] = useState("");
  const [eventName, setEventName] = useState("");
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Cálculos automáticos
  const totalSale = productItems.reduce(
    (sum, item) => sum + item.specialPrice * item.quantity,
    0
  );
  const totalCost = productItems.reduce(
    (sum, item) => sum + item.cost * item.quantity,
    0
  );
  const totalProfit = totalSale - totalCost;
  const distributionSum = distribution.reduce(
    (sum, dist) => sum + (dist.amount || 0),
    0
  );
  const tolerance = 0.01;
  const remainingProfit = totalProfit - distributionSum;
  const isOverAllocated = remainingProfit < -tolerance;
  const isBalanced = Math.abs(remainingProfit) <= tolerance;
  const isValid = !isOverAllocated;
  const selectedDistributorIds = distribution
    .map(dist => dist.distributorId)
    .filter((id): id is string => Boolean(id));

  const toPercentageNumber = (value: string) => {
    if (!value || value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const loadProducts = useCallback(async () => {
    try {
      const response = await productService.getAll();
      setProducts(response.data || []);
    } catch (error) {
      console.error("Error al cargar productos:", error);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadDistributors = useCallback(async () => {
    try {
      const response = await distributorService.getAll({ active: true } as any); // Solo activos
      // Extraer solo distribuidores (role: 'distribuidor')
      const distData = Array.isArray(response) ? response : response.data;
      const distributorUsers = distData.filter(
        (user: User) => user.role === "distribuidor"
      );
      setDistributors(distributorUsers);
    } catch (error) {
      console.error("Error al cargar distribuidores:", error);
    } finally {
      setLoadingDistributors(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadDistributors();
  }, [loadProducts, loadDistributors]);

  useEffect(() => {
    if (editData) {
      // Convertir datos de edición al nuevo formato
      setProductItems([
        {
          productId: editData.product.productId,
          productName: editData.product.name,
          quantity: editData.quantity,
          specialPrice: editData.specialPrice,
          cost: editData.cost,
        },
      ]);
      setDistribution(
        editData.distribution?.map((d: any) => ({
          name: d.name,
          amount: d.amount,
          percentage: "",
        })) || [{ name: "", amount: 0, percentage: "" }]
      );
      setObservations(editData.observations || "");
      setEventName(editData.eventName || "");
      setSaleDate(
        editData.saleDate
          ? new Date(editData.saleDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
    }
  }, [editData]);

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p._id === productId);
    if (product) {
      const newItems = [...productItems];
      newItems[index] = {
        ...newItems[index],
        productId: product._id,
        productName: product.name,
        cost: product.purchasePrice || 0,
      };
      setProductItems(newItems);
    }
  };

  const addProductItem = () => {
    setProductItems([
      ...productItems,
      { productName: "", quantity: 1, specialPrice: 0, cost: 0 },
    ]);
  };

  const removeProductItem = (index: number) => {
    if (productItems.length > 1) {
      setProductItems(productItems.filter((_, i) => i !== index));
    }
  };

  const updateProductItem = (
    index: number,
    field: keyof ProductItem,
    value: string | number
  ) => {
    const newItems = [...productItems];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    };
    setProductItems(newItems);
  };

  const addDistributor = () => {
    setDistribution([
      ...distribution,
      { name: "", amount: 0, percentage: "", useExisting: true },
    ]);
  };

  const removeDistributor = (index: number) => {
    if (distribution.length > 1) {
      setDistribution(distribution.filter((_, i) => i !== index));
    }
  };

  const updateDistributor = (
    index: number,
    field: keyof Distribution,
    value: string | number | boolean
  ) => {
    const newDistribution = [...distribution];

    if (field === "percentage") {
      const percentageValue = value as string;
      newDistribution[index] = {
        ...newDistribution[index],
        percentage: percentageValue,
      };

      // Si hay un porcentaje válido, calcular el monto
      if (percentageValue && !isNaN(parseFloat(percentageValue))) {
        const pct = parseFloat(percentageValue);
        const calculatedAmount =
          totalProfit > 0 ? (totalProfit * pct) / 100 : 0;
        newDistribution[index].amount = parseFloat(calculatedAmount.toFixed(2));
      }
    } else if (field === "amount") {
      const amountValue = parseFloat(value as string) || 0;
      const pct = totalProfit > 0 ? (amountValue / totalProfit) * 100 : 0;
      newDistribution[index] = {
        ...newDistribution[index],
        amount: amountValue,
        percentage: pct ? pct.toFixed(2) : "",
      };
    } else if (field === "distributorId") {
      // Cuando se selecciona un distribuidor existente
      const distributorId = value as string;
      if (distributorId === "custom") {
        newDistribution[index] = {
          ...newDistribution[index],
          distributorId: undefined,
          name: "",
          useExisting: false,
        };
      } else {
        const selectedDist = distributors.find(d => d._id === distributorId);
        if (selectedDist) {
          newDistribution[index] = {
            ...newDistribution[index],
            distributorId: distributorId,
            name: selectedDist.name,
            useExisting: true,
          };
        }
      }
    } else {
      newDistribution[index] = {
        ...newDistribution[index],
        [field]: value,
      };
    }

    setDistribution(newDistribution);
  };

  const autoDistribute = () => {
    if (distribution.length === 0) return;

    const validDistributors = distribution.filter(
      d => d.name && d.name.trim() !== ""
    );
    if (validDistributors.length === 0) return;

    const amountPerPerson = totalProfit / validDistributors.length;

    const newDistribution = distribution.map(dist => {
      if (dist.name && dist.name.trim() !== "") {
        return {
          ...dist,
          amount: parseFloat(amountPerPerson.toFixed(2)),
          percentage: "",
        };
      }
      return dist;
    });

    setDistribution(newDistribution);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isOverAllocated) {
      alert(
        `La suma de distribuciones ($${distributionSum.toFixed(2)}) excede la ganancia total ($${totalProfit.toFixed(2)})`
      );
      return;
    }

    if (distribution.some(d => !d.name || d.name.trim() === "")) {
      alert("Todos los distribuidores deben tener un nombre");
      return;
    }

    if (
      productItems.some(
        item => !item.productName || item.productName.trim() === ""
      )
    ) {
      alert("Todos los productos deben tener un nombre");
      return;
    }

    setLoading(true);

    try {
      // Para ventas con múltiples productos, crear una venta especial por cada producto
      const promises = productItems.map(item => {
        // Calcular la proporción de distribución para este producto
        const itemProfit =
          item.specialPrice * item.quantity - item.cost * item.quantity;
        const proportionalDistribution = distribution.map(dist => ({
          name: dist.name,
          amount: (dist.amount * itemProfit) / totalProfit,
          notes: dist.notes,
          percentage: toPercentageNumber(dist.percentage),
        }));

        const data = {
          product: {
            name: item.productName,
            productId: item.productId,
          },
          quantity: item.quantity,
          specialPrice: item.specialPrice,
          cost: item.cost,
          distribution: proportionalDistribution,
          observations: `${observations}${productItems.length > 1 ? ` (Parte de venta múltiple)` : ""}`,
          eventName,
          saleDate,
        };

        if (editData && productItems.length === 1) {
          return specialSaleService.update(editData._id, data);
        } else {
          return specialSaleService.create(data);
        }
      });

      await Promise.all(promises);

      alert(
        editData && productItems.length === 1
          ? "Venta especial actualizada exitosamente"
          : `${productItems.length} venta${productItems.length > 1 ? "s" : ""} especial${productItems.length > 1 ? "es" : ""} creada${productItems.length > 1 ? "s" : ""} exitosamente`
      );
      onSuccess();
    } catch (error: any) {
      console.error("Error al guardar venta especial:", error);
      alert(
        error.response?.data?.message ||
          "Error al guardar la venta especial. Verifica los datos."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-[0_28px_70px_-50px_rgba(56,189,248,0.45)] backdrop-blur sm:p-6">
      <div className="mb-6 rounded-xl border border-slate-700/70 bg-slate-950/40 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">
              Operación guiada
            </p>
            <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">
              {editData ? "Editar" : "Nueva"} Venta Especial
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Completa el formulario por pasos para evitar errores de reparto.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-white"
          >
            Cancelar
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
            1. Contexto de venta
          </div>
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
            2. Productos y costos
          </div>
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
            3. Distribución
          </div>
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
            4. Confirmación
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre del evento */}
        <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4 sm:p-5">
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Paso 1. Nombre del evento
          </label>
          <p className="mb-3 text-xs text-slate-400">
            Usa una referencia clara para encontrarla rápido en el historial.
          </p>
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Nombre del evento
          </label>
          <input
            type="text"
            value={eventName}
            onChange={e => setEventName(e.target.value)}
            placeholder="Ej: Black Friday 2024"
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
        </div>

        {/* Productos */}
        <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-200">
              Paso 2. Productos *
            </label>
            <span className="text-xs text-slate-400">
              Puedes mezclar varios productos en una sola operación
            </span>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">
              Productos *
            </label>
            <button
              type="button"
              onClick={addProductItem}
              className="min-h-10 rounded-lg bg-cyan-500 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              + Agregar producto
            </button>
          </div>

          <div className="space-y-3">
            {productItems.map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-slate-700 bg-slate-900/60 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">
                    Producto {index + 1}
                  </h4>
                  {productItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProductItem(index)}
                      className="rounded-lg bg-red-600/90 p-1.5 text-white transition hover:bg-red-500"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Selector de producto */}
                  <div className="sm:col-span-2">
                    {loadingProducts ? (
                      <p className="text-sm text-gray-400">
                        Cargando productos...
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <select
                          value={item.productId || ""}
                          onChange={e => {
                            if (e.target.value === "custom") {
                              updateProductItem(index, "productId", "");
                            } else {
                              handleProductSelect(index, e.target.value);
                            }
                          }}
                          className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                        >
                          <option value="">Seleccionar producto...</option>
                          <option value="custom">
                            -- Producto personalizado --
                          </option>
                          {products.map(product => (
                            <option key={product._id} value={product._id}>
                              {product.name} - $
                              {product.clientPrice?.toLocaleString()}
                            </option>
                          ))}
                        </select>

                        {!item.productId && (
                          <input
                            type="text"
                            value={item.productName}
                            onChange={e =>
                              updateProductItem(
                                index,
                                "productName",
                                e.target.value
                              )
                            }
                            placeholder="Nombre del producto *"
                            required
                            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Cantidad */}
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      Cantidad *
                    </label>
                    <input
                      type="number"
                      value={item.quantity || ""}
                      onChange={e =>
                        updateProductItem(
                          index,
                          "quantity",
                          parseInt(e.target.value) || 1
                        )
                      }
                      min="1"
                      required
                      placeholder="1"
                      className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  {/* Precio especial */}
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      Precio especial * ($)
                    </label>
                    <input
                      type="number"
                      value={item.specialPrice || ""}
                      onChange={e =>
                        updateProductItem(
                          index,
                          "specialPrice",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      min="0"
                      step="0.01"
                      required
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  {/* Costo */}
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-gray-400">
                      Costo * ($)
                    </label>
                    <input
                      type="number"
                      value={item.cost || ""}
                      onChange={e =>
                        updateProductItem(
                          index,
                          "cost",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      min="0"
                      step="0.01"
                      required
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Resumen del producto */}
                <div className="mt-3 rounded bg-gray-800/50 px-3 py-2 text-xs">
                  <div className="flex justify-between text-gray-400">
                    <span>Venta:</span>
                    <span className="text-white">
                      ${(item.specialPrice * item.quantity).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Costo:</span>
                    <span className="text-white">
                      ${(item.cost * item.quantity).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-gray-600 pt-1 font-semibold">
                    <span className="text-gray-300">Ganancia:</span>
                    <span className="text-green-400">
                      $
                      {(
                        item.specialPrice * item.quantity -
                        item.cost * item.quantity
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fecha */}
        <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4 sm:p-5">
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Paso 3. Fecha de venta *
          </label>
          <input
            type="date"
            value={saleDate}
            onChange={e => setSaleDate(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
        </div>

        {/* Resumen de cálculos */}
        <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-cyan-300">
            Resumen de Cálculos
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Venta total:</span>
              <span className="font-medium text-white">
                ${totalSale.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Costo total:</span>
              <span className="font-medium text-white">
                ${totalCost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-600 pt-2">
              <span className="font-semibold text-slate-200">
                Ganancia total:
              </span>
              <span className="text-lg font-bold text-green-400">
                ${totalProfit.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Distribución */}
        <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-200">
              Paso 4. Distribución de ganancias *
            </label>
            <span className="text-xs text-slate-400">
              Puedes usar porcentaje o monto
            </span>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">
              Distribución de ganancias *
            </label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={autoDistribute}
                  className="min-h-10 rounded-lg bg-blue-500 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-blue-400"
                >
                  Distribuir equitativamente
                </button>
                <button
                  type="button"
                  onClick={addDistributor}
                  className="min-h-10 rounded-lg bg-cyan-500 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  + Agregar
                </button>
              </div>
              {remainingProfit > tolerance && distributionSum > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                  <svg
                    className="h-4 w-4 shrink-0 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-xs text-amber-200">
                    Restante {remainingProfit.toLocaleString()} se asignará
                    automáticamente a Admin
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {distribution.map((dist, index) => (
              <div
                key={index}
                className="rounded-lg border border-slate-700 bg-slate-900/60 p-4"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      Nombre *
                    </label>
                    {loadingDistributors ? (
                      <p className="py-2 text-xs text-gray-400">Cargando...</p>
                    ) : (
                      <div className="space-y-2">
                        <select
                          value={
                            dist.distributorId ||
                            (dist.useExisting ? "" : "custom")
                          }
                          onChange={e => {
                            updateDistributor(
                              index,
                              "distributorId",
                              e.target.value
                            );
                          }}
                          className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                        >
                          <option value="">Seleccionar distribuidor...</option>
                          <option value="custom">
                            -- Persona personalizada --
                          </option>
                          {distributors
                            .filter(
                              distributor =>
                                distributor._id === dist.distributorId ||
                                !selectedDistributorIds.includes(
                                  distributor._id
                                )
                            )
                            .map(distributor => (
                              <option
                                key={distributor._id}
                                value={distributor._id}
                              >
                                {distributor.name}
                              </option>
                            ))}
                        </select>

                        {!dist.useExisting && (
                          <input
                            type="text"
                            value={dist.name}
                            onChange={e =>
                              updateDistributor(index, "name", e.target.value)
                            }
                            placeholder="Nombre de la persona *"
                            required
                            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
                          />
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      Porcentaje (%)
                    </label>
                    <input
                      type="number"
                      value={dist.percentage || ""}
                      onChange={e =>
                        updateDistributor(index, "percentage", e.target.value)
                      }
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      Monto ($) *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={dist.amount || ""}
                        onChange={e =>
                          updateDistributor(
                            index,
                            "amount",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="0"
                        min="0"
                        step="0.01"
                        required
                        className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {distribution.length > 1 && (
                  <div className="mt-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeDistributor(index)}
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Verificación de distribución */}
          <div
            className={`mt-3 rounded-lg p-3 ${
              isOverAllocated
                ? "border border-red-700 bg-red-900/30"
                : "border border-green-700 bg-green-900/30"
            }`}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-300">
                Suma de distribuciones:
              </span>
              <span
                className={`font-bold ${
                  isOverAllocated ? "text-red-400" : "text-green-400"
                }`}
              >
                ${distributionSum.toLocaleString()}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              {isOverAllocated ? (
                <>
                  <svg
                    className="h-4 w-4 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-red-400">
                    ✗ La suma excede la ganancia total ($
                    {totalProfit.toLocaleString()})
                  </span>
                </>
              ) : isBalanced ? (
                <>
                  <svg
                    className="h-4 w-4 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-green-400">
                    ✓ Distribución correcta
                  </span>
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-amber-200">
                    Se asignarán ${remainingProfit.toLocaleString()} al Admin
                    automáticamente
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Observaciones */}
        <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4 sm:p-5">
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Observaciones
          </label>
          <textarea
            value={observations}
            onChange={e => setObservations(e.target.value)}
            rows={3}
            placeholder="Notas adicionales sobre esta venta especial..."
            className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading || !isValid}
            className="bg-linear-to-r min-h-12 flex-1 rounded-xl from-cyan-400 to-emerald-300 px-6 py-3 font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Guardando..."
              : editData
                ? "Actualizar Venta Especial"
                : "Crear Venta Especial"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-white"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
