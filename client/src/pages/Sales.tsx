import { useEffect, useState } from "react";
import { saleService } from "../api/services";
import type { Sale } from "../types";

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pendiente" | "confirmado">("all");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      setLoading(true);
      const response = await saleService.getAllSales();
      setSales(response.sales);
    } catch (error) {
      console.error("Error al cargar ventas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async (saleId: string) => {
    if (!confirm("¿Confirmar que has recibido el pago de esta venta?")) {
      return;
    }

    try {
      setConfirmingId(saleId);
      await saleService.confirmPayment(saleId);
      await loadSales();
    } catch (error) {
      console.error("Error al confirmar pago:", error);
      alert("Error al confirmar el pago");
    } finally {
      setConfirmingId(null);
    }
  };

  const filteredSales = sales.filter((sale) => {
    if (filter === "all") return true;
    return sale.paymentStatus === filter;
  });

  const stats = {
    total: sales.length,
    pendiente: sales.filter((s) => s.paymentStatus === "pendiente").length,
    confirmado: sales.filter((s) => s.paymentStatus === "confirmado").length,
    totalRevenue: sales.reduce((sum, s) => sum + s.salePrice * s.quantity, 0),
    totalProfit: sales.reduce((sum, s) => sum + s.adminProfit, 0),
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Ventas</h1>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Ventas</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 p-6 rounded-lg shadow">
          <p className="text-sm text-yellow-700">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-900">{stats.pendiente}</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg shadow">
          <p className="text-sm text-green-700">Confirmadas</p>
          <p className="text-2xl font-bold text-green-900">{stats.confirmado}</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg shadow">
          <p className="text-sm text-purple-700">Ingresos Totales</p>
          <p className="text-2xl font-bold text-purple-900">
            ${stats.totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="bg-blue-50 p-6 rounded-lg shadow">
          <p className="text-sm text-blue-700">Ganancia Admin</p>
          <p className="text-2xl font-bold text-blue-900">
            ${stats.totalProfit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
              filter === "all"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Todas ({stats.total})
          </button>
          <button
            onClick={() => setFilter("pendiente")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
              filter === "pendiente"
                ? "bg-yellow-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Pendientes ({stats.pendiente})
          </button>
          <button
            onClick={() => setFilter("confirmado")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
              filter === "confirmado"
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Confirmadas ({stats.confirmado})
          </button>
        </div>
      </div>

      {/* Tabla de ventas */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto table-responsive">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Distribuidor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Venta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ganancia Admin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.map((sale) => {
                const product = typeof sale.product === "object" ? sale.product : null;
                const distributor = typeof sale.distributor === "object" ? sale.distributor : null;

                return (
                  <tr key={sale._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(sale.saleDate).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {distributor?.name || "N/A"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {distributor?.email || ""}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {product?.image?.url && (
                          <img
                            src={product.image.url}
                            alt={product.name}
                            className="h-10 w-10 rounded object-cover mr-3"
                          />
                        )}
                        <span className="text-sm text-gray-900">
                          {product?.name || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${(sale.salePrice * sale.quantity).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ${sale.adminProfit.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sale.paymentStatus === "pendiente" ? (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                      ) : (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Confirmado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {sale.paymentStatus === "pendiente" ? (
                        <button
                          onClick={() => handleConfirmPayment(sale._id)}
                          disabled={confirmingId === sale._id}
                          className="text-green-600 hover:text-green-900 font-medium disabled:opacity-50"
                        >
                          {confirmingId === sale._id
                            ? "Confirmando..."
                            : "Confirmar Pago"}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          Confirmado el{" "}
                          {sale.paymentConfirmedAt &&
                            new Date(sale.paymentConfirmedAt).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredSales.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No hay ventas registradas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
