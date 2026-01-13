import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import api from "../api/axios";
import {
  branchService,
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
import PointsRedemption from "../components/PointsRedemption";
import ProductSelector from "../components/ProductSelector";
import { useBusiness } from "../context/BusinessContext";
import type { Branch, BranchStock, Customer, Product } from "../types";

interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  salePrice: number;
  purchasePrice: number;
  clientPrice: number;
}

interface AdditionalCost {
  id: string;
  type: "warranty" | "gift" | "other";
  description: string;
  amount: number;
}

interface FormState {
  productId: string;
  quantity: number;
  salePrice: number;
  notes: string;
  saleDate: string;
  branchId: string;
  paymentMethodId: string;
  deliveryMethodId: string;
  shippingCost: number;
  deliveryAddress: string;
  customerId: string;
  creditDueDate: string;
  initialPayment: number;
  discount: number;
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] =
    useState<DeliveryMethod | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);
  const [formData, setFormData] = useState<FormState>({
    productId: "",
    quantity: 1,
    salePrice: 0,
    notes: "",
    saleDate: new Date().toISOString().slice(0, 10),
    branchId: "",
    paymentMethodId: "",
    deliveryMethodId: "",
    shippingCost: 0,
    deliveryAddress: "",
    customerId: "",
    creditDueDate: "",
    initialPayment: 0,
    discount: 0,
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Stock de la sede seleccionada (para validación de ventas múltiples)
  const [branchStock, setBranchStock] = useState<BranchStock[]>([]);
  // Productos filtrados según la sede seleccionada
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  // Indica si la sede seleccionada es bodega
  const [isWarehouseSelected, setIsWarehouseSelected] = useState(false);

  // Cargar stock de la sede cuando cambia la selección
  const loadBranchStock = useCallback(
    async (branchId: string) => {
      if (!branchId) {
        setBranchStock([]);
        setFilteredProducts([]);
        setIsWarehouseSelected(false);
        return;
      }

      const selectedBranch = branches.find(b => b._id === branchId);
      const isWarehouse = selectedBranch?.isWarehouse ?? false;
      setIsWarehouseSelected(isWarehouse);

      // Si es bodega, filtrar por warehouseStock > 0
      if (isWarehouse) {
        setBranchStock([]);
        const productsWithStock = products.filter(
          p => (p.warehouseStock || 0) > 0
        );
        setFilteredProducts(productsWithStock);
        return;
      }

      // Si es sede normal, cargar BranchStock y filtrar productos
      try {
        const stock = await stockService.getBranchStock(branchId);
        setBranchStock(stock);

        // Filtrar solo productos que tienen stock en esta sede
        const productIdsWithStock = new Set(
          stock
            .filter(s => s.quantity > 0)
            .map(s =>
              typeof s.product === "string" ? s.product : s.product?._id
            )
        );
        const productsWithStock = products.filter(p =>
          productIdsWithStock.has(p._id)
        );
        setFilteredProducts(productsWithStock);
      } catch (err) {
        console.error("Error cargando stock de sede:", err);
        setBranchStock([]);
        setFilteredProducts([]);
      }
    },
    [branches, products]
  );

  // Efecto para cargar stock cuando cambia la sede
  useEffect(() => {
    if (formData.branchId) {
      void loadBranchStock(formData.branchId);
    } else {
      setBranchStock([]);
      setFilteredProducts([]);
      setIsWarehouseSelected(false);
    }
  }, [formData.branchId, loadBranchStock]);

  // Efecto para seleccionar bodega por defecto cuando se cargan las sedes
  useEffect(() => {
    if (branches.length > 0 && !formData.branchId) {
      // Buscar la bodega (isWarehouse = true)
      const warehouse = branches.find(b => b.isWarehouse);
      if (warehouse) {
        setFormData(prev => ({ ...prev, branchId: warehouse._id }));
      } else {
        // Si no hay bodega, seleccionar la primera sede
        setFormData(prev => ({ ...prev, branchId: branches[0]._id }));
      }
    }
  }, [branches, formData.branchId]);

  useEffect(() => {
    if (!businessId || businessHydrating || businessLoading) return;
    void Promise.all([
      loadProducts(),
      loadBranches(),
      loadCustomers(),
      loadPaymentMethods(),
      loadDeliveryMethods(),
    ]);
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
    } catch (error) {
      console.error("No se pudieron cargar los clientes", error);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      if (!businessId) return;
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
      if (!businessId) return;
      const { deliveryMethods: methods } = await deliveryMethodService.getAll();
      const activeMethods = methods.filter((m: DeliveryMethod) => m.isActive);
      setDeliveryMethods(activeMethods);
      // Por defecto NO seleccionar ningún método de entrega
      // El usuario lo elegirá manualmente si lo necesita
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

  // Tipo simplificado para compatibilidad con CustomerSelector
  type CustomerBasic = {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
  };

  const handleCustomerChange = (
    customerId: string,
    customer?: CustomerBasic
  ) => {
    if (!customerId) {
      setSelectedCustomer(null);
      setPointsToRedeem(0);
      setFormData(prev => ({ ...prev, customerId: "" }));
      return;
    }
    // Si viene el objeto customer del CustomerSelector, usarlo directamente
    if (customer) {
      // Buscar en la lista local para obtener el objeto completo si existe
      const fullCustomer = customers.find(c => c._id === customer._id);
      setSelectedCustomer(fullCustomer || (customer as Customer));
    } else {
      const found = customers.find(c => c._id === customerId);
      setSelectedCustomer(found || null);
    }
    setPointsToRedeem(0);
    setFormData(prev => ({ ...prev, customerId }));
  };

  const handleCustomerCreated = (customer: CustomerBasic) => {
    // Agregar el nuevo cliente a la lista local (con valores por defecto)
    const newCustomer: Customer = {
      ...customer,
      business: businessId || "",
      points: 0,
      totalSpend: 0,
      totalDebt: 0,
      ordersCount: 0,
    };
    setCustomers(prev => [newCustomer, ...prev]);
    // Seleccionarlo automáticamente
    handleCustomerChange(newCustomer._id, newCustomer);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (saleItems.length === 0) {
      setError("Agrega al menos un producto al pedido");
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

      // 🔍 Validar stock ANTES de registrar ventas múltiples del mismo producto
      const productQuantities = new Map<string, number>();
      for (const item of saleItems) {
        const currentQty = productQuantities.get(item.productId) || 0;
        productQuantities.set(item.productId, currentQty + item.quantity);
      }

      // Verificar que cada producto tenga suficiente stock para la cantidad TOTAL solicitada
      for (const [productId, totalQuantity] of productQuantities) {
        const product = products.find(p => p._id === productId);
        if (!product) continue;

        // Determinar si es venta de bodega o sede normal
        const selectedBranch = branches.find(b => b._id === formData.branchId);
        const isWarehouseSale =
          !formData.branchId || selectedBranch?.isWarehouse;

        if (isWarehouseSale) {
          // Validar contra warehouseStock del producto
          const availableStock = product.warehouseStock || 0;
          if (availableStock < totalQuantity) {
            setError(
              `Stock insuficiente de "${product.name}". Disponible en bodega: ${availableStock}, solicitado en total: ${totalQuantity}`
            );
            setLoading(false);
            return;
          }
        } else {
          // Validar contra BranchStock de la sede seleccionada
          const stockItem = branchStock.find(s => {
            const stockProductId =
              typeof s.product === "string" ? s.product : s.product?._id;
            return stockProductId === productId;
          });
          const availableStock = stockItem?.quantity || 0;
          if (availableStock < totalQuantity) {
            setError(
              `Stock insuficiente de "${product.name}" en ${selectedBranch?.name || "la sede"}. Disponible: ${availableStock}, solicitado en total: ${totalQuantity}`
            );
            setLoading(false);
            return;
          }
        }
      }

      // Generar un saleGroupId único para agrupar todas las ventas del carrito
      const saleGroupId = uuidv4();

      // Registrar cada venta con el mismo saleGroupId
      for (const item of saleItems) {
        await saleService.register({
          productId: item.productId,
          quantity: item.quantity,
          salePrice: item.salePrice,
          branchId: formData.branchId || undefined,
          notes: formData.notes,
          saleDate: formData.saleDate,
          customerId: formData.customerId || undefined,
          paymentMethodId: formData.paymentMethodId || undefined,
          deliveryMethodId: formData.deliveryMethodId || undefined,
          shippingCost: item === saleItems[0] ? formData.shippingCost : 0, // Solo el primer item lleva costo de envío
          deliveryAddress: formData.deliveryAddress || undefined,
          paymentType: isCredit ? "credit" : "cash",
          creditDueDate: isCredit ? formData.creditDueDate : undefined,
          initialPayment:
            isCredit && item === saleItems[0] && formData.initialPayment > 0
              ? formData.initialPayment
              : undefined,
          saleGroupId, // ⭐ Asignar el mismo ID de grupo a todas las ventas del carrito
        });
      }

      setSuccess(
        `¡Pedido con ${saleItems.length} ${saleItems.length === 1 ? "producto registrado" : "productos registrados"} exitosamente!`
      );

      // Limpiar todo
      setSaleItems([]);
      setAdditionalCosts([]);
      // Restaurar el método de pago por defecto
      const defaultMethod =
        paymentMethods.find(m => m.code === "cash") || paymentMethods[0];
      // Restaurar el método de entrega por defecto
      const defaultDelivery =
        deliveryMethods.find(m => m.code === "porteria") || deliveryMethods[0];
      setFormData({
        productId: "",
        quantity: 1,
        salePrice: 0,
        paymentMethodId: defaultMethod?._id || "",
        deliveryMethodId: defaultDelivery?._id || "",
        shippingCost: defaultDelivery?.defaultCost || 0,
        deliveryAddress: "",
        customerId: "",
        creditDueDate: "",
        initialPayment: 0,
        discount: 0,
        notes: "",
        saleDate: new Date().toISOString().slice(0, 10),
        branchId: formData.branchId,
      });
      setSelectedProduct(null);
      setSelectedPaymentMethod(defaultMethod || null);
      setSelectedDeliveryMethod(defaultDelivery || null);

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
    // Calcular total de costos adicionales
    const totalAdditionalCosts = additionalCosts.reduce(
      (sum, cost) => sum + cost.amount,
      0
    );
    // Calcular costo de envío
    const shippingCost = formData.shippingCost || 0;
    // Calcular descuento manual
    const discount = formData.discount || 0;
    // Total final = subtotal - puntos - descuento
    const finalTotal = Math.max(0, totalSale - pointsDiscount - discount);
    // Ganancia neta = ganancia bruta - costos adicionales - envío
    const netProfit = totalProfit - totalAdditionalCosts - shippingCost;
    return {
      totalSale,
      totalProfit,
      pointsDiscount,
      finalTotal,
      totalAdditionalCosts,
      shippingCost,
      discount,
      netProfit,
    };
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
    <div className="mx-auto max-w-7xl space-y-6">
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

      {/* SECCIÓN 1: Selección de Sede OBLIGATORIA */}
      <div className="rounded-xl border-2 border-purple-500 bg-purple-900/20 p-6">
        <h2 className="mb-4 text-lg font-bold text-purple-300">
          📍 Paso 1: Seleccionar Sede/Bodega (Obligatorio)
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="branchId"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Sede *
            </label>
            <select
              id="branchId"
              name="branchId"
              value={formData.branchId}
              onChange={handleChange}
              required
              className="w-full rounded-lg border-2 border-purple-500 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">-- Selecciona una sede --</option>
              {branches.map(branch => (
                <option key={branch._id} value={branch._id}>
                  {branch.name} {branch.isWarehouse ? "(Bodega Principal)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center">
            {formData.branchId && (
              <div
                className={`rounded-lg p-4 ${isWarehouseSelected ? "border border-green-500/50 bg-green-900/30" : "border border-blue-500/50 bg-blue-900/30"}`}
              >
                <p className="font-semibold text-white">
                  {isWarehouseSelected
                    ? "🏭 Bodega Principal"
                    : "🏪 Sede Normal"}
                </p>
                <p className="text-sm text-gray-300">
                  {isWarehouseSelected
                    ? "Stock se descuenta de warehouseStock"
                    : "Stock se descuenta de BranchStock de esta sede"}
                </p>
                <p className="mt-1 text-sm font-medium text-green-400">
                  ✓ {filteredProducts.length} productos disponibles
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: Contenido principal (solo visible si hay sede seleccionada) */}
      {!formData.branchId ? (
        <div className="rounded-xl border border-yellow-500/50 bg-yellow-900/20 p-8 text-center">
          <p className="text-xl text-yellow-300">
            ⚠️ Selecciona una sede para continuar
          </p>
          <p className="mt-2 text-gray-400">
            Debes elegir desde qué sede/bodega se descontará el stock
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Panel izquierdo: Inventario de la sede */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 rounded-xl border border-gray-700 bg-gray-800/50 p-4">
              <h2 className="mb-4 text-lg font-semibold text-white">
                📦 Inventario {isWarehouseSelected ? "Bodega" : "Sede"}
              </h2>
              <div className="max-h-[600px] space-y-2 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <p className="py-4 text-center text-gray-500">
                    No hay productos con stock
                  </p>
                ) : (
                  filteredProducts.map(product => {
                    const stock = isWarehouseSelected
                      ? product.warehouseStock || 0
                      : branchStock.find(s => {
                          const pid =
                            typeof s.product === "string"
                              ? s.product
                              : s.product?._id;
                          return pid === product._id;
                        })?.quantity || 0;
                    const inCart = saleItems
                      .filter(i => i.productId === product._id)
                      .reduce((sum, i) => sum + i.quantity, 0);
                    const remaining = stock - inCart;

                    return (
                      <div
                        key={product._id}
                        className={`rounded-lg border p-3 text-sm ${
                          remaining <= 0
                            ? "border-red-500/50 bg-red-900/20 opacity-60"
                            : remaining <= 3
                              ? "border-yellow-500/50 bg-yellow-900/20"
                              : "border-gray-600 bg-gray-900/50"
                        }`}
                      >
                        <p
                          className="truncate font-medium text-white"
                          title={product.name}
                        >
                          {product.name}
                        </p>
                        <div className="mt-1 flex justify-between text-xs">
                          <span className="text-gray-400">Stock:</span>
                          <span
                            className={
                              remaining <= 0
                                ? "font-bold text-red-400"
                                : remaining <= 3
                                  ? "text-yellow-400"
                                  : "text-green-400"
                            }
                          >
                            {remaining}{" "}
                            {inCart > 0 && (
                              <span className="text-orange-400">
                                (-{inCart} en carrito)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="mt-1 flex justify-between text-xs">
                          <span className="text-gray-400">P.Venta:</span>
                          <span className="text-green-400">
                            ${(product.clientPrice || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Panel central: Formulario para agregar productos */}
          <div className="space-y-6 lg:col-span-1">
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
                      excludeProductIds={saleItems.map(item => item.productId)}
                      products={filteredProducts}
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
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold text-orange-400">
                        Descuento al cliente:
                      </span>
                      <span className="font-bold text-orange-400">
                        -{formatCurrency(totals.discount)}
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
                  <div className="mt-4 border-t border-gray-600 pt-3">
                    <p className="mb-2 text-sm font-medium text-gray-400">
                      Análisis de Ganancias:
                    </p>
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold text-white">
                        Ganancia bruta:
                      </span>
                      <span className="font-bold text-blue-400">
                        {formatCurrency(totals.totalProfit)}
                      </span>
                    </div>
                    {totals.totalAdditionalCosts > 0 && (
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>- Costos adicionales:</span>
                        <span className="text-red-400">
                          -{formatCurrency(totals.totalAdditionalCosts)}
                        </span>
                      </div>
                    )}
                    {totals.shippingCost > 0 && (
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>- Costo de envío:</span>
                        <span className="text-red-400">
                          -{formatCurrency(totals.shippingCost)}
                        </span>
                      </div>
                    )}
                    <div className="mt-2 flex justify-between border-t border-gray-700 pt-2 text-lg">
                      <span className="font-bold text-white">
                        Ganancia neta:
                      </span>
                      <span
                        className={`font-bold ${totals.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {formatCurrency(totals.netProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
                  htmlFor="paymentMethodId"
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  Método de Pago *
                </label>
                <select
                  id="paymentMethodId"
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
                <label
                  htmlFor="deliveryMethodId"
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  Método de Entrega
                </label>
                <select
                  id="deliveryMethodId"
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
                  <label
                    htmlFor="shippingCost"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Costo de envío
                  </label>
                  <input
                    type="number"
                    id="shippingCost"
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
                <div className="md:col-span-2">
                  <label
                    htmlFor="deliveryAddress"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Dirección de entrega
                  </label>
                  <input
                    type="text"
                    id="deliveryAddress"
                    name="deliveryAddress"
                    value={formData.deliveryAddress}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dirección completa de entrega..."
                  />
                </div>
              )}
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
              <div>
                <label
                  htmlFor="discount"
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  Descuento al cliente
                </label>
                <input
                  type="number"
                  id="discount"
                  name="discount"
                  value={formData.discount}
                  onChange={handleChange}
                  min={0}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Costos Adicionales (Garantías, Obsequios) */}
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

            {/* Campos de crédito (solo si es a crédito) */}
            {selectedPaymentMethod?.isCredit && (
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
                    <CustomerSelector
                      value={formData.customerId}
                      onChange={handleCustomerChange}
                      placeholder="Buscar cliente por nombre o teléfono..."
                      required={true}
                      allowCreate={true}
                      onCreateSuccess={handleCustomerCreated}
                    />
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
                      required={selectedPaymentMethod?.isCredit}
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
                    {selectedPaymentMethod?.isCredit && (
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
              {!selectedPaymentMethod?.isCredit && (
                <div>
                  <label
                    htmlFor="customerId"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Cliente (opcional - para acumular/canjear puntos)
                  </label>
                  <CustomerSelector
                    value={selectedCustomer?._id || ""}
                    onChange={handleCustomerChange}
                    placeholder="Buscar cliente por nombre o teléfono..."
                    required={false}
                    allowCreate={true}
                    onCreateSuccess={handleCustomerCreated}
                  />
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
