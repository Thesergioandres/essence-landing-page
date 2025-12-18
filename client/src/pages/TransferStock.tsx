import { useCallback, useEffect, useState } from "react";
import { distributorService, stockService } from "../api/services";
import LoadingSpinner from "../components/LoadingSpinner";
import type { DistributorStock, User } from "../types";

export default function TransferStock() {
  const [distributors, setDistributors] = useState<User[]>([]);
  const [myStock, setMyStock] = useState<DistributorStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedDistributor, setSelectedDistributor] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      // Verificar que tengamos un ID de usuario válido
      if (!user._id) {
        setMessage({
          type: "error",
          text: "No se encontró información del usuario. Por favor, inicia sesión nuevamente.",
        });
        setLoading(false);
        return;
      }

      const [distributorsData, stockData] = await Promise.all([
        distributorService.getAll({ active: true }),
        stockService.getDistributorStock(user._id),
      ]);

      // Filtrar el distribuidor actual de la lista
      const allDistributors = Array.isArray(distributorsData)
        ? distributorsData
        : distributorsData.data || [];

      const filteredDistributors = allDistributors.filter(
        (d: User) => d._id !== user._id && d.active
      );

      setDistributors(filteredDistributors);
      setMyStock(stockData);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      setMessage({ type: "error", text: "Error al cargar los datos" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getAvailableStock = () => {
    if (!selectedProduct) return 0;
    const stock = myStock.find(s => {
      const productId =
        typeof s.product === "string" ? s.product : s.product._id;
      return productId === selectedProduct;
    });
    return stock?.quantity || 0;
  };

  const handleTransfer = async () => {
    try {
      setSubmitting(true);
      setMessage(null);

      const result = await stockService.transferStock({
        toDistributorId: selectedDistributor,
        productId: selectedProduct,
        quantity,
      });

      setMessage({ type: "success", text: result.message });

      // Limpiar formulario
      setSelectedDistributor("");
      setSelectedProduct("");
      setQuantity(1);
      setShowConfirmation(false);

      // Recargar stock
      await loadData();
    } catch (error: any) {
      console.error("Error en transferencia:", error);
      setMessage({
        type: "error",
        text:
          error.response?.data?.message || "Error al realizar la transferencia",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDistributor || !selectedProduct || quantity <= 0) {
      setMessage({
        type: "error",
        text: "Completa todos los campos correctamente",
      });
      return;
    }

    const availableStock = getAvailableStock();
    if (quantity > availableStock) {
      setMessage({
        type: "error",
        text: `Stock insuficiente. Disponible: ${availableStock}`,
      });
      return;
    }

    setShowConfirmation(true);
  };

  const getDistributorName = () => {
    return distributors.find(d => d._id === selectedDistributor)?.name || "";
  };

  const getProductName = () => {
    const stock = myStock.find(s => {
      const productId =
        typeof s.product === "string" ? s.product : s.product._id;
      return productId === selectedProduct;
    });
    if (!stock) return "";
    return typeof stock.product === "string" ? "" : stock.product.name;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner
          size="lg"
          variant="dots"
          message="Cargando datos de transferencia..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Transferir Inventario</h1>
        <p className="mt-2 text-gray-300">
          Transfiere productos de tu inventario a otro distribuidor
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === "success"
              ? "border border-green-500/30 bg-green-500/10 text-green-300"
              : "border border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          <p className="flex items-center gap-2">
            {message.type === "success" ? "✓" : "✕"} {message.text}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seleccionar distribuidor */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Distribuidor Destino *
            </label>
            <select
              value={selectedDistributor}
              onChange={e => setSelectedDistributor(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2.5 text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              required
            >
              <option value="">Selecciona un distribuidor</option>
              {distributors.map(dist => (
                <option key={dist._id} value={dist._id}>
                  {dist.name} - {dist.email}
                </option>
              ))}
            </select>
          </div>

          {/* Seleccionar producto */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Producto *
            </label>
            <select
              value={selectedProduct}
              onChange={e => {
                setSelectedProduct(e.target.value);
                setQuantity(1);
              }}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2.5 text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              required
            >
              <option value="">Selecciona un producto</option>
              {myStock
                .filter(s => s.quantity > 0)
                .map(stock => {
                  const productId =
                    typeof stock.product === "string"
                      ? stock.product
                      : stock.product._id;
                  const productName =
                    typeof stock.product === "string"
                      ? "Producto"
                      : stock.product.name;
                  return (
                    <option key={productId} value={productId}>
                      {productName} - Disponible: {stock.quantity} unidades
                    </option>
                  );
                })}
            </select>
          </div>

          {/* Cantidad */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Cantidad *
            </label>
            <input
              type="number"
              min="1"
              max={getAvailableStock()}
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2.5 text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              required
            />
            {selectedProduct && (
              <p className="mt-1 text-sm text-gray-400">
                Disponible: {getAvailableStock()} unidades
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Procesando..." : "Transferir"}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de confirmación */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white">
              Confirmar Transferencia
            </h3>
            <div className="mt-4 space-y-2 text-gray-200">
              <p>
                <strong>Producto:</strong> {getProductName()}
              </p>
              <p>
                <strong>Cantidad:</strong> {quantity} unidades
              </p>
              <p>
                <strong>Destino:</strong> {getDistributorName()}
              </p>
              <p className="mt-4 text-sm text-amber-300">
                ⚠️ Esta acción no se puede deshacer. El stock se restará de tu
                inventario y se agregará al inventario del distribuidor
                seleccionado.
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-700 bg-transparent px-4 py-2 font-medium text-gray-200 transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransfer}
                disabled={submitting}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Transfiriendo..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resumen de mi inventario */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="mb-4 text-xl font-bold text-white">
          Mi Inventario Actual
        </h2>
        <div className="space-y-2">
          {myStock.length === 0 ? (
            <p className="text-gray-400">
              No tienes productos en tu inventario
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myStock.map(stock => {
                const productId =
                  typeof stock.product === "string"
                    ? stock.product
                    : stock.product._id;
                const productName =
                  typeof stock.product === "string"
                    ? "Producto"
                    : stock.product.name;
                return (
                  <div
                    key={productId}
                    className="rounded-lg border border-gray-700 bg-gray-900/30 p-4"
                  >
                    <h3 className="font-medium text-gray-200">{productName}</h3>
                    <p className="mt-1 text-sm text-gray-300">
                      Stock:{" "}
                      <span className="font-semibold">{stock.quantity}</span>{" "}
                      unidades
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
