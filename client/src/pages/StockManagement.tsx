import { useEffect, useState } from 'react';
import { distributorService, productService, stockService } from '../api/services';
import { Button } from '../components/Button';
import type { DistributorStock, Product, User } from '../types';

type OperationType = 'assign' | 'withdraw';

const StockManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [distributors, setDistributors] = useState<User[]>([]);
  const [alerts, setAlerts] = useState<Array<Product | DistributorStock>>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedDistributor, setSelectedDistributor] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(0);
  const [operation, setOperation] = useState<OperationType>('assign');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsRes, distributorsRes, alertsRes] = await Promise.all([
        productService.getAll(),
        distributorService.getAll(),
        stockService.getAlerts(),
      ]);
      setProducts(productsRes);
      setDistributors(distributorsRes.filter((d: User) => d.active));
      setAlerts([...alertsRes.warehouseAlerts, ...alertsRes.distributorAlerts]);
    } catch (err) {
      console.error('Error al cargar datos:', err);
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p._id === productId);
    setSelectedProduct(product || null);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedProduct || !selectedDistributor || quantity <= 0) {
      setError('Por favor completa todos los campos correctamente');
      return;
    }

    if (operation === 'assign' && quantity > (selectedProduct.warehouseStock || 0)) {
      setError(`Stock insuficiente en bodega. Disponible: ${selectedProduct.warehouseStock}`);
      return;
    }

    try {
      setLoading(true);
      if (operation === 'assign') {
        await stockService.assignToDistributor({
          distributorId: selectedDistributor,
          productId: selectedProduct._id!,
          quantity
        });
        setSuccess(`Stock asignado correctamente a ${distributors.find(d => d._id === selectedDistributor)?.name}`);
      } else {
        await stockService.withdrawFromDistributor({
          distributorId: selectedDistributor,
          productId: selectedProduct._id!,
          quantity
        });
        setSuccess(`Stock retirado correctamente de ${distributors.find(d => d._id === selectedDistributor)?.name}`);
      }
      
      // Recargar datos
      await loadData();
      
      // Resetear formulario
      setSelectedProduct(null);
      setSelectedDistributor('');
      setQuantity(0);
     
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Stock</h1>
        <p className="text-gray-600 mt-2">Asigna o retira inventario de distribuidores</p>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">
            ⚠️ Alertas de Stock Bajo ({alerts.length})
          </h2>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert, index) => {
              if ('warehouseStock' in alert) {
                // Es un Product (warehouse alert)
                return (
                  <div key={index} className="text-sm text-yellow-700">
                    <strong>{alert.name}</strong> - Bodega - Stock: {alert.warehouseStock} (Alerta: {alert.lowStockAlert})
                  </div>
                );
              } else {
                // Es un DistributorStock
                const product = typeof alert.product === 'object' ? alert.product : null;
                const distributor = typeof alert.distributor === 'object' ? alert.distributor : null;
                return (
                  <div key={index} className="text-sm text-yellow-700">
                    <strong>{product?.name}</strong> - Distribuidor: {distributor?.name} - Stock: {alert.quantity}
                  </div>
                );
              }
            })}
            {alerts.length > 5 && (
              <p className="text-sm text-yellow-600 mt-2">
                Y {alerts.length - 5} alertas más...
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de productos */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Productos Disponibles</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {products.map((product) => (
              <div
                key={product._id}
                onClick={() => handleProductSelect(product._id!)}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedProduct?._id === product._id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Precio Distribuidor: {formatCurrency(product.distributorPrice || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">
                      Stock Total: {product.totalStock || 0}
                    </p>
                    <p className="text-sm text-green-600">
                      Bodega: {product.warehouseStock || 0}
                    </p>
                    {(product.warehouseStock || 0) <= (product.lowStockAlert || 0) && (
                      <span className="text-xs text-red-600 font-semibold">⚠️ Stock Bajo</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Formulario de operación */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Operación de Stock</h2>

          {error && (
            <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Producto seleccionado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Producto Seleccionado
              </label>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                {selectedProduct ? (
                  <>
                    <p className="font-semibold">{selectedProduct.name}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Stock en Bodega: {selectedProduct.warehouseStock || 0}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500">Selecciona un producto de la lista</p>
                )}
              </div>
            </div>

            {/* Tipo de operación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Operación
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="assign"
                    checked={operation === 'assign'}
                    onChange={(e) => setOperation(e.target.value as OperationType)}
                    className="mr-2"
                  />
                  <span>Asignar Stock</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="withdraw"
                    checked={operation === 'withdraw'}
                    onChange={(e) => setOperation(e.target.value as OperationType)}
                    className="mr-2"
                  />
                  <span>Retirar Stock</span>
                </label>
              </div>
            </div>

            {/* Distribuidor */}
            <div>
              <label htmlFor="distributor" className="block text-sm font-medium text-gray-700 mb-2">
                Distribuidor *
              </label>
              <select
                id="distributor"
                value={selectedDistributor}
                onChange={(e) => setSelectedDistributor(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

            {/* Cantidad */}
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad *
              </label>
              <input
                type="number"
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Información adicional */}
            {selectedProduct && operation === 'assign' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> Después de asignar {quantity} unidades, quedarán{' '}
                  {(selectedProduct.warehouseStock || 0) - quantity} unidades en bodega.
                </p>
              </div>
            )}

            {/* Botón submit */}
            <Button
              type="submit"
              disabled={loading || !selectedProduct || !selectedDistributor || quantity <= 0}
              className={`w-full ${
                operation === 'assign' ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'
              } disabled:bg-gray-400`}
            >
              {loading
                ? 'Procesando...'
                : operation === 'assign'
                ? 'Asignar Stock'
                : 'Retirar Stock'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StockManagement;
