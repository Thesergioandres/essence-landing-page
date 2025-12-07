import { useEffect, useState } from "react";
import { productService, specialSaleService } from "../api/services";
import type { Product } from "../types";

interface Distribution {
  name: string;
  amount: number;
  percentage?: number;
  notes?: string;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Campos del formulario
  const [useExistingProduct, setUseExistingProduct] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [specialPrice, setSpecialPrice] = useState(0);
  const [cost, setCost] = useState(0);
  const [distribution, setDistribution] = useState<Distribution[]>([
    { name: "", amount: 0 },
  ]);
  const [observations, setObservations] = useState("");
  const [eventName, setEventName] = useState("");
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Cálculos automáticos
  const totalSale = specialPrice * quantity;
  const totalCost = cost * quantity;
  const totalProfit = totalSale - totalCost;
  const distributionSum = distribution.reduce(
    (sum, dist) => sum + (dist.amount || 0),
    0
  );
  const isValid = Math.abs(distributionSum - totalProfit) < 0.01;

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (editData) {
      setUseExistingProduct(!!editData.product.productId);
      setSelectedProductId(editData.product.productId || "");
      setProductName(editData.product.name);
      setQuantity(editData.quantity);
      setSpecialPrice(editData.specialPrice);
      setCost(editData.cost);
      setDistribution(editData.distribution || [{ name: "", amount: 0 }]);
      setObservations(editData.observations || "");
      setEventName(editData.eventName || "");
      setSaleDate(
        editData.saleDate
          ? new Date(editData.saleDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
    }
  }, [editData]);

  const loadProducts = async () => {
    try {
      const data = await productService.getAll();
      setProducts(data);
    } catch (error) {
      console.error("Error al cargar productos:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find((p) => p._id === productId);
    if (product) {
      setProductName(product.name);
      setCost(product.cost || 0);
    }
  };

  const addDistributor = () => {
    setDistribution([...distribution, { name: "", amount: 0 }]);
  };

  const removeDistributor = (index: number) => {
    if (distribution.length > 1) {
      setDistribution(distribution.filter((_, i) => i !== index));
    }
  };

  const updateDistributor = (
    index: number,
    field: keyof Distribution,
    value: string | number
  ) => {
    const newDistribution = [...distribution];
    newDistribution[index] = {
      ...newDistribution[index],
      [field]: value,
    };
    setDistribution(newDistribution);
  };

  const autoDistribute = () => {
    if (distribution.length === 0) return;

    const validDistributors = distribution.filter(
      (d) => d.name && d.name.trim() !== ""
    );
    if (validDistributors.length === 0) return;

    const amountPerPerson = totalProfit / validDistributors.length;

    const newDistribution = distribution.map((dist) => {
      if (dist.name && dist.name.trim() !== "") {
        return {
          ...dist,
          amount: parseFloat(amountPerPerson.toFixed(2)),
        };
      }
      return dist;
    });

    setDistribution(newDistribution);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      alert(
        `La suma de distribuciones ($${distributionSum.toFixed(2)}) no coincide con la ganancia total ($${totalProfit.toFixed(2)})`
      );
      return;
    }

    if (distribution.some((d) => !d.name || d.name.trim() === "")) {
      alert("Todos los distribuidores deben tener un nombre");
      return;
    }

    setLoading(true);

    try {
      const data = {
        product: {
          name: productName,
          productId: useExistingProduct ? selectedProductId : undefined,
        },
        quantity,
        specialPrice,
        cost,
        distribution,
        observations,
        eventName,
        saleDate,
      };

      if (editData) {
        await specialSaleService.update(editData._id, data);
      } else {
        await specialSaleService.create(data);
      }

      alert(
        editData
          ? "Venta especial actualizada exitosamente"
          : "Venta especial creada exitosamente"
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
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          {editData ? "Editar" : "Nueva"} Venta Especial
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-white transition"
        >
          Cancelar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Selector de tipo de producto */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={useExistingProduct}
              onChange={() => setUseExistingProduct(true)}
              className="text-purple-500"
            />
            <span className="text-sm text-gray-300">Producto existente</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={!useExistingProduct}
              onChange={() => setUseExistingProduct(false)}
              className="text-purple-500"
            />
            <span className="text-sm text-gray-300">Producto personalizado</span>
          </label>
        </div>

        {/* Producto */}
        {useExistingProduct ? (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Producto *
            </label>
            {loadingProducts ? (
              <p className="text-gray-400 text-sm">Cargando productos...</p>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => handleProductSelect(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Seleccionar producto</option>
                {products.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name} - ${product.clientPrice?.toLocaleString()}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Nombre del producto *
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required
              placeholder="Ej: Deathrow Edición Especial"
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        )}

        {/* Nombre del evento */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Nombre del evento
          </label>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Ej: Black Friday 2024"
            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Cantidad, Precio y Costo */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Cantidad *
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              min="1"
              required
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Precio especial * ($)
            </label>
            <input
              type="number"
              value={specialPrice}
              onChange={(e) => setSpecialPrice(parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
              required
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Costo * ($)
            </label>
            <input
              type="number"
              value={cost}
              onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
              required
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Fecha */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Fecha de venta *
          </label>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Resumen de cálculos */}
        <div className="rounded-lg border border-gray-600 bg-gray-700/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-purple-400">
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
            <div className="flex justify-between border-t border-gray-600 pt-2">
              <span className="font-semibold text-gray-300">
                Ganancia total:
              </span>
              <span className="text-lg font-bold text-green-400">
                ${totalProfit.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Distribución */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">
              Distribución de ganancias *
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={autoDistribute}
                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition"
              >
                Distribuir equitativamente
              </button>
              <button
                type="button"
                onClick={addDistributor}
                className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 transition"
              >
                + Agregar
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {distribution.map((dist, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-lg border border-gray-600 bg-gray-700/30 p-3"
              >
                <div className="flex-1 grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={dist.name}
                    onChange={(e) =>
                      updateDistributor(index, "name", e.target.value)
                    }
                    placeholder="Nombre (ej: Nico)"
                    required
                    className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    value={dist.amount}
                    onChange={(e) =>
                      updateDistributor(
                        index,
                        "amount",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="Monto ($)"
                    min="0"
                    step="0.01"
                    required
                    className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                {distribution.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDistributor(index)}
                    className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-700 transition shrink-0"
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
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Verificación de distribución */}
          <div
            className={`mt-3 rounded-lg p-3 ${
              isValid
                ? "bg-green-900/30 border border-green-700"
                : "bg-red-900/30 border border-red-700"
            }`}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-300">
                Suma de distribuciones:
              </span>
              <span
                className={`font-bold ${
                  isValid ? "text-green-400" : "text-red-400"
                }`}
              >
                ${distributionSum.toLocaleString()}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              {isValid ? (
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
                    ✗ La suma debe ser ${totalProfit.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Observaciones
          </label>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={3}
            placeholder="Notas adicionales sobre esta venta especial..."
            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading || !isValid}
            className="flex-1 rounded-xl bg-linear-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="rounded-xl border border-gray-600 px-6 py-3 font-semibold text-gray-300 transition hover:bg-gray-700"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
