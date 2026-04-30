/**
 * Admin Register Sale Page - Full Bulk Order System
 * Complete order management with location context, advanced cart, financial logic,
 * warranty management, and customer integration
 */

import {
  CheckCircle,
  FileText,
  Package,
  Plus,
  RefreshCcw,
  ShoppingBag,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import PromotionSelector from "../../../components/PromotionSelector";
import { useBusiness } from "../../../context/BusinessContext";
import type { RegisterPromotionSaleInput } from "../../../core/domain/sales/sales.types";
import { salesWriteUseCases } from "../../../core/use-cases/sales";
import { useSession } from "../../../hooks/useSession";
import { Button, Card } from "../../../shared/components/ui";
import LoadingSpinner from "../../../shared/components/ui/LoadingSpinner";
import { branchService } from "../../branches/services/branch.service";
import type { Branch } from "../../business/types/business.types";
import { employeeService } from "../../employees/services/employee.service";
import { productsService } from "../../inventory/api/products.service";
import { stockService } from "../../inventory/services/inventory.service";
import type { Product } from "../../inventory/types/product.types";
import { promotionService } from "../../settings/services";
import type { Promotion } from "../../settings/types/promotion.types";
import {
  CustomerSelector,
  FinancialPanel,
  LocationSelector,
  OrderCart,
  OrderSummary,
  WarrantySection,
} from "../components/admin-order";
import { initialOrderState, orderReducer } from "../reducers/orderReducer";
import { defectiveProductService } from "../services/sales.service";
import type {
  AdminOrderPayload,
  ProductWithStock,
} from "../types/admin-order.types";

const resolveEntityId = (value: unknown): string => {
  if (!value) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : "";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "object") {
    const candidate = value as {
      _id?: unknown;
      id?: unknown;
      $oid?: unknown;
      toHexString?: () => string;
      toString?: () => string;
    };

    const nested =
      resolveEntityId(candidate._id) ||
      resolveEntityId(candidate.id) ||
      resolveEntityId(candidate.$oid);
    if (nested) return nested;

    if (typeof candidate.toHexString === "function") {
      const hex = resolveEntityId(candidate.toHexString());
      if (hex) return hex;
    }

    if (typeof candidate.toString === "function") {
      const raw = candidate.toString();
      if (raw && raw !== "[object Object]") {
        return raw;
      }
    }
  }

  return "";
};

const resolveBusinessIdFromSessionUser = (sessionUser: unknown): string => {
  if (!sessionUser || typeof sessionUser !== "object") {
    return "";
  }

  const candidate = sessionUser as {
    business?: unknown;
    memberships?: Array<{ business?: unknown; status?: unknown }>;
  };

  const directBusinessId = resolveEntityId(candidate.business);
  if (directBusinessId) {
    return directBusinessId;
  }

  const membershipBusinessIds = Array.isArray(candidate.memberships)
    ? candidate.memberships
        .filter(membership => {
          const status = String(membership?.status || "").toLowerCase();
          return status !== "pending" && status !== "suspended";
        })
        .map(membership => resolveEntityId(membership.business))
        .filter(Boolean)
    : [];

  const uniqueBusinessIds = Array.from(new Set(membershipBusinessIds));
  return uniqueBusinessIds.length === 1 ? uniqueBusinessIds[0] : "";
};

const normalizeRole = (role: unknown): string =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const isEmployeeRole = (role: unknown): boolean => {
  const normalized = normalizeRole(role);
  return normalized === "employee" || normalized === "operativo";
};

const resolveSessionMembershipRole = (sessionUser: unknown): string => {
  if (!sessionUser || typeof sessionUser !== "object") {
    return "";
  }

  const candidate = sessionUser as {
    memberships?: Array<{ role?: unknown; status?: unknown }>;
  };

  const activeMembership = Array.isArray(candidate.memberships)
    ? candidate.memberships.find(membership => {
        const status = normalizeRole(membership?.status);
        return status === "active" || status === "invited";
      })
    : null;

  return normalizeRole(activeMembership?.role);
};

