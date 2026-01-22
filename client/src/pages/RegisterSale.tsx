import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import {
  authService,
  customerService,
  deliveryMethodService,
  paymentMethodService,
  productService,
  saleService,
  stockService,
  type DeliveryMethod,
  type PaymentMethod,
} from "../api/services";
import { Button } from "../components/Button";
import CustomerSelector from "../components/CustomerSelector";
import type { DistributorStock, Product } from "../types";

interface SaleItem {
  productId: string;
  product: Product;
  quantity: number;
  salePrice: number;
  availableStock: number;
  profitPercentage?: number;
  sourceBranchId?: string; // Bodega de origen (si aplica)
}

interface CustomerData {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  totalDebt?: number;
}

interface AllowedBranch {
  _id: string;
  name: string;
  address?: string;
  isWarehouse?: boolean;
  stock: Array<{
    product: {
      _id: string;
      name: string;
      image?: string;
      clientPrice?: number;
      distributorPrice?: number;
    };
    quantity: number;
  }>;
  totalProducts: number;
  totalUnits: number;
}

interface AdditionalCost {
  id: string;
  type: "warranty" | "gift" | "other";
  description: string;
  amount: number;
}

interface FormState {
  notes: string;
  paymentProof: string | null;
  saleDate: string;
  paymentMethodId: string;
  deliveryMethodId: string;
  shippingCost: number;
  deliveryAddress: string;
  customerId: string;
  creditDueDate: string;
  initialPayment: number;
  discount: number;
}

