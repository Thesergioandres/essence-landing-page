import { useEffect, useState } from "react";
import { authService, branchService, saleService } from "../api/services";
import { useFeature } from "../components/FeatureSection";
import LoadingSpinner from "../components/LoadingSpinner";
import SaleDetailModal from "../components/SaleDetailModal";
import type { Branch, Sale } from "../types";
import {
  buildCacheKey,
  readSessionCache,
  writeSessionCache,
} from "../utils/requestCache";

const SALES_CACHE_TTL_MS = 60 * 1000;

export default function Sales() {
  // Hooks para features
  const distributorsEnabled = useFeature("distributors");
  const branchesEnabled = useFeature("branches");
  const gamificationEnabled = useFeature("gamification");
  const creditsEnabled = useFeature("credits");

  const [sales, setSales] = useState<Sale[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasMore: false,
  });
  const [statsData, setStatsData] = useState<{
    totalSales?: number;
    totalRevenue?: number;
    confirmedSales?: number;
    pendingSales?: number;
    totalProfit?: number;
    pendingCollection?: number; // ventas con crédito activo
    pendingCollectionAmount?: number;
  }>({});
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "pendiente" | "confirmado">(
    "all"
  );
  const [sortBy, setSortBy] = useState<
    "date-desc" | "date-asc" | "distributor"
  >("date-desc");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [dateFilters, setDateFilters] = useState({
    startDate: "",
    endDate: "",
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const currentUser = authService.getCurrentUser();
  const canDeleteSales =
    currentUser?.role === "admin" ||
    currentUser?.role === "super_admin" ||
    currentUser?.role === "god";

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filter, sortBy, dateFilters, branchId]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const data = await branchService.list();
        setBranches(data || []);
      } catch (error) {
        console.error("Error cargando sedes", error);
      }
    };
    void fetchBranches();
  }, []);

  const loadSales = async () => {
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: sortBy,
      };
      if (branchId) params.branchId = branchId;
      if (filter !== "all") params.paymentStatus = filter;
      if (dateFilters.startDate) params.startDate = dateFilters.startDate;
      if (dateFilters.endDate) params.endDate = dateFilters.endDate;

      const cacheKey = buildCacheKey("sales:list", params);
      const cached = readSessionCache<{
        sales: Sale[];
        pagination?: typeof pagination;
        stats?: typeof statsData;
      }>(cacheKey, SALES_CACHE_TTL_MS);

      if (cached?.sales?.length) {
        setSales(cached.sales);
        if (cached.pagination) setPagination(cached.pagination);
        if (cached.stats) setStatsData(cached.stats);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const response = await saleService.getAllSales(params);
      const normalized = {
        sales: (response?.sales || response) as Sale[],
        pagination: response?.pagination,
        stats: response?.stats,
      };

      setSales(normalized.sales || []);
      if (normalized.pagination) setPagination(normalized.pagination);
      if (normalized.stats) setStatsData(normalized.stats);
      writeSessionCache(cacheKey, normalized);
    } catch (error) {
      console.error("Error al cargar ventas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (
      !confirm(
        "¿Seguro que deseas eliminar esta venta? Esto restaurará el stock del producto."
      )
    )
      return;

    try {
      setDeletingId(saleId);
      await saleService.deleteSale(saleId);

      // Actualizar la lista sin recargar toda la página
      setSales(prevSales => prevSales.filter(sale => sale._id !== saleId));
    } catch (error) {
      console.error("Error al eliminar la venta:", error);
      alert("Error al eliminar la venta");
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfirmPayment = async (saleId: string) => {
    if (!confirm("¿Confirmar que has recibido el pago de esta venta?")) {
      return;
    }

    try {
      setConfirmingId(saleId);
      await saleService.confirmPayment(saleId);

      // Actualizar solo la venta específica sin recargar toda la página
      setSales(prevSales =>
        prevSales.map(sale =>
          sale._id === saleId
            ? {
                ...sale,
                paymentStatus: "confirmado",
                paymentConfirmedAt: new Date().toISOString(),
              }
            : sale
        )
      );
    } catch (error) {
      console.error("Error al confirmar pago:", error);
      alert("Error al confirmar el pago");
    } finally {
      setConfirmingId(null);
    }
  };

  // Helper para determinar si una venta tiene crédito activo (deuda pendiente)
  const hasActiveCredit = (sale: Sale) => {
    if (!sale.credit) return false;
    if (
      typeof sale.credit === "object" &&
      sale.credit.remainingAmount !== undefined
    ) {
      return sale.credit.remainingAmount > 0;
    }
    return true; // Si tiene crédito pero no sabemos el estado, asumimos activo
  };

  // Agrupar ventas por saleGroupId
  type SaleGroup = {
    id: string;
    sales: Sale[];
    totalQuantity: number;
    totalRevenue: number;
    totalProfit: number;
    date: string;
    distributor: Sale["distributor"];
    branch: Sale["branch"];
    customer: Sale["customer"];
    paymentStatus: Sale["paymentStatus"];
    isGroup: boolean;
  };

  const groupSales = (): SaleGroup[] => {
    const grouped = new Map<string, Sale[]>();
    const individual: Sale[] = [];

    // Separar ventas agrupadas vs individuales
    sales.forEach(sale => {
      if (sale.saleGroupId) {
        if (!grouped.has(sale.saleGroupId)) {
          grouped.set(sale.saleGroupId, []);
        }
        grouped.get(sale.saleGroupId)!.push(sale);
      } else {
        individual.push(sale);
      }
    });

    const result: SaleGroup[] = [];

    // Procesar grupos
    grouped.forEach((groupSales, groupId) => {
      const firstSale = groupSales[0];
      result.push({
        id: groupId,
        sales: groupSales,
        totalQuantity: groupSales.reduce((sum, s) => sum + s.quantity, 0),
        totalRevenue: groupSales.reduce(
          (sum, s) => sum + s.salePrice * s.quantity,
          0
        ),
        totalProfit: groupSales.reduce(
          (sum, s) => sum + (s.adminProfit || 0),
          0
        ),
        date: firstSale.saleDate,
        distributor: firstSale.distributor,
        branch: firstSale.branch,
        customer: firstSale.customer,
        paymentStatus: firstSale.paymentStatus,
        isGroup: true,
      });
    });

    // Procesar ventas individuales
    individual.forEach(sale => {
      result.push({
        id: sale._id,
        sales: [sale],
        totalQuantity: sale.quantity,
        totalRevenue: sale.salePrice * sale.quantity,
        totalProfit: sale.adminProfit || 0,
        date: sale.saleDate,
        distributor: sale.distributor,
        branch: sale.branch,
        customer: sale.customer,
        paymentStatus: sale.paymentStatus,
        isGroup: false,
      });
    });

    // Ordenar por fecha
    result.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return result;
  };

  const saleGroups = groupSales();

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

  // Calcular ventas con crédito activo
  const salesWithActiveCredit = sales.filter(s => hasActiveCredit(s));
  const pendingCollectionAmount = salesWithActiveCredit.reduce((sum, s) => {
    if (
      typeof s.credit === "object" &&
      s.credit !== null &&
      s.credit.remainingAmount !== undefined
    ) {
      return sum + s.credit.remainingAmount;
    }
    return sum + s.salePrice * s.quantity;
  }, 0);

  const stats = {
    total: statsData.totalSales || sales.length,
    pendiente:
      statsData.pendingSales ||
      sales.filter(s => s.paymentStatus === "pendiente").length,
    confirmado:
      statsData.confirmedSales ||
      sales.filter(s => s.paymentStatus === "confirmado" && !hasActiveCredit(s))
        .length,
    pendingCollection: salesWithActiveCredit.length,
    pendingCollectionAmount: pendingCollectionAmount,
    totalRevenue:
      statsData.totalRevenue ||
      sales.reduce((sum, s) => sum + s.salePrice * s.quantity, 0),
    totalProfit:
      statsData.totalProfit || sales.reduce((sum, s) => sum + s.adminProfit, 0),
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Gestión de Ventas</h1>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6">
          <p className="text-xs text-gray-400 sm:text-sm">Total Ventas</p>
          <p className="text-xl font-bold text-white sm:text-2xl">
            {stats.total}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6">
          <p className="text-xs text-gray-400 sm:text-sm">Pendientes</p>
          <p className="text-xl font-bold text-yellow-400 sm:text-2xl">
            {stats.pendiente}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6">
          <p className="text-xs text-gray-400 sm:text-sm">Confirmadas</p>
          <p className="text-xl font-bold text-green-400 sm:text-2xl">
            {stats.confirmado}
          </p>
        </div>
        <div className="rounded-xl border border-orange-700/50 bg-orange-900/20 p-4 sm:p-6">
          <p className="text-xs text-orange-300 sm:text-sm">💳 Por Cobrar</p>
          <p className="text-xl font-bold text-orange-400 sm:text-2xl">
            {stats.pendingCollection}
          </p>
          <p className="mt-1 text-xs text-orange-300/70">
            ${stats.pendingCollectionAmount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6">
          <p className="text-xs text-gray-400 sm:text-sm">Ingresos Totales</p>
          <p className="text-xl font-bold text-white sm:text-2xl">
            ${stats.totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6">
          <p className="text-xs text-gray-400 sm:text-sm">Ganancia Admin</p>
          <p className="text-xl font-bold text-green-400 sm:text-2xl">
            ${stats.totalProfit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner
            size="lg"
            variant="dots"
            message="Cargando ventas..."
          />
        </div>
      )}

      {/* Filtros y Ordenamiento */}
      {!loading && (
        <>
          <div className="space-y-4 rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            {/* Filtro por sede */}
            {branchesEnabled && (
              <div>
                <p className="mb-2 text-sm font-medium text-gray-300">
                  Sede / Bodega:
                </p>
                <div className="flex flex-wrap gap-4">
                  <div className="min-w-[220px] flex-1">
                    <select
                      value={branchId}
                      onChange={e => {
                        setBranchId(e.target.value);
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2 text-sm text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
                    >
                      <option value="">Todas las sedes (stock general)</option>
                      {branches.map(branch => (
                        <option key={branch._id} value={branch._id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
            {/* Filtros de fecha */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300">
                Filtrar por fecha:
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="min-w-[180px] flex-1">
                  <label
                    htmlFor="startDate"
                    className="mb-1 block text-xs text-gray-400"
                  >
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={dateFilters.startDate}
                    onChange={e =>
                      setDateFilters({
                        ...dateFilters,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div className="min-w-[180px] flex-1">
                  <label
                    htmlFor="endDate"
                    className="mb-1 block text-xs text-gray-400"
                  >
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={dateFilters.endDate}
                    onChange={e =>
                      setDateFilters({
                        ...dateFilters,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                {(dateFilters.startDate || dateFilters.endDate) && (
                  <div className="flex items-end">
                    <button
                      onClick={() =>
                        setDateFilters({ startDate: "", endDate: "" })
                      }
                      className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-gray-800"
                    >
                      Limpiar fechas
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-300">
                Filtrar por estado:
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter("all")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                    filter === "all"
                      ? "bg-purple-600 text-white"
                      : "border border-gray-700 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  Todas ({stats.total})
                </button>
                <button
                  onClick={() => setFilter("pendiente")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                    filter === "pendiente"
                      ? "bg-yellow-500 text-white"
                      : "border border-gray-700 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  Pendientes ({stats.pendiente})
                </button>
                <button
                  onClick={() => setFilter("confirmado")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                    filter === "confirmado"
                      ? "bg-green-500 text-white"
                      : "border border-gray-700 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  Confirmadas ({stats.confirmado})
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="sortBy"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Ordenar por:
              </label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2 text-sm text-gray-100 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
              >
                <option value="date-desc">Fecha (Más reciente primero)</option>
                <option value="date-asc">Fecha (Más antigua primero)</option>
                {distributorsEnabled && (
                  <option value="distributor">Distribuidor (A-Z)</option>
                )}
              </select>
            </div>
          </div>

          {/* Tabla de ventas */}
          <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50">
            <div className="table-responsive overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Fecha
                    </th>
                    {branchesEnabled && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Sede
                      </th>
                    )}
                    {distributorsEnabled && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Distribuidor
                      </th>
                    )}
                    {distributorsEnabled && gamificationEnabled && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Rango
                      </th>
                    )}
                    {distributorsEnabled && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Comisión
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Cliente
                    </th>
                    {creditsEnabled && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                        Crédito
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Cantidad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Total Venta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Ganancia Admin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {saleGroups.map(group => {
                    const isExpanded = expandedGroups.has(group.id);
                    const firstSale = group.sales[0];
                    const distributor =
                      typeof group.distributor === "object"
                        ? group.distributor
                        : null;
                    const createdByUser =
                      typeof firstSale.createdBy === "object"
                        ? firstSale.createdBy
                        : null;
                    const branchName =
                      typeof group.branch === "object"
                        ? group.branch?.name
                        : undefined;

                    // Obtener el nombre para mostrar: si hay distribuidor mostrar su nombre,
                    // si no, mostrar el createdBy (quien registró la venta), o "Admin" como fallback
                    const displayName =
                      distributor?.name || createdByUser?.name || "Admin";
                    const displayEmail =
                      distributor?.email || createdByUser?.email || "";

                    // Determinar rango según comisión
                    let rankBadge = {
                      emoji: "👑",
                      text: "Admin",
                      color: "bg-purple-500/20 text-purple-300",
                    };
                    if (distributor) {
                      const percentage =
                        firstSale.distributorProfitPercentage || 20;
                      if (percentage === 25) {
                        rankBadge = {
                          emoji: "🥇",
                          text: "1º",
                          color: "bg-yellow-500/20 text-yellow-300",
                        };
                      } else if (percentage === 23) {
                        rankBadge = {
                          emoji: "🥈",
                          text: "2º",
                          color: "bg-gray-500/20 text-gray-200",
                        };
                      } else if (percentage === 21) {
                        rankBadge = {
                          emoji: "🥉",
                          text: "3º",
                          color: "bg-orange-500/20 text-orange-300",
                        };
                      } else {
                        rankBadge = {
                          emoji: "📊",
                          text: "Normal",
                          color: "bg-blue-500/20 text-blue-300",
                        };
                      }
                    }

                    return (
                      <>
                        {/* Fila principal del grupo o venta individual */}
                        <tr
                          key={group.id}
                          className={`hover:bg-gray-900/30 ${group.isGroup ? "bg-purple-900/10 font-semibold" : "cursor-pointer"}`}
                          onClick={e => {
                            if ((e.target as HTMLElement).closest("button"))
                              return;
                            if (!group.isGroup) {
                              setSelectedSale(firstSale);
                            }
                          }}
                        >
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-200">
                            {group.isGroup && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  toggleGroup(group.id);
                                }}
                                className="mr-2 text-purple-400 hover:text-purple-300"
                              >
                                {isExpanded ? "▼" : "▶"}
                              </button>
                            )}
                            {new Date(group.date).toLocaleDateString("es-ES", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          {branchesEnabled && (
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-300">
                              {branchName || "General"}
                            </td>
                          )}
                          {distributorsEnabled && (
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="text-sm font-medium text-gray-200">
                                {displayName}
                              </div>
                              <div className="text-sm text-gray-400">
                                {displayEmail}
                              </div>
                            </td>
                          )}
                          {distributorsEnabled && gamificationEnabled && (
                            <td className="whitespace-nowrap px-6 py-4">
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-semibold ${rankBadge.color}`}
                              >
                                {rankBadge.emoji} {rankBadge.text}
                              </span>
                            </td>
                          )}
                          {distributorsEnabled && (
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-200">
                              {distributor
                                ? `${firstSale.distributorProfitPercentage ?? 20}%`
                                : "—"}
                            </td>
                          )}
                          <td className="whitespace-nowrap px-6 py-4">
                            {group.isGroup ? (
                              <span className="text-sm font-medium text-purple-300">
                                📦 {group.sales.length} productos
                              </span>
                            ) : (
                              <div className="flex items-center">
                                {typeof firstSale.product === "object" &&
                                  firstSale.product?.image?.url && (
                                    <img
                                      src={firstSale.product.image.url}
                                      alt={firstSale.product.name}
                                      className="mr-3 h-10 w-10 rounded object-cover"
                                    />
                                  )}
                                <span className="text-sm text-gray-200">
                                  {typeof firstSale.product === "object"
                                    ? firstSale.product?.name
                                    : "N/A"}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-200">
                            {firstSale.customerName || "-"}
                          </td>
                          {creditsEnabled && (
                            <td className="whitespace-nowrap px-6 py-4">
                              {firstSale.credit ? (
                                <div className="flex flex-col gap-1">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-400">
                                    💳 Crédito
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {typeof firstSale.credit === "object" &&
                                    firstSale.credit.remainingAmount !==
                                      undefined
                                      ? new Intl.NumberFormat("es-CO", {
                                          style: "currency",
                                          currency: "COP",
                                          minimumFractionDigits: 0,
                                        }).format(
                                          firstSale.credit.remainingAmount
                                        )
                                      : "Pendiente"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">
                                  Contado
                                </span>
                              )}
                            </td>
                          )}
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-200">
                            {group.totalQuantity}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-200">
                            ${group.totalRevenue.toLocaleString()}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-green-400">
                            ${group.totalProfit.toLocaleString()}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {group.paymentStatus === "pendiente" ? (
                              <span className="inline-flex rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold leading-5 text-yellow-300">
                                Pendiente
                              </span>
                            ) : hasActiveCredit(firstSale) ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold leading-5 text-orange-300">
                                💳 Por Cobrar
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold leading-5 text-green-300">
                                Confirmado
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">
                            <div className="flex gap-2">
                              {!group.isGroup &&
                              group.paymentStatus === "pendiente" &&
                              !hasActiveCredit(firstSale) ? (
                                <button
                                  onClick={() =>
                                    handleConfirmPayment(firstSale._id)
                                  }
                                  disabled={confirmingId === firstSale._id}
                                  className="font-medium text-green-400 hover:text-green-300 disabled:opacity-50"
                                >
                                  {confirmingId === firstSale._id
                                    ? "Confirmando..."
                                    : "Confirmar Pago"}
                                </button>
                              ) : !group.isGroup ? (
                                <span className="text-xs text-gray-400">
                                  Confirmado el{" "}
                                  {firstSale.paymentConfirmedAt &&
                                    new Date(
                                      firstSale.paymentConfirmedAt
                                    ).toLocaleDateString()}
                                </span>
                              ) : null}
                              {/* Botón eliminar solo para ventas individuales */}
                              {!group.isGroup && canDeleteSales && (
                                <button
                                  onClick={() =>
                                    handleDeleteSale(firstSale._id)
                                  }
                                  disabled={deletingId === firstSale._id}
                                  className="font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                                >
                                  {deletingId === firstSale._id
                                    ? "Eliminando..."
                                    : "Eliminar"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Filas expandidas para grupos */}
                        {group.isGroup &&
                          isExpanded &&
                          group.sales.map(sale => {
                            const product =
                              typeof sale.product === "object"
                                ? sale.product
                                : null;

                            return (
                              <tr
                                key={sale._id}
                                className="cursor-pointer bg-gray-900/20 hover:bg-gray-900/40"
                                onClick={e => {
                                  if (
                                    (e.target as HTMLElement).closest("button")
                                  )
                                    return;
                                  setSelectedSale(sale);
                                }}
                              >
                                <td className="whitespace-nowrap px-6 py-3 pl-12 text-sm text-gray-400">
                                  {/* Vacío - fecha ya mostrada */}
                                </td>
                                {branchesEnabled && (
                                  <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-400">
                                    {/* Vacío */}
                                  </td>
                                )}
                                {distributorsEnabled && (
                                  <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-400">
                                    {/* Vacío */}
                                  </td>
                                )}
                                {distributorsEnabled && gamificationEnabled && (
                                  <td className="whitespace-nowrap px-6 py-3">
                                    {/* Vacío */}
                                  </td>
                                )}
                                {distributorsEnabled && (
                                  <td className="whitespace-nowrap px-6 py-3">
                                    {/* Vacío */}
                                  </td>
                                )}
                                <td className="whitespace-nowrap px-6 py-3">
                                  <div className="flex items-center">
                                    {product?.image?.url && (
                                      <img
                                        src={product.image.url}
                                        alt={product.name}
                                        className="mr-3 h-8 w-8 rounded object-cover"
                                      />
                                    )}
                                    <span className="text-sm text-gray-300">
                                      {product?.name || "N/A"}
                                    </span>
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-400">
                                  {/* Vacío */}
                                </td>
                                {creditsEnabled && (
                                  <td className="whitespace-nowrap px-6 py-3">
                                    {/* Vacío */}
                                  </td>
                                )}
                                <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-300">
                                  {sale.quantity}
                                </td>
                                <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-300">
                                  $
                                  {(
                                    sale.salePrice * sale.quantity
                                  ).toLocaleString()}
                                </td>
                                <td className="whitespace-nowrap px-6 py-3 text-sm text-green-400">
                                  ${sale.adminProfit.toLocaleString()}
                                </td>
                                <td className="whitespace-nowrap px-6 py-3">
                                  {/* Vacío */}
                                </td>
                                <td className="whitespace-nowrap px-6 py-3 text-sm">
                                  <div className="flex gap-2">
                                    {canDeleteSales && (
                                      <button
                                        onClick={() =>
                                          handleDeleteSale(sale._id)
                                        }
                                        disabled={deletingId === sale._id}
                                        className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                                      >
                                        {deletingId === sale._id
                                          ? "Eliminando..."
                                          : "Eliminar"}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </>
                    );
                  })}
                </tbody>
              </table>

              {saleGroups.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-gray-400">No hay ventas que mostrar</p>
                </div>
              )}
            </div>

            {/* Controles de Paginación */}
            {pagination.pages > 1 && (
              <div className="mt-4 flex flex-col items-center justify-between gap-4 border-t border-gray-700 bg-gray-900/30 px-6 py-4 sm:flex-row">
                <div className="text-sm text-gray-300">
                  Página {pagination.page} de {pagination.pages} • Total:{" "}
                  {pagination.total} ventas
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="rounded-lg border border-gray-700 bg-transparent px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasMore}
                    className="rounded-lg border border-gray-700 bg-transparent px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Detalle */}
      <SaleDetailModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
      />
    </div>
  );
}
