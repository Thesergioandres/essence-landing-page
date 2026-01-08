import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  branchService,
  branchTransferService,
  distributorService,
  productService,
  stockService,
} from "../api/services";
import { Button } from "../components/Button";
import LoadingSpinner from "../components/LoadingSpinner";
import ProductSelector from "../components/ProductSelector";
import type { Branch, DistributorStock, Product, User } from "../types";

type OperationType = "assign" | "withdraw";
type Mode = "distributor" | "branch";

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
  const [mode, setMode] = useState<Mode>("distributor");
  const [products, setProducts] = useState<Product[]>([]);
  const [distributors, setDistributors] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [alerts, setAlerts] = useState<Array<Product | DistributorStock>>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedDistributor, setSelectedDistributor] = useState<string>("");
  const [distributorStock, setDistributorStock] = useState<DistributorStock[]>(
    []
  );
  const [loadingDistributorStock, setLoadingDistributorStock] = useState(false);
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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDistributor) {
      loadDistributorStock(selectedDistributor);
    } else {
      setDistributorStock([]);
    }
  }, [selectedDistributor]);

  useEffect(() => {
    setError("");
    setSuccess("");
  }, [mode]);

  useEffect(() => {
    if (originBranchId) {
      loadOriginBranchStock(originBranchId);
    } else {
      setOriginBranchStock([]);
    }
  }, [originBranchId]);

  const loadData = async () => {
    try {
      const [
        productsDataResult,
        distributorsResult,
        alertsResult,
        branchesResult,
      ] = await Promise.allSettled([
        productService.getAll(),
        distributorService.getAll(),
        stockService.getAlerts(),
        branchService.list(),
      ]);

      if (productsDataResult.status === "fulfilled") {
        const productsData = productsDataResult.value;
        setProducts(productsData.data || productsData);
      } else {
        console.error("Error al cargar productos:", productsDataResult.reason);
        setProducts([]);
      }

      if (distributorsResult.status === "fulfilled") {
        const distributorsRes = distributorsResult.value;
        const distList = Array.isArray(distributorsRes)
          ? distributorsRes
          : distributorsRes.data;
        setDistributors((distList || []).filter((d: User) => d.active));
      } else {
        console.error(
          "Error al cargar distribuidores:",
          distributorsResult.reason
        );
        setDistributors([]);
      }

      if (alertsResult.status === "fulfilled") {
        const alertsRes = alertsResult.value;
        setAlerts([
          ...(alertsRes?.warehouseAlerts || []),
          ...(alertsRes?.distributorAlerts || []),
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

  const loadDistributorStock = async (distributorId: string) => {
    try {
      setLoadingDistributorStock(true);
      const stock = await stockService.getDistributorStock(distributorId);
      setDistributorStock(stock);
    } catch (err) {
      console.error("Error al cargar inventario del distribuidor:", err);
      setDistributorStock([]);
    } finally {
      setLoadingDistributorStock(false);
    }
  };

  const loadOriginBranchStock = async (branchId: string) => {
    try {
      setLoadingOriginStock(true);
      console.log("[DEBUG] Loading stock for branchId:", branchId);

      // Verificar si es bodega (warehouse)
      const isWarehouse =
        branchId === "warehouse" ||
        branches.find(b => b._id === branchId)?.isWarehouse;

      console.log("[DEBUG] isWarehouse:", isWarehouse);

      if (isWarehouse) {
        // Para bodega, usar el warehouseStock de los productos
        const productsData = await productService.getAll();
        const productsList = productsData.data || productsData;
        console.log("[DEBUG] Total productos:", productsList.length);
        const warehouseStock = productsList
          .filter((p: Product) => (p.warehouseStock || 0) > 0)
          .map((p: Product) => ({
            _id: `warehouse-${p._id}`,
            product: { _id: p._id, name: p.name },
            quantity: p.warehouseStock || 0,
          }));
        console.log(
          "[DEBUG] Productos con stock en bodega:",
          warehouseStock.length
        );
        console.log("[DEBUG] Warehouse stock:", warehouseStock);
        setOriginBranchStock(warehouseStock);
      } else {
        // Para sedes, usar BranchStock
        const stock = await stockService.getBranchStock(branchId);
        console.log("[DEBUG] Branch stock:", stock);
        const mappedStock = (stock || []).map(s => ({
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
  };

  const addItem = () => {
    if (!selectedProductId) {
      setError("Selecciona un producto");
      return;
    }

    const product = products.find(p => p._id === selectedProductId);
    if (!product) return;

    // Verificar si ya está agregado
    if (items.some(item => item.productId === selectedProductId)) {
      setError("Este producto ya está en la lista");
      return;
    }

    const newItem: StockItem = {
      productId: selectedProductId,
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

    const product = products.find(p => p._id === branchSelectedProductId);
    if (!product) return;

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

    if (!selectedDistributor) {
      setError("Selecciona un distribuidor");
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
          await stockService.assignToDistributor({
            distributorId: selectedDistributor,
            productId: item.productId,
            quantity: item.quantity,
          });
        } else {
          await stockService.withdrawFromDistributor({
            distributorId: selectedDistributor,
            productId: item.productId,
            quantity: item.quantity,
          });
        }
      }

      const distributorName = distributors.find(
        d => d._id === selectedDistributor
      )?.name;
      setSuccess(
        `¡${items.length} producto(s) ${operation === "assign" ? "asignado(s)" : "retirado(s)"} exitosamente ${operation === "assign" ? "a" : "de"} ${distributorName}!`
      );

      // Recargar datos
      await loadData();

      // Recargar inventario del distribuidor
      if (selectedDistributor) {
        await loadDistributorStock(selectedDistributor);
      }

      // Resetear formulario de items
      setItems([]);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al procesar la operación");
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
          product: item.productId,
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
        err?.response?.data?.message ||
          "No se pudo crear la transferencia entre sedes"
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
  const availableProducts = products.filter(
    p => !items.some(item => item.productId === p._id)
  );

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
      };
    })
    .filter(p => p.branchStock > 0);

  // Debug logs
  console.log("[DEBUG] Total products:", products.length);
  console.log("[DEBUG] originBranchStock:", originBranchStock.length);
  console.log(
    "[DEBUG] availableBranchProducts:",
    availableBranchProducts.length
  );
  if (
    availableBranchProducts.length === 0 &&
    originBranchStock.length > 0 &&
    products.length > 0
  ) {
    console.log("[DEBUG] Sample product from products:", products[0]);
    console.log(
      "[DEBUG] Sample stock from originBranchStock:",
      originBranchStock[0]
    );
  }

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
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-white">Gestión de Stock</h1>
        <p className="mt-2 text-gray-400">
          Asigna o retira múltiples productos de distribuidores o transfiere
          entre sedes
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setMode("distributor")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === "distributor"
                ? "bg-blue-600 text-white"
                : "border border-gray-700 bg-gray-800/60 text-gray-200 hover:border-blue-500"
            }`}
          >
            Distribuidores
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

      {mode === "distributor" && (
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
                    const product =
                      typeof alert.product === "object" ? alert.product : null;
                    const distributor =
                      typeof alert.distributor === "object"
                        ? alert.distributor
                        : null;
                    return (
                      <div key={index} className="text-sm text-yellow-300">
                        <strong>{product?.name}</strong> - Distribuidor:{" "}
                        {distributor?.name} - Stock: {alert.quantity}
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
                    Distribuidor *
                  </label>
                  {distributors.length === 0 ? (
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-4 text-sm text-gray-300">
                      <p>No tienes distribuidores.</p>
                      <Button
                        type="button"
                        className="mt-3"
                        onClick={() => navigate("/admin/distributors/add")}
                      >
                        Añadir distribuidor
                      </Button>
                    </div>
                  ) : (
                    <select
                      value={selectedDistributor}
                      onChange={e => setSelectedDistributor(e.target.value)}
                      className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Selecciona un distribuidor</option>
                      {distributors.map(dist => (
                        <option key={dist._id} value={dist._id}>
                          {dist.name} - {dist.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {selectedDistributor && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-900/20 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">
                    Inventario de{" "}
                    {
                      distributors.find(d => d._id === selectedDistributor)
                        ?.name
                    }
                  </h2>
                  {loadingDistributorStock && <LoadingSpinner size="sm" />}
                </div>

                {!loadingDistributorStock && distributorStock.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-gray-400">
                      Este distribuidor no tiene productos asignados
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {distributorStock.map(stock => {
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
                                {formatCurrency(product?.distributorPrice || 0)}
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
                              <p className="text-xs text-gray-400">unidades</p>
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

              <div className="flex gap-4">
                <div className="flex-1">
                  {availableProducts.length === 0 ? (
                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-4 text-sm text-gray-300">
                      <p>No tienes productos.</p>
                      <Button
                        type="button"
                        className="mt-3"
                        onClick={() => navigate("/admin/add-product")}
                      >
                        Añadir producto
                      </Button>
                    </div>
                  ) : (
                    <ProductSelector
                      value={selectedProductId}
                      onChange={(id) => setSelectedProductId(id)}
                      placeholder="Buscar y seleccionar producto..."
                      showStock={true}
                    />
                  )}
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
                              Bodega: {item.warehouseStock}
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
                                    : undefined
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
                                  }
                                }}
                                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: 10"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs text-gray-400">
                                Precio Distribuidor
                              </label>
                              <div className="flex items-center justify-between rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2">
                                <span className="font-bold text-blue-400">
                                  {formatCurrency(
                                    item.product.distributorPrice || 0
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
                  {selectedDistributor && (
                    <div className="flex justify-between text-lg">
                      <span className="text-gray-300">Distribuidor:</span>
                      <span className="font-bold text-blue-400">
                        {
                          distributors.find(d => d._id === selectedDistributor)
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
                disabled={loading || items.length === 0 || !selectedDistributor}
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
                      onClick={() => navigate("/admin/add-product")}
                    >
                      Añadir producto
                    </Button>
                  </div>
                ) : (
                  <ProductSelector
                    value={branchSelectedProductId}
                    onChange={(id) => setBranchSelectedProductId(id)}
                    placeholder={
                      !originBranchId
                        ? "Primero selecciona sede origen"
                        : loadingOriginStock
                          ? "Cargando stock..."
                          : "Buscar y seleccionar producto..."
                    }
                    disabled={!originBranchId || loadingOriginStock}
                    showStock={true}
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
                    {formatCurrency(product.distributorPrice || 0)}
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
