import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { distributorService, saleService, stockService } from "../api/services";
import { Button } from "../components/Button";
import LoadingSpinner from "../components/LoadingSpinner";
import type { DistributorStock, Sale, User } from "../types";

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
  const [activeTab, setActiveTab] = useState<
    "info" | "stock" | "sales" | "stats"
  >("info");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDistributor = async () => {
      try {
        setLoading(true);
        if (!id) return;
        const response = await distributorService.getById(id);
        setDistributor(response.distributor);
        setError("");
      } catch (err: any) {
        setError(err.response?.data?.message || "Error al cargar distribuidor");
      } finally {
        setLoading(false);
      }
    };

    void loadDistributor();
  }, [id]);

  useEffect(() => {
    const loadStock = async () => {
      try {
        if (!id) return;
        const response = await stockService.getDistributorStock(id);
        setStock(response);
      } catch (err: any) {
        console.error("Error al cargar inventario:", err);
      }
    };

    const loadSales = async () => {
      try {
        if (!id) return;
        const response = await saleService.getDistributorSales(id);
        setSales(response.sales);

        // Calcular estadísticas
        const totalSales = response.sales.length;
        const totalRevenue = response.sales.reduce(
          (sum: number, sale: Sale) => sum + sale.salePrice * sale.quantity,
          0
        );
        const totalProfit = response.sales.reduce(
          (sum: number, sale: Sale) => sum + sale.distributorProfit,
          0
        );

        setStats({ totalSales, totalRevenue, totalProfit });
      } catch (err: any) {
        console.error("Error al cargar ventas:", err);
      }
    };

    if (activeTab === "stock") void loadStock();
    if (activeTab === "sales") void loadSales();
  }, [activeTab, id]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" message="Cargando distribuidor..." />
      </div>
    );
  }

  if (error || !distributor) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">
          {error || "Distribuidor no encontrado"}
        </div>
        <div>
          <Button
            onClick={() => navigate("/admin/distributors")}
            variant="outline"
            className="border-gray-700 bg-transparent text-gray-200 hover:bg-gray-800"
          >
            Volver a Distribuidores
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white">{distributor.name}</h1>
          <p className="mt-2 text-gray-400">{distributor.email}</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => navigate(`/admin/distributors/${id}/edit`)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Editar
          </Button>
          <Button
            onClick={() => navigate("/admin/distributors")}
            variant="outline"
            className="border-gray-700 bg-transparent text-gray-200 hover:bg-gray-800"
          >
            Volver
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mb-6">
        <span
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            distributor.active
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {distributor.active ? "Activo" : "Inactivo"}
        </span>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-700">
        <nav className="flex gap-8">
          {["info", "stock", "sales", "stats"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === tab
                  ? "border-purple-500 text-purple-300"
                  : "border-transparent text-gray-400 hover:border-gray-500 hover:text-white"
              }`}
            >
              {tab === "info" && "Información"}
              {tab === "stock" && "Inventario"}
              {tab === "sales" && "Ventas"}
              {tab === "stats" && "Estadísticas"}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        {activeTab === "info" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400">
                Nombre
              </label>
              <p className="mt-1 text-lg text-white">{distributor.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">
                Email
              </label>
              <p className="mt-1 text-lg text-white">{distributor.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">
                Teléfono
              </label>
              <p className="mt-1 text-lg text-white">
                {distributor.phone || "No especificado"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">
                Dirección
              </label>
              <p className="mt-1 text-lg text-white">
                {distributor.address || "No especificada"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">
                Rol
              </label>
              <p className="mt-1 text-lg capitalize text-white">
                {distributor.role}
              </p>
            </div>
            {/* Fecha de registro no está en la interfaz User */}
          </div>
        )}

        {activeTab === "stock" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                Productos Asignados
              </h2>
              <Button
                onClick={() => navigate("/admin/stock-management")}
                className="bg-green-600 hover:bg-green-700"
              >
                Gestionar Stock
              </Button>
            </div>
            {stock.length === 0 ? (
              <p className="py-8 text-center text-gray-400">
                No hay productos asignados
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Producto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Precio Distribuidor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Alerta Stock Bajo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {stock.map(item => (
                      <tr key={item._id} className="hover:bg-gray-900/30">
                        <td className="whitespace-nowrap px-6 py-4 text-gray-200">
                          {typeof item.product === "object"
                            ? item.product.name
                            : "N/A"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-200">
                          {item.quantity}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-200">
                          {typeof item.product === "object"
                            ? formatCurrency(item.product.distributorPrice || 0)
                            : "N/A"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-200">
                          {item.lowStockAlert}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {item.quantity <= item.lowStockAlert ? (
                            <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-300">
                              Stock Bajo
                            </span>
                          ) : (
                            <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs font-semibold text-green-300">
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

        {activeTab === "sales" && (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-white">
              Historial de Ventas
            </h2>
            {sales.length === 0 ? (
              <p className="py-8 text-center text-gray-400">
                No hay ventas registradas
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Producto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Precio Venta
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Rango
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Ganancia
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {sales.map(sale => {
                      // Determinar rango según comisión
                      let rankBadge = {
                        emoji: "📊",
                        text: "Normal",
                        color: "bg-blue-500/20 text-blue-300",
                      };
                      if (sale.distributorProfitPercentage === 25) {
                        rankBadge = {
                          emoji: "🥇",
                          text: "1º",
                          color: "bg-yellow-500/20 text-yellow-300",
                        };
                      } else if (sale.distributorProfitPercentage === 23) {
                        rankBadge = {
                          emoji: "🥈",
                          text: "2º",
                          color: "bg-gray-500/20 text-gray-200",
                        };
                      } else if (sale.distributorProfitPercentage === 21) {
                        rankBadge = {
                          emoji: "🥉",
                          text: "3º",
                          color: "bg-orange-500/20 text-orange-300",
                        };
                      }

                      return (
                        <tr key={sale._id} className="hover:bg-gray-900/30">
                          <td className="whitespace-nowrap px-6 py-4">
                            <span className="font-mono text-xs text-purple-300">
                              {sale.saleId || sale._id.slice(-8)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-gray-200">
                            {formatDate(sale.createdAt || "")}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-gray-200">
                            {typeof sale.product === "object"
                              ? sale.product.name
                              : "N/A"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-gray-200">
                            {sale.quantity}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-gray-200">
                            {formatCurrency(sale.salePrice)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${rankBadge.color}`}
                            >
                              {rankBadge.emoji} {rankBadge.text}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-gray-200">
                            {formatCurrency(sale.salePrice * sale.quantity)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 font-semibold text-green-400">
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

        {activeTab === "stats" && (
          <div>
            <h2 className="mb-6 text-xl font-semibold text-white">
              Estadísticas
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-6">
                <p className="text-sm font-medium text-gray-400">
                  Total Ventas
                </p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {stats.totalSales}
                </p>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-6">
                <p className="text-sm font-medium text-gray-400">
                  Ingresos Totales
                </p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-6">
                <p className="text-sm font-medium text-gray-400">
                  Ganancia Total
                </p>
                <p className="mt-2 text-3xl font-bold text-white">
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
