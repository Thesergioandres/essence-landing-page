import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { saleService } from "../../sales/services";
import type { Sale } from "../../sales/types/sales.types";

export default function EmployeeSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
  });
  const [filterType, setFilterType] = useState<"all" | "credit" | "paid">(
    "all"
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadSales = async () => {
      try {
        setLoading(true);
        const filterParams = {
          ...(filters.startDate && { startDate: filters.startDate }),
          ...(filters.endDate && { endDate: filters.endDate }),
        };

        const response = await saleService.getEmployeeSales(
          undefined,
          filterParams
        );
        setSales(response?.sales || []);
        if (response?.stats) {
          setStats({
            totalSales: response.stats.totalSales || 0,
            totalRevenue: response.stats.totalRevenue || 0,
            totalProfit: response.stats.totalEmployeeProfit || 0,
          });
        }
      } catch (error) {
        console.error("Error al cargar ventas:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadSales();
  }, [filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ startDate: "", endDate: "" });
    setFilterType("all");
  };

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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSaleSourceLabel = (sale: Sale) => {
    const source = sale.sourceLocation;
    if (source === "employee") return "Inventario empleado";
    if (source === "branch") {
      const branchName =
        sale.branchName ||
        (typeof sale.branch === "object" ? sale.branch?.name : null);
      return branchName ? `Sede: ${branchName}` : "Sede";
    }
    if (source === "warehouse") return "Bodega central";

    if (sale.branchName) return `Sede: ${sale.branchName}`;
    if (typeof sale.branch === "object" && sale.branch?.name)
      return `Sede: ${sale.branch.name}`;
    if (sale.employee) return "Inventario empleado";
    return "Bodega central";
  };

  const getGroupSourceLabel = (groupSales: Sale[]) => {
    const labels = new Set(groupSales.map(getSaleSourceLabel));
    if (labels.size === 1) return Array.from(labels)[0];
    return "Mixto";
  };

  // Helper para obtener el crédito de una venta (puede venir en creditId o credit)
  const getCreditFromSale = (sale: Sale) => {
    // El backend devuelve creditId poblado cuando es crédito
    if (sale.creditId && typeof sale.creditId === "object") {
      return sale.creditId;
    }
    // Fallback a credit si existe
    if (sale.credit && typeof sale.credit === "object") {
      return sale.credit;
    }
    return null;
  };

  // Helper para verificar crédito activo
  const hasActiveCredit = (sale: Sale): boolean => {
    if (!sale.isCredit) return false;
    const credit = getCreditFromSale(sale);
    if (credit && credit.remainingAmount !== undefined) {
      return credit.remainingAmount > 0;
    }
    // Si es crédito pero no hay info del crédito poblado, asumir activo
    return sale.isCredit === true;
  };

  // Calcular estadísticas de créditos
  const creditStats = {
    salesWithCredit: sales.filter(s => s.isCredit).length,
    pendingCollection: sales.filter(s => hasActiveCredit(s)).length,
    pendingAmount: sales
      .filter(s => hasActiveCredit(s))
      .reduce((sum, s) => {
        const credit = getCreditFromSale(s);
        if (credit && credit.remainingAmount !== undefined) {
          return sum + credit.remainingAmount;
        }
        return sum + s.salePrice * s.quantity;
      }, 0),
    collectedAmount: sales
      .filter(s => s.isCredit)
      .reduce((sum, s) => {
        const credit = getCreditFromSale(s);
        if (credit && credit.paidAmount !== undefined) {
          return sum + credit.paidAmount;
        }
        return sum;
      }, 0),
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Filtrar ventas según el tipo seleccionado
  const filteredSales = sales.filter(sale => {
    if (filterType === "credit") return hasActiveCredit(sale);
    if (filterType === "paid") return !hasActiveCredit(sale);
    return true;
  });

  // Agrupar las ventas filtradas
  const saleGroups = (() => {
    const groups = new Map<
      string,
      {
        groupId: string;
        sales: Sale[];
        totalQuantity: number;
        totalRevenue: number;
        totalProfit: number;
        saleDate: string;
        isCredit: boolean;
        hasActiveCredit: boolean;
      }
    >();

    filteredSales.forEach(sale => {
      const groupId = sale.saleGroupId || sale._id;
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          groupId,
          sales: [],
          totalQuantity: 0,
          totalRevenue: 0,
          totalProfit: 0,
          saleDate: sale.saleDate,
          isCredit: sale.isCredit || false,
          hasActiveCredit: hasActiveCredit(sale),
        });
      }
      const group = groups.get(groupId)!;
      group.sales.push(sale);
      group.totalQuantity += sale.quantity;
      group.totalRevenue += sale.salePrice * sale.quantity;
      group.totalProfit += sale.employeeProfit || 0;
      if (hasActiveCredit(sale)) {
        group.hasActiveCredit = true;
      }
    });

    return Array.from(groups.values());
  })();

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white">Mis Ventas</h1>
          <p className="mt-2 text-gray-400">Historial completo de tus ventas</p>
        </div>
        <Link
          to="/staff/credits"
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition hover:bg-orange-700"
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
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          Gestionar Cobros
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-linear-to-br rounded-xl border border-gray-700 from-blue-900/50 to-gray-800/50 p-5">
          <p className="text-sm text-gray-400">Total Ventas</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {stats.totalSales}
          </p>
        </div>
        <div className="bg-linear-to-br rounded-xl border border-gray-700 from-purple-900/50 to-gray-800/50 p-5">
          <p className="text-sm text-gray-400">Mis Ganancias</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(stats.totalProfit)}
          </p>
        </div>
        <div className="bg-linear-to-br rounded-xl border border-orange-700/50 from-orange-900/30 to-gray-800/50 p-5">
          <p className="text-sm text-orange-300">💳 Por Cobrar</p>
          <p className="mt-2 text-2xl font-bold text-orange-400">
            {creditStats.pendingCollection}
          </p>
          <p className="mt-1 text-xs text-orange-300/70">
            {formatCurrency(creditStats.pendingAmount)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Fecha inicio
            </label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Fecha fin
            </label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Estado
            </label>
            <select
              value={filterType}
              onChange={e =>
                setFilterType(e.target.value as "all" | "credit" | "paid")
              }
              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas ({sales.length})</option>
              <option value="credit">
                Pendientes de cobro ({creditStats.pendingCollection})
              </option>
              <option value="paid">
                Pagadas ({sales.length - creditStats.pendingCollection})
              </option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Historial de Ventas ({saleGroups.length}{" "}
          {saleGroups.length === 1 ? "registro" : "registros"})
        </h2>

        {saleGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-600 p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
            <p className="mt-4 text-lg text-gray-400">
              No se encontraron ventas
            </p>
            {(filters.startDate || filters.endDate || filterType !== "all") && (
              <p className="mt-2 text-sm text-gray-500">
                Intenta ajustar los filtros de búsqueda
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    ID
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Fecha
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Producto
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Cliente
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Origen
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Total
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Estado
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Rango
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Ganancia
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {saleGroups.map(group => {
                  const isGroup = group.sales.length > 1;
                  const isExpanded = expandedGroups.has(group.groupId);

                  // Si es un grupo, mostrar fila de resumen
                  if (isGroup) {
                    return (
                      <Fragment key={group.groupId}>
                        <tr
                          key={group.groupId}
                          className="cursor-pointer bg-purple-900/10 hover:bg-purple-900/20"
                          onClick={() => toggleGroup(group.groupId)}
                        >
                          <td className="px-3 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-purple-400">
                                {isExpanded ? "▼" : "▶"}
                              </span>
                              <span className="font-mono text-xs text-purple-400">
                                GRUPO-{group.groupId.slice(-6)}
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-300">
                            {formatDate(group.saleDate)}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <span className="font-semibold text-purple-300">
                              {group.sales.length} productos
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-300">
                            {typeof group.sales[0].customer === "object"
                              ? group.sales[0].customer.name
                              : "-"}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-300">
                            {getGroupSourceLabel(group.sales)}
                          </td>
                          <td className="px-3 py-3 text-sm font-semibold text-white">
                            {formatCurrency(group.totalRevenue)}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {group.hasActiveCredit ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-900/30 px-2 py-1 text-xs font-semibold text-orange-400">
                                💳 Por cobrar
                              </span>
                            ) : group.isCredit ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-900/30 px-2 py-1 text-xs font-semibold text-green-400">
                                ✓ Cobrado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-900/30 px-2 py-1 text-xs font-semibold text-green-400">
                                ✓ Pagado
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm">-</td>
                          <td className="px-3 py-3 text-sm font-bold text-green-400">
                            {formatCurrency(group.totalProfit)}
                          </td>
                        </tr>
                        {isExpanded &&
                          group.sales.map(sale => {
                            const product =
                              typeof sale.product === "object"
                                ? sale.product
                                : null;
                            const customer =
                              typeof sale.customer === "object"
                                ? sale.customer
                                : null;
                            const credit = getCreditFromSale(sale);
                            const total = sale.salePrice * sale.quantity;
                            const isActiveCredit = hasActiveCredit(sale);

                            let rankBadge = {
                              emoji: "📊",
                              text: "Normal",
                              color: "bg-blue-900/30 text-blue-400",
                            };
                            if (sale.employeeProfitPercentage === 25) {
                              rankBadge = {
                                emoji: "🥇",
                                text: "1º",
                                color: "bg-yellow-900/30 text-yellow-400",
                              };
                            } else if (
                              sale.employeeProfitPercentage === 23
                            ) {
                              rankBadge = {
                                emoji: "🥈",
                                text: "2º",
                                color: "bg-gray-700/30 text-gray-300",
                              };
                            } else if (
                              sale.employeeProfitPercentage === 21
                            ) {
                              rankBadge = {
                                emoji: "🥉",
                                text: "3º",
                                color: "bg-orange-900/30 text-orange-400",
                              };
                            }

                            return (
                              <tr
                                key={sale._id}
                                className="bg-gray-900/30 hover:bg-gray-700/30"
                              >
                                <td className="px-3 py-3 pl-10 text-sm">
                                  <span className="font-mono text-xs text-blue-400">
                                    {sale.saleId || sale._id.slice(-8)}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-300">
                                  {formatDate(sale.saleDate)}
                                </td>
                                <td className="px-3 py-3 text-sm">
                                  <div className="flex items-center gap-2">
                                    {product?.image?.url && (
                                      <img
                                        src={product.image.url}
                                        alt={product.name}
                                        className="h-8 w-8 rounded object-cover"
                                      />
                                    )}
                                    <div>
                                      <span className="block font-medium text-white">
                                        {product?.name ||
                                          sale.productName ||
                                          "Producto Eliminado"}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        x{sale.quantity}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-sm text-gray-300">
                                  {customer?.name || "-"}
                                </td>
                                <td className="px-3 py-3 text-sm text-gray-300">
                                  {getSaleSourceLabel(sale)}
                                </td>
                                <td className="px-3 py-3 text-sm font-semibold text-white">
                                  {formatCurrency(total)}
                                </td>
                                <td className="px-3 py-3 text-sm">
                                  {isActiveCredit ? (
                                    <div className="flex flex-col">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-900/30 px-2 py-1 text-xs font-semibold text-orange-400">
                                        💳 Por cobrar
                                      </span>
                                      {credit && (
                                        <span className="mt-1 text-xs text-orange-300/70">
                                          Debe:{" "}
                                          {formatCurrency(
                                            credit.remainingAmount || 0
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  ) : sale.isCredit ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-900/30 px-2 py-1 text-xs font-semibold text-green-400">
                                      ✓ Cobrado
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-900/30 px-2 py-1 text-xs font-semibold text-green-400">
                                      ✓ Pagado
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-sm">
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-semibold ${rankBadge.color}`}
                                  >
                                    {rankBadge.emoji} {rankBadge.text}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-sm font-bold text-green-400">
                                  {formatCurrency(sale.employeeProfit)}
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  }

                  // Si no es un grupo, mostrar venta individual normal
                  const sale = group.sales[0];
                  const product =
                    typeof sale.product === "object" ? sale.product : null;
                  const customer =
                    typeof sale.customer === "object" ? sale.customer : null;
                  const credit = getCreditFromSale(sale);
                  const total = sale.salePrice * sale.quantity;
                  const isActiveCredit = hasActiveCredit(sale);

                  let rankBadge = {
                    emoji: "📊",
                    text: "Normal",
                    color: "bg-blue-900/30 text-blue-400",
                  };
                  if (sale.employeeProfitPercentage === 25) {
                    rankBadge = {
                      emoji: "🥇",
                      text: "1º",
                      color: "bg-yellow-900/30 text-yellow-400",
                    };
                  } else if (sale.employeeProfitPercentage === 23) {
                    rankBadge = {
                      emoji: "🥈",
                      text: "2º",
                      color: "bg-gray-700/30 text-gray-300",
                    };
                  } else if (sale.employeeProfitPercentage === 21) {
                    rankBadge = {
                      emoji: "🥉",
                      text: "3º",
                      color: "bg-orange-900/30 text-orange-400",
                    };
                  }

                  return (
                    <tr key={sale._id} className="hover:bg-gray-700/30">
                      <td className="px-3 py-3 text-sm">
                        <span className="font-mono text-xs text-blue-400">
                          {sale.saleId || sale._id.slice(-8)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-300">
                        {formatDate(sale.saleDate)}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {product?.image?.url && (
                            <img
                              src={product.image.url}
                              alt={product.name}
                              className="h-8 w-8 rounded object-cover"
                            />
                          )}
                          <div>
                            <span className="block font-medium text-white">
                              {product?.name ||
                                sale.productName ||
                                "Producto Eliminado"}
                            </span>
                            <span className="text-xs text-gray-500">
                              x{sale.quantity}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-300">
                        {customer?.name || "-"}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-300">
                        {getSaleSourceLabel(sale)}
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-white">
                        {formatCurrency(total)}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {isActiveCredit ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-900/30 px-2 py-1 text-xs font-semibold text-orange-400">
                              💳 Por cobrar
                            </span>
                            {credit && (
                              <span className="mt-1 text-xs text-orange-300/70">
                                Debe:{" "}
                                {formatCurrency(credit.remainingAmount || 0)}
                              </span>
                            )}
                          </div>
                        ) : sale.isCredit ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-900/30 px-2 py-1 text-xs font-semibold text-green-400">
                            ✓ Cobrado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-900/30 px-2 py-1 text-xs font-semibold text-green-400">
                            ✓ Pagado
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${rankBadge.color}`}
                        >
                          {rankBadge.emoji} {rankBadge.text}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-green-400">
                        {formatCurrency(sale.employeeProfit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