export default function RegisterSale() {
  const navigate = useNavigate();
  const [stock, setStock] = useState<DistributorStock[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] =
    useState<DeliveryMethod | null>(null);
  const [formData, setFormData] = useState<FormState>({
    notes: "",
    paymentProof: null,
    saleDate: new Date().toISOString().slice(0, 10),
    paymentMethodId: "",
    deliveryMethodId: "",
    shippingCost: 0,
    deliveryAddress: "",
    customerId: "",
    creditDueDate: "",
    initialPayment: 0,
    discount: 0,
  });
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStock, setLoadingStock] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Nuevos estados para fuente de inventario
  const [allowedBranches, setAllowedBranches] = useState<AllowedBranch[]>([]);
  const [selectedSource, setSelectedSource] = useState<"own" | string>("own"); // "own" = inventario propio, o branchId

  useEffect(() => {
    loadStock();
    loadCustomers();
    loadAllowedBranches();
    loadPaymentMethods();
    loadDeliveryMethods();
  }, []);

  const loadAllowedBranches = async () => {
    try {
      const response = await stockService.getMyAllowedBranches();
      setAllowedBranches(response.branches || []);
    } catch (error) {
      console.error("Error al cargar bodegas permitidas:", error);
      // No mostramos error porque no es crítico
    }
  };

  const loadStock = async () => {
    try {
      setLoadingStock(true);
      const response = await stockService.getDistributorStock("me");
      setStock(response.filter(item => item.quantity > 0));
    } catch (error) {
      console.error("Error al cargar inventario:", error);
      setError("No se pudo cargar el inventario");
    } finally {
      setLoadingStock(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await customerService.getAll();
      setCustomers(response.customers || []);
    } catch (error) {
      console.error("Error al cargar clientes:", error);
      // No mostramos error porque no es crítico
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const { paymentMethods: methods } = await paymentMethodService.getAll();
      const activeMethods = methods.filter(m => m.isActive);
      setPaymentMethods(activeMethods);

      // Seleccionar el primer método por defecto (usualmente Efectivo)
      if (activeMethods.length > 0 && !formData.paymentMethodId) {
        const defaultMethod =
          activeMethods.find(m => m.code === "cash") || activeMethods[0];
        setFormData(prev => ({
          ...prev,
          paymentMethodId: defaultMethod._id,
        }));
        setSelectedPaymentMethod(defaultMethod);
      }
    } catch (error) {
      console.error("No se pudieron cargar los métodos de pago", error);
    }
  };

  const handlePaymentMethodChange = (methodId: string) => {
    const method = paymentMethods.find(m => m._id === methodId);
    setSelectedPaymentMethod(method || null);
    setFormData(prev => ({
      ...prev,
      paymentMethodId: methodId,
      // Limpiar datos de crédito si cambia a método no-crédito
      ...(method && !method.isCredit
        ? { customerId: "", creditDueDate: "", initialPayment: 0 }
        : {}),
    }));
  };

  const loadDeliveryMethods = async () => {
    try {
      const { deliveryMethods: methods } = await deliveryMethodService.getAll();
      const activeMethods = methods.filter((m: DeliveryMethod) => m.isActive);
      setDeliveryMethods(activeMethods);

      // Seleccionar el primer método por defecto (usualmente Portería)
      if (activeMethods.length > 0 && !formData.deliveryMethodId) {
        const defaultMethod =
          activeMethods.find((m: DeliveryMethod) => m.code === "porteria") ||
          activeMethods[0];
        setFormData(prev => ({
          ...prev,
          deliveryMethodId: defaultMethod._id,
          shippingCost: defaultMethod.defaultCost || 0,
        }));
        setSelectedDeliveryMethod(defaultMethod);
      }
    } catch {
      console.error("No se pudieron cargar los métodos de entrega");
    }
  };

  const handleDeliveryMethodChange = (methodId: string) => {
    const method = deliveryMethods.find(m => m._id === methodId);
    setSelectedDeliveryMethod(method || null);
    setFormData(prev => ({
      ...prev,
      deliveryMethodId: methodId,
      shippingCost: method?.defaultCost || 0,
      // Limpiar dirección si el método no requiere dirección
      ...(method && !method.requiresAddress ? { deliveryAddress: "" } : {}),
    }));
  };

  // Obtener stock disponible según la fuente seleccionada
  const getAvailableStock = () => {
    if (selectedSource === "own") {
      return stock
        .filter(item => item.quantity > 0)
        .map(item => ({
          productId:
            typeof item.product === "object" ? item.product._id : item.product,
          product: typeof item.product === "object" ? item.product : null,
          quantity: item.quantity,
          sourceBranchId: undefined,
        }))
        .filter(item => item.product !== null);
    } else {
      // Buscar la bodega seleccionada
      const branch = allowedBranches.find(b => b._id === selectedSource);
      if (!branch) return [];
      return branch.stock.map(item => ({
        productId: item.product._id,
        product: item.product as Product,
        quantity: item.quantity,
        sourceBranchId: branch._id,
      }));
    }
  };

  const addItem = async () => {
    if (!selectedProductId) {
      setError("Selecciona un producto");
      return;
    }

    const availableStock = getAvailableStock();
    const stockItem = availableStock.find(
      item => item.productId === selectedProductId
    );

    if (!stockItem || !stockItem.product) {
      setError("Producto no encontrado en el inventario seleccionado");
      return;
    }

    // Verificar si ya está agregado (mismo producto Y misma fuente)
    if (
      items.some(
        item =>
          item.productId === selectedProductId &&
          item.sourceBranchId === stockItem.sourceBranchId
      )
    ) {
      setError("Este producto ya está en la lista");
      return;
    }

    try {
      // Obtener precio dinámico según ranking
      const currentUser = authService.getCurrentUser();
      let profitPercentage = 20; // Default

      if (currentUser) {
        try {
          const pricing = await productService.getDistributorPrice(
            selectedProductId,
            currentUser._id
          );
          profitPercentage = pricing.profitPercentage;
        } catch (err) {
          console.error("Error obteniendo precio dinámico:", err);
        }
      }

      const newItem: SaleItem = {
        productId: selectedProductId,
        product: stockItem.product as Product,
        quantity: 1,
        salePrice: (stockItem.product as Product).clientPrice || 0,
        availableStock: stockItem.quantity,
        profitPercentage,
        sourceBranchId: stockItem.sourceBranchId,
      };

      setItems([...items, newItem]);
      setSelectedProductId("");
      setError("");
    } catch {
      setError("Error al agregar el producto");
    }
  };

  const removeItem = (productId: string, sourceBranchId?: string) => {
    setItems(
      items.filter(
        item =>
          !(
            item.productId === productId &&
            item.sourceBranchId === sourceBranchId
          )
      )
    );
  };

  const updateItemQuantity = (
    productId: string,
    quantity: number,
    sourceBranchId?: string
  ) => {
    setItems(
      items.map(item =>
        item.productId === productId && item.sourceBranchId === sourceBranchId
          ? {
              ...item,
              quantity: Math.max(1, Math.min(quantity, item.availableStock)),
            }
          : item
      )
    );
  };

  // Funciones para costos adicionales
  const handleAddCost = () => {
    const newCost: AdditionalCost = {
      id: Date.now().toString(),
      type: "warranty",
      description: "",
      amount: 0,
    };
    setAdditionalCosts(prev => [...prev, newCost]);
  };

  const handleRemoveCost = (id: string) => {
    setAdditionalCosts(prev => prev.filter(cost => cost.id !== id));
  };

  const handleUpdateCost = (
    id: string,
    field: keyof Omit<AdditionalCost, "id">,
    value: string | number
  ) => {
    setAdditionalCosts(prev =>
      prev.map(cost => (cost.id === id ? { ...cost, [field]: value } : cost))
    );
  };

  const calculateTotal = () => {
    return items.reduce(
      (total, item) => total + item.salePrice * item.quantity,
      0
    );
  };

  const calculateTotalProfit = () => {
    return items.reduce((total, item) => {
      const profit = (item.salePrice * (item.profitPercentage || 20)) / 100;
      return total + profit * item.quantity;
    }, 0);
  };

  const calculateTotalPayment = () => {
    return items.reduce((total, item) => {
      const payment =
        (item.salePrice * (100 - (item.profitPercentage || 20))) / 100;
      return total + payment * item.quantity;
    }, 0);
  };

  const calculateTotalAdditionalCosts = () => {
    return additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
  };

  const calculateFinalTotal = () => {
    return Math.max(0, calculateTotal() - (formData.discount || 0));
  };

  const calculateNetProfit = () => {
    return (
      calculateTotalProfit() -
      calculateTotalAdditionalCosts() -
      (formData.shippingCost || 0)
    );
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCustomerChange = (
    customerId: string,
    customer?: CustomerData
  ) => {
    if (!customerId) {
      setFormData(prev => ({ ...prev, customerId: "" }));
      return;
    }
    // Si viene el objeto customer del CustomerSelector, agregarlo a la lista
    if (customer && !customers.find(c => c._id === customer._id)) {
      setCustomers(prev => [customer, ...prev]);
    }
    setFormData(prev => ({ ...prev, customerId }));
  };

  const handleCustomerCreated = (customer: CustomerData) => {
    // Agregar el nuevo cliente a la lista local
    setCustomers(prev => [customer, ...prev]);
    // Seleccionarlo automáticamente
    handleCustomerChange(customer._id, customer);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no debe superar 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setFormData(prev => ({ ...prev, paymentProof: base64String }));
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

    if (items.length === 0) {
      setError("Agrega al menos un producto");
      return;
    }

    // Determinar si es método de crédito
    const isCredit = selectedPaymentMethod?.isCredit ?? false;

    // Validar campos de crédito
    if (isCredit) {
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

      // Generar un saleGroupId único para agrupar todas las ventas del carrito
      const saleGroupId = uuidv4();

      // Registrar cada venta individualmente con el mismo saleGroupId
      for (const item of items) {
        const saleData: {
          productId: string;
          quantity: number;
          salePrice: number;
          notes?: string;
          saleDate?: string;
          paymentProof?: string;
          paymentProofMimeType?: string;
          paymentType?: string;
          paymentMethodId?: string;
          customerId?: string;
          creditDueDate?: string;
          initialPayment?: number;
          branchId?: string;
          deliveryMethodId?: string;
          shippingCost?: number;
          deliveryAddress?: string;
          additionalCosts?: Array<{
            type: string;
            description: string;
            amount: number;
          }>;
          discount?: number;
          saleGroupId?: string;
        } = {
          productId: item.productId,
          quantity: item.quantity,
          salePrice: item.salePrice,
          notes: formData.notes,
          saleDate: formData.saleDate,
          paymentMethodId: formData.paymentMethodId || undefined,
          paymentType: isCredit ? "credit" : "cash",
          deliveryMethodId: formData.deliveryMethodId || undefined,
          shippingCost: formData.shippingCost || undefined,
          deliveryAddress: formData.deliveryAddress || undefined,
          saleGroupId: saleGroupId,
          additionalCosts:
            additionalCosts.length > 0
              ? additionalCosts.map(c => ({
                  type: c.type,
                  description: c.description,
                  amount: c.amount,
                }))
              : undefined,
          discount: formData.discount || undefined,
        };

        // Si la venta es desde una bodega, agregar el branchId
        if (item.sourceBranchId) {
          saleData.branchId = item.sourceBranchId;
        }

        if (formData.paymentProof) {
          saleData.paymentProof = formData.paymentProof;
          saleData.paymentProofMimeType = "image/jpeg";
        }

        // Agregar campos de crédito si aplica
        if (isCredit) {
          saleData.customerId = formData.customerId;
          saleData.creditDueDate = formData.creditDueDate;
          if (formData.initialPayment > 0) {
            saleData.initialPayment = formData.initialPayment;
          }
        }

        await saleService.register(saleData);
      }

      setSuccess(`¡${items.length} venta(s) registrada(s) exitosamente!`);

      // Resetear formulario
      setItems([]);
      setAdditionalCosts([]);
      // Restaurar el método de pago por defecto
      const defaultMethod =
        paymentMethods.find(m => m.code === "cash") || paymentMethods[0];
      // Restaurar el método de entrega por defecto
      const defaultDelivery =
        deliveryMethods.find(m => m.code === "porteria") || deliveryMethods[0];
      setFormData({
        notes: "",
        paymentProof: null,
        saleDate: new Date().toISOString().slice(0, 10),
        paymentMethodId: defaultMethod?._id || "",
        deliveryMethodId: defaultDelivery?._id || "",
        shippingCost: defaultDelivery?.defaultCost || 0,
        deliveryAddress: "",
        customerId: "",
        creditDueDate: "",
        initialPayment: 0,
        discount: 0,
      });
      setSelectedPaymentMethod(defaultMethod || null);
      setSelectedDeliveryMethod(defaultDelivery || null);
      setImagePreview(null);
      setSelectedSource("own");

      // Recargar stock
      await loadStock();
      await loadAllowedBranches();

      // Redirigir después de 2 segundos
      setTimeout(() => {
        navigate("/distributor/sales");
      }, 2000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(
        error.response?.data?.message || "Error al registrar las ventas"
      );
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
    <div className="mx-auto max-w-4xl space-y-6 overflow-hidden">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white">Registrar Ventas</h1>
        <p className="mt-2 text-gray-400">
          Registra una o múltiples ventas de tus productos
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

      {stock.length === 0 && allowedBranches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-700 bg-gray-800/50 p-12 text-center">
          <svg
            className="h-16 w-16 text-gray-600"
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
          {/* Selector de Fuente de Inventario */}
          {allowedBranches.length > 0 && (
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
              <h2 className="mb-4 text-xl font-semibold text-white">
                Fuente del Inventario
              </h2>
              <p className="mb-4 text-sm text-gray-400">
                Selecciona desde dónde tomarás los productos para esta venta
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSource("own");
                    setSelectedProductId("");
                  }}
                  className={`rounded-lg px-4 py-3 font-medium transition-all ${
                    selectedSource === "own"
                      ? "bg-blue-600 text-white ring-2 ring-blue-400"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  <span className="flex items-center gap-2">
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
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    Mi Inventario
                    <span className="ml-1 rounded-full bg-black/20 px-2 py-0.5 text-xs">
                      {stock.filter(s => s.quantity > 0).length} productos
                    </span>
                  </span>
                </button>
                {allowedBranches.map(branch => (
                  <button
                    key={branch._id}
                    type="button"
                    onClick={() => {
                      setSelectedSource(branch._id);
                      setSelectedProductId("");
                    }}
                    className={`rounded-lg px-4 py-3 font-medium transition-all ${
                      selectedSource === branch._id
                        ? "bg-green-600 text-white ring-2 ring-green-400"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    <span className="flex items-center gap-2">
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
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                      {branch.name}
                      <span className="ml-1 rounded-full bg-black/20 px-2 py-0.5 text-xs">
                        {branch.totalProducts} productos
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Agregar Productos */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Agregar Productos
              {selectedSource !== "own" && (
                <span className="ml-2 text-sm font-normal text-green-400">
                  (desde{" "}
                  {allowedBranches.find(b => b._id === selectedSource)?.name})
                </span>
              )}
            </h2>

            <div className="flex gap-4">
              <div className="flex-1">
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecciona un producto</option>
                  {getAvailableStock()
                    .filter(
                      item =>
                        !items.some(
                          i =>
                            i.productId === item.productId &&
                            i.sourceBranchId === item.sourceBranchId
                        )
                    )
                    .map(item => (
                      <option key={item.productId} value={item.productId}>
                        {item.product?.name} | Stock: {item.quantity} |{" "}
                        {formatCurrency(item.product?.clientPrice || 0)}
                      </option>
                    ))}
                </select>
              </div>
              <Button
                type="button"
                onClick={addItem}
                disabled={!selectedProductId}
                className="whitespace-nowrap"
              >
                + Agregar
              </Button>
            </div>
          </div>

          {/* Lista de Productos */}
          {items.length > 0 && (
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
              <h2 className="mb-4 text-xl font-semibold text-white">
                Productos a Vender ({items.length})
              </h2>

              <div className="space-y-4">
                {items.map(item => (
                  <div
                    key={`${item.productId}-${item.sourceBranchId || "own"}`}
                    className={`rounded-lg border p-4 ${
                      item.sourceBranchId
                        ? "border-green-500/30 bg-green-900/10"
                        : "border-blue-500/30 bg-blue-900/10"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">
                              {item.product.name}
                            </h3>
                            {item.sourceBranchId && (
                              <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                                {
                                  allowedBranches.find(
                                    b => b._id === item.sourceBranchId
                                  )?.name
                                }
                              </span>
                            )}
                          </div>
                          {item.profitPercentage && (
                            <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-400">
                              {item.profitPercentage}% ganancia
                            </span>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-xs text-gray-400">
                              Cantidad (máx: {item.availableStock})
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={item.availableStock}
                              value={item.quantity === 0 ? "" : item.quantity}
                              onChange={e => {
                                const val = e.target.value;
                                // Permitir vacío temporalmente
                                setItems(items =>
                                  items.map(it =>
                                    it.productId === item.productId &&
                                    it.sourceBranchId === item.sourceBranchId
                                      ? {
                                          ...it,
                                          quantity:
                                            val === "" ? 0 : Number(val),
                                        }
                                      : it
                                  )
                                );
                              }}
                              onBlur={e => {
                                let val = Number(e.target.value);
                                if (isNaN(val) || val < 1) val = 1;
                                if (val > item.availableStock)
                                  val = item.availableStock;
                                updateItemQuantity(
                                  item.productId,
                                  val,
                                  item.sourceBranchId
                                );
                              }}
                              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs text-gray-400">
                              Precio de venta (unitario)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={item.salePrice}
                              readOnly
                              className="w-full cursor-not-allowed rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2 text-white opacity-70"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs text-gray-400">
                              Subtotal
                            </label>
                            <div className="flex items-center justify-between rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2">
                              <span className="font-bold text-green-400">
                                {formatCurrency(item.salePrice * item.quantity)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1 rounded-lg border border-blue-500/20 bg-blue-900/10 p-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">
                              Pagar al admin:
                            </span>
                            <span className="font-semibold text-blue-400">
                              {formatCurrency(
                                ((item.salePrice *
                                  (100 - (item.profitPercentage || 20))) /
                                  100) *
                                  item.quantity
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Tu ganancia:</span>
                            <span className="font-semibold text-green-400">
                              {formatCurrency(
                                ((item.salePrice *
                                  (item.profitPercentage || 20)) /
                                  100) *
                                  item.quantity
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeItem(item.productId, item.sourceBranchId)
                        }
                        className="ml-4 rounded-lg p-2 text-red-400 hover:bg-red-500/10"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Información General */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Información General
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Cliente (opcional para ventas normales, obligatorio para crédito) */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Cliente {selectedPaymentMethod?.isCredit ? "*" : "(Opcional)"}
                </label>
                <CustomerSelector
                  value={formData.customerId}
                  onChange={handleCustomerChange}
                  placeholder="Buscar cliente por nombre o teléfono..."
                  required={selectedPaymentMethod?.isCredit}
                  allowCreate={true}
                  onCreateSuccess={handleCustomerCreated}
                />
                <p className="mt-1 text-xs text-gray-400">
                  {selectedPaymentMethod?.isCredit
                    ? "Requerido para ventas a crédito"
                    : "Registra el cliente para acumular puntos y llevar historial"}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Fecha de la venta *
                </label>
                <input
                  type="date"
                  name="saleDate"
                  value={formData.saleDate}
                  onChange={handleChange}
                  required
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Método de Pago *
                </label>
                <select
                  name="paymentMethodId"
                  value={formData.paymentMethodId}
                  onChange={e => handlePaymentMethodChange(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecciona un método</option>
                  {paymentMethods.map(method => (
                    <option key={method._id} value={method._id}>
                      {method.name}
                      {method.isCredit ? " (Crédito)" : ""}
                    </option>
                  ))}
                </select>
                {selectedPaymentMethod?.isCredit && (
                  <p className="mt-1 text-xs text-orange-400">
                    ⚠️ Este método genera una venta a crédito
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Método de Entrega
                </label>
                <select
                  name="deliveryMethodId"
                  value={formData.deliveryMethodId}
                  onChange={e => handleDeliveryMethodChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin método de entrega</option>
                  {deliveryMethods.map(method => (
                    <option key={method._id} value={method._id}>
                      {method.name}
                      {method.defaultCost > 0
                        ? ` (+$${method.defaultCost.toLocaleString()})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              {/* Costo de envío variable */}
              {selectedDeliveryMethod?.hasVariableCost && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Costo de envío
                  </label>
                  <input
                    type="number"
                    name="shippingCost"
                    value={formData.shippingCost}
                    onChange={handleChange}
                    min={0}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              )}
              {/* Dirección de entrega */}
              {selectedDeliveryMethod?.requiresAddress && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Dirección de entrega
                  </label>
                  <input
                    type="text"
                    name="deliveryAddress"
                    value={formData.deliveryAddress}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dirección completa de entrega..."
                  />
                </div>
              )}
            </div>

            {/* Campos de crédito (solo si es a crédito) */}
            {selectedPaymentMethod?.isCredit && (
              <div className="mt-4 rounded-lg border border-orange-500/30 bg-orange-900/10 p-4">
                <h3 className="mb-3 text-sm font-semibold text-orange-400">
                  ⚠️ Información de Crédito
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">
                      Fecha de vencimiento *
                    </label>
                    <input
                      type="date"
                      name="creditDueDate"
                      value={formData.creditDueDate}
                      onChange={handleChange}
                      required
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">
                      Abono inicial (opcional)
                    </label>
                    <input
                      type="number"
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
                      venta
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Comprobante (solo para no-crédito) */}
            {!selectedPaymentMethod?.isCredit && (
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Comprobante de Transferencia
                </label>
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-600 bg-gray-900/50 px-4 py-3 text-sm text-gray-400 hover:border-blue-500 hover:text-blue-400">
                      {imagePreview ? "Cambiar imagen" : "Click para subir"}
                    </div>
                  </label>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="rounded-lg border border-red-500 px-4 text-red-400 hover:bg-red-500/10"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="mt-2 h-32 w-full rounded-lg object-cover"
                  />
                )}
              </div>
            )}

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Notas (opcional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Cliente, método de pago, etc."
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Descuento al cliente
              </label>
              <input
                type="number"
                name="discount"
                value={formData.discount}
                onChange={handleChange}
                min={0}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>

            {/* Costos Adicionales */}
            <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-900/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-purple-400">
                  🎁 Costos Adicionales (Garantías, Obsequios)
                </h3>
                <button
                  type="button"
                  onClick={handleAddCost}
                  className="rounded-lg bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-500"
                >
                  + Agregar
                </button>
              </div>
              {additionalCosts.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No hay costos adicionales. Agrega garantías u obsequios si
                  aplica.
                </p>
              ) : (
                <div className="space-y-3">
                  {additionalCosts.map(cost => (
                    <div
                      key={cost.id}
                      className="flex items-center gap-3 rounded-lg border border-purple-500/20 bg-gray-800/50 p-3"
                    >
                      <select
                        value={cost.type}
                        onChange={e =>
                          handleUpdateCost(cost.id, "type", e.target.value)
                        }
                        className="rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-white"
                      >
                        <option value="warranty">🛡️ Garantía</option>
                        <option value="gift">🎁 Obsequio</option>
                        <option value="other">📦 Otro</option>
                      </select>
                      <input
                        type="text"
                        value={cost.description}
                        onChange={e =>
                          handleUpdateCost(
                            cost.id,
                            "description",
                            e.target.value
                          )
                        }
                        placeholder="Descripción..."
                        className="flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-white"
                      />
                      <input
                        type="number"
                        value={cost.amount}
                        onChange={e =>
                          handleUpdateCost(
                            cost.id,
                            "amount",
                            Number(e.target.value) || 0
                          )
                        }
                        placeholder="Costo"
                        min={0}
                        className="w-24 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCost(cost.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resumen */}
          {items.length > 0 && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-900/20 p-6">
              <h2 className="mb-4 text-xl font-semibold text-white">
                Resumen de Ventas
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Productos:</span>
                  <span className="font-semibold text-white">
                    {items.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Unidades totales:</span>
                  <span className="font-semibold text-white">
                    {items.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <div className="mt-2 flex justify-between border-t border-gray-700 pt-2 text-lg">
                  <span className="text-gray-300">Subtotal venta:</span>
                  <span className="font-bold text-green-400">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
                {formData.discount > 0 && (
                  <div className="flex justify-between text-sm text-orange-400">
                    <span>Descuento al cliente:</span>
                    <span>-{formatCurrency(formData.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg">
                  <span className="text-gray-300">Total a cobrar:</span>
                  <span className="font-bold text-green-400">
                    {formatCurrency(calculateFinalTotal())}
                  </span>
                </div>
                <div className="flex justify-between rounded-lg border border-blue-500/30 bg-blue-900/20 p-2 text-base">
                  <span className="text-blue-300">A pagar al admin:</span>
                  <span className="font-bold text-blue-400">
                    {formatCurrency(calculateTotalPayment())}
                  </span>
                </div>
                <div className="mt-3 border-t border-gray-700 pt-3">
                  <p className="mb-2 text-xs font-medium text-gray-400">
                    Análisis de Ganancias:
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Ganancia bruta:</span>
                    <span className="font-semibold text-blue-400">
                      {formatCurrency(calculateTotalProfit())}
                    </span>
                  </div>
                  {calculateTotalAdditionalCosts() > 0 && (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>- Costos adicionales:</span>
                      <span className="text-red-400">
                        -{formatCurrency(calculateTotalAdditionalCosts())}
                      </span>
                    </div>
                  )}
                  {formData.shippingCost > 0 && (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>- Costo de envío:</span>
                      <span className="text-red-400">
                        -{formatCurrency(formData.shippingCost)}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between rounded-lg border border-green-500/30 bg-green-900/20 p-2 text-base">
                    <span className="text-green-300">Ganancia neta:</span>
                    <span
                      className={`font-bold ${calculateNetProfit() >= 0 ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {formatCurrency(calculateNetProfit())}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/distributor/sales")}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || items.length === 0}
              className="flex-1"
            >
              {loading
                ? "Registrando..."
                : `Registrar ${items.length} Venta(s)`}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
