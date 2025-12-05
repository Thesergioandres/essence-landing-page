import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { distributorService, saleService, stockService } from '../api/services';
import { Button } from '../components/Button';
import type { DistributorStock, Sale, User } from '../types';

interface DistributorStats {
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
}

const DistributorDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [distributor, setDistributor] = useState<User | null>(null);
  const [stock, setStock] = useState<DistributorStock[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<DistributorStats>({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
  });
  const [activeTab, setActiveTab] = useState<'info' | 'stock' | 'sales' | 'stats'>('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDistributor();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'stock') loadStock();
    if (activeTab === 'sales') loadSales();
  }, [activeTab, id]);

  const loadDistributor = async () => {
    try {
      setLoading(true);
      if (!id) return;
      const response = await distributorService.getById(id);
      setDistributor(response.distributor);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar distribuidor');
    } finally {
      setLoading(false);
    }
  };

  const loadStock = async () => {
    try {
      if (!id) return;
      const response = await stockService.getDistributorStock(id);
      setStock(response);
    } catch (err: any) {
      console.error('Error al cargar inventario:', err);
    }
  };

  const loadSales = async () => {
    try {
      if (!id) return;
      const response = await saleService.getDistributorSales(id);
      setSales(response.sales);
      
      // Calcular estadísticas
      const totalSales = response.sales.length;
      const totalRevenue = response.sales.reduce((sum: number, sale: Sale) => sum + (sale.salePrice * sale.quantity), 0);
      const totalProfit = response.sales.reduce((sum: number, sale: Sale) => sum + sale.distributorProfit, 0);
      
      setStats({ totalSales, totalRevenue, totalProfit });
    } catch (err: any) {
      console.error('Error al cargar ventas:', err);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (error || !distributor) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error || 'Distribuidor no encontrado'}
        </div>
        <Button onClick={() => navigate('/admin/distributors')} className="mt-4">
          Volver a Distribuidores
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{distributor.name}</h1>
          <p className="text-gray-600 mt-1">{distributor.email}</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => navigate(`/admin/distributors/${id}/edit`)}
            className="bg-blue-500 hover:bg-blue-600"
          >
            Editar
          </Button>
          <Button onClick={() => navigate('/admin/distributors')}>Volver</Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mb-6">
        <span
          className={`px-4 py-2 rounded-full text-sm font-semibold ${
            distributor.active
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {distributor.active ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          {['info', 'stock', 'sales', 'stats'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'info' && 'Información'}
              {tab === 'stock' && 'Inventario'}
              {tab === 'sales' && 'Ventas'}
              {tab === 'stats' && 'Estadísticas'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre</label>
              <p className="mt-1 text-lg">{distributor.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-lg">{distributor.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <p className="mt-1 text-lg">{distributor.phone || 'No especificado'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Dirección</label>
              <p className="mt-1 text-lg">{distributor.address || 'No especificada'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Rol</label>
              <p className="mt-1 text-lg capitalize">{distributor.role}</p>
            </div>
            {/* Fecha de registro no está en la interfaz User */}
          </div>
        )}

        {activeTab === 'stock' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Productos Asignados</h2>
              <Button
                onClick={() => navigate('/admin/stock-management')}
                className="bg-green-500 hover:bg-green-600"
              >
                Gestionar Stock
              </Button>
            </div>
            {stock.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay productos asignados</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Producto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Precio Distribuidor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Alerta Stock Bajo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stock.map((item) => (
                      <tr key={item._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {typeof item.product === 'object' ? item.product.name : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{item.quantity}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {typeof item.product === 'object'
                            ? formatCurrency(item.product.distributorPrice || 0)
                            : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{item.lowStockAlert}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.quantity <= item.lowStockAlert ? (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              Stock Bajo
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sales' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Historial de Ventas</h2>
            {sales.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay ventas registradas</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Producto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Precio Venta
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Rango
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ganancia
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sales.map((sale) => {
                      // Determinar rango según comisión
                      let rankBadge = { emoji: '📊', text: 'Normal', color: 'bg-blue-100 text-blue-800' };
                      if (sale.distributorProfitPercentage === 25) {
                        rankBadge = { emoji: '🥇', text: '1º', color: 'bg-yellow-100 text-yellow-800' };
                      } else if (sale.distributorProfitPercentage === 23) {
                        rankBadge = { emoji: '🥈', text: '2º', color: 'bg-gray-100 text-gray-800' };
                      } else if (sale.distributorProfitPercentage === 21) {
                        rankBadge = { emoji: '🥉', text: '3º', color: 'bg-orange-100 text-orange-800' };
                      }
                      
                      return (
                      <tr key={sale._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-blue-600 text-xs">
                            {sale.saleId || sale._id.slice(-8)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatDate(sale.createdAt || '')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {typeof sale.product === 'object' ? sale.product.name : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{sale.quantity}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatCurrency(sale.salePrice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${rankBadge.color}`}>
                            {rankBadge.emoji} {rankBadge.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatCurrency(sale.salePrice * sale.quantity)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-green-600 font-semibold">
                          {formatCurrency(sale.distributorProfit)}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Estadísticas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <p className="text-blue-600 text-sm font-medium">Total Ventas</p>
                <p className="text-3xl font-bold text-blue-900 mt-2">{stats.totalSales}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-lg">
                <p className="text-green-600 text-sm font-medium">Ingresos Totales</p>
                <p className="text-3xl font-bold text-green-900 mt-2">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
              <div className="bg-purple-50 p-6 rounded-lg">
                <p className="text-purple-600 text-sm font-medium">Ganancia Total</p>
                <p className="text-3xl font-bold text-purple-900 mt-2">
                  {formatCurrency(stats.totalProfit)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DistributorDetail;
