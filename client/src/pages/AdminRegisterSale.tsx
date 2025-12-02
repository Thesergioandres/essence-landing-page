import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { productService, saleService, authService } from "../api/services";
import { Button } from "../components/Button";
import type { Product } from "../types";

interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  salePrice: number;
  purchasePrice: number;
  clientPrice: number;
}

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
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
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
      setProducts(response.data || response);
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

  const handleAddItem = () => {
    setError("");
    
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

    const newItem: SaleItem = {
      id: Date.now().toString(),
      productId: formData.productId,
      productName: selectedProduct.name,
      quantity: formData.quantity,
      salePrice: formData.salePrice,
      purchasePrice: selectedProduct.purchasePrice,
      clientPrice: selectedProduct.clientPrice || 0,
    };

    setSaleItems(prev => [...prev, newItem]);
    
    // Limpiar solo los campos del producto
    setFormData(prev => ({
      ...prev,
      productId: "",
      quantity: 1,
      salePrice: 0,
    }));
    setSelectedProduct(null);
  };

  const handleRemoveItem = (id: string) => {
    setSaleItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (saleItems.length === 0) {
      setError("Agrega al menos un producto al pedido");
      return;
    }

    if (saleItems.length === 0) {
      setError("Agrega al menos un producto al pedido");
      return;
    }

    try {
      setLoading(true);
      const user = authService.getCurrentUser();
      
      // Registrar cada venta del pedido
      for (const item of saleItems) {
        if (user && user.role === "admin") {
          await saleService.registerAdmin({
            productId: item.productId,
            quantity: item.quantity,
            salePrice: item.salePrice,
            notes: formData.notes,
            saleDate: formData.saleDate,
          });
        } else {
          await saleService.register({
            productId: item.productId,
            quantity: item.quantity,
            salePrice: item.salePrice,
            notes: formData.notes,
            saleDate: formData.saleDate,
          });
        }
      }
      
      setSuccess(`¡${saleItems.length} ${saleItems.length === 1 ? 'venta registrada' : 'ventas registradas'} exitosamente!`);
      
      // Limpiar todo
      setSaleItems([]);
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
      
      // Opción de volver al dashboard después de 2 segundos
      setTimeout(() => {
        setSuccess(prev => prev + " Redirigiendo al dashboard...");
        setTimeout(() => navigate("/dashboard"), 1000);
      }, 2000);
    } catch {
      setError("Error al registrar las ventas");
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const totalSale = saleItems.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
    const totalProfit = saleItems.reduce((sum, item) => sum + ((item.salePrice - item.purchasePrice) * item.quantity), 0);
    return { totalSale, totalProfit };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const totals = calculateTotals();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-white">Registrar Pedido Grande (Admin)</h1>
        <p className="mt-2 text-gray-400">Registra múltiples ventas en un solo pedido</p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500 bg-green-500/10 p-4 text-sm text-green-400">{success}</div>
      )}
      
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario para agregar productos */}
        <div className="space-y-6">
          <form onSubmit={(e) => { e.preventDefault(); handleAddItem(); }} className="space-y-6">
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Agregar Producto</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="productId" className="mb-2 block text-sm font-medium text-gray-300">Producto *</label>
                  <select
                    id="productId"
                    name="productId"
                    value={formData.productId}
                    onChange={e => handleProductChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecciona un producto</option>
                    {products.map(product => (
                      <option key={product._id} value={product._id}>
                        {product.name} | Compra: {formatCurrency(product.purchasePrice)} | Cliente: {formatCurrency(product.clientPrice || 0)}
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
                        <p className="font-bold text-white">{formatCurrency(selectedProduct.purchasePrice)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Precio sugerido:</p>
                        <p className="font-bold text-green-400">{formatCurrency(selectedProduct.clientPrice || 0)}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="quantity" className="mb-2 block text-sm font-medium text-gray-300">Cantidad *</label>
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleChange}
                      min="1"
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="salePrice" className="mb-2 block text-sm font-medium text-gray-300">Precio Unitario *</label>
                    <input
                      type="number"
                      id="salePrice"
                      name="salePrice"
                      value={formData.salePrice}
                      onChange={handleChange}
                      min="0"
                      step="1"
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            <Button 
              type="submit" 
              disabled={!formData.productId} 
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              ➕ Agregar al Pedido
            </Button>
          </form>
        </div>

        {/* Lista de productos agregados */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Productos en el Pedido ({saleItems.length})
            </h2>
            {saleItems.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No hay productos agregados</p>
            ) : (
              <div className="space-y-3">
                {saleItems.map(item => (
                  <div key={item.id} className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-white">{item.productName}</h3>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-400">Cantidad:</p>
                        <p className="text-white">{item.quantity} uds</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Precio unit:</p>
                        <p className="text-white">{formatCurrency(item.salePrice)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Subtotal:</p>
                        <p className="font-bold text-green-400">{formatCurrency(item.salePrice * item.quantity)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Ganancia:</p>
                        <p className="font-bold text-blue-400">{formatCurrency((item.salePrice - item.purchasePrice) * item.quantity)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totales del pedido */}
          {saleItems.length > 0 && (
            <div className="rounded-xl border border-gray-700 bg-gradient-to-br from-purple-900/30 to-blue-900/30 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Resumen del Pedido</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-lg">
                  <span className="font-semibold text-white">Total venta:</span>
                  <span className="font-bold text-green-400">{formatCurrency(totals.totalSale)}</span>
                </div>
                <div className="flex justify-between text-lg border-t border-gray-600 pt-3">
                  <span className="font-semibold text-white">Ganancia total:</span>
                  <span className="font-bold text-blue-400">{formatCurrency(totals.totalProfit)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Información general del pedido */}
      {saleItems.length > 0 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Información del Pedido</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="saleDate" className="mb-2 block text-sm font-medium text-gray-300">Fecha del pedido *</label>
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
                <label htmlFor="notes" className="mb-2 block text-sm font-medium text-gray-300">Notas (opcional)</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={1}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Cliente, método de pago, etc."
                />
              </div>
            </div>
          </div>
          
          {/* Botones de acción */}
          <div className="flex gap-4">
            <Button 
              type="button" 
              onClick={() => navigate("/dashboard")} 
              className="flex-1 bg-gray-700 hover:bg-gray-600"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || saleItems.length === 0} 
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
            >
              {loading ? "Registrando..." : `✓ Confirmar Pedido (${saleItems.length} ${saleItems.length === 1 ? 'venta' : 'ventas'})`}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
