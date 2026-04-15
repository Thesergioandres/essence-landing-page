import { useEffect, useMemo, useState } from "react";
import ProductSelector from "../../../components/ProductSelector";
import { useSession } from "../../../hooks/useSession";
import { Button } from "../../../shared/components/ui";
import { branchService } from "../../branches/services";
import {
  productService,
  stockService,
} from "../../inventory/services/inventory.service";
import type {
  Branch,
  BranchStock,
  EmployeeStock,
  Product,
} from "../../inventory/types/product.types";
import { saleService, warrantyService } from "../../sales/services";
import type { Sale } from "../../sales/types/sales.types";

type ReplacementSource = "warehouse" | "branch" | "employee";

type SaleLookupItem = {
  saleItemId: string;
  saleGroupId?: string;
  saleId?: string;
  saleDate?: string;
  product: Product | string;
  quantity: number;
  salePrice: number;
  employee?: { _id: string; name: string } | string | null;
  branch?: { _id: string; name: string } | string | null;
  sourceLocation?: "warehouse" | "branch" | "employee" | null;
  createdBy?: { _id: string; name: string } | string | null;
};

type SaleLookupResponse = {
  saleGroupId: string;
  saleId: string;
  saleDate: string;
  seller: {
    role: "admin" | "employee";
    user: { _id: string; name: string; email?: string } | string | null;
  };
  items: SaleLookupItem[];
};

