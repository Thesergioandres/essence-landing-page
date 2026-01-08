import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  authService,
  customerService,
  productService,
  saleService,
  stockService,
} from "../api/services";
import { Button } from "../components/Button";
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

interface FormState {
  notes: string;
  paymentProof: string | null;
  saleDate: string;
  paymentType: "cash" | "credit"; // contado o crédito
  customerId: string;
  creditDueDate: string;
  initialPayment: number;
}

export default function RegisterSale() {
  const navigate = useNavigate();
  const [stock, setStock] = useState<DistributorStock[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [formData, setFormData] = useState<FormState>({
    notes: "",
    paymentProof: null,
    saleDate: new Date().toISOString().slice(0, 10),
    paymentType: "cash",
    customerId: "",
    creditDueDate: "",
    initialPayment: 0,
  });
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

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

      // Registrar cada venta individualmente
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
          customerId?: string;
          creditDueDate?: string;
          initialPayment?: number;
          branchId?: string;
        } = {
          productId: item.productId,
          quantity: item.quantity,
          salePrice: item.salePrice,
          notes: formData.notes,
          saleDate: formData.saleDate,
          paymentType: formData.paymentType,
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
        if (formData.paymentType === "credit") {
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
      setFormData({
        notes: "",
        paymentProof: null,
        saleDate: new Date().toISOString().slice(0, 10),
        paymentType: "cash",
        customerId: "",
        creditDueDate: "",
        initialPayment: 0,
      });
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
    <div className="mx-auto max-w-4xl space-y-6">
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
                  Tipo de Pago *
                </label>
                <select
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
            </div>

            {/* Campos de crédito (solo si es a crédito) */}
            {formData.paymentType === "credit" && (
              <div className="mt-4 rounded-lg border border-orange-500/30 bg-orange-900/10 p-4">
                <h3 className="mb-3 text-sm font-semibold text-orange-400">
                  ⚠️ Información de Crédito
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">
                      Cliente *
                    </label>
                    <select
                      name="customerId"
                      value={formData.customerId}
                      onChange={handleChange}
                      required
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

                  <div className="md:col-span-2">
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

            {/* Comprobante (solo para contado) */}
            {formData.paymentType === "cash" && (
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
                  <span className="text-gray-300">Total venta:</span>
                  <span className="font-bold text-green-400">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
                <div className="flex justify-between rounded-lg border border-blue-500/30 bg-blue-900/20 p-2 text-base">
                  <span className="text-blue-300">A pagar al admin:</span>
                  <span className="font-bold text-blue-400">
                    {formatCurrency(calculateTotalPayment())}
                  </span>
                </div>
                <div className="flex justify-between rounded-lg border border-green-500/30 bg-green-900/20 p-2 text-base">
                  <span className="text-green-300">Tu ganancia total:</span>
                  <span className="font-bold text-green-400">
                    {formatCurrency(calculateTotalProfit())}
                  </span>
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
