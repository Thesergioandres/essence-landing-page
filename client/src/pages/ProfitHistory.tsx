import { useEffect, useState } from "react";
import { profitHistoryService, authService } from "../api/services";
import type {
  ProfitHistoryEntry,
  UserBalance,
  ComparativeAnalysis,
  User,
} from "../types";

export default function ProfitHistory() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ProfitHistoryEntry[]>([]);
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [comparative, setComparative] = useState<ComparativeAnalysis | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<
    "venta_normal" | "venta_especial" | "ajuste" | "bonus" | ""
  >("");
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  // Admin check
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = currentUser.role === "admin";

  const loadData = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);

      const filters = {
        page: currentPage,
        limit: 20,
        ...(typeFilter && { type: typeFilter }),
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      };

      // Cargar historial y balance en paralelo
      const [historyRes, balanceRes] = await Promise.all([
        profitHistoryService.getUserHistory(selectedUser, filters).catch(err => {
          console.error("Error cargando historial:", err);
          return { history: [], pagination: { page: 1, pages: 1, total: 0 }, summary: { totalAmount: 0, count: 0 } };
        }),
        profitHistoryService.getUserBalance(selectedUser).catch(err => {
          console.error("Error cargando balance:", err);
          return { totalBalance: 0, breakdown: {}, transactionCount: 0, lastUpdate: null };
        }),
      ]);

      setHistory(historyRes.history);
      setBalance(balanceRes);
      setCurrentPage(historyRes.pagination.page);
      setTotalPages(historyRes.pagination.pages);
      setTotalCount(historyRes.pagination.total);

      // Load comparative if admin (no bloquear si falla)
      if (isAdmin) {
        profitHistoryService.getComparativeAnalysis({ userId: selectedUser })
          .then(comparativeRes => setComparative(comparativeRes))
          .catch(err => console.error("Error cargando comparativo:", err));
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await authService.getAllUsers();
        // Incluir admin y distribuidores
        const relevantUsers = response.data.filter((u: User) => 
          u.role === "distribuidor" || u.role === "admin"
        );
        setUsers(relevantUsers);
        
        // Si es admin, seleccionar el primer usuario (puede ser él mismo)
        if (relevantUsers.length > 0) {
          setSelectedUser(relevantUsers[0]._id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error cargando usuarios:", error);
        setLoading(false);
      }
    };

    if (isAdmin) {
      loadUsers();
    } else {
      setSelectedUser(currentUser._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, currentPage, typeFilter, dateRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      venta_normal: "Venta Normal",
      venta_especial: "Venta Especial",
      ajuste: "Ajuste",
      bonus: "Bonus",
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      venta_normal: "bg-blue-100 text-blue-800",
      venta_especial: "bg-purple-100 text-purple-800",
      ajuste: "bg-yellow-100 text-yellow-800",
      bonus: "bg-green-100 text-green-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const clearFilters = () => {
    setTypeFilter("");
    setDateRange({ startDate: "", endDate: "" });
    setCurrentPage(1);
  };

  if (loading && !history.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Cargando historial...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Historial de Ganancias</h1>
      </div>

      {/* Balance Card */}
      {balance && (
        <div className="bg-linear-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm font-medium">Balance Total</p>
              <p className="text-4xl font-bold mt-2">{formatCurrency(balance.totalBalance)}</p>
            </div>
            <div className="text-right space-y-2">
              <div>
                <p className="text-indigo-100 text-xs">Ventas Normales</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(balance.breakdown.venta_normal || 0)}
                </p>
              </div>
              <div>
                <p className="text-indigo-100 text-xs">Ventas Especiales</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(balance.breakdown.venta_especial || 0)}
                </p>
              </div>
              {balance.breakdown.ajuste !== 0 && (
                <div>
                  <p className="text-indigo-100 text-xs">Ajustes</p>
                  <p className="text-xl font-semibold">
                    {formatCurrency(balance.breakdown.ajuste || 0)}
                  </p>
                </div>
              )}
              {balance.breakdown.bonus !== 0 && (
                <div>
                  <p className="text-indigo-100 text-xs">Bonus</p>
                  <p className="text-xl font-semibold">
                    {formatCurrency(balance.breakdown.bonus || 0)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comparative Analysis */}
      {isAdmin && comparative && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm font-medium">Mes Actual</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(comparative.currentMonth?.total || 0)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {comparative.currentMonth?.count || 0} transacciones
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm font-medium">Mes Anterior</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(comparative.previousMonth?.total || 0)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {comparative.previousMonth?.count || 0} transacciones
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm font-medium">Cambio</p>
            <p
              className={`text-2xl font-bold mt-1 ${
                (comparative.percentageChange || 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {(comparative.percentageChange || 0) >= 0 ? "+" : ""}
              {(comparative.percentageChange || 0).toFixed(1)}%
            </p>
            <p
              className={`text-sm mt-1 ${
                (comparative.difference || 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(Math.abs(comparative.difference || 0))}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distribuidor
              </label>
              <select
                value={selectedUser}
                onChange={(e) => {
                  setSelectedUser(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Seleccionar...</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(
                  e.target.value as "venta_normal" | "venta_especial" | "ajuste" | "bonus" | ""
                );
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos</option>
              <option value="venta_normal">Venta Normal</option>
              <option value="venta_especial">Venta Especial</option>
              <option value="ajuste">Ajuste</option>
              <option value="bonus">Bonus</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => {
                setDateRange({ ...dateRange, startDate: e.target.value });
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Fin</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => {
                setDateRange({ ...dateRange, endDate: e.target.value });
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No hay registros en el historial
                  </td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(entry.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeColor(
                          entry.type
                        )}`}
                      >
                        {getTypeLabel(entry.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {entry.description || "-"}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                        entry.amount >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {entry.amount >= 0 ? "+" : ""}
                      {formatCurrency(entry.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(entry.balanceAfter)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando{" "}
                  <span className="font-medium">
                    {(currentPage - 1) * 20 + 1}
                  </span>{" "}
                  a{" "}
                  <span className="font-medium">
                    {Math.min(currentPage * 20, totalCount)}
                  </span>{" "}
                  de <span className="font-medium">{totalCount}</span> resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === i + 1
                          ? "z-10 bg-indigo-50 border-indigo-500 text-indigo-600"
                          : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
