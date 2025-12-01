import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { saleService, stockService } from "../api/services";
import { Button } from "../components/Button";
import type { DistributorStock } from "../types";

interface FormState {
  productId: string;
  quantity: number;
  salePrice: number;
  notes: string;
  paymentProof: string | null;
  saleDate: string;
}

export default function RegisterSale() {
  const navigate = useNavigate();
  const [stock, setStock] = useState<DistributorStock[]>([]);
  const [formData, setFormData] = useState<FormState>({
    productId: "",
    quantity: 1,
    salePrice: 0,
    notes: "",
    paymentProof: null,
    saleDate: new Date().toISOString().slice(0, 10), // yyyy-mm-dd
  });
  const [selectedProduct, setSelectedProduct] =
    useState<DistributorStock | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStock, setLoadingStock] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    loadStock();
  }, []);

  const loadStock = async () => {
    try {
      setLoadingStock(true);
      const response = await stockService.getDistributorStock("me");
      // Solo productos con stock disponible
      setStock(response.filter(item => item.quantity > 0));
    } catch (error) {
      console.error("Error al cargar inventario:", error);
      setError("No se pudo cargar el inventario");
    } finally {
      setLoadingStock(false);
    }
  };

  const handleProductChange = (productId: string) => {
    const product = stock.find(
      item =>
        (typeof item.product === "object" ? item.product._id : item.product) ===
        productId
    );

    setSelectedProduct(product || null);
    setFormData(prev => ({
      ...prev,
      productId,
      quantity: 1,
      salePrice:
        product && typeof product.product === "object"
          ? product.product.clientPrice || 0
          : 0,
    }));
    setError("");
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]:
        name === "quantity" || name === "salePrice"
          ? Number(value)
          : value,
    }));
  };

  const calculateProfit = () => {
    if (!selectedProduct || typeof selectedProduct.product !== "object")
      return 0;
    return (
      (formData.salePrice - selectedProduct.product.distributorPrice) *
      formData.quantity
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no debe superar 5MB");
      return;
    }

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setFormData(prev => ({
        ...prev,
        paymentProof: base64String,
      }));
      setImagePreview(base64String);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, paymentProof: null }));
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.productId) {
      setError("Selecciona un producto");
      return;
    }

    if (formData.quantity <= 0) {
      setError("La cantidad debe ser mayor a 0");
      return;
    }

    if (!selectedProduct || formData.quantity > selectedProduct.quantity) {
      setError(
        `Stock insuficiente. Disponible: ${selectedProduct?.quantity || 0}`
      );
      return;
    }

    if (formData.salePrice <= 0) {
      setError("El precio de venta debe ser mayor a 0");
      return;
    }

    const product =
      typeof selectedProduct.product === "object"
        ? selectedProduct.product
        : null;
    if (product && formData.salePrice < product.distributorPrice) {
      setError("El precio de venta no puede ser menor al precio que pagaste");
      return;
    }

    try {
      setLoading(true);
      const saleData: {
        productId: string;
        quantity: number;
        salePrice: number;
        notes?: string;
        saleDate?: string;
        paymentProof?: string;
        paymentProofMimeType?: string;
      } = {
        productId: formData.productId,
        quantity: formData.quantity,
        salePrice: formData.salePrice,
        notes: formData.notes,
        saleDate: formData.saleDate,
      };

      // Agregar comprobante si existe
      if (formData.paymentProof) {
        saleData.paymentProof = formData.paymentProof;
        saleData.paymentProofMimeType = "image/jpeg";
      }

      await saleService.register(saleData);

      setSuccess("¡Venta registrada exitosamente!");

      // Resetear formulario
      setFormData({
        productId: "",
        quantity: 1,
        salePrice: 0,
        notes: "",
        paymentProof: null,
        saleDate: new Date().toISOString().slice(0, 10),
      });
      setSelectedProduct(null);
      setImagePreview(null);

      // Recargar stock
      await loadStock();

      // Redirigir después de 2 segundos
      setTimeout(() => {
        navigate("/distributor/sales");
      }, 2000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Error al registrar la venta");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loadingStock) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white">Registrar Venta</h1>
        <p className="mt-2 text-gray-400">
          Registra una nueva venta de tus productos
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500 bg-green-500/10 p-4 text-sm text-green-400">
          {success}
        </div>
      )}

      {stock.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-600 bg-gray-800/50 p-12 text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="mt-4 text-lg text-gray-400">
            No tienes productos con stock disponible
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Contacta al administrador para que te asigne productos
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Selection */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Información de la Venta
            </h2>

            <div className="space-y-4">
                            <div>
                              <label htmlFor="saleDate" className="mb-2 block text-sm font-medium text-gray-300">
                                Fecha de la venta *
                              </label>
                              <input
                                type="date"
                                id="saleDate"
                                name="saleDate"
                                value={formData.saleDate}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
              <div>
                <label
                  htmlFor="productId"
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  Producto *
                </label>
                <select
                  id="productId"
                  name="productId"
                  value={formData.productId}
                  onChange={e => handleProductChange(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecciona un producto</option>
                  {stock.map(item => {
                    const product =
                      typeof item.product === "object" ? item.product : null;
                    return (
                      <option key={item._id} value={product?._id}>
                        {product?.name} | Stock: {item.quantity} | Tu precio: {formatCurrency(product?.distributorPrice || 0)} | Venta sugerida: {formatCurrency(product?.clientPrice || 0)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedProduct &&
                typeof selectedProduct.product === "object" && (
                  <div className="rounded-lg border border-blue-500/30 bg-blue-900/10 p-4">
                    <h3 className="mb-2 font-semibold text-white">
                      {selectedProduct.product.name}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Stock disponible:</p>
                        <p className="text-lg font-bold text-blue-400">
                          {selectedProduct.quantity} unidades
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Tu precio de compra:</p>
                        <p className="text-lg font-bold text-white">
                          {formatCurrency(
                            selectedProduct.product.distributorPrice
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Precio sugerido:</p>
                        <p className="text-lg font-bold text-green-400">
                          {formatCurrency(
                            selectedProduct.product.clientPrice || 0
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Ganancia sugerida:</p>
                        <p className="text-lg font-bold text-purple-400">
                          {formatCurrency(
                            (selectedProduct.product.clientPrice || 0) -
                              selectedProduct.product.distributorPrice
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="quantity"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    min="1"
                    max={selectedProduct?.quantity || 999}
                    required
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {selectedProduct && (
                    <p className="mt-1 text-xs text-gray-500">
                      Máximo disponible: {selectedProduct.quantity}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="salePrice"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Precio de Venta (unitario) *
                  </label>
                  <input
                    type="number"
                    id="salePrice"
                    name="salePrice"
                    value={formData.salePrice}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    required
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Precio por unidad
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="paymentProof"
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  Comprobante de Transferencia
                </label>
                <div className="space-y-3">
                  {!imagePreview ? (
                    <div className="relative">
                      <input
                        type="file"
                        id="paymentProof"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="paymentProof"
                        className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-600 bg-gray-900/50 px-6 py-8 transition hover:border-blue-500 hover:bg-gray-900/70"
                      >
                        <div className="text-center">
                          <svg
                            className="mx-auto h-12 w-12 text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <p className="mt-2 text-sm text-gray-400">
                            Click para subir captura de transferencia
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            PNG, JPG hasta 5MB
                          </p>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="relative rounded-lg border border-gray-600 bg-gray-900/50 p-4">
                      <img
                        src={imagePreview}
                        alt="Comprobante"
                        className="mx-auto max-h-64 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white hover:bg-red-600"
                      >
                        <svg
                          className="h-5 w-5"
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
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Opcional: Sube una captura de la transferencia bancaria para
                    verificación
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  Notas (opcional)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Cliente, método de pago, etc."
                />
              </div>
            </div>
          </div>

          {/* Sale Summary */}
          {selectedProduct &&
            formData.quantity > 0 &&
            formData.salePrice > 0 && (
              <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-purple-900/30 to-blue-900/30 p-6">
                <h2 className="mb-4 text-lg font-semibold text-white">
                  Resumen de la Venta
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-300">
                    <span>Cantidad:</span>
                    <span className="font-semibold">
                      {formData.quantity} unidades
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Precio unitario:</span>
                    <span className="font-semibold">
                      {formatCurrency(formData.salePrice)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-600 pt-3 text-lg">
                    <span className="font-semibold text-white">
                      Total venta:
                    </span>
                    <span className="font-bold text-green-400">
                      {formatCurrency(formData.salePrice * formData.quantity)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold text-white">
                      Tu ganancia:
                    </span>
                    <span className="font-bold text-purple-400">
                      {formatCurrency(calculateProfit())}
                    </span>
                  </div>
                </div>
              </div>
            )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              type="button"
              onClick={() => navigate("/distributor/dashboard")}
              className="flex-1 bg-gray-700 hover:bg-gray-600"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.productId}
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50"
            >
              {loading ? "Registrando..." : "Registrar Venta"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
