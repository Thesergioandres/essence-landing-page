import { m as motion } from "framer-motion";
import { Award, Medal, TrendingUp, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { advancedAnalyticsService } from "../../features/analytics/services";
import InfoTooltip from "../InfoTooltip";

interface EmployeeRankingsTableProps {
  startDate?: string;
  endDate?: string;
  limit?: number;
  search?: string;
  reloadKey?: number;
}

export const EmployeeRankingsTable: React.FC<
  EmployeeRankingsTableProps
> = ({ startDate, endDate, limit = 10, search = "", reloadKey = 0 }) => {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await advancedAnalyticsService.getEmployeeRankings({
          startDate,
          endDate,
        });
        console.log("Employee Rankings Response:", response);
        const validatedData = (response.rankings || []).map(
          (item: any, index: number) => ({
            ...item,
            rank: index + 1,
            totalSales: Number(item.totalSales ?? item.salesCount) || 0,
            revenue: Number(item.revenue ?? item.totalRevenue) || 0,
            profit: Number(item.profit ?? item.totalProfit) || 0,
            conversionRate: Number(item.conversionRate) || 0,
            averageOrderValue:
              Number(item.averageOrderValue ?? item.avgOrderValue) || 0,
          })
        );
        setRankings(validatedData);
      } catch (error) {
        console.error("Error al cargar rankings de employees:", error);
        setRankings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate, reloadKey]);

  const filteredRankings = useMemo(() => {
    const term = search.toLowerCase();
    const filtered = rankings.filter(r =>
      `${r.employeeName || r.name || ""} ${
        r.employeeEmail || r.email || ""
      }`
        .toLowerCase()
        .includes(term)
    );
    return filtered.slice(0, limit);
  }, [limit, rankings, search]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="font-bold text-gray-400">#{rank}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-gray-800 bg-gray-900/60">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!loading && filteredRankings.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center"
      >
        <h3 className="text-xl font-bold text-white">
          Ranking de Employees
        </h3>
        <p className="mt-2 text-gray-400">
          No hay employees para los filtros seleccionados.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900"
    >
      <div className="bg-linear-to-r from-purple-600 to-pink-600 p-6">
        <h3 className="flex items-center text-2xl font-bold text-white">
          <TrendingUp className="mr-2 h-6 w-6" />
          Ranking de Employees
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-800">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Posición
                <InfoTooltip text="Ranking por rendimiento en el periodo." />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Employee
                <InfoTooltip text="Nombre y contacto del employee." />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Ventas
                <InfoTooltip text="Cantidad de ventas confirmadas." />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Ingresos
                <InfoTooltip text="Ingresos confirmados generados por el employee." />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Ganancia
                <InfoTooltip text="Ganancia estimada para el negocio por esas ventas." />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Tasa de confirmacion
                <InfoTooltip text="Porcentaje de pedidos confirmados sobre el total registrado." />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Ticket Prom.
                <InfoTooltip text="Ingreso promedio por venta confirmada." />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-gray-900">
            {filteredRankings.map((employee, index) => {
              const position = index + 1;
              return (
                <motion.tr
                  key={employee.employeeId || employee._id || index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`hover:bg-white/5 ${
                    position <= 3 ? "bg-purple-500/10" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center justify-center">
                      {getRankIcon(position)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm font-medium text-white">
                      {employee.employeeName || employee.name}
                    </div>
                    <div className="text-sm text-gray-400">
                      {employee.employeeEmail || employee.email}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm font-semibold text-white">
                      {employee.totalSales}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm font-semibold text-green-600">
                      ${(Number(employee.revenue) || 0).toFixed(2)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm font-semibold text-blue-600">
                      ${(Number(employee.profit) || 0).toFixed(2)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center">
                      <div
                        className={`text-sm font-semibold ${
                          employee.conversionRate >= 70
                            ? "text-green-600"
                            : employee.conversionRate >= 50
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {(Number(employee.conversionRate) || 0).toFixed(1)}%
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm text-white">
                      ${(Number(employee.averageOrderValue) || 0).toFixed(2)}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