export default function CustomerWarrantyPage() {
  const { user } = useSession();
  const isEmployee = user?.role === "employee";

  const [lookupId, setLookupId] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [saleData, setSaleData] = useState<SaleLookupResponse | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState("");
  const [filterText, setFilterText] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");
  const [filterSellerId, setFilterSellerId] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("");
  const [filterMinTotal, setFilterMinTotal] = useState("");
  const [filterMaxTotal, setFilterMaxTotal] = useState("");
  const [sortBy, setSortBy] = useState<
    "date-desc" | "date-asc" | "amount-desc" | "amount-asc"
  >("date-desc");

  const [selectedSaleItemId, setSelectedSaleItemId] = useState("");
  const [defectiveQuantity, setDefectiveQuantity] = useState(1);
  const [reason, setReason] = useState("");

  const [replacementSource, setReplacementSource] = useState<ReplacementSource>(
    isEmployee ? "employee" : "warehouse"
  );
  const [replacementBranchId, setReplacementBranchId] = useState("");
  const [replacementProductId, setReplacementProductId] = useState("");
  const [replacementPrice, setReplacementPrice] = useState("");
  const [cashRefund, setCashRefund] = useState("");

  const [warehouseProducts, setWarehouseProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchStock, setBranchStock] = useState<BranchStock[]>([]);
  const [employeeStock, setEmployeeStock] = useState<EmployeeStock[]>(
    []
  );
  const [allowedBranches, setAllowedBranches] = useState<
    Array<{
      _id: string;
      name: string;
      stock: Array<{ product: Product; quantity: number }>;
    }>
  >([]);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (isEmployee && replacementSource === "warehouse") {
      setReplacementSource("employee");
    }
    if (!isEmployee && replacementSource === "employee") {
      setReplacementSource("warehouse");
    }
  }, [isEmployee, replacementSource]);

  useEffect(() => {
    const loadSources = async () => {
      try {
        if (isEmployee) {
          const [distStock, branchesResponse] = await Promise.all([
            stockService.getEmployeeStock("me").catch(() => []),
            stockService.getMyAllowedBranches().catch(() => ({ branches: [] })),
          ]);
          setEmployeeStock(distStock || []);
          setAllowedBranches(branchesResponse.branches || []);
        } else {
          const [productsResponse, branchesResponse] = await Promise.all([
            productService.getAll({ limit: 1000, excludePromotions: true }),
            branchService.list(),
          ]);
          const productsList = Array.isArray(productsResponse)
            ? productsResponse
            : productsResponse.data || [];
          setWarehouseProducts(productsList);
          setBranches(branchesResponse || []);
        }
      } catch (error) {
        console.error("Error al cargar fuentes de stock:", error);
      }
    };

    loadSources();
  }, [isEmployee]);

  useEffect(() => {
    const loadSales = async () => {
      try {
        setSalesLoading(true);
        setSalesError("");
        if (isEmployee) {
          const response = await saleService.getEmployeeSales();
          setSales(response.sales || []);
        } else {
          const response = await saleService.getAllSales({ limit: 50 });
          setSales(response.sales || []);
        }
      } catch (error: any) {
        console.error("Error al cargar ventas:", error);
        setSalesError(
          error.response?.data?.message || "No se pudieron cargar las ventas"
        );
      } finally {
        setSalesLoading(false);
      }
    };

    loadSales();
  }, [isEmployee]);

  useEffect(() => {
    if (!replacementBranchId) {
      setBranchStock([]);
      return;
    }

    const loadBranchStock = async () => {
      try {
        const stock = await stockService.getBranchStock(replacementBranchId);
        setBranchStock(stock || []);
      } catch (error) {
        console.error("Error al cargar stock de sede:", error);
        setBranchStock([]);
      }
    };

    if (replacementSource === "branch" && !isEmployee) {
      loadBranchStock();
    }
  }, [replacementBranchId, replacementSource, isEmployee]);

  const selectedSaleItem = saleData?.items.find(
    item => item.saleItemId === selectedSaleItemId
  );
  const saleProduct =
    selectedSaleItem && typeof selectedSaleItem.product === "object"
      ? selectedSaleItem.product
      : null;

  const maxDefectiveQuantity = selectedSaleItem?.quantity || 0;

  const employeeProducts = useMemo(() => {
    return employeeStock
      .map(item => {
        const product =
          typeof item.product === "object" ? (item.product as Product) : null;
        if (!product) return null;
        return {
          ...product,
          totalStock: item.quantity,
        };
      })
      .filter(item => item && (item.totalStock || 0) > 0) as Product[];
  }, [employeeStock]);

  const allowedBranch = allowedBranches.find(
    branch => branch._id === replacementBranchId
  );

  const allowedBranchProducts = useMemo(() => {
    const stock = allowedBranch?.stock || [];
    return stock
      .map(item => ({
        ...item.product,
        totalStock: item.quantity,
      }))
      .filter(item => (item.totalStock || 0) > 0);
  }, [allowedBranch]);

  const adminBranchProducts = useMemo(() => {
    return branchStock
      .map(item => {
        const product = typeof item.product === "object" ? item.product : null;
        if (!product) return null;
        return {
          ...product,
          totalStock: item.quantity,
        };
      })
      .filter(item => item && (item.totalStock || 0) > 0) as Product[];
  }, [branchStock]);

  const warehouseSelectableProducts = useMemo(() => {
    return warehouseProducts
      .filter(product => (product.warehouseStock || 0) > 0)
      .map(product => ({
        ...product,
        totalStock: product.warehouseStock || 0,
      }));
  }, [warehouseProducts]);

  const replacementProducts = useMemo(() => {
    if (replacementSource === "employee") return employeeProducts;
    if (replacementSource === "branch") {
      return isEmployee ? allowedBranchProducts : adminBranchProducts;
    }
    return warehouseSelectableProducts;
  }, [
    replacementSource,
    employeeProducts,
    allowedBranchProducts,
    adminBranchProducts,
    warehouseSelectableProducts,
    isEmployee,
  ]);

  useEffect(() => {
    if (!replacementProductId) return;
    const product = replacementProducts.find(
      p => p._id === replacementProductId
    );
    if (!product) return;
    const defaultPrice =
      product.clientPrice ||
      product.suggestedPrice ||
      product.employeePrice ||
      0;
    setReplacementPrice(defaultPrice ? String(defaultPrice) : "");
  }, [replacementProductId, replacementProducts]);

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();
    sales.forEach(sale => {
      if (!sale.branch) return;
      if (typeof sale.branch === "object") {
        if (sale.branch._id) map.set(sale.branch._id, sale.branch.name);
      } else {
        map.set(sale.branch, "Sede");
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sales]);

  const isWarehouseBranch = (branch: Branch) => {
    if (branch.isWarehouse) return true;
    const name = String(branch.name || "")
      .trim()
      .toLowerCase();
    return name === "bodega" || name === "bodega (central)";
  };

  const replacementBranchOptions = useMemo(() => {
    if (isEmployee) return allowedBranches;
    return branches.filter(branch => !isWarehouseBranch(branch));
  }, [allowedBranches, branches, isEmployee]);

  const sellerOptions = useMemo(() => {
    const map = new Map<string, string>();
    sales.forEach(sale => {
      if (sale.employee) {
        if (typeof sale.employee === "object") {
          map.set(sale.employee._id, sale.employee.name || "Employee");
        } else {
          map.set(sale.employee, "Employee");
        }
        return;
      }
      if (sale.createdBy) {
        if (typeof sale.createdBy === "object") {
          map.set(sale.createdBy._id, sale.createdBy.name || "Vendedor");
        } else {
          map.set(sale.createdBy, "Vendedor");
        }
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sales]);

  const filteredSales = useMemo(() => {
    const minTotal = filterMinTotal ? Number(filterMinTotal) : null;
    const maxTotal = filterMaxTotal ? Number(filterMaxTotal) : null;
    const text = filterText.trim().toLowerCase();

    const matchesDateRange = (saleDate: string) => {
      const date = new Date(saleDate);
      if (filterStartDate) {
        const start = new Date(filterStartDate);
        if (date < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (date > end) return false;
      }
      return true;
    };

    const getSellerId = (sale: Sale) => {
      if (sale.employee) {
        return typeof sale.employee === "object"
          ? sale.employee._id
          : sale.employee;
      }
      if (sale.createdBy) {
        return typeof sale.createdBy === "object"
          ? sale.createdBy._id
          : sale.createdBy;
      }
      return "";
    };

    const getBranchId = (sale: Sale) => {
      if (!sale.branch) return "";
      return typeof sale.branch === "object" ? sale.branch._id : sale.branch;
    };

    const getSearchText = (sale: Sale) => {
      const productName =
        typeof sale.product === "object" ? sale.product?.name : "";
      const customerName = sale.customerName || "";
      const branchName =
        typeof sale.branch === "object" ? sale.branch?.name : "";
      const sellerName = sale.employee
        ? typeof sale.employee === "object"
          ? sale.employee?.name
          : ""
        : typeof sale.createdBy === "object"
          ? sale.createdBy?.name
          : "";
      return `${sale.saleId || ""} ${productName || sale.productName || ""} ${customerName} ${branchName} ${sellerName}`
        .toLowerCase()
        .trim();
    };

    const result = sales.filter(sale => {
      if (isEmployee) {
        const employeeId =
          typeof sale.employee === "object"
            ? sale.employee?._id
            : sale.employee;
        if (!employeeId || employeeId !== user?._id) return false;
      }
      const total = (sale.salePrice || 0) * (sale.quantity || 0);
      if (text && !getSearchText(sale).includes(text)) return false;
      if (filterPaymentStatus && sale.paymentStatus !== filterPaymentStatus) {
        return false;
      }
      if (filterBranchId && getBranchId(sale) !== filterBranchId) {
        return false;
      }
      if (filterSellerId && getSellerId(sale) !== filterSellerId) {
        return false;
      }
      if (minTotal !== null && total < minTotal) return false;
      if (maxTotal !== null && total > maxTotal) return false;
      if (!matchesDateRange(sale.saleDate)) return false;
      return true;
    });

    const sorted = [...result].sort((a, b) => {
      const totalA = (a.salePrice || 0) * (a.quantity || 0);
      const totalB = (b.salePrice || 0) * (b.quantity || 0);
      const dateA = new Date(a.saleDate).getTime();
      const dateB = new Date(b.saleDate).getTime();
      if (sortBy === "date-asc") return dateA - dateB;
      if (sortBy === "date-desc") return dateB - dateA;
      if (sortBy === "amount-asc") return totalA - totalB;
      return totalB - totalA;
    });

    return sorted;
  }, [
    sales,
    filterText,
    filterStartDate,
    filterEndDate,
    filterBranchId,
    filterSellerId,
    filterPaymentStatus,
    filterMinTotal,
    filterMaxTotal,
    sortBy,
    isEmployee,
    user?._id,
  ]);

  const replacementUnitPrice = replacementPrice ? Number(replacementPrice) : 0;
  const originalUnitPrice = selectedSaleItem?.salePrice || 0;
  const originalTotal = originalUnitPrice * defectiveQuantity;
  const replacementTotal = replacementUnitPrice * defectiveQuantity;
  const suggestedRefund = Math.max(0, originalTotal - replacementTotal);

  const handleLookup = async (overrideId?: string) => {
    const resolvedId = (overrideId || lookupId).trim();
    if (!resolvedId) {
      setLookupError("Ingresa el ID de la venta");
      return;
    }

    try {
      setLookupLoading(true);
      setLookupError("");
      setSaleData(null);
      setSelectedSaleItemId("");
      const response = await warrantyService.getSaleLookup(resolvedId);
      setSaleData(response.data);
    } catch (error: any) {
      console.error("Error al buscar venta:", error);
      setLookupError(
        error.response?.data?.message || "No se pudo cargar la venta"
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const handleUseSale = (saleId?: string) => {
    if (!saleId) return;
    setLookupId(saleId);
    setSaleData(null);
    setSelectedSaleItemId("");
    setLookupError("");
    void handleLookup(saleId);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    if (!saleData || !selectedSaleItemId) {
      setFormError("Selecciona una venta y un producto defectuoso");
      return;
    }

    if (!replacementProductId) {
      setFormError("Selecciona el producto de reemplazo");
      return;
    }

    if (!reason.trim()) {
      setFormError("Describe el fallo del producto");
      return;
    }

    if (defectiveQuantity <= 0 || defectiveQuantity > maxDefectiveQuantity) {
      setFormError("Cantidad inválida");
      return;
    }

    if (replacementSource === "branch" && !replacementBranchId) {
      setFormError("Selecciona la sede de reemplazo");
      return;
    }

    if (cashRefund) {
      const parsedRefund = Number(cashRefund);
      if (!Number.isFinite(parsedRefund) || parsedRefund < 0) {
        setFormError("La devolucion de efectivo no es valida");
        return;
      }
      if (parsedRefund > originalTotal) {
        setFormError("La devolucion excede el total original");
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        saleItemId: selectedSaleItemId,
        quantity: defectiveQuantity,
        reason,
        replacementProductId,
        replacementPrice: replacementPrice
          ? Number(replacementPrice)
          : undefined,
        cashRefund: cashRefund ? Number(cashRefund) : undefined,
        replacementSource,
        replacementBranchId:
          replacementSource === "branch" ? replacementBranchId : undefined,
      };
      const response = await warrantyService.createWarranty(payload);
      const ticketId = response.data?.report?.ticketId;
      setSuccessMessage(
        ticketId
          ? `Garantia creada con ticket ${ticketId}`
          : "Garantia creada correctamente"
      );
      setSelectedSaleItemId("");
      setReplacementProductId("");
      setReplacementPrice("");
      setCashRefund("");
      setReason("");
      setDefectiveQuantity(1);
    } catch (error: any) {
      console.error("Error al registrar garantia:", error);
      setFormError(
        error.response?.data?.message || "No se pudo registrar la garantia"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Garantia al Cliente</h1>
        <p className="mt-2 text-sm text-gray-400">
          Inicia con el ID de la venta original para registrar reemplazos y
          upselling.
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">Buscar venta</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={lookupId}
            onChange={event => setLookupId(event.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
            placeholder="ID de venta (SALE-...)"
          />
          <Button
            type="button"
            onClick={() => handleLookup()}
            disabled={lookupLoading}
            className="whitespace-nowrap"
          >
            {lookupLoading ? "Buscando..." : "Buscar"}
          </Button>
        </div>
        {lookupError && (
          <p className="mt-3 text-sm text-red-300">{lookupError}</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-white">Ventas recientes</h2>
          <p className="text-xs text-gray-400">
            Selecciona una venta para iniciar la garantía.
          </p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="text-xs text-gray-400">Buscar</label>
            <input
              value={filterText}
              onChange={event => setFilterText(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
              placeholder={
                isEmployee
                  ? "ID, producto, cliente"
                  : "ID, producto, cliente, vendedor"
              }
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Desde</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={event => setFilterStartDate(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Hasta</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={event => setFilterEndDate(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Sede</label>
            <select
              value={filterBranchId}
              onChange={event => setFilterBranchId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
            >
              <option value="">Todas</option>
              {branchOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          {!isEmployee && (
            <div>
              <label className="text-xs text-gray-400">Vendedor</label>
              <select
                value={filterSellerId}
                onChange={event => setFilterSellerId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
              >
                <option value="">Todos</option>
                {sellerOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-400">Estado pago</label>
            <select
              value={filterPaymentStatus}
              onChange={event => setFilterPaymentStatus(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
            >
              <option value="">Todos</option>
              <option value="confirmado">Confirmado</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400">Monto mín.</label>
            <input
              type="number"
              min={0}
              value={filterMinTotal}
              onChange={event => setFilterMinTotal(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Monto máx.</label>
            <input
              type="number"
              min={0}
              value={filterMaxTotal}
              onChange={event => setFilterMaxTotal(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Orden</label>
            <select
              value={sortBy}
              onChange={event => setSortBy(event.target.value as typeof sortBy)}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
            >
              <option value="date-desc">Fecha desc</option>
              <option value="date-asc">Fecha asc</option>
              <option value="amount-desc">Monto desc</option>
              <option value="amount-asc">Monto asc</option>
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Mostrando {filteredSales.length} de {sales.length} ventas.
        </p>
        {salesError && (
          <p className="mt-3 text-sm text-red-300">{salesError}</p>
        )}
        {salesLoading ? (
          <p className="mt-4 text-sm text-gray-400">Cargando ventas...</p>
        ) : filteredSales.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            No hay ventas disponibles.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-800">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-gray-950/70">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">
                    ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">
                    Fecha
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">
                    Responsable
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">
                    Producto
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">
                    Total
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-900/40">
                {filteredSales.map(sale => {
                  const product =
                    typeof sale.product === "object" ? sale.product : null;
                  const total = (sale.salePrice || 0) * (sale.quantity || 0);
                  const resolvedSaleId = sale.saleId || sale._id;
                  const responsibleName = sale.employee
                    ? typeof sale.employee === "object"
                      ? sale.employee.name || "Employee"
                      : "Employee"
                    : typeof sale.createdBy === "object"
                      ? sale.createdBy.name || "Admin"
                      : "Admin";
                  return (
                    <tr key={sale._id} className="hover:bg-white/5">
                      <td className="px-4 py-2 text-xs text-white">
                        {resolvedSaleId}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-300">
                        {new Date(sale.saleDate).toLocaleDateString("es-CO")}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-200">
                        {responsibleName}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-200">
                        {product?.name || sale.productName || "Producto"}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-200">
                        ${total.toLocaleString("es-CO")}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleUseSale(resolvedSaleId)}
                          className="rounded bg-purple-600 px-2 py-1 text-xs font-semibold text-white hover:bg-purple-500"
                        >
                          Usar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {saleData && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-400">Venta encontrada</p>
              <h3 className="text-lg font-semibold text-white">
                {saleData.saleId}
              </h3>
              <p className="text-xs text-gray-500">
                {new Date(saleData.saleDate).toLocaleString("es-CO")}
              </p>
            </div>
            <div className="text-sm text-gray-300">
              {saleData.seller?.role === "employee" ? "Employee" : "Admin"}:{" "}
              {typeof saleData.seller?.user === "object"
                ? saleData.seller.user?.name
                : "-"}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {saleData.items.map(item => {
              const product =
                typeof item.product === "object" ? item.product : null;
              return (
                <button
                  key={item.saleItemId}
                  type="button"
                  onClick={() => {
                    setSelectedSaleItemId(item.saleItemId);
                    setDefectiveQuantity(1);
                  }}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    selectedSaleItemId === item.saleItemId
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-gray-700 bg-gray-900/70 hover:border-gray-500"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">
                    {product?.name || "Producto"}
                  </p>
                  <p className="text-xs text-gray-400">
                    Vendido: {item.quantity} | Precio: ${" "}
                    {item.salePrice.toLocaleString("es-CO")}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {saleData && selectedSaleItem && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-800 bg-gray-900/60 p-6"
        >
          <h2 className="text-lg font-semibold text-white">
            Registrar garantia
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-gray-400">
                Producto defectuoso
              </label>
              <div className="mt-2 rounded-lg border border-gray-700 bg-gray-950/50 px-3 py-2 text-sm text-white">
                {saleProduct?.name || "Producto"}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Precio cobrado: ${" "}
                {selectedSaleItem.salePrice.toLocaleString("es-CO")}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-400">
                Cantidad defectuosa
              </label>
              <input
                type="number"
                min={1}
                max={maxDefectiveQuantity}
                value={defectiveQuantity}
                onChange={event =>
                  setDefectiveQuantity(Number(event.target.value))
                }
                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
              />
              <p className="mt-1 text-xs text-gray-500">
                Maximo: {maxDefectiveQuantity}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs text-gray-400">
              Descripcion del fallo
            </label>
            <textarea
              value={reason}
              onChange={event => setReason(event.target.value)}
              className="mt-2 min-h-[90px] w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-gray-400">
                Origen del reemplazo
              </label>
              <select
                value={replacementSource}
                onChange={event => {
                  const value = event.target.value as ReplacementSource;
                  setReplacementSource(value);
                  setReplacementBranchId("");
                  setReplacementProductId("");
                }}
                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
              >
                {isEmployee && (
                  <option value="employee">Mi inventario</option>
                )}
                <option value="branch">Sede</option>
                {!isEmployee && <option value="warehouse">Bodega</option>}
              </select>
            </div>

            {replacementSource === "branch" && (
              <div>
                <label className="text-xs text-gray-400">
                  Sede de reemplazo
                </label>
                <select
                  value={replacementBranchId}
                  onChange={event => setReplacementBranchId(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
                >
                  <option value="">Selecciona una sede</option>
                  {replacementBranchOptions.map(branch => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="text-xs text-gray-400">
              Producto de reemplazo
            </label>
            <div className="mt-2">
              <ProductSelector
                value={replacementProductId}
                onChange={productId => setReplacementProductId(productId)}
                products={replacementProducts}
                disabled={
                  replacementSource === "branch" && !replacementBranchId
                }
                placeholder="Selecciona el reemplazo"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-gray-400">Precio reemplazo</label>
              <input
                type="number"
                min={0}
                value={replacementPrice}
                onChange={event => setReplacementPrice(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">
                Devolucion de efectivo
              </label>
              <input
                type="number"
                min={0}
                value={cashRefund}
                onChange={event => setCashRefund(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white"
                placeholder={
                  suggestedRefund > 0
                    ? `Sugerido: ${suggestedRefund.toLocaleString("es-CO")}`
                    : "0"
                }
              />
              {suggestedRefund > 0 && !cashRefund && (
                <p className="mt-1 text-[11px] text-gray-500">
                  Sugerido segun precios:{" "}
                  {suggestedRefund.toLocaleString("es-CO")}
                </p>
              )}
            </div>
          </div>

          {formError && (
            <p className="mt-4 text-sm text-red-300">{formError}</p>
          )}
          {successMessage && (
            <p className="mt-4 text-sm text-green-300">{successMessage}</p>
          )}

          <div className="mt-6">
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Guardando..." : "Registrar garantia"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