export default function PromotionSalePage() {
  const { user, loading: userLoading } = useSession();
  const { businessId: contextBusinessId, hydrating: businessHydrating } =
    useBusiness();
  const isEmployee =
    isEmployeeRole(user?.role) ||
    isEmployeeRole(resolveSessionMembershipRole(user));
  const currentUserId = resolveEntityId(user) || "";
  const effectiveBusinessId = useMemo(
    () =>
      resolveEntityId(contextBusinessId) ||
      resolveEntityId(localStorage.getItem("businessId")) ||
      resolveBusinessIdFromSessionUser(user) ||
      "",
    [contextBusinessId, user]
  );

  useEffect(() => {
    if (!effectiveBusinessId) {
      return;
    }

    const storedBusinessId = resolveEntityId(
      localStorage.getItem("businessId")
    );
    if (storedBusinessId !== effectiveBusinessId) {
      localStorage.setItem("businessId", effectiveBusinessId);
    }
  }, [effectiveBusinessId]);

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
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const [promotionsError, setPromotionsError] = useState<string | null>(null);
  const [promotionSelectorId, setPromotionSelectorId] = useState("");

  // State: Loading/Error/Success
  const [dataLoading, setDataLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saleResult, setSaleResult] = useState<{
    success: boolean;
    saleGroupId: string;
    totalAmount: number;
    totalItems: number;
  } | null>(null);

  // Initialize ONLY ONCE
  /* Removed the useEffect that forces location reset on mount to avoid overriding user selection */

  // Update location when user loads (fix timing issue)
  useEffect(() => {
    if (user && isEmployee) {
      dispatch({
        type: "SET_LOCATION",
        locationType: "employee",
        locationId: currentUserId || "employee",
        locationName: "Mi Inventario",
      });
      dispatch({ type: "SET_PAYMENT_METHOD", method: "transfer" });
    }
  }, [currentUserId, isEmployee, user]);

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

          const preferredBranch = employeeBranches.find(
            branch => !branch.isWarehouse
          );

          if (preferredBranch) {
            dispatch({
              type: "SET_LOCATION",
              locationType: "branch",
              locationId: resolveEntityId(preferredBranch._id),
              locationName: preferredBranch.name,
            });
          } else {
            dispatch({
              type: "SET_LOCATION",
              locationType: "employee",
              locationId: currentUserId || "employee",
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
  }, [currentUserId, isEmployee, userLoading]);

  useEffect(() => {
    if (userLoading) return;

    const fetchPromotions = async () => {
      setPromotionsLoading(true);
      setPromotionsError(null);
      try {
        const response = await promotionService.getAll({ status: "active" });
        setPromotions(response.promotions || []);
      } catch (error) {
        console.error("Error fetching promotions:", error);
        setPromotionsError("Error al cargar promociones");
      } finally {
        setPromotionsLoading(false);
      }
    };

    fetchPromotions();
  }, [userLoading]);

  useEffect(() => {
    if (!isEmployee) {
      dispatch({
        type: "SET_EMPLOYEE_PROFIT",
        isEmployeeSale: false,
        profitPercentage: 0,
      });
      return;
    }

    const userData = user as {
      isCommissionFixed?: boolean;
      customCommissionRate?: number;
    };
    const fixedRate = Number(userData?.customCommissionRate);
    const resolvedProfitPercentage =
      userData?.isCommissionFixed &&
      Number.isFinite(fixedRate) &&
      fixedRate >= 0
        ? fixedRate
        : 20;

    const normalizedProfitPercentage = Math.max(
      0,
      Math.min(95, resolvedProfitPercentage)
    );

    dispatch({
      type: "SET_EMPLOYEE_PROFIT",
      isEmployeeSale: true,
      profitPercentage: normalizedProfitPercentage,
    });
  }, [isEmployee, user]);

  // Fetch branch stock when branch location is selected
  useEffect(() => {
    const fetchBranchStock = async () => {
      if (order.locationType !== "branch" || !order.locationId) return;

      try {
        const branchStockData = await branchService.getBranchStock(
          order.locationId
        );

        const stockMap = new Map<string, number>();
        branchStockData.stock.forEach(item => {
          if (item.product?._id) {
            stockMap.set(String(item.product._id), item.quantity || 0);
          }
        });
        setBranchStock(stockMap);
      } catch (error) {
        console.error("Error fetching branch stock:", error);
      }
    };

    fetchBranchStock();
  }, [order.locationType, order.locationId]);

  // Products with correct stock based on location
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

      return {
        ...p,
        branchStock: order.locationType === "branch" ? stock : undefined,
        employeeStock: order.locationType === "employee" ? stock : undefined,
        // HYBRID MODEL: Employees CAN see warehouse stock for dropshipping
        warehouseStock:
          order.locationType === "warehouse" ? stock : p.warehouseStock,
      };
    });
  }, [products, order.locationType, branchStock]);

  const sellablePromotions = useMemo(
    () =>
      promotions.filter(
        promo =>
          (promo.type === "bundle" || promo.type === "combo") &&
          (promo.comboItems?.length || 0) > 0
      ),
    [promotions]
  );

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

  const handleAddPromotion = useCallback(
    (promotion: Promotion) => {
      setSubmitError(null);

      const resolvePositive = (value: unknown) => {
        const num = Number(value);
        return Number.isFinite(num) && num > 0 ? num : null;
      };

      const items = promotion.comboItems || [];
      if (items.length === 0) {
        setSubmitError("Esta promocion no tiene productos configurados.");
        return;
      }

      const baseTotal = items.reduce((sum, item) => {
        const product =
          typeof item.product === "object" && item.product !== null
            ? item.product
            : null;
        const unitPrice =
          item.unitPrice ??
          product?.clientPrice ??
          product?.suggestedPrice ??
          0;
        return sum + unitPrice * (item.quantity || 1);
      }, 0);

      const baseEmployeeTotal = items.reduce((sum, item) => {
        const product =
          typeof item.product === "object" && item.product !== null
            ? item.product
            : null;
        const unitPrice =
          resolvePositive(product?.employeePrice) ??
          item.unitPrice ??
          product?.clientPrice ??
          product?.suggestedPrice ??
          0;
        return sum + unitPrice * (item.quantity || 1);
      }, 0);

      const promotionTotal =
        promotion.promotionPrice && promotion.promotionPrice > 0
          ? promotion.promotionPrice
          : baseTotal;
      const ratio = baseTotal > 0 ? promotionTotal / baseTotal : 1;
      const employeeTotal =
        promotion.employeePrice && promotion.employeePrice > 0
          ? promotion.employeePrice
          : baseEmployeeTotal;
      const employeeRatio =
        baseEmployeeTotal > 0 ? employeeTotal / baseEmployeeTotal : 1;

      const additions: Array<{
        product: ProductWithStock;
        quantity: number;
        unitPrice: number;
        employeePrice: number;
      }> = [];
      const missingProducts: string[] = [];
      const insufficientStock: string[] = [];

      items.forEach(item => {
        const productId =
          typeof item.product === "string" ? item.product : item.product?._id;
        if (!productId) return;

        const product = productsWithLocationStock.find(
          p => p._id === productId
        );
        if (!product) {
          const label =
            typeof item.product === "object" && item.product !== null
              ? item.product.name
              : productId;
          missingProducts.push(label || productId);
          return;
        }

        const stock =
          order.locationType === "warehouse"
            ? (product.warehouseStock ?? 0)
            : order.locationType === "branch"
              ? (product.branchStock ?? 0)
              : (product.employeeStock ?? 0);

        const quantity = item.quantity || 1;
        if (stock < quantity) {
          insufficientStock.push(product.name);
          return;
        }

        const baseUnitPrice =
          item.unitPrice ?? product.clientPrice ?? product.employeePrice ?? 0;
        const promoUnitPrice = Math.max(0, Math.round(baseUnitPrice * ratio));
        const baseEmployeeUnitPrice =
          resolvePositive(product.employeePrice) ?? baseUnitPrice;
        const promoEmployeeUnitPrice = Math.max(
          0,
          Math.round(baseEmployeeUnitPrice * employeeRatio)
        );

        additions.push({
          product,
          quantity,
          unitPrice: promoUnitPrice,
          employeePrice: promoEmployeeUnitPrice,
        });
      });

      if (missingProducts.length > 0) {
        setSubmitError(
          `No se pudieron cargar productos de la promocion: ${missingProducts.join(
            ", "
          )}.`
        );
        return;
      }

      if (insufficientStock.length > 0) {
        setSubmitError(
          `Sin stock suficiente para: ${insufficientStock.join(", ")}.`
        );
        return;
      }

      additions.forEach(({ product, quantity, unitPrice, employeePrice }) => {
        const existing = order.items.find(i => i.productId === product._id);
        if (existing) {
          dispatch({
            type: "UPDATE_ITEM",
            itemId: existing.id,
            updates: {
              quantity: existing.quantity + quantity,
              unitPrice,
              employeePrice,
              isPromotion: true,
              promotionId: promotion._id,
            },
          });
        } else {
          dispatch({
            type: "ADD_ITEM",
            item: {
              productId: product._id,
              productName: product.name,
              promotionId: promotion._id,
              quantity,
              unitPrice,
              employeePrice,
              isPromotion: true,
              purchasePrice: product.averageCost ?? product.purchasePrice ?? 0,
              availableStock:
                order.locationType === "warehouse"
                  ? (product.warehouseStock ?? 0)
                  : order.locationType === "branch"
                    ? (product.branchStock ?? 0)
                    : (product.employeeStock ?? 0),
              category:
                typeof product.category === "object"
                  ? product.category?.name
                  : product.category,
              image: product.image,
            },
          });
        }
      });
    },
    [order.items, order.locationType, productsWithLocationStock]
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
          promotionId: item.promotionId,
          quantity: item.quantity,
          salePrice: item.unitPrice,
          isPromotion: true,
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

      if (order.locationType === "employee" && order.locationId) {
        payload.employeeId = order.locationId;
      }

      if (isEmployee && currentUserId) {
        payload.employeeId = currentUserId;
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
        const hasMissingPromotion = payload.items.some(
          item => !item.promotionId
        );
        if (hasMissingPromotion) {
          throw new Error(
            "Todas las lineas deben pertenecer a una promocion activa."
          );
        }

        const promotionPayload: RegisterPromotionSaleInput = {
          items: payload.items.map(item => ({
            productId: item.productId,
            promotionId: item.promotionId as string,
            quantity: item.quantity,
            salePrice: item.salePrice,
            isPromotion: true,
          })),
          employeeId: payload.employeeId,
          businessId: effectiveBusinessId || undefined,
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
          shippingCost: payload.shippingCost,
          additionalCosts: payload.additionalCosts,
          paymentProof: payload.paymentProof,
          paymentProofMimeType: payload.paymentProofMimeType,
        };

        await salesWriteUseCases.registerPromotionBulk(promotionPayload);

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
  }, [currentUserId, effectiveBusinessId, isEmployee, order]);

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
                  Registrar Promocion
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
              Elige promociones
            </p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">Paso 2</p>
            <p className="mt-1 text-sm font-semibold text-white">
              Ajusta pago y entrega
            </p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">Paso 3</p>
            <p className="mt-1 text-sm font-semibold text-white">
              Confirma la operación
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
                    Promociones
                  </p>
                  <PromotionSelector
                    value={promotionSelectorId}
                    promotions={sellablePromotions}
                    onChange={(promotionId, promotion) => {
                      setPromotionSelectorId(promotionId);
                      if (!promotionId || !promotion) return;
                      handleAddPromotion(promotion);
                      setPromotionSelectorId("");
                    }}
                    placeholder="Buscar promocion..."
                  />
                </div>
              </div>
            </div>

            {/* Promotions */}
            <div className="bg-linear-to-br animate-fade-in-up rounded-2xl border border-white/10 from-slate-900/80 via-slate-900/60 to-slate-800/60 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)] backdrop-blur">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <ShoppingBag className="h-5 w-5 text-teal-300" />
                Promociones Activas
              </h3>

              {promotionsLoading && (
                <div className="flex h-24 items-center justify-center text-gray-400">
                  Cargando promociones...
                </div>
              )}

              {promotionsError && (
                <div className="mb-3 rounded-lg border border-red-500/40 bg-red-900/20 p-3 text-sm text-red-300">
                  {promotionsError}
                </div>
              )}

              {!promotionsLoading && sellablePromotions.length === 0 && (
                <div className="flex h-20 items-center justify-center text-gray-500">
                  No hay promociones activas para vender.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {sellablePromotions.map(promo => {
                  const promoItems = promo.comboItems || [];
                  const promoImage =
                    promo.image?.url ||
                    (typeof promoItems[0]?.product === "object"
                      ? promoItems[0]?.product?.image?.url
                      : undefined);
                  const fallbackTotal = promoItems.reduce((sum, item) => {
                    const product =
                      typeof item.product === "object" && item.product !== null
                        ? item.product
                        : null;
                    const unitPrice =
                      item.unitPrice ??
                      product?.clientPrice ??
                      product?.suggestedPrice ??
                      0;
                    return sum + unitPrice * (item.quantity || 1);
                  }, 0);
                  const displayPrice =
                    promo.promotionPrice && promo.promotionPrice > 0
                      ? promo.promotionPrice
                      : fallbackTotal;

                  return (
                    <div
                      key={promo._id}
                      className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 transition hover:-translate-y-0.5 hover:border-teal-500/50 hover:shadow-[0_15px_30px_-20px_rgba(45,212,191,0.6)]"
                    >
                      <div className="flex items-start gap-3">
                        {promoImage ? (
                          <img
                            src={promoImage}
                            alt={promo.name}
                            className="h-12 w-12 rounded-lg object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-700">
                            <Package className="h-6 w-6 text-gray-500" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {promo.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {promoItems.length} productos incluidos
                          </p>
                          <p className="mt-1 text-sm font-bold text-green-400">
                            ${displayPrice.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddPromotion(promo)}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500/20 px-3 py-2 text-sm font-medium text-teal-200 transition hover:bg-teal-500/30"
                      >
                        <Plus className="h-4 w-4" />
                        Agregar promocion
                      </button>
                    </div>
                  );
                })}
              </div>
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
                      referrerPolicy="no-referrer"
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
