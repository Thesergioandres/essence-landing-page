import { useEffect, useState } from "react";
import { authService, profitHistoryService } from "../api/services";
import type {
  ComparativeAnalysis,
  ProfitHistoryEntry,
  User,
  UserBalance,
} from "../types";

export default function ProfitHistory() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ProfitHistoryEntry[]>([]);
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [comparative, setComparative] = useState<ComparativeAnalysis | null>(
    null
  );
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
        profitHistoryService
          .getUserHistory(selectedUser, filters)
          .catch(err => {
            console.error("Error cargando historial:", err);
            return {
              history: [],
              pagination: { page: 1, pages: 1, total: 0 },
              summary: { totalAmount: 0, count: 0 },
            };
          }),
        profitHistoryService.getUserBalance(selectedUser).catch(err => {
          console.error("Error cargando balance:", err);
          return {
            totalBalance: 0,
            breakdown: {
              venta_normal: 0,
              venta_especial: 0,
              ajuste: 0,
              bonus: 0,
            },
            transactionCount: 0,
            lastUpdate: null,
          };
        }),
      ]);

      setHistory(historyRes.history);
      setBalance(balanceRes);
      setCurrentPage(historyRes.pagination.page);
      setTotalPages(historyRes.pagination.pages);
      setTotalCount(historyRes.pagination.total);

      // Load comparative if admin (no bloquear si falla)
      if (isAdmin) {
        profitHistoryService
          .getComparativeAnalysis({ userId: selectedUser })
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
        const relevantUsers = response.data.filter(
          (u: User) => u.role === "distribuidor" || u.role === "admin"
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
      venta_normal: "bg-blue-500/20 text-blue-300",
      venta_especial: "bg-purple-500/20 text-purple-300",
      ajuste: "bg-yellow-500/20 text-yellow-300",
      bonus: "bg-green-500/20 text-green-300",
    };
    return colors[type] || "bg-gray-500/20 text-gray-200";
  };

  const clearFilters = () => {
    setTypeFilter("");
    setDateRange({ startDate: "", endDate: "" });
    setCurrentPage(1);
  };

  if (loading && !history.length) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg text-gray-200">Cargando historial...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">
          Historial de Ganancias
        </h1>
      </div>

      {/* Balance Card */}
      {balance && (
        <div className="bg-linear-to-r rounded-lg from-indigo-500 to-purple-600 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-100">
                Balance Total
              </p>
              <p className="mt-2 text-4xl font-bold">
                {formatCurrency(balance.totalBalance)}
              </p>
            </div>
            <div className="space-y-2 text-right">
              <div>
                <p className="text-xs text-indigo-100">Ventas Normales</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(balance.breakdown.venta_normal || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-indigo-100">Ventas Especiales</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(balance.breakdown.venta_especial || 0)}
                </p>
              </div>
              {balance.breakdown.ajuste !== 0 && (
                <div>
                  <p className="text-xs text-indigo-100">Ajustes</p>
                  <p className="text-xl font-semibold">
                    {formatCurrency(balance.breakdown.ajuste || 0)}
                  </p>
                </div>
              )}
              {balance.breakdown.bonus !== 0 && (
                <div>
                  <p className="text-xs text-indigo-100">Bonus</p>
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-sm font-medium text-gray-400">Mes Actual</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {formatCurrency(comparative.currentMonth?.total || 0)}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {comparative.currentMonth?.count || 0} transacciones
            </p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-sm font-medium text-gray-400">Mes Anterior</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {formatCurrency(comparative.previousMonth?.total || 0)}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {comparative.previousMonth?.count || 0} transacciones
            </p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-sm font-medium text-gray-400">Cambio</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                (comparative.percentageChange || 0) >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {(comparative.percentageChange || 0) >= 0 ? "+" : ""}
              {(comparative.percentageChange || 0).toFixed(1)}%
            </p>
            <p
              className={`mt-1 text-sm ${
                (comparative.difference || 0) >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {formatCurrency(Math.abs(comparative.difference || 0))}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {isAdmin && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Distribuidor
              </label>
              <select
                value={selectedUser}
                onChange={e => {
                  setSelectedUser(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              >
                <option value="">Seleccionar...</option>
                {users.map(user => (
                  <option key={user._id} value={user._id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Tipo
            </label>
            <select
              value={typeFilter}
              onChange={e => {
                setTypeFilter(
                  e.target.value as
                    | "venta_normal"
                    | "venta_especial"
                    | "ajuste"
                    | "bonus"
                    | ""
                );
                setCurrentPage(1);
              }}
              className="w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            >
              <option value="">Todos</option>
              <option value="venta_normal">Venta Normal</option>
              <option value="venta_especial">Venta Especial</option>
              <option value="ajuste">Ajuste</option>
              <option value="bonus">Bonus</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={e => {
                setDateRange({ ...dateRange, startDate: e.target.value });
                setCurrentPage(1);
              }}
              className="w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Fecha Fin
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={e => {
                setDateRange({ ...dateRange, endDate: e.target.value });
                setCurrentPage(1);
              }}
              className="w-full rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full rounded-md border border-gray-700 bg-gray-900/40 px-4 py-2 text-gray-200 transition-colors hover:bg-gray-800"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  Descripción
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                  Monto
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {history.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    No hay registros en el historial
                  </td>
                </tr>
              ) : (
                history.map(entry => (
                  <tr key={entry._id} className="hover:bg-gray-900/30">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-200">
                      {formatDate(entry.date)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold leading-5 ${getTypeColor(
                          entry.type
                        )}`}
                      >
                        {getTypeLabel(entry.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-200">
                      {entry.description || "-"}
                    </td>
                    <td
                      className={`whitespace-nowrap px-6 py-4 text-right text-sm font-medium ${
                        entry.amount >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {entry.amount >= 0 ? "+" : ""}
                      {formatCurrency(entry.amount)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-200">
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
          <div className="flex items-center justify-between border-t border-gray-700 bg-gray-900/30 px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-gray-700 bg-transparent px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-700 bg-transparent px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-300">
                  Mostrando{" "}
                  <span className="font-medium">
                    {(currentPage - 1) * 20 + 1}
                  </span>{" "}
                  a{" "}
                  <span className="font-medium">
                    {Math.min(currentPage * 20, totalCount)}
                  </span>{" "}
                  de <span className="font-medium">{totalCount}</span>{" "}
                  resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md border border-gray-700 bg-transparent px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`relative inline-flex items-center border px-4 py-2 text-sm font-medium ${
                        currentPage === i + 1
                          ? "z-10 border-indigo-500 bg-indigo-50 text-indigo-600"
                          : "border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      setCurrentPage(p => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md border border-gray-700 bg-transparent px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
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
