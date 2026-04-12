import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProductSelector from "../../../components/ProductSelector";
import { Button, LoadingSpinner } from "../../../shared/components/ui";
import type { User } from "../../auth/types/auth.types";
import { branchService, branchTransferService } from "../../branches/services";
import type { Branch } from "../../business/types/business.types";
import { employeeService } from "../../employees/services";
import {
  productService,
  stockService,
} from "../../inventory/services/inventory.service";
import type {
  EmployeeStock,
  Product,
} from "../../inventory/types/product.types";

type OperationType = "assign" | "withdraw";
type Mode = "employee" | "branch";

interface BranchItem {
  productId: string;
  product: Product;
  quantity: number;
}

interface StockItem {
  productId: string;
  product: Product;
  quantity: number;
  warehouseStock: number;
}

const StockManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const firstSegment = location.pathname.split("/").filter(Boolean)[0] || "";
  const areaBase = firstSegment ? `/${firstSegment}` : "";
  const isEmployeeView = areaBase === "/staff";
  const isOperativoEmployeeView = location.pathname.startsWith(
    "/staff/operativo/"
  );
  const addEmployeeRoute = isOperativoEmployeeView
    ? `${areaBase}/operativo/team`
    : `${areaBase}/employees/add`;
  const addProductRoute = isEmployeeView
    ? `${areaBase}/products`
    : `${areaBase}/add-product`;
  const [mode, setMode] = useState<Mode>("employee");
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [alerts, setAlerts] = useState<Array<Product | EmployeeStock>>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [employeeStock, setEmployeeStock] = useState<EmployeeStock[]>(
    []
  );
  const [loadingEmployeeStock, setLoadingEmployeeStock] = useState(false);
  const [originBranchId, setOriginBranchId] = useState<string>("");
  const [targetBranchId, setTargetBranchId] = useState<string>("");
  const [branchItems, setBranchItems] = useState<BranchItem[]>([]);
  const [originBranchStock, setOriginBranchStock] = useState<
    Array<{
      _id: string;
      product: { _id: string; name: string };
      quantity: number;
    }>
  >([]);
  const [loadingOriginStock, setLoadingOriginStock] = useState(false);
  const [branchSelectedProductId, setBranchSelectedProductId] =
    useState<string>("");
  const [branchNotes, setBranchNotes] = useState<string>("");
  const [operation, setOperation] = useState<OperationType>("assign");
  const [loading, setLoading] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [inventorySearchTerm, setInventorySearchTerm] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState<string>("all");

  const getPermissionAwareMessage = (
    err: any,
    fallbackMessage: string,
    permissionMessage = "No tienes permisos de membresía para gestionar inventario en este negocio"
  ) => {
    const status = err?.response?.status;
    const backendMessage = String(err?.response?.data?.message || "").trim();
    const rawMessage = String(err?.message || "").trim();
    const combined = `${backendMessage} ${rawMessage}`.toLowerCase();

    if (
      status === 403 ||
      combined.includes("permiso") ||
      combined.includes("sin permisos") ||
      combined.includes("acceso denegado") ||
      combined.includes("forbidden")
    ) {
      return permissionMessage;
    }

    return backendMessage || fallbackMessage;
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeStock(selectedEmployee);
    } else {
      setEmployeeStock([]);
    }
  }, [selectedEmployee]);

  useEffect(() => {
    setError("");
    setSuccess("");
  }, [mode]);

  const loadData = async () => {
    try {
      const [
        productsDataResult,
        employeesResult,
        alertsResult,
        branchesResult,
      ] = await Promise.allSettled([
        productService.getAll({ limit: 1000, excludePromotions: true }),
        employeeService.getAll(),
        stockService.getAlerts(),
        branchService.list(),
      ]);

      if (productsDataResult.status === "fulfilled") {
        const productsData = productsDataResult.value;
        const productsList = Array.isArray(productsData)
          ? productsData
          : productsData.data || [];
        setProducts(productsList);
      } else {
        console.error("Error al cargar productos:", productsDataResult.reason);
        setProducts([]);
      }

      if (employeesResult.status === "fulfilled") {
        const employeesRes = employeesResult.value;
        const distList = Array.isArray(employeesRes)
          ? employeesRes
          : employeesRes.data;
        setEmployees((distList || []).filter((d: User) => d.active));
      } else {
        console.error(
          "Error al cargar empleados:",
          employeesResult.reason
        );
        setEmployees([]);
      }

      if (alertsResult.status === "fulfilled") {
        const alertsRes = alertsResult.value;
        setAlerts([
          ...(alertsRes?.warehouseAlerts || []),
          ...(alertsRes?.employeeAlerts || []),
        ]);
      } else {
        console.error("Error al cargar alertas:", alertsResult.reason);
        setAlerts([]);
      }

      if (branchesResult.status === "fulfilled") {
        const branchesRes = branchesResult.value;
        setBranches(branchesRes || []);
      } else {
        console.error("Error al cargar sedes:", branchesResult.reason);
        setBranches([]);
      }
    } catch (err) {
      console.error("Error al cargar datos:", err);
    }
  };

  const loadEmployeeStock = async (employeeId: string) => {
    try {
      setLoadingEmployeeStock(true);
      const stock = await stockService.getEmployeeStock(employeeId);
      setEmployeeStock(stock);
    } catch (err) {
      console.error("Error al cargar inventario del empleado:", err);
      setError(
        getPermissionAwareMessage(
          err,
          "No se pudo cargar el inventario del empleado",
          "No tienes permisos para consultar inventario de empleados"
        )
      );
      setEmployeeStock([]);
    } finally {
      setLoadingEmployeeStock(false);
    }
  };

  const loadOriginBranchStock = useCallback(
    async (branchId: string) => {
      try {
        setLoadingOriginStock(true);

        // Verificar si es bodega (warehouse)
        const isWarehouse =
          branchId === "warehouse" ||
          branches.find(b => b._id === branchId)?.isWarehouse;

        if (isWarehouse) {
          // Para bodega, usar el warehouseStock de los productos
          const response = await productService.getAll({
            limit: 1000,
            excludePromotions: true,
          });
          const productsList = Array.isArray(response)
            ? response
            : response.data || [];
          const warehouseStock = productsList
            .filter((p: Product) => (p.warehouseStock || 0) > 0)
            .map((p: Product) => ({
              _id: `warehouse-${p._id}`,
              product: { _id: p._id, name: p.name },
              quantity: p.warehouseStock || 0,
            }));
          setOriginBranchStock(warehouseStock);
        } else {
          // Para sedes, usar BranchStock
          const stockData = await stockService.getBranchStock(branchId);
          const stockList = Array.isArray(stockData) ? stockData : [];
          const mappedStock = stockList.map(s => ({
            _id: s._id,
            product:
              typeof s.product === "object"
                ? { _id: s.product._id, name: s.product.name }
                : { _id: s.product, name: "" },
            quantity: s.quantity,
          }));
          setOriginBranchStock(mappedStock);
        }
      } catch (err) {
        console.error("Error al cargar inventario de la sede:", err);
        setOriginBranchStock([]);
      } finally {
        setLoadingOriginStock(false);
      }
    },
    [branches]
  );

  useEffect(() => {
    if (originBranchId) {
      loadOriginBranchStock(originBranchId);
    } else {
      setOriginBranchStock([]);
    }
  }, [originBranchId, loadOriginBranchStock]);

  const addItem = () => {
    if (!selectedProductId) {
      setError("Selecciona un producto");
      return;
    }

    addItemByProductId(selectedProductId);
  };

  const addItemByProductId = (productId: string) => {
    if (!productId) {
      setError("Selecciona un producto");
      return;
    }

    const product = selectorProducts.find(p => p._id === productId);
    if (!product) return;

    // Verificar si ya está agregado
    if (items.some(item => item.productId === productId)) {
      setError("Este producto ya está en la lista");
      return;
    }

    const newItem: StockItem = {
      productId,
      product,
      quantity: 1,
      warehouseStock: product.warehouseStock || 0,
    };

    setItems([...items, newItem]);
    setSelectedProductId("");
    setError("");
  };

  const addBranchItem = () => {
    if (!branchSelectedProductId) {
      setError("Selecciona un producto");
      return;
    }

    const product = availableBranchProducts.find(
      p => p._id === branchSelectedProductId
    );
    if (!product) {
      setError("El producto seleccionado no tiene stock en la sede origen");
      return;
    }

    if (branchItems.some(item => item.productId === branchSelectedProductId)) {
      setError("Este producto ya está en la lista");
      return;
    }

    const newItem: BranchItem = {
      productId: branchSelectedProductId,
      product,
      quantity: 1,
    };

    setBranchItems([...branchItems, newItem]);
    setBranchSelectedProductId("");
    setError("");
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(item => item.productId !== productId));
  };

  const removeBranchItem = (productId: string) => {
    setBranchItems(branchItems.filter(item => item.productId !== productId));
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    setItems(
      items.map(item =>
        item.productId === productId ? { ...item, quantity: quantity } : item
      )
    );
  };

  const updateBranchItemQuantity = (productId: string, quantity: number) => {
    setBranchItems(
      branchItems.map(item =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  const calculateTotalUnits = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (items.length === 0) {
      setError("Agrega al menos un producto");
      return;
    }

    if (!selectedEmployee) {
      setError("Selecciona un empleado");
      return;
    }

    // Validar stock disponible para asignación
    if (operation === "assign") {
      for (const item of items) {
        if (item.quantity > item.warehouseStock) {
          setError(
            `${item.product.name}: stock insuficiente. Disponible: ${item.warehouseStock}`
          );
          return;
        }
      }
    }

    try {
      setLoading(true);

      // Procesar cada item
      for (const item of items) {
        if (operation === "assign") {
          await stockService.assignToEmployee({
            employeeId: selectedEmployee,
            productId: item.productId,
            quantity: item.quantity,
          });
        } else {
          await stockService.withdrawFromEmployee({
            employeeId: selectedEmployee,
            productId: item.productId,
            quantity: item.quantity,
          });
        }
      }

      const employeeName = employees.find(
        d => d._id === selectedEmployee
      )?.name;
      setSuccess(
        `¡${items.length} producto(s) ${operation === "assign" ? "asignado(s)" : "retirado(s)"} exitosamente ${operation === "assign" ? "a" : "de"} ${employeeName}!`
      );

      // Recargar datos
      await loadData();

      // Recargar inventario del empleado
      if (selectedEmployee) {
        await loadEmployeeStock(selectedEmployee);
      }

      // Resetear formulario de items
      setItems([]);
    } catch (err: any) {
      setError(
        getPermissionAwareMessage(err, "Error al procesar la operación")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!originBranchId || !targetBranchId) {
      setError("Selecciona sede origen y destino");
      return;
    }

    if (originBranchId === targetBranchId) {
      setError("Elige sedes distintas para transferir");
      return;
    }

    if (branchItems.length === 0) {
      setError("Agrega al menos un producto");
      return;
    }

    if (branchItems.some(i => !i.quantity || i.quantity <= 0)) {
      setError("Las cantidades deben ser mayores a 0");
      return;
    }

    try {
      setBranchLoading(true);
      await branchTransferService.create({
        originBranchId,
        targetBranchId,
        items: branchItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        notes: branchNotes || undefined,
      });

      setSuccess(
        `Transferencia creada entre sedes (${branchItems.length} producto(s))`
      );

      // Recargar datos para actualizar el inventario de bodega
      await loadData();

      // Recargar el stock de la sede origen si fue seleccionada
      if (originBranchId) {
        await loadOriginBranchStock(originBranchId);
      }

      setBranchItems([]);
      setBranchNotes("");
    } catch (err: any) {
      setError(
        getPermissionAwareMessage(
          err,
          "No se pudo crear la transferencia entre sedes"
        )
      );
    } finally {
      setBranchLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Filtrar productos disponibles (no agregados aún)
  const employeeStockByProduct = new Map(
    employeeStock
      .map(stock => {
        const product =
          typeof stock.product === "object" ? stock.product : null;
        if (!product) return null;
        return [product._id, { product, quantity: stock.quantity || 0 }];
      })
      .filter(
        (entry): entry is [string, { product: Product; quantity: number }] =>
          Boolean(entry)
      )
  );

  const withdrawSelectableProducts = Array.from(
    employeeStockByProduct.values()
  )
    .filter(entry => entry.quantity > 0)
    .map(entry => ({
      ...entry.product,
      totalStock: entry.quantity,
    }));

  const selectorProducts =
    operation === "withdraw" ? withdrawSelectableProducts : products;

  const inventoryCategories = useMemo(() => {
    const cats = new Set<string>();
    selectorProducts.forEach(product => {
      const catName =
        typeof product.category === "object"
          ? product.category?.name
          : product.category;
      if (catName) cats.add(catName);
    });
    return Array.from(cats);
  }, [selectorProducts]);

  const filteredInventoryProducts = useMemo(() => {
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const term = normalize(inventorySearchTerm);

    return selectorProducts.filter(product => {
      const name = normalize(product.name || "");
      const catName =
        typeof product.category === "object"
          ? product.category?.name
          : product.category;

      const matchesSearch = name.includes(term);
      const matchesCategory =
        inventoryCategory === "all" || catName === inventoryCategory;

      return matchesSearch && matchesCategory;
    });
  }, [selectorProducts, inventorySearchTerm, inventoryCategory]);

  const availableBranchProducts = products
    .filter(p => !branchItems.some(item => item.productId === p._id))
    .map(p => {
      const stockItem = originBranchStock.find(s => {
        const productId =
          typeof s.product === "object" ? s.product._id : s.product;
        return productId === p._id;
      });
      return {
        ...p,
        branchStock: stockItem?.quantity || 0,
        totalStock: stockItem?.quantity || 0,
      };
    })
    .filter(p => p.branchStock > 0);

  const hasWarehouseBranch = branches.some(branch => branch.isWarehouse);
  const branchOptions: Branch[] = [
    ...(hasWarehouseBranch
      ? []
      : [
          {
            _id: "warehouse",
            name: "Bodega (central)",
            isWarehouse: true,
            active: true,
          } as Branch,
        ]),
    ...branches.filter(branch => branch.active !== false),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 overflow-hidden">
      <div>
        <h1 className="text-4xl font-bold text-white">Gestión de Stock</h1>
        <p className="mt-2 text-gray-400">
          Asigna o retira múltiples productos de empleados o transfiere
          entre sedes
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setMode("employee")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === "employee"
                ? "bg-blue-600 text-white"
                : "border border-gray-700 bg-gray-800/60 text-gray-200 hover:border-blue-500"
            }`}
          >
            Empleados
          </button>
          <button
            type="button"
            onClick={() => setMode("branch")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === "branch"
                ? "bg-purple-600 text-white"
                : "border border-gray-700 bg-gray-800/60 text-gray-200 hover:border-purple-500"
            }`}
          >
            Sedes
          </button>
        </div>
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

      {mode === "employee" && (
        <>
          {alerts.length > 0 && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-900/20 p-6">
              <h2 className="mb-3 text-xl font-semibold text-yellow-400">
                ⚠️ Alertas de Stock Bajo ({alerts.length})
              </h2>
              <div className="space-y-2">
                {alerts.slice(0, 5).map((alert, index) => {
                  if ("warehouseStock" in alert) {
                    return (
                      <div key={index} className="text-sm text-yellow-300">
                        <strong>{alert.name}</strong> - Bodega - Stock:{" "}
                        {alert.warehouseStock} (Alerta: {alert.lowStockAlert})
                      </div>
                    );
                  } else {
                    const employeeStock = alert as EmployeeStock;
                    const product =
                      typeof employeeStock.product === "object"
                        ? (employeeStock.product as { name?: string })
                        : null;
                    const employee =
                      typeof employeeStock.employee === "object"
                        ? (employeeStock.employee as { name?: string })
                        : null;
                    return (
                      <div key={index} className="text-sm text-yellow-300">
                        <strong>{product?.name}</strong> - Empleado:{" "}
                        {employee?.name} - Stock: {employeeStock.quantity}
                      </div>
                    );
                  }
                })}
                {alerts.length > 5 && (
                  <p className="mt-2 text-sm text-yellow-400">
                    Y {alerts.length - 5} alertas más...
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
              <h2 className="mb-4 text-xl font-semibold text-white">
                Configuración General
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Tipo de Operación *
                  </label>
                  <div className="flex gap-4">
                    <label className="flex cursor-pointer items-center rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 hover:border-blue-500">
                      <input
                        type="radio"
                        value="assign"
                        checked={operation === "assign"}
                        onChange={e =>
                          setOperation(e.target.value as OperationType)
                        }
                        className="mr-2"
                      />
                      <span className="text-white">Asignar Stock</span>
                    </label>
                    <label className="flex cursor-pointer items-center rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 hover:border-orange-500">
                      <input
                        type="radio"
                        value="withdraw"
                        checked={operation === "withdraw"}
                        onChange={e =>
                          setOperation(e.target.value as OperationType)
                        }
                        className="mr-2"
                      />
                      <span className="text-white">Retirar Stock</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Empleado *
                  </label>
                  {employees.length === 0 ? (
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-4 text-sm text-gray-300">
                      <p>No tienes empleados.</p>
                      <Button
                        type="button"
                        className="mt-3"
                        onClick={() => navigate(addEmployeeRoute)}
                      >
                        Añadir empleado
                      </Button>
                    </div>
                  ) : (
                    <select
                      value={selectedEmployee}
                      onChange={e => setSelectedEmployee(e.target.value)}
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Selecciona un empleado</option>
                      {employees.map(dist => (
                        <option key={dist._id} value={dist._id}>
                          {dist.name} - {dist.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {selectedEmployee && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-900/20 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">
                    Inventario de{" "}
                    {
                      employees.find(d => d._id === selectedEmployee)
                        ?.name
                    }
                  </h2>
                  {loadingEmployeeStock && <LoadingSpinner size="sm" />}
                </div>

                {!loadingEmployeeStock && employeeStock.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-gray-400">
                      Este empleado no tiene productos asignados
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {employeeStock
                      .filter(stock => {
                        const product =
                          typeof stock.product === "object"
                            ? stock.product
                            : null;
                        if (!product) return false;
                        // FILTER: Hide Promotions/Combos from Stock View
                        return (
                          !product.isPromotion &&
                          (product as any).type !== "promotion" &&
                          !product.name.toLowerCase().includes("combo") // Safety Extra Check
                        );
                      })
                      .map(stock => {
                        const product =
                          typeof stock.product === "object"
                            ? stock.product
                            : null;
                        return (
                          <div
                            key={stock._id}
                            className="rounded-lg border border-blue-500/20 bg-blue-950/30 p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-white">
                                  {product?.name || "Producto desconocido"}
                                </h3>
                                <p className="mt-1 text-xs text-gray-400">
                                  {formatCurrency(
                                    product?.employeePrice || 0
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                <p
                                  className={`text-lg font-bold ${
                                    stock.quantity <= 5
                                      ? "text-red-400"
                                      : "text-green-400"
                                  }`}
                                >
                                  {stock.quantity}
                                </p>
                                <p className="text-xs text-gray-400">
                                  unidades
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
              <h2 className="mb-4 text-xl font-semibold text-white">
                Agregar Productos
              </h2>

              <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={inventorySearchTerm}
                  onChange={e => setInventorySearchTerm(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-2 text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <select
                  value={inventoryCategory}
                  onChange={e => setInventoryCategory(e.target.value)}
                  className="rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-2 text-white outline-none focus:border-blue-500"
                >
                  <option value="all">Todas las categorías</option>
                  {inventoryCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {selectorProducts.length === 0 ? (
                <div className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-4 text-sm text-gray-300">
                  <p>No tienes productos.</p>
                  <Button
                    type="button"
                    className="mt-3"
                    onClick={() => navigate(addProductRoute)}
                  >
                    Añadir producto
                  </Button>
                </div>
              ) : (
                <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredInventoryProducts.map(product => {
                    const distQty =
                      employeeStockByProduct.get(product._id)?.quantity || 0;
                    const stock =
                      operation === "withdraw"
                        ? distQty
                        : product.warehouseStock || 0;
                    const alreadyAdded = items.some(
                      item => item.productId === product._id
                    );
                    const isOutOfStock = stock <= 0;

                    return (
                      <div
                        key={product._id}
                        className={`rounded-lg border p-3 transition ${
                          isOutOfStock
                            ? "border-gray-700 bg-gray-800/30 opacity-60"
                            : "border-gray-700 bg-gray-800/60 hover:border-blue-500/60"
                        }`}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            {product.image?.url ? (
                              <img
                                src={product.image.url}
                                alt={product.name}
                                className="h-10 w-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700 text-xs font-semibold text-gray-300">
                                {product.name.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate text-sm font-semibold text-white">
                                {product.name}
                              </h4>
                              <p className="truncate text-xs text-gray-400">
                                {(typeof product.category === "object"
                                  ? product.category?.name
                                  : product.category) || "Sin categoría"}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              stock <= 5
                                ? "bg-red-500/20 text-red-300"
                                : "bg-green-500/20 text-green-300"
                            }`}
                          >
                            Stock: {stock}
                          </span>
                        </div>

                        <div className="mb-3 text-sm font-semibold text-blue-300">
                          {formatCurrency(product.employeePrice || 0)}
                        </div>

                        <Button
                          type="button"
                          onClick={() => addItemByProductId(product._id)}
                          disabled={isOutOfStock || alreadyAdded}
                          className="w-full"
                        >
                          {alreadyAdded
                            ? "Ya agregado"
                            : isOutOfStock
                              ? "Sin stock"
                              : "+ Agregar"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredInventoryProducts.length === 0 &&
                selectorProducts.length > 0 && (
                  <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-4 text-sm text-gray-400">
                    No se encontraron productos con los filtros actuales.
                  </div>
                )}

              <div className="mt-4 flex gap-4">
                <div className="flex-1">
                  <ProductSelector
                    value={selectedProductId}
                    onChange={id => setSelectedProductId(id)}
                    placeholder={
                      operation === "withdraw"
                        ? "Selecciona un producto del empleado"
                        : "Buscar y seleccionar producto..."
                    }
                    showStock={true}
                    excludeProductIds={items.map(item => item.productId)}
                    products={selectorProducts}
                  />
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

            {items.length > 0 && (
              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
                <h2 className="mb-4 text-xl font-semibold text-white">
                  Productos Seleccionados ({items.length})
                </h2>

                <div className="space-y-4">
                  {items.map(item => (
                    <div
                      key={item.productId}
                      className="rounded-lg border border-blue-500/30 bg-blue-900/10 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold text-white">
                              {item.product.name}
                            </h3>
                            <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold text-green-400">
                              {operation === "assign"
                                ? `Bodega: ${item.warehouseStock}`
                                : `Empleado: ${employeeStockByProduct.get(item.productId)?.quantity || 0}`}
                            </span>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs text-gray-400">
                                Cantidad{" "}
                                {operation === "assign" &&
                                  `(máx: ${item.warehouseStock})`}
                              </label>
                              <input
                                type="number"
                                min="1"
                                max={
                                  operation === "assign"
                                    ? item.warehouseStock
                                    : employeeStockByProduct.get(
                                        item.productId
                                      )?.quantity
                                }
                                value={item.quantity === 0 ? "" : item.quantity}
                                onChange={e => {
                                  const val =
                                    e.target.value === ""
                                      ? 0
                                      : Number(e.target.value);
                                  updateItemQuantity(item.productId, val);
                                }}
                                onBlur={e => {
                                  const val = Number(e.target.value);
                                  if (e.target.value === "" || val < 1) {
                                    updateItemQuantity(item.productId, 1);
                                  } else if (
                                    operation === "assign" &&
                                    val > item.warehouseStock
                                  ) {
                                    updateItemQuantity(
                                      item.productId,
                                      item.warehouseStock
                                    );
                                  } else if (operation === "withdraw") {
                                    const maxQty =
                                      employeeStockByProduct.get(
                                        item.productId
                                      )?.quantity ?? 0;
                                    if (val > maxQty && maxQty > 0) {
                                      updateItemQuantity(
                                        item.productId,
                                        maxQty
                                      );
                                    }
                                  }
                                }}
                                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: 10"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs text-gray-400">
                                Precio Empleado
                              </label>
                              <div className="flex items-center justify-between rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2">
                                <span className="font-bold text-blue-400">
                                  {formatCurrency(
                                    item.product.employeePrice || 0
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>

                          {operation === "assign" && (
                            <div className="mt-2 text-xs text-gray-400">
                              Quedará en bodega:{" "}
                              {item.warehouseStock - item.quantity} unidades
                            </div>
                          )}
                          {operation === "withdraw" && (
                            <div className="mt-2 text-xs text-gray-400">
                              Quedará en empleado:{" "}
                              {(employeeStockByProduct.get(item.productId)
                                ?.quantity || 0) - item.quantity}{" "}
                              unidades
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
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

            {items.length > 0 && (
              <div
                className={`rounded-xl border p-6 ${
                  operation === "assign"
                    ? "border-green-500/30 bg-green-900/20"
                    : "border-orange-500/30 bg-orange-900/20"
                }`}
              >
                <h2 className="mb-4 text-xl font-semibold text-white">
                  Resumen de Operación
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
                      {calculateTotalUnits()}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg">
                    <span className="text-gray-300">Operación:</span>
                    <span
                      className={`font-bold ${
                        operation === "assign"
                          ? "text-green-400"
                          : "text-orange-400"
                      }`}
                    >
                      {operation === "assign" ? "Asignar" : "Retirar"}
                    </span>
                  </div>
                  {selectedEmployee && (
                    <div className="flex justify-between text-lg">
                      <span className="text-gray-300">Empleado:</span>
                      <span className="font-bold text-blue-400">
                        {
                          employees.find(d => d._id === selectedEmployee)
                            ?.name
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={loading || items.length === 0 || !selectedEmployee}
                className={`flex-1 ${
                  operation === "assign"
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                {loading
                  ? "Procesando..."
                  : `${operation === "assign" ? "Asignar" : "Retirar"} ${items.length} Producto(s)`}
              </Button>
            </div>
          </form>
        </>
      )}

      {mode === "branch" && (
        <form onSubmit={handleBranchSubmit} className="space-y-6">
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Transferencia entre sedes
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Sede origen *
                </label>
                <select
                  value={originBranchId}
                  onChange={e => setOriginBranchId(e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Selecciona origen</option>
                  {branchOptions.map(branch => (
                    <option key={branch._id} value={branch._id}>
                      {branch.isWarehouse
                        ? `${branch.name || "Bodega"}`
                        : branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Sede destino *
                </label>
                <select
                  value={targetBranchId}
                  onChange={e => setTargetBranchId(e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Selecciona destino</option>
                  {branchOptions.map(branch => (
                    <option key={branch._id} value={branch._id}>
                      {branch.isWarehouse
                        ? `${branch.name || "Bodega"}`
                        : branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Notas (opcional)
              </label>
              <textarea
                value={branchNotes}
                onChange={e => setBranchNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ej. Responsable o motivo de la transferencia"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Agregar Productos
            </h2>
            <div className="flex gap-4">
              <div className="flex-1">
                {availableBranchProducts.length === 0 ? (
                  <div className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-4 text-sm text-gray-300">
                    <p>No tienes productos.</p>
                    <Button
                      type="button"
                      className="mt-3"
                      onClick={() => navigate(addProductRoute)}
                    >
                      Añadir producto
                    </Button>
                  </div>
                ) : (
                  <ProductSelector
                    value={branchSelectedProductId}
                    onChange={id => setBranchSelectedProductId(id)}
                    placeholder={
                      !originBranchId
                        ? "Primero selecciona sede origen"
                        : loadingOriginStock
                          ? "Cargando stock..."
                          : "Buscar y seleccionar producto..."
                    }
                    disabled={!originBranchId || loadingOriginStock}
                    showStock={true}
                    excludeProductIds={branchItems.map(item => item.productId)}
                    products={availableBranchProducts}
                  />
                )}
              </div>
              <Button
                type="button"
                onClick={addBranchItem}
                disabled={!branchSelectedProductId}
                className="whitespace-nowrap"
              >
                + Agregar
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {originBranchId
                ? `Mostrando solo productos con stock en ${branchOptions.find(b => b._id === originBranchId)?.name || "la sede seleccionada"}`
                : "Selecciona una sede origen para ver productos disponibles"}
            </p>
          </div>

          {branchItems.length > 0 && (
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
              <h2 className="mb-4 text-xl font-semibold text-white">
                Productos Seleccionados ({branchItems.length})
              </h2>
              <div className="space-y-4">
                {branchItems.map(item => (
                  <div
                    key={item.productId}
                    className="rounded-lg border border-purple-500/30 bg-purple-900/10 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">
                          {item.product.name}
                        </h3>
                        <p className="text-xs text-gray-400">
                          Stock disponible en origen:{" "}
                          {originBranchStock.find(s => {
                            const productId =
                              typeof s.product === "object"
                                ? s.product._id
                                : s.product;
                            return productId === item.productId;
                          })?.quantity || 0}
                        </p>

                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs text-gray-400">
                              Cantidad
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity === 0 ? "" : item.quantity}
                              onChange={e => {
                                const val =
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value);
                                updateBranchItemQuantity(item.productId, val);
                              }}
                              onBlur={e => {
                                const val = Number(e.target.value);
                                if (e.target.value === "" || val < 1) {
                                  updateBranchItemQuantity(item.productId, 1);
                                }
                              }}
                              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="Ej: 5"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeBranchItem(item.productId)}
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

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={
                branchLoading ||
                branchItems.length === 0 ||
                !originBranchId ||
                !targetBranchId
              }
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
            >
              {branchLoading
                ? "Procesando..."
                : `Transferir ${branchItems.length} Producto(s)`}
            </Button>
          </div>
        </form>
      )}

      {/* Referencia de productos disponibles */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="mb-4 text-xl font-semibold text-white">
          Inventario de Bodega
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map(product => (
            <div
              key={product._id}
              className="rounded-lg border border-gray-600 bg-gray-900/50 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{product.name}</h3>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatCurrency(product.employeePrice || 0)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-300">
                    Total: {product.totalStock || 0}
                  </p>
                  <p
                    className={`text-sm font-bold ${
                      (product.warehouseStock || 0) <=
                      (product.lowStockAlert || 0)
                        ? "text-red-400"
                        : "text-green-400"
                    }`}
                  >
                    Bodega: {product.warehouseStock || 0}
                  </p>
                  {(product.warehouseStock || 0) <=
                    (product.lowStockAlert || 0) && (
                    <span className="text-xs font-semibold text-red-400">
                      ⚠️ Bajo
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StockManagement;
