import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { productService, saleService, authService } from "../api/services";
import { Button } from "../components/Button";
import type { Product } from "../types";

interface FormState {
  productId: string;
  quantity: number;
  salePrice: number;
  notes: string;
  saleDate: string;
}

export default function AdminRegisterSale() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState<FormState>({
    productId: "",
    quantity: 1,
    salePrice: 0,
    notes: "",
    saleDate: new Date().toISOString().slice(0, 10),
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await productService.getAll();
      setProducts(response);
    } catch {
      setError("No se pudo cargar los productos");
    }
  };

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p._id === productId);
    setSelectedProduct(product || null);
    setFormData(prev => ({
      ...prev,
      productId,
      quantity: 1,
      salePrice: product?.clientPrice || 0,
    }));
    setError("");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "quantity" || name === "salePrice" ? Number(value) : value,
    }));
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
    if (!selectedProduct) {
      setError("Producto no válido");
      return;
    }
    if (formData.salePrice <= 0) {
      setError("El precio de venta debe ser mayor a 0");
      return;
    }
    if (formData.salePrice < selectedProduct.purchasePrice) {
      setError("El precio de venta no puede ser menor al precio de compra");
      return;
    }

    try {
      setLoading(true);
      const user = authService.getCurrentUser();
      if (user && user.role === "admin") {
        await saleService.registerAdmin({
          productId: formData.productId,
          quantity: formData.quantity,
          salePrice: formData.salePrice,
          notes: formData.notes,
          saleDate: formData.saleDate,
        });
      } else {
        await saleService.register({
          productId: formData.productId,
          quantity: formData.quantity,
          salePrice: formData.salePrice,
          notes: formData.notes,
          saleDate: formData.saleDate,
        });
      }
      setSuccess("¡Venta registrada exitosamente! Puedes registrar otra venta o ir a ver las ventas.");
      
      // Limpiar formulario para permitir registrar otra venta
      setFormData({
        productId: "",
        quantity: 1,
        salePrice: 0,
        notes: "",
        saleDate: new Date().toISOString().slice(0, 10),
      });
      setSelectedProduct(null);
      
      // Recargar productos para actualizar stock
      await loadProducts();
    } catch {
      setError("Error al registrar la venta");
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-white">Registrar Venta (Admin)</h1>
        <p className="mt-2 text-gray-400">Registra una venta directa como administrador</p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500 bg-green-500/10 p-4 text-sm text-green-400">{success}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Información de la Venta</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="saleDate" className="mb-2 block text-sm font-medium text-gray-300">Fecha de la venta *</label>
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
              <label htmlFor="productId" className="mb-2 block text-sm font-medium text-gray-300">Producto *</label>
              <select
                id="productId"
                name="productId"
                value={formData.productId}
                onChange={e => handleProductChange(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona un producto</option>
                {products.map(product => (
                  <option key={product._id} value={product._id}>
                    {product.name} - {formatCurrency(product.clientPrice || 0)}
                  </option>
                ))}
              </select>
            </div>
            {selectedProduct && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-900/10 p-4">
                <h3 className="mb-2 font-semibold text-white">{selectedProduct.name}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Precio de compra:</p>
                    <p className="text-lg font-bold text-white">{formatCurrency(selectedProduct.purchasePrice)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Precio sugerido:</p>
                    <p className="text-lg font-bold text-green-400">{formatCurrency(selectedProduct.clientPrice || 0)}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="quantity" className="mb-2 block text-sm font-medium text-gray-300">Cantidad *</label>
                <input
                  type="number"
                  id="quantity"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  required
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="salePrice" className="mb-2 block text-sm font-medium text-gray-300">Precio de Venta (unitario) *</label>
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
                <p className="mt-1 text-xs text-gray-500">Precio por unidad</p>
              </div>
            </div>
            <div>
              <label htmlFor="notes" className="mb-2 block text-sm font-medium text-gray-300">Notas (opcional)</label>
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
        {selectedProduct && formData.quantity > 0 && formData.salePrice > 0 && (
          <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-purple-900/30 to-blue-900/30 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Resumen de la Venta</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-gray-300">
                <span>Cantidad:</span>
                <span className="font-semibold">{formData.quantity} unidades</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Precio unitario:</span>
                <span className="font-semibold">{formatCurrency(formData.salePrice)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-600 pt-3 text-lg">
                <span className="font-semibold text-white">Total venta:</span>
                <span className="font-bold text-green-400">{formatCurrency(formData.salePrice * formData.quantity)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-semibold text-white">Ganancia admin:</span>
                <span className="font-bold text-blue-400">{formatCurrency((formData.salePrice - (selectedProduct?.purchasePrice || 0)) * formData.quantity)}</span>
              </div>
            </div>
          </div>
        )}
        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button type="button" onClick={() => navigate("/dashboard")} className="flex-1 bg-gray-700 hover:bg-gray-600">Cancelar</Button>
          <Button type="submit" disabled={loading || !formData.productId} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50">{loading ? "Registrando..." : "Registrar Venta"}</Button>
        </div>
      </form>
    </div>
  );
}
