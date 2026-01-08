import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  authService,
  branchService,
  productService,
  saleService,
} from "../api/services";
import { Button } from "../components/Button";
import PointsRedemption from "../components/PointsRedemption";
import ProductSelector from "../components/ProductSelector";
import { useBusiness } from "../context/BusinessContext";
import type { Branch, Customer, Product } from "../types";

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
  branchId: string;
  paymentType: "cash" | "credit";
  customerId: string;
  creditDueDate: string;
  initialPayment: number;
}

export default function AdminRegisterSale() {
  const {
    businessId,
    hydrating: businessHydrating,
    loading: businessLoading,
  } = useBusiness();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [formData, setFormData] = useState<FormState>({
    productId: "",
    quantity: 1,
    salePrice: 0,
    notes: "",
    saleDate: new Date().toISOString().slice(0, 10),
    branchId: "",
    paymentType: "cash",
    customerId: "",
    creditDueDate: "",
    initialPayment: 0,
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!businessId || businessHydrating || businessLoading) return;
    void Promise.all([loadProducts(), loadBranches(), loadCustomers()]);
  }, [businessId, businessHydrating, businessLoading]);

  const loadProducts = async () => {
    try {
      if (!businessId) return;
      const response = await productService.getAll();
      setProducts(response.data || response);
    } catch {
      setError(
        "No se pudo cargar los productos. Verifica el negocio seleccionado."
      );
    }
  };

  const loadBranches = async () => {
    try {
      if (!businessId) return;
      const response = await branchService.list();
      setBranches(Array.isArray(response) ? response : []);
    } catch {
      setError(
        "No se pudieron cargar las sedes. Verifica el negocio seleccionado."
      );
    }
  };

  const loadCustomers = async () => {
    try {
      if (!businessId) return;
      const { data } = await api.get<{ customers: Customer[] }>("/customers");
      setCustomers(data.customers || []);
    } catch {
      console.error("No se pudieron cargar los clientes");
    }
  };

  const handleCustomerChange = (customerId: string) => {
    if (!customerId) {
      setSelectedCustomer(null);
      setPointsToRedeem(0);
      setFormData(prev => ({ ...prev, customerId: "" }));
      return;
    }
    const customer = customers.find(c => c._id === customerId);
    setSelectedCustomer(customer || null);
    setPointsToRedeem(0);
    setFormData(prev => ({ ...prev, customerId }));
  };

  const handlePointsRedemption = (data: {
    points: number;
    discountAmount: number;
  }) => {
    setPointsToRedeem(data.points);
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
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]:
        name === "quantity" || name === "salePrice" ? Number(value) : value,
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

  const handleUpdateItem = (
    id: string,
    field: "salePrice" | "quantity",
    value: number
  ) => {
    setSaleItems(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (saleItems.length === 0) {
      setError("Agrega al menos un producto al pedido");
      return;
    }

    // Validar campos de crédito
    if (formData.paymentType === "credit") {
      if (!formData.customerId) {
        setError("Debes seleccionar un cliente para ventas a crédito");
        return;
      }
      if (!formData.creditDueDate) {
        setError("Debes indicar la fecha de vencimiento del crédito");
        return;
      }
    }

    try {
      setLoading(true);
      const user = authService.getCurrentUser();

      // Registrar cada venta del pedido
      for (const item of saleItems) {
        if (
          user &&
          (user.role === "admin" ||
            user.role === "super_admin" ||
            user.role === "god")
        ) {
          await saleService.registerAdmin({
            productId: item.productId,
            quantity: item.quantity,
            salePrice: item.salePrice,
            branchId: formData.branchId || undefined,
            notes: formData.notes,
            saleDate: formData.saleDate,
            paymentType: formData.paymentType,
            customerId:
              formData.paymentType === "credit"
                ? formData.customerId
                : undefined,
            creditDueDate:
              formData.paymentType === "credit"
                ? formData.creditDueDate
                : undefined,
            initialPayment:
              formData.paymentType === "credit" && formData.initialPayment > 0
                ? formData.initialPayment
                : undefined,
          });
        } else {
          await saleService.register({
            productId: item.productId,
            quantity: item.quantity,
            salePrice: item.salePrice,
            branchId: formData.branchId || undefined,
            notes: formData.notes,
            saleDate: formData.saleDate,
          });
        }
      }

      setSuccess(
        `¡${saleItems.length} ${saleItems.length === 1 ? "venta registrada" : "ventas registradas"} exitosamente!`
      );

      // Limpiar todo
      setSaleItems([]);
      setFormData({
        productId: "",
        quantity: 1,
        salePrice: 0,
        paymentType: "cash",
        customerId: "",
        creditDueDate: "",
        initialPayment: 0,
        notes: "",
        saleDate: new Date().toISOString().slice(0, 10),
        branchId: formData.branchId,
      });
      setSelectedProduct(null);

      // Recargar productos para actualizar stock
      await loadProducts();

      // Opción de volver al dashboard después de 2 segundos
      setTimeout(() => {
        setSuccess(prev => prev + " Redirigiendo al dashboard...");
        setTimeout(() => navigate("/admin/dashboard"), 1000);
      }, 2000);
    } catch (err) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr.response?.data?.message;
      setError(msg || "Error al registrar las ventas");
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const totalSale = saleItems.reduce(
      (sum, item) => sum + item.salePrice * item.quantity,
      0
    );
    const totalProfit = saleItems.reduce(
      (sum, item) =>
        sum + (item.salePrice - item.purchasePrice) * item.quantity,
      0
    );
    // Calcular descuento de puntos (cada punto = $0.01 por defecto)
    const pointsDiscount = pointsToRedeem * 0.01;
    const finalTotal = Math.max(0, totalSale - pointsDiscount);
    return { totalSale, totalProfit, pointsDiscount, finalTotal };
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
        <h1 className="text-4xl font-bold text-white">
          Registrar Pedido Grande (Admin)
        </h1>
        <p className="mt-2 text-gray-400">
          Registra múltiples ventas en un solo pedido
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario para agregar productos */}
        <div className="space-y-6">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleAddItem();
            }}
            className="space-y-6"
          >
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Agregar Producto
              </h2>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="productId"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Producto *
                  </label>
                  <ProductSelector
                    value={formData.productId}
                    onChange={(productId, _product) => {
                      handleProductChange(productId);
                    }}
                    placeholder="Buscar producto..."
                    showStock={true}
                  />
                </div>
                {selectedProduct && (
                  <div className="rounded-lg border border-blue-500/30 bg-blue-900/10 p-4">
                    <h3 className="mb-2 font-semibold text-white">
                      {selectedProduct.name}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Precio de compra:</p>
                        <p className="font-bold text-white">
                          {formatCurrency(selectedProduct.purchasePrice)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Precio sugerido:</p>
                        <p className="font-bold text-green-400">
                          {formatCurrency(selectedProduct.clientPrice || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
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
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="salePrice"
                      className="mb-2 block text-sm font-medium text-gray-300"
                    >
                      Precio Unitario *
                    </label>
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
              <p className="py-8 text-center text-gray-500">
                No hay productos agregados
              </p>
            ) : (
              <div className="space-y-3">
                {saleItems.map(item => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-gray-700 bg-gray-900/50 p-4"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="font-semibold text-white">
                        {item.productName}
                      </h3>
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
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e =>
                            handleUpdateItem(
                              item.id,
                              "quantity",
                              Number(e.target.value) || 1
                            )
                          }
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-white focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <p className="text-gray-400">Precio unit:</p>
                        <input
                          type="number"
                          min="0"
                          value={item.salePrice}
                          onChange={e =>
                            handleUpdateItem(
                              item.id,
                              "salePrice",
                              Number(e.target.value) || 0
                            )
                          }
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-white focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <p className="text-gray-400">Subtotal:</p>
                        <p className="font-bold text-green-400">
                          {formatCurrency(item.salePrice * item.quantity)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Ganancia:</p>
                        <p className="font-bold text-blue-400">
                          {formatCurrency(
                            (item.salePrice - item.purchasePrice) *
                              item.quantity
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totales del pedido */}
          {saleItems.length > 0 && (
            <div className="bg-linear-to-br rounded-xl border border-gray-700 from-purple-900/30 to-blue-900/30 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Resumen del Pedido
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-lg">
                  <span className="font-semibold text-white">Subtotal:</span>
                  <span className="font-bold text-green-400">
                    {formatCurrency(totals.totalSale)}
                  </span>
                </div>
                {totals.pointsDiscount > 0 && (
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold text-amber-400">
                      Descuento por puntos ({pointsToRedeem} pts):
                    </span>
                    <span className="font-bold text-amber-400">
                      -{formatCurrency(totals.pointsDiscount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-600 pt-3 text-lg">
                  <span className="font-semibold text-white">
                    Total a pagar:
                  </span>
                  <span className="font-bold text-green-400">
                    {formatCurrency(totals.finalTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="font-semibold text-white">
                    Ganancia total:
                  </span>
                  <span className="font-bold text-blue-400">
                    {formatCurrency(totals.totalProfit)}
                  </span>
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
            <h2 className="mb-4 text-lg font-semibold text-white">
              Información del Pedido
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="branchId"
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  Sede (opcional)
                </label>
                <select
                  id="branchId"
                  name="branchId"
                  value={formData.branchId || ""}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {branches.map(branch => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-400">
                  Deja sin seleccionar para usar el stock general. Solo se
                  muestran sedes/bodegas reales.
                </p>
              </div>
              <div>
                <label
                  htmlFor="saleDate"
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  Fecha del pedido *
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
                  htmlFor="paymentType"
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  Tipo de Pago *
                </label>
                <select
                  id="paymentType"
                  name="paymentType"
                  value={formData.paymentType}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Contado (Efectivo/Transferencia)</option>
                  <option value="credit">A Crédito (Fiado)</option>
                </select>
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
                  rows={1}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Cliente, método de pago, etc."
                />
              </div>
            </div>

            {/* Campos de crédito (solo si es a crédito) */}
            {formData.paymentType === "credit" && (
              <div className="mt-4 rounded-lg border border-orange-500/30 bg-orange-900/10 p-4">
                <h3 className="mb-3 text-sm font-semibold text-orange-400">
                  ⚠️ Información de Crédito
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="creditCustomerId"
                      className="mb-2 block text-sm font-medium text-gray-300"
                    >
                      Cliente * (Requerido para crédito)
                    </label>
                    <select
                      id="creditCustomerId"
                      value={formData.customerId}
                      onChange={e => {
                        handleCustomerChange(e.target.value);
                      }}
                      required={formData.paymentType === "credit"}
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Selecciona un cliente</option>
                      {customers.map(customer => (
                        <option key={customer._id} value={customer._id}>
                          {customer.name}
                          {customer.phone && ` - ${customer.phone}`}
                          {customer.totalDebt && customer.totalDebt > 0
                            ? ` (Deuda: ${formatCurrency(customer.totalDebt)})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="creditDueDate"
                      className="mb-2 block text-sm font-medium text-gray-300"
                    >
                      Fecha de vencimiento *
                    </label>
                    <input
                      type="date"
                      id="creditDueDate"
                      name="creditDueDate"
                      value={formData.creditDueDate}
                      onChange={handleChange}
                      required={formData.paymentType === "credit"}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label
                      htmlFor="initialPayment"
                      className="mb-2 block text-sm font-medium text-gray-300"
                    >
                      Abono inicial (opcional)
                    </label>
                    <input
                      type="number"
                      id="initialPayment"
                      name="initialPayment"
                      value={formData.initialPayment}
                      onChange={handleChange}
                      min="0"
                      step="100"
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Si el cliente realizó un pago parcial al momento de la
                      venta (máx: {formatCurrency(totals.totalSale)})
                    </p>
                    {formData.paymentType === "credit" && (
                      <div className="mt-2 rounded-lg border border-orange-500/30 bg-orange-900/20 px-3 py-2">
                        <p className="text-sm font-semibold text-orange-300">
                          💳 Monto del crédito a crear:{" "}
                          {formatCurrency(
                            totals.totalSale - (formData.initialPayment || 0)
                          )}
                        </p>
                        <p className="text-xs text-orange-400/80">
                          Total: {formatCurrency(totals.totalSale)} - Abono:{" "}
                          {formatCurrency(formData.initialPayment || 0)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-1">
              {formData.paymentType === "cash" && (
                <div>
                  <label
                    htmlFor="customerId"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Cliente (opcional - para acumular/canjear puntos)
                  </label>
                  <select
                    id="customerId"
                    value={selectedCustomer?._id || ""}
                    onChange={e => handleCustomerChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin cliente asociado</option>
                    {customers.map(customer => (
                      <option key={customer._id} value={customer._id}>
                        {customer.name}{" "}
                        {customer.phone ? `(${customer.phone})` : ""} -{" "}
                        {customer.points || 0} pts
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Sección de puntos si hay cliente seleccionado */}
            {selectedCustomer && businessId && (
              <div className="mt-6 border-t border-gray-700 pt-6">
                <PointsRedemption
                  customerId={selectedCustomer._id}
                  businessId={businessId}
                  saleTotal={totals.totalSale}
                  onRedemptionChange={handlePointsRedemption}
                />
              </div>
            )}
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
              className="bg-linear-to-r flex-1 from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
            >
              {loading
                ? "Registrando..."
                : `✓ Confirmar Pedido (${saleItems.length} ${saleItems.length === 1 ? "venta" : "ventas"})`}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
