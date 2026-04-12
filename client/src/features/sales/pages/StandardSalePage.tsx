/**
 * Admin Register Sale Page - Full Bulk Order System
 * Complete order management with location context, advanced cart, financial logic,
 * warranty management, and customer integration
 */

import { CheckCircle, FileText, RefreshCcw, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import ProductSelector from "../../../components/ProductSelector";
import type {
  RegisterSaleResponse,
  RegisterStandardSaleInput,
} from "../../../core/domain/sales/sales.types";
import { useSession } from "../../../hooks/useSession";
import { Button, Card } from "../../../shared/components/ui";
import LoadingSpinner from "../../../shared/components/ui/LoadingSpinner";
import type {
  EmployeeStats,
  GamificationConfig,
  LevelConfig,
} from "../../analytics/types/gamification.types";
import { branchService } from "../../branches/services/branch.service";
import type { Branch } from "../../business/types/business.types";
import { gamificationService } from "../../common/services";
import { employeeService } from "../../employees/services/employee.service";
import { productsService } from "../../inventory/api/products.service";
import { stockService } from "../../inventory/services/inventory.service";
import type { Product } from "../../inventory/types/product.types";
import {
  CustomerSelector,
  FinancialPanel,
  InventoryGrid,
  LocationSelector,
  OrderCart,
  OrderSummary,
  WarrantySection,
} from "../components/admin-order";
import { initialOrderState, orderReducer } from "../reducers/orderReducer";
import {
  defectiveProductService,
  saleService,
} from "../services/sales.service";
import type {
  AdminOrderPayload,
  ProductWithStock,
} from "../types/admin-order.types";

type RegisterStandardSaleHandler = (
  data: RegisterStandardSaleInput
) => Promise<RegisterSaleResponse>;

interface StandardSalePageProps {
  registerStandardSale?: RegisterStandardSaleHandler;
}

export default function StandardSalePage({
  registerStandardSale,
}: StandardSalePageProps = {}) {
  const { user, loading: userLoading } = useSession(); // Get user from session
  const isEmployee = user?.role === "employee";

  // State: Order managed by reducer
  const [order, dispatch] = useReducer(orderReducer, {
    ...initialOrderState,
    locationType: isEmployee ? "employee" : "warehouse", // Default start
    locationName: isEmployee ? "Mi Inventario" : "Bodega Principal",
    paymentMethod: isEmployee ? "transfer" : "cash",
    isEmployeeSale: isEmployee,
    employeeProfitPercentage: 20,
  });

  // State: Data sources
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [branchStock, setBranchStock] = useState<Map<string, number>>(
    new Map()
  );
  const [productSelectorId, setProductSelectorId] = useState("");

  // State: Loading/Error/Success
  const [dataLoading, setDataLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [gamificationLoading, setGamificationLoading] = useState(false);
  const [gamificationConfig, setGamificationConfig] =
    useState<GamificationConfig | null>(null);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats | null>(
    null
  );
  const [rankingInfo, setRankingInfo] = useState<{
    position: number | null;
    totalEmployees: number;
    bonusCommission: number;
  } | null>(null);
  const [saleResult, setSaleResult] = useState<{
    success: boolean;
    saleGroupId: string;
    totalAmount: number;
    totalItems: number;
  } | null>(null);

  // Update location when user loads (fix timing issue)
  useEffect(() => {
    if (user && isEmployee) {
      dispatch({
        type: "SET_LOCATION",
        locationType: "employee",
        locationId: user?._id || "employee",
        locationName: "Mi Inventario",
      });
      dispatch({ type: "SET_PAYMENT_METHOD", method: "transfer" });
    }
  }, [user, isEmployee]);

  // ==================== DATA FETCHING ====================
  useEffect(() => {
    // Don't fetch until user session is loaded
    if (userLoading) return;

    const fetchData = async () => {
      setDataLoading(true);
      try {
        if (isEmployee) {
          // 1. Fetch Employee Inventory (Personal Stock)
          // 2. Fetch Allowed Branches (Company Stock)
          const [distProductsRes, allowedBranchesRes] = await Promise.all([
            employeeService.getProducts(),
            stockService
              .getMyAllowedBranches()
              .catch(() => ({ branches: [] as Branch[] })),
          ]);

          const employeeBranches = allowedBranchesRes.branches || [];
          setBranches(employeeBranches);

          const allProducts = await productsService.getProducts();
          const distStockMap = new Map<string, number>();
          distProductsRes.products.forEach((item: any) => {
            if (item.product && item.product._id) {
              distStockMap.set(String(item.product._id), item.quantity);
            }
          });

          const firstBranch = employeeBranches.find(
            branch => !branch.isWarehouse
          );

          if (firstBranch) {
            dispatch({
              type: "SET_LOCATION",
              locationType: "branch",
              locationId: firstBranch._id,
              locationName: firstBranch.name,
            });
          } else {
            dispatch({
              type: "SET_LOCATION",
              locationType: "employee",
              locationId: user?._id || "employee",
              locationName: "Mi Inventario",
            });
          }

          const mappedProducts: ProductWithStock[] = (
            allProducts as Product[]
          ).map(p => ({
            _id: p._id,
            name: p.name,
            purchasePrice:
              p.averageCost ?? p.purchasePrice ?? p.employeePrice ?? 0,
            averageCost: p.averageCost ?? undefined,
            clientPrice: p.clientPrice ?? p.suggestedPrice ?? 0,
            employeePrice: p.employeePrice ?? 0,
            warehouseStock: p.warehouseStock ?? 0, // HYBRID MODEL: Employees CAN see warehouse stock for dropshipping
            totalStock: p.totalStock ?? 0,
            employeeStock: distStockMap.get(p._id) || 0,
            category: p.category,
            image: p.image ?? undefined,
          }));

          setProducts(mappedProducts);
        } else {
          // Fetch Admin Data
          const [branchesData, productsData] = await Promise.all([
            branchService.getAll(),
            productsService.getProducts(),
          ]);
          setBranches(branchesData.filter(b => b.active !== false));

          const productsWithStock: ProductWithStock[] = (
            productsData as Product[]
          ).map(p => ({
            _id: p._id,
            name: p.name,
            purchasePrice: p.averageCost ?? p.purchasePrice ?? 0,
            averageCost: p.averageCost ?? undefined,
            clientPrice: p.clientPrice ?? p.suggestedPrice ?? 0,
            employeePrice: p.employeePrice,
            warehouseStock: p.warehouseStock ?? 0,
            totalStock: p.totalStock ?? 0,
            category: p.category,
            image: p.image ?? undefined,
          }));
          setProducts(productsWithStock);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [userLoading, isEmployee, user?._id]);

  useEffect(() => {
    if (!isEmployee || !user?._id) return;

    let isActive = true;
    const loadGamification = async () => {
      try {
        setGamificationLoading(true);
        const [configRes, statsRes, rankingRes] = await Promise.all([
          gamificationService.getConfig(),
          gamificationService.getEmployeeStats(user._id),
          gamificationService.getAdjustedCommission(user._id),
        ]);

        if (!isActive) return;
        setGamificationConfig(configRes as GamificationConfig);
        setEmployeeStats(statsRes?.stats ?? null);
        setRankingInfo({
          position: rankingRes?.position ?? null,
          totalEmployees: rankingRes?.totalEmployees ?? 0,
          bonusCommission: rankingRes?.bonusCommission ?? 0,
        });
      } catch (error) {
        console.error("Error loading gamification info:", error);
      } finally {
        if (isActive) setGamificationLoading(false);
      }
    };

    loadGamification();
    return () => {
      isActive = false;
    };
  }, [isEmployee, user?._id]);

  useEffect(() => {
    const bonus = rankingInfo?.bonusCommission || 0;
    const profitPercentage = 20 + bonus;
    dispatch({
      type: "SET_EMPLOYEE_PROFIT",
      isEmployeeSale: isEmployee,
      profitPercentage,
    });
  }, [isEmployee, rankingInfo?.bonusCommission]);

  // Fetch branch stock when branch location is selected
  useEffect(() => {
    const fetchBranchStock = async () => {
      if (order.locationType !== "branch" || !order.locationId) {
        setBranchStock(new Map());
        return;
      }

      setBranchStock(new Map());

      try {
        const branchStockData = await stockService.getBranchStock(
          order.locationId
        );

        const stockMap = new Map<string, number>();
        branchStockData.forEach(item => {
          const productId =
            typeof item.product === "object" ? item.product?._id : item.product;
          if (productId) {
            stockMap.set(String(productId), item.quantity || 0);
          }
        });
        setBranchStock(stockMap);
      } catch (error) {
        console.error("Error fetching branch stock:", error);
        setBranchStock(new Map());
      }
    };

    fetchBranchStock();
  }, [order.locationType, order.locationId]);

  // Products with correct stock based on location
  const quantitiesInCartByProduct = useMemo(() => {
    return order.items.reduce((acc, item) => {
      acc.set(item.productId, (acc.get(item.productId) || 0) + item.quantity);
      return acc;
    }, new Map<string, number>());
  }, [order.items]);

  const productsWithLocationStock = useMemo(() => {
    return products.map(p => {
      let stock = 0;
      // Warehouse stock (Admin OR Employee in dropshipping mode)
      if (order.locationType === "warehouse") stock = p.warehouseStock ?? 0;
      // Branch stock (specific branch selected)
      else if (order.locationType === "branch")
        stock = branchStock.get(p._id) ?? 0;
      // Employee's personal inventory
      else if (order.locationType === "employee") stock = p.employeeStock ?? 0;

      const reservedInCart = quantitiesInCartByProduct.get(p._id) || 0;
      const remainingStock = Math.max(0, stock - reservedInCart);

      return {
        ...p,
        branchStock:
          order.locationType === "branch" ? remainingStock : undefined,
        employeeStock:
          order.locationType === "employee" ? remainingStock : undefined,
        // HYBRID MODEL: Employees CAN see warehouse stock for dropshipping
        warehouseStock:
          order.locationType === "warehouse"
            ? remainingStock
            : p.warehouseStock,
      };
    });
  }, [products, order.locationType, branchStock, quantitiesInCartByProduct]);

  const selectorProducts = useMemo(
    () =>
      productsWithLocationStock
        .map(product => {
          const availableStock =
            order.locationType === "warehouse"
              ? (product.warehouseStock ?? 0)
              : order.locationType === "branch"
                ? (product.branchStock ?? 0)
                : (product.employeeStock ?? 0);

          return {
            _id: product._id,
            name: product.name,
            category: product.category,
            totalStock: availableStock,
            warehouseStock: product.warehouseStock,
            purchasePrice: product.purchasePrice,
            averageCost: product.averageCost,
            suggestedPrice: product.clientPrice,
            clientPrice: product.clientPrice,
            image: product.image,
          };
        })
        .filter(product => (product.totalStock ?? 0) > 0),
    [productsWithLocationStock, order.locationType]
  );

  const gamificationSummary = useMemo(() => {
    const levels = (gamificationConfig?.levels || []) as LevelConfig[];
    const sorted = [...levels].sort(
      (a, b) => (a.minPoints || 0) - (b.minPoints || 0)
    );
    const points = employeeStats?.totalPoints || 0;
    let current = sorted[0] || null;
    for (const level of sorted) {
      if (points >= (level.minPoints || 0)) {
        current = level;
      }
    }
    const next = sorted.find(level => (level.minPoints || 0) > points) || null;
    const currentMin = current?.minPoints || 0;
    const nextMin = next?.minPoints || currentMin;
    const pointsToNext = next ? Math.max(0, next.minPoints - points) : 0;
    const pointsPerCurrencyUnit =
      gamificationConfig?.generalRules?.pointsPerCurrencyUnit || 0;
    const pointsPerSaleConfirmed =
      gamificationConfig?.generalRules?.pointsPerSaleConfirmed || 0;
    const estimatedRevenueToNext =
      pointsPerCurrencyUnit > 0 ? pointsToNext / pointsPerCurrencyUnit : null;
    const estimatedSalesToNext =
      pointsPerSaleConfirmed > 0
        ? Math.ceil(pointsToNext / pointsPerSaleConfirmed)
        : null;

    return {
      points,
      current,
      next,
      currentMin,
      nextMin,
      progressPercent:
        next && nextMin > currentMin
          ? Math.min(
              100,
              Math.max(
                0,
                ((points - currentMin) / (nextMin - currentMin)) * 100
              )
            )
          : 100,
      pointsToNext,
      estimatedRevenueToNext,
      estimatedSalesToNext,
    };
  }, [gamificationConfig, employeeStats]);

  // ==================== HANDLERS ====================
  const handleLocationChange = useCallback(
    (type: "warehouse" | "branch" | "employee", id: string, name: string) => {
      // Allow Employees to switch between "employee" (My Inventory) and "branch" (Allowed Warehouse)
      // They cannot select "warehouse" (Main Warehouse) usually, unless its a branch?
      // LocationSelector sends "warehouse" type for the main button.
      // If employee tries to click "Bodega" button -> blocked?
      // We will handle this in UI, but here we allow the change.

      dispatch({
        type: "SET_LOCATION",
        locationType: type as any,
        locationId: id,
        locationName: name,
      });
    },
    []
  );

  const handleAddProduct = useCallback(
    (product: ProductWithStock, quantity: number) => {
      let stock = 0;
      if (order.locationType === "warehouse") stock = product.warehouseStock;
      else if (order.locationType === "branch")
        stock = product.branchStock ?? 0;
      else if (order.locationType === "employee")
        stock = product.employeeStock ?? 0;

      // ... rest of logic
      dispatch({
        type: "ADD_ITEM",
        item: {
          productId: product._id,
          productName: product.name,
          quantity,
          unitPrice: product.clientPrice,
          purchasePrice: product.averageCost ?? product.purchasePrice ?? 0,
          availableStock: stock,
          category:
            typeof product.category === "object"
              ? product.category?.name
              : product.category,
          image: product.image,
        },
      });
    },
    [order.locationType]
  );

  const handleUpdateItem = useCallback(
    (
      itemId: string,
      updates: {
        quantity?: number;
        unitPrice?: number;
        employeePrice?: number;
      }
    ) => {
      dispatch({ type: "UPDATE_ITEM", itemId, updates });
    },
    []
  );

  const handleRemoveItem = useCallback((itemId: string) => {
    dispatch({ type: "REMOVE_ITEM", itemId });
  }, []);

  const handlePaymentProofUpload = useCallback((file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result ? String(reader.result) : "";
      dispatch({
        type: "SET_PAYMENT_PROOF",
        paymentProof: base64 || null,
        paymentProofMimeType: file.type || null,
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleConfirmOrder = useCallback(async () => {
    if (order.items.length === 0) return;

    const discountAmount =
      order.discount || (order.subtotal * order.discountPercent) / 100 || 0;
    const subtotal = order.subtotal || 0;
    const belowCostItem = order.items.find(item => {
      const cost = Number(item.purchasePrice || 0);
      if (cost <= 0) return false;
      const itemSubtotal = item.unitPrice * item.quantity;
      const discountShare =
        subtotal > 0 ? (itemSubtotal / subtotal) * discountAmount : 0;
      const effectiveUnitPrice =
        item.unitPrice - discountShare / Math.max(1, item.quantity);
      return effectiveUnitPrice < cost;
    });

    if (belowCostItem) {
      setSubmitError(
        `El producto no se puede vender a ese precio: ${belowCostItem.productName}. ` +
          `Costo minimo $${Number(belowCostItem.purchasePrice).toLocaleString()}.`
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Generate unique sale group ID
      const saleGroupId = uuidv4();

      // Build payload for sale items
      const payload: AdminOrderPayload = {
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          salePrice: item.unitPrice,
        })),
        locationType: order.locationType,
        paymentMethodId: order.paymentMethod,
        paymentType: order.paymentMethod,
        notes: order.notes || undefined,
        discount:
          order.discount ||
          (order.subtotal * order.discountPercent) / 100 ||
          undefined,
        saleGroupId,
      };

      if (order.paymentProof) {
        payload.paymentProof = order.paymentProof;
        payload.paymentProofMimeType = order.paymentProofMimeType || undefined;
      }

      // Add branch ID if selling from branch
      if (order.locationType === "branch" && order.locationId) {
        payload.branchId = order.locationId;
      }

      // Add customer if selected
      if (order.customerId) {
        payload.customerId = order.customerId;
      }

      // Add delivery info (only shipping cost, not deliveryMethodId as it's a string)
      if (order.deliveryMethod === "delivery") {
        payload.shippingCost = order.shippingCost;
        // Don't send deliveryMethodId as "delivery" string - backend expects ObjectId or nothing
      }

      // Add credit details
      if (order.paymentMethod === "credit") {
        payload.creditDueDate = order.creditDueDate || undefined;
        payload.initialPayment = order.initialPayment || undefined;
      }

      // Add additional costs
      if (order.additionalCosts.length > 0) {
        payload.additionalCosts = order.additionalCosts.map(c => ({
          type: c.type || "other",
          description: c.description,
          amount: c.amount,
        }));
      }

      // Process all sale items in a single batch request (V2 API)
      let totalProcessedItems = 0;
      let totalAmount = 0;

      try {
        const registerStandardSaleHandler =
          registerStandardSale || saleService.registerStandardBulk;

        await registerStandardSaleHandler({
          items: payload.items,
          locationType: payload.locationType,
          branchId: payload.branchId,
          paymentMethodId: payload.paymentMethodId,
          paymentType: payload.paymentType,
          customerId: payload.customerId,
          notes: payload.notes,
          discount: payload.discount,
          saleGroupId: saleGroupId,
          creditDueDate: payload.creditDueDate,
          initialPayment: payload.initialPayment,
          // Don't send deliveryMethodId - not supported as string
          shippingCost: payload.shippingCost,
          additionalCosts: payload.additionalCosts,
          paymentProof: payload.paymentProof,
          paymentProofMimeType: payload.paymentProofMimeType,
        });

        totalProcessedItems = payload.items.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
        totalAmount = payload.items.reduce(
          (sum, item) => sum + item.salePrice * item.quantity,
          0
        );
      } catch (err: any) {
        console.error(`Error processing order:`, err);
        throw new Error(
          err.response?.data?.message || "Error al procesar el pedido"
        );
      }

      // Process warranty items as defective products
      for (const warranty of order.warranties) {
        try {
          await defectiveProductService.reportAdmin({
            productId: warranty.productId,
            quantity: warranty.quantity,
            reason:
              warranty.reason ||
              `${warranty.type === "supplier_replacement" ? "Reemplazo proveedor" : "Pérdida total"} - Orden ${saleGroupId}`,
          });
        } catch (err) {
          console.error(
            `Error processing warranty for ${warranty.productName}:`,
            err
          );
          // Don't fail the whole order for warranty errors
        }
      }

      // Success!
      setSaleResult({
        success: true,
        saleGroupId,
        totalAmount,
        totalItems: totalProcessedItems,
      });
    } catch (err: any) {
      console.error("Error submitting order:", err);
      setSubmitError(err.message || "Error al procesar el pedido");
    } finally {
      setIsSubmitting(false);
    }
  }, [order]);

  const handleNewOrder = useCallback(() => {
    dispatch({ type: "CLEAR_ORDER" });
    setSaleResult(null);
    setSubmitError(null);
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(value);

  const getProductNameById = (productId: string) =>
    products.find(product => product._id === productId)?.name || productId;

  const getCategoryNameById = (categoryId?: string) => {
    if (!categoryId) return "Categoria";
    const found = products.find(product => {
      const category = product.category as any;
      return category?._id === categoryId || category === categoryId;
    });
    const category = found?.category as any;
    return category?.name || category || categoryId;
  };

  const resolveMultiplierLabel = (multiplier: any) => {
    const type = multiplier?.type || "custom";
    const targetType = multiplier?.targetType || "all";
    const targetId = multiplier?.targetId || "";

    if (type === "weekend" || targetType === "weekend") {
      return "Fines de semana";
    }

    if (targetType === "product") {
      return `Producto: ${getProductNameById(targetId)}`;
    }

    if (targetType === "category") {
      return `Categoria: ${getCategoryNameById(targetId)}`;
    }

    return type === "custom" ? "Multiplicador" : type;
  };

  const projectedPoints = useMemo(() => {
    if (!isEmployee) return 0;
    const rules = gamificationConfig?.generalRules;
    const pointsPerCurrencyUnit = Number(rules?.pointsPerCurrencyUnit || 0);
    const pointsPerSaleConfirmed = Number(rules?.pointsPerSaleConfirmed || 0);
    const multipliers = gamificationConfig?.activeMultipliers || [];

    if (!pointsPerCurrencyUnit && !pointsPerSaleConfirmed) return 0;

    const discountAmount =
      order.discount || (order.subtotal * order.discountPercent) / 100 || 0;
    const subtotal = order.subtotal || 0;

    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    return order.items.reduce((total, item) => {
      const product = products.find(p => p._id === item.productId) as any;
      const itemSubtotal = (item.unitPrice || 0) * (item.quantity || 0);
      const discountShare =
        subtotal > 0 ? (itemSubtotal / subtotal) * discountAmount : 0;
      const saleAmount = Math.max(0, itemSubtotal - discountShare);
      let points = saleAmount * pointsPerCurrencyUnit + pointsPerSaleConfirmed;

      let multiplierValue = 1;
      for (const multiplier of multipliers) {
        if (!multiplier?.active) continue;
        const targetType = multiplier?.targetType || "all";
        const targetId = String(multiplier?.targetId || "");
        const value = Number(multiplier?.value || 1);

        if (value <= 0) continue;

        if (multiplier.type === "weekend" || targetType === "weekend") {
          if (isWeekend) multiplierValue *= value;
          continue;
        }

        if (targetType === "all") {
          multiplierValue *= value;
          continue;
        }

        if (targetType === "product") {
          if (String(item.productId) === targetId) multiplierValue *= value;
          continue;
        }

        if (targetType === "category") {
          const category = product?.category as any;
          const categoryId = category?._id || category || "";
          if (String(categoryId) === targetId) multiplierValue *= value;
        }
      }

      points *= multiplierValue;
      return total + Math.max(0, Math.round(points));
    }, 0);
  }, [
    gamificationConfig,
    isEmployee,
    order.items,
    order.discount,
    order.discountPercent,
    order.subtotal,
    products,
  ]);

  const projectedTotalPoints =
    (employeeStats?.totalPoints || 0) + projectedPoints;
  const projectedPointsToNext = gamificationSummary.next
    ? Math.max(0, gamificationSummary.nextMin - projectedTotalPoints)
    : 0;
  const projectedHitsNext = gamificationSummary.next
    ? projectedPointsToNext === 0
    : false;

  // ==================== LOADING STATE ====================
  if (dataLoading) {
    return (
      <div className="bg-app-sales-state flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // ==================== SUCCESS STATE ====================
  if (saleResult?.success) {
    return (
      <div className="bg-app-sales-state flex min-h-screen flex-col items-center justify-center p-6 text-white">
        <div className="mb-6 rounded-full bg-green-500/10 p-6">
          <CheckCircle className="h-20 w-20 text-green-500" />
        </div>
        <h1 className="mb-2 text-4xl font-bold">¡Pedido Confirmado!</h1>
        <p className="mb-8 text-gray-400">
          La transacción ha sido procesada exitosamente.
        </p>

        <Card className="w-full max-w-md space-y-4 rounded-2xl border-gray-700 bg-gray-800/50 p-6">
          <div className="flex justify-between">
            <span className="text-gray-400">Total Pagado:</span>
            <span className="text-2xl font-bold text-white">
              ${saleResult.totalAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Items Procesados:</span>
            <span className="text-white">{saleResult.totalItems}</span>
          </div>
          <div className="border-t border-gray-700 pt-4">
            <p className="text-center text-xs text-gray-500">
              ID del Pedido: {saleResult.saleGroupId}
            </p>
          </div>
        </Card>

        <div className="mt-8 flex gap-4">
          <Button
            onClick={handleNewOrder}
            size="lg"
            className="flex items-center gap-2 rounded-xl bg-purple-600 font-bold text-white hover:bg-purple-700"
          >
            <RefreshCcw className="h-5 w-5" />
            Nuevo Pedido
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              // Could navigate to sales history or print receipt
              window.print();
            }}
            className="flex items-center gap-2 rounded-xl border-gray-600 font-medium text-gray-300 hover:bg-gray-800"
          >
            <FileText className="h-5 w-5" />
            Imprimir
          </Button>
        </div>
      </div>
    );
  }

  // ==================== MAIN VIEW ====================
  return (
    <div className="bg-app-sales-shell relative min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute -right-40 top-20 h-[480px] w-[480px] rounded-full bg-amber-400/10 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-[360px] w-[360px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_45%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6">
        {/* Header */}
        <div className="mb-6 animate-fade-in">
          <div className="bg-linear-to-r rounded-2xl border border-white/10 from-slate-900/80 via-slate-800/70 to-slate-900/80 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-teal-300">
                  Punto de venta
                </p>
                <h1 className="font-display mt-2 flex items-center gap-3 text-3xl font-semibold sm:text-4xl">
                  <ShoppingBag className="h-8 w-8 text-teal-300" />
                  Registrar Venta
                </h1>
                <p className="mt-1 text-sm text-slate-300">
                  {isEmployee ? "Panel de Empleado" : "Panel de Administrador"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                  {isEmployee ? "Empleado" : "Administrador"}
                </span>
                <span className="rounded-full border border-slate-600/60 bg-slate-900/60 px-3 py-1 text-slate-200">
                  Items: {order.items.length}
                </span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">
                  Total: {formatCurrency(order.totalPayable)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">Paso 1</p>
            <p className="mt-1 text-sm font-semibold text-white">
              Origen y productos
            </p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">Paso 2</p>
            <p className="mt-1 text-sm font-semibold text-white">
              Cliente y condiciones
            </p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">Paso 3</p>
            <p className="mt-1 text-sm font-semibold text-white">
              Confirmar y cerrar
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {submitError && (
          <div className="mb-4 animate-fade-in rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-red-200 shadow-[0_20px_40px_-30px_rgba(248,113,113,0.6)]">
            <p className="font-semibold">Error al procesar el pedido</p>
            <p className="text-sm opacity-80">{submitError}</p>
          </div>
        )}

        {/* NEW LAYOUT: Two Main Columns */}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* ============ LEFT COLUMN: Products & Cart ============ */}
          <div className="space-y-5">
            {/* Location Selector - Compact */}
            <LocationSelector
              locationType={order.locationType}
              locationId={order.locationId}
              branches={branches}
              isEmployee={isEmployee}
              onLocationChange={handleLocationChange}
            />

            {/* Quick Selectors */}
            <div className="animate-fade-in-up rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.9)]">
              <h3 className="mb-4 text-lg font-semibold text-white">
                Selectores rapidos
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                    Productos
                  </p>
                  <ProductSelector
                    value={productSelectorId}
                    onChange={productId => {
                      setProductSelectorId(productId);
                      if (!productId) return;
                      const product = productsWithLocationStock.find(
                        p => p._id === productId
                      );
                      if (!product) return;

                      const stock =
                        order.locationType === "warehouse"
                          ? (product.warehouseStock ?? 0)
                          : order.locationType === "branch"
                            ? (product.branchStock ?? 0)
                            : (product.employeeStock ?? 0);

                      if (stock <= 0) {
                        setSubmitError(
                          `Sin stock disponible para ${product.name}.`
                        );
                        return;
                      }

                      handleAddProduct(product, 1);
                      setProductSelectorId("");
                    }}
                    placeholder="Buscar producto para agregar..."
                    showStock={true}
                    products={selectorProducts}
                  />
                </div>
              </div>
            </div>

            {/* Inventory Grid - Main Focus */}
            <div
              className="animate-fade-in-up"
              style={{ animationDelay: "120ms" }}
            >
              <InventoryGrid
                products={productsWithLocationStock}
                locationType={order.locationType}
                loading={dataLoading}
                onAddProduct={handleAddProduct}
              />
            </div>

            {/* Cart - Below Inventory */}
            <div
              className="animate-fade-in-up rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.9)]"
              style={{ animationDelay: "140ms" }}
            >
              <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
                🛒 Carrito
                {order.items.length > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-sm text-amber-200">
                    {order.items.length}
                  </span>
                )}
              </h3>
              <OrderCart
                items={order.items}
                onUpdateItem={handleUpdateItem}
                onRemoveItem={handleRemoveItem}
              />
            </div>
          </div>

          {/* ============ RIGHT COLUMN: Options & Summary ============ */}
          <div className="space-y-5">
            {isEmployee && (
              <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
                <h3 className="mb-3 text-lg font-semibold text-white">
                  🏅 Mi progreso
                </h3>
                {gamificationLoading ? (
                  <p className="text-sm text-gray-400">
                    Cargando gamificacion...
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-gray-900/40 p-3">
                        <p className="text-xs text-gray-400">Rango actual</p>
                        <p className="text-base font-semibold text-white">
                          {gamificationSummary.current?.name || "Sin rango"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-900/40 p-3">
                        <p className="text-xs text-gray-400">Puntos</p>
                        <p className="text-base font-semibold text-white">
                          {gamificationSummary.points}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-900/40 p-3">
                        <p className="text-xs text-gray-400">Ranking</p>
                        <p className="text-base font-semibold text-white">
                          {rankingInfo?.position
                            ? `#${rankingInfo.position} / ${rankingInfo.totalEmployees}`
                            : "Sin ranking"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-900/40 p-3">
                        <p className="text-xs text-gray-400">Bono comision</p>
                        <p className="text-base font-semibold text-white">
                          +{rankingInfo?.bonusCommission || 0}%
                        </p>
                      </div>
                    </div>

                    {gamificationSummary.next ? (
                      <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3 text-sm">
                        <p className="text-xs text-gray-400">Siguiente rango</p>
                        <p className="font-semibold text-white">
                          {gamificationSummary.next.name}
                        </p>
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                            <span>
                              {gamificationSummary.currentMin} /{" "}
                              {gamificationSummary.nextMin} pts
                            </span>
                            <span>
                              {Math.round(gamificationSummary.progressPercent)}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-700">
                            <div
                              className="h-2 rounded-full bg-purple-500"
                              style={{
                                width: `${gamificationSummary.progressPercent}%`,
                              }}
                            />
                          </div>
                        </div>
                        <p className="mt-1 text-gray-300">
                          Te faltan {gamificationSummary.pointsToNext} puntos.
                        </p>
                        {gamificationSummary.estimatedRevenueToNext !==
                          null && (
                          <p className="text-gray-400">
                            Aprox{" "}
                            {formatCurrency(
                              gamificationSummary.estimatedRevenueToNext
                            )}{" "}
                            en ventas.
                          </p>
                        )}
                        {gamificationSummary.estimatedSalesToNext !== null && (
                          <p className="text-gray-400">
                            O ~{gamificationSummary.estimatedSalesToNext} ventas
                            confirmadas.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3 text-sm text-gray-300">
                        Estas en el rango maximo.
                      </div>
                    )}

                    <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3 text-sm">
                      <p className="text-xs text-gray-400">
                        Multiplicadores activos
                      </p>
                      {gamificationConfig?.activeMultipliers?.filter(
                        m => m.active
                      ).length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {gamificationConfig?.activeMultipliers
                            ?.filter(m => m.active)
                            .map((multiplier, idx) => (
                              <span
                                key={`${multiplier.type}-${idx}`}
                                className="rounded-full bg-purple-500/20 px-3 py-1 text-xs text-purple-200"
                              >
                                {resolveMultiplierLabel(multiplier)}
                                {multiplier.value
                                  ? ` x${multiplier.value}`
                                  : ""}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-gray-500">
                          No hay multiplicadores activos.
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3 text-sm">
                      <p className="text-xs text-gray-400">
                        Proyeccion de puntos con este carrito
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        +{projectedPoints} pts
                      </p>
                      <p className="text-sm text-gray-300">
                        Total estimado: {projectedTotalPoints} pts
                      </p>
                      {gamificationSummary.next && (
                        <p className="text-xs text-gray-400">
                          {projectedHitsNext
                            ? `Alcanzas ${gamificationSummary.next.name}`
                            : `Te faltarian ${projectedPointsToNext} pts para ${gamificationSummary.next.name}`}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Estimado; se confirma al aprobar la venta.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Customer Selector */}
            <CustomerSelector
              customerId={order.customerId}
              customerName={order.customerName}
              onSelectCustomer={(id, name) =>
                dispatch({
                  type: "SET_CUSTOMER",
                  customerId: id,
                  customerName: name,
                })
              }
            />

            {/* Financial Panel - Compact */}
            <FinancialPanel
              paymentMethod={order.paymentMethod}
              deliveryMethod={order.deliveryMethod}
              shippingCost={order.shippingCost}
              discount={order.discount}
              discountPercent={order.discountPercent}
              additionalCosts={order.additionalCosts}
              creditDueDate={order.creditDueDate}
              initialPayment={order.initialPayment}
              totalPayable={order.totalPayable}
              onPaymentMethodChange={method =>
                dispatch({ type: "SET_PAYMENT_METHOD", method })
              }
              onDeliveryMethodChange={method =>
                dispatch({ type: "SET_DELIVERY_METHOD", method })
              }
              onShippingCostChange={cost =>
                dispatch({ type: "SET_SHIPPING_COST", cost })
              }
              onDiscountChange={amount =>
                dispatch({ type: "SET_DISCOUNT", amount })
              }
              onDiscountPercentChange={percent =>
                dispatch({ type: "SET_DISCOUNT_PERCENT", percent })
              }
              onAddCost={cost =>
                dispatch({ type: "ADD_ADDITIONAL_COST", cost })
              }
              onRemoveCost={costId =>
                dispatch({ type: "REMOVE_ADDITIONAL_COST", costId })
              }
              onCreditDueDateChange={date =>
                dispatch({ type: "SET_CREDIT_DUE_DATE", date })
              }
              onInitialPaymentChange={amount =>
                dispatch({ type: "SET_INITIAL_PAYMENT", amount })
              }
            />

            {isEmployee && order.paymentMethod === "transfer" && (
              <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
                <h4 className="mb-2 text-sm font-medium text-gray-400">
                  🧾 Comprobante de pago
                </h4>
                {order.paymentProof ? (
                  <div className="relative">
                    <img
                      src={order.paymentProof}
                      alt="Comprobante"
                      className="h-36 w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "SET_PAYMENT_PROOF",
                          paymentProof: null,
                          paymentProofMimeType: null,
                        })
                      }
                      className="absolute right-2 top-2 rounded-full bg-red-600 p-1 text-white hover:bg-red-700"
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
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-600 p-4 transition-colors hover:border-gray-500">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e =>
                        handlePaymentProofUpload(e.target.files?.[0])
                      }
                      className="hidden"
                    />
                    <div className="text-center">
                      <svg
                        className="mx-auto h-8 w-8 text-gray-400"
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
                      <p className="mt-1 text-sm text-gray-400">
                        Subir comprobante
                      </p>
                    </div>
                  </label>
                )}
              </div>
            )}

            {/* Notes - Compact */}
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
              <h4 className="mb-2 text-sm font-medium text-gray-400">
                📝 Notas
              </h4>
              <textarea
                value={order.notes}
                onChange={e =>
                  dispatch({ type: "SET_NOTES", notes: e.target.value })
                }
                className="h-20 w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500"
                placeholder="Notas opcionales..."
              />
            </div>

            {/* Warranty Section - Collapsible */}
            <WarrantySection
              warranties={order.warranties}
              products={products}
              onAddWarranty={warranty =>
                dispatch({ type: "ADD_WARRANTY", warranty })
              }
              onRemoveWarranty={warrantyId =>
                dispatch({ type: "REMOVE_WARRANTY", warrantyId })
              }
            />

            {/* Order Summary - Sticky at bottom */}
            <div className="lg:sticky lg:top-4">
              <OrderSummary
                order={order}
                isSubmitting={isSubmitting}
                onConfirm={handleConfirmOrder}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
