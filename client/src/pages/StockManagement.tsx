import { useEffect, useState } from 'react';
import { distributorService, productService, stockService } from '../api/services';
import { Button } from '../components/Button';
import type { DistributorStock, Product, User } from '../types';

type OperationType = 'assign' | 'withdraw';

interface StockItem {
  productId: string;
  product: Product;
  quantity: number;
  warehouseStock: number;
}

const StockManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [distributors, setDistributors] = useState<User[]>([]);
  const [alerts, setAlerts] = useState<Array<Product | DistributorStock>>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedDistributor, setSelectedDistributor] = useState<string>('');
  const [distributorStock, setDistributorStock] = useState<DistributorStock[]>([]);
  const [loadingDistributorStock, setLoadingDistributorStock] = useState(false);
  const [operation, setOperation] = useState<OperationType>('assign');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const loadData = async () => {
    try {
      const [productsData, distributorsRes, alertsRes] = await Promise.all([
        productService.getAll(),
        distributorService.getAll(),
        stockService.getAlerts(),
      ]);
      setProducts(productsData.data || productsData);
      const distList = Array.isArray(distributorsRes) ? distributorsRes : distributorsRes.data;
      setDistributors(distList.filter((d: User) => d.active));
      setAlerts([...alertsRes.warehouseAlerts, ...alertsRes.distributorAlerts]);
    } catch (err) {
      console.error('Error al cargar datos:', err);
    }
  };

  const loadDistributorStock = async (distributorId: string) => {
    try {
      setLoadingDistributorStock(true);
      const stock = await stockService.getDistributorStock(distributorId);
      setDistributorStock(stock);
    } catch (err) {
      console.error('Error al cargar inventario del distribuidor:', err);
      setDistributorStock([]);
    } finally {
      setLoadingDistributorStock(false);
    }
  };

  const addItem = () => {
    if (!selectedProductId) {
      setError('Selecciona un producto');
      return;
    }

    const product = products.find((p) => p._id === selectedProductId);
    if (!product) return;

    // Verificar si ya está agregado
    if (items.some(item => item.productId === selectedProductId)) {
      setError('Este producto ya está en la lista');
      return;
    }

    const newItem: StockItem = {
      productId: selectedProductId,
      product,
      quantity: 1,
      warehouseStock: product.warehouseStock || 0,
    };

    setItems([...items, newItem]);
    setSelectedProductId('');
    setError('');
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(item => item.productId !== productId));
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    setItems(items.map(item =>
      item.productId === productId ? { ...item, quantity: quantity || 1 } : item
    ));
  };

  const calculateTotalUnits = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (items.length === 0) {
      setError('Agrega al menos un producto');
      return;
    }

    if (!selectedDistributor) {
      setError('Selecciona un distribuidor');
      return;
    }

    // Validar stock disponible para asignación
    if (operation === 'assign') {
      for (const item of items) {
        if (item.quantity > item.warehouseStock) {
          setError(`${item.product.name}: stock insuficiente. Disponible: ${item.warehouseStock}`);
          return;
        }
      }
    }

    try {
      setLoading(true);

      // Procesar cada item
      for (const item of items) {
        if (operation === 'assign') {
          await stockService.assignToDistributor({
            distributorId: selectedDistributor,
            productId: item.productId,
            quantity: item.quantity
          });
        } else {
          await stockService.withdrawFromDistributor({
            distributorId: selectedDistributor,
            productId: item.productId,
            quantity: item.quantity
          });
        }
      }

      const distributorName = distributors.find(d => d._id === selectedDistributor)?.name;
      setSuccess(
        `¡${items.length} producto(s) ${operation === 'assign' ? 'asignado(s)' : 'retirado(s)'} exitosamente ${operation === 'assign' ? 'a' : 'de'} ${distributorName}!`
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
      setError(err.response?.data?.message || 'Error al procesar la operación');
    } finally {
      setLoading(false);
    }
  };


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Filtrar productos disponibles (no agregados aún)
  const availableProducts = products.filter(
    p => !items.some(item => item.productId === p._id)
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-white">Gestión de Stock</h1>
        <p className="mt-2 text-gray-400">
          Asigna o retira múltiples productos de distribuidores
        </p>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-900/20 p-6">
          <h2 className="mb-3 text-xl font-semibold text-yellow-400">
            ⚠️ Alertas de Stock Bajo ({alerts.length})
          </h2>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert, index) => {
              if ('warehouseStock' in alert) {
                return (
                  <div key={index} className="text-sm text-yellow-300">
                    <strong>{alert.name}</strong> - Bodega - Stock: {alert.warehouseStock} (Alerta: {alert.lowStockAlert})
                  </div>
                );
              } else {
                const product = typeof alert.product === 'object' ? alert.product : null;
                const distributor = typeof alert.distributor === 'object' ? alert.distributor : null;
                return (
                  <div key={index} className="text-sm text-yellow-300">
                    <strong>{product?.name}</strong> - Distribuidor: {distributor?.name} - Stock: {alert.quantity}
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Configuración General */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">
            Configuración General
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Tipo de operación */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Tipo de Operación *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 cursor-pointer hover:border-blue-500">
                  <input
                    type="radio"
                    value="assign"
                    checked={operation === 'assign'}
                    onChange={(e) => setOperation(e.target.value as OperationType)}
                    className="mr-2"
                  />
                  <span className="text-white">Asignar Stock</span>
                </label>
                <label className="flex items-center rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 cursor-pointer hover:border-orange-500">
                  <input
                    type="radio"
                    value="withdraw"
                    checked={operation === 'withdraw'}
                    onChange={(e) => setOperation(e.target.value as OperationType)}
                    className="mr-2"
                  />
                  <span className="text-white">Retirar Stock</span>
                </label>
              </div>
            </div>

            {/* Distribuidor */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Distribuidor *
              </label>
              <select
                value={selectedDistributor}
                onChange={(e) => setSelectedDistributor(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecciona un distribuidor</option>
                {distributors.map((dist) => (
                  <option key={dist._id} value={dist._id}>
                    {dist.name} - {dist.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Inventario del Distribuidor Seleccionado */}
        {selectedDistributor && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-900/20 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                Inventario de {distributors.find(d => d._id === selectedDistributor)?.name}
              </h2>
              {loadingDistributorStock && (
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500"></div>
              )}
            </div>

            {!loadingDistributorStock && distributorStock.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">
                  Este distribuidor no tiene productos asignados
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {distributorStock.map((stock) => {
                  const product = typeof stock.product === 'object' ? stock.product : null;
                  return (
                    <div
                      key={stock._id}
                      className="rounded-lg border border-blue-500/20 bg-blue-950/30 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">
                            {product?.name || 'Producto desconocido'}
                          </h3>
                          <p className="mt-1 text-xs text-gray-400">
                            {formatCurrency(product?.distributorPrice || 0)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            stock.quantity <= 5 ? 'text-red-400' : 'text-green-400'
                          }`}>
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

        {/* Agregar Productos */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">
            Agregar Productos
          </h2>

          <div className="flex gap-4">
            <div className="flex-1">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona un producto</option>
                {availableProducts.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name} | Bodega: {product.warehouseStock || 0} | {formatCurrency(product.distributorPrice || 0)}
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
              Productos Seleccionados ({items.length})
            </h2>

            <div className="space-y-4">
              {items.map((item) => (
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
                            Cantidad {operation === 'assign' && `(máx: ${item.warehouseStock})`}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={operation === 'assign' ? item.warehouseStock : undefined}
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value);
                              updateItemQuantity(item.productId, val);
                            }}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (e.target.value === '' || val < 1) {
                                updateItemQuantity(item.productId, 1);
                              } else if (operation === 'assign' && val > item.warehouseStock) {
                                updateItemQuantity(item.productId, item.warehouseStock);
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
                              {formatCurrency(item.product.distributorPrice || 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {operation === 'assign' && (
                        <div className="mt-2 text-xs text-gray-400">
                          Quedará en bodega: {item.warehouseStock - item.quantity} unidades
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

        {/* Resumen */}
        {items.length > 0 && (
          <div className={`rounded-xl border p-6 ${
            operation === 'assign' 
              ? 'border-green-500/30 bg-green-900/20' 
              : 'border-orange-500/30 bg-orange-900/20'
          }`}>
            <h2 className="mb-4 text-xl font-semibold text-white">
              Resumen de Operación
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Productos:</span>
                <span className="font-semibold text-white">{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Unidades totales:</span>
                <span className="font-semibold text-white">
                  {calculateTotalUnits()}
                </span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-gray-300">Operación:</span>
                <span className={`font-bold ${
                  operation === 'assign' ? 'text-green-400' : 'text-orange-400'
                }`}>
                  {operation === 'assign' ? 'Asignar' : 'Retirar'}
                </span>
              </div>
              {selectedDistributor && (
                <div className="flex justify-between text-lg">
                  <span className="text-gray-300">Distribuidor:</span>
                  <span className="font-bold text-blue-400">
                    {distributors.find(d => d._id === selectedDistributor)?.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || items.length === 0 || !selectedDistributor}
            className={`flex-1 ${
              operation === 'assign' 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {loading 
              ? 'Procesando...' 
              : `${operation === 'assign' ? 'Asignar' : 'Retirar'} ${items.length} Producto(s)`
            }
          </Button>
        </div>
      </form>

      {/* Referencia de productos disponibles */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="mb-4 text-xl font-semibold text-white">
          Inventario de Bodega
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
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
                  <p className={`text-sm font-bold ${
                    (product.warehouseStock || 0) <= (product.lowStockAlert || 0)
                      ? 'text-red-400'
                      : 'text-green-400'
                  }`}>
                    Bodega: {product.warehouseStock || 0}
                  </p>
                  {(product.warehouseStock || 0) <= (product.lowStockAlert || 0) && (
                    <span className="text-xs text-red-400 font-semibold">⚠️ Bajo</span>
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
