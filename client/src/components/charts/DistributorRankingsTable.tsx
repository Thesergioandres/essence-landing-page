import { motion } from "framer-motion";
import { Award, Medal, TrendingUp, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { advancedAnalyticsService } from "../../api/services";

interface DistributorRankingsTableProps {
  startDate?: string;
  endDate?: string;
}

export const DistributorRankingsTable: React.FC<
  DistributorRankingsTableProps
> = ({ startDate, endDate }) => {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await advancedAnalyticsService.getDistributorRankings({
          startDate,
          endDate,
        });
        console.log("Distributor Rankings Response:", response);
        const validatedData = (response.rankings || []).map(
          (item: any, index: number) => ({
            ...item,
            rank: index + 1,
            totalSales: Number(item.totalSales) || 0,
            revenue: Number(item.totalRevenue) || 0,
            profit: Number(item.totalProfit) || 0,
            conversionRate: Number(item.conversionRate) || 0,
            averageOrderValue: Number(item.avgOrderValue) || 0,
          })
        );
        setRankings(validatedData);
      } catch (error) {
        console.error("Error al cargar rankings de distribuidores:", error);
        setRankings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

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
          Ranking de Distribuidores
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-800">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Posición
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Distribuidor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Ventas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Ingresos
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Ganancia
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Conv. Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                Ticket Prom.
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-gray-900">
            {rankings.map((distributor, index) => (
              <motion.tr
                key={distributor._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`hover:bg-white/5 ${
                  distributor.rank <= 3 ? "bg-purple-500/10" : ""
                }`}
              >
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center justify-center">
                    {getRankIcon(distributor.rank)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="text-sm font-medium text-white">
                    {distributor.name}
                  </div>
                  <div className="text-sm text-gray-400">
                    {distributor.email}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="text-sm font-semibold text-white">
                    {distributor.totalSales}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="text-sm font-semibold text-green-600">
                    ${(Number(distributor.revenue) || 0).toFixed(2)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="text-sm font-semibold text-blue-600">
                    ${(Number(distributor.profit) || 0).toFixed(2)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center">
                    <div
                      className={`text-sm font-semibold ${
                        distributor.conversionRate >= 70
                          ? "text-green-600"
                          : distributor.conversionRate >= 50
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    >
                      {(Number(distributor.conversionRate) || 0).toFixed(1)}%
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="text-sm text-white">
                    ${(Number(distributor.averageOrderValue) || 0).toFixed(2)}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
