import {
  AlertTriangle,
  BarChart3,
  Box,
  Building2,
  CheckCircle2,
  Package,
  RefreshCw,
  Search,
  Users,
  Warehouse,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Product } from "../../../types";
import { stockService } from "../services";

interface StockDetail {
  name: string;
  quantity: number;
}

interface GlobalInventoryItem {
  product: Product;
  warehouse: number;
  branches: number;
  branchDetails: StockDetail[];
  distributors: number;
  distributorDetails: StockDetail[];
  total: number;
  systemTotal: number;
  unassigned: number;
}

export default function GlobalInventoryPage() {
  const [inventory, setInventory] = useState<GlobalInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await stockService.getGlobalInventory();
      if (res.success) {
        // Map backend response to component state structure
        const mappedInventory: GlobalInventoryItem[] = res.inventory.map(
          (item: any) => {
            const calculatedTotal =
              (item.warehouse || 0) +
              (item.branches || 0) +
              (item.distributors || 0);

            const systemTotal = item.systemTotal || 0;
            const unassigned = systemTotal - calculatedTotal;

            return {
              product: item.product,
              warehouse: item.warehouse || 0,
              branches: item.branches || 0,
              branchDetails: item.branchDetails || [],
              distributors: item.distributors || 0,
              distributorDetails: item.distributorDetails || [],
              total: calculatedTotal,
              systemTotal: systemTotal,
              unassigned: unassigned,
            };
          }
        );
        setInventory(mappedInventory);
      }
    } catch (err) {
      console.error("Error loading global inventory:", err);
      setError("Error al cargar el inventario global");
    } finally {
      setLoading(false);
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (num: number) =>
    new Intl.NumberFormat("es-CO").format(num);

  // Totals Calculation
  const totals = filteredInventory.reduce(
    (acc, item) => ({
      warehouse: acc.warehouse + item.warehouse,
      branches: acc.branches + item.branches,
      distributors: acc.distributors + item.distributors,
      total: acc.total + item.total,
      unassigned: acc.unassigned + (item.unassigned > 0 ? item.unassigned : 0),
    }),
    { warehouse: 0, branches: 0, distributors: 0, total: 0, unassigned: 0 }
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <Warehouse className="mx-auto mb-4 h-12 w-12 animate-bounce text-purple-500" />
          <p className="text-gray-400">Cargando inventario global...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="mb-4 text-red-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-500"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
            <BarChart3 className="h-8 w-8 text-purple-500" />
            Inventario Global
          </h1>
          <p className="text-gray-400">
            Vista unificada de todo el stock del sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totals.unassigned > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-red-500/50 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">
              <AlertTriangle className="h-3 w-3" />
              {formatNumber(totals.unassigned)} Sin Asignar
            </span>
          )}
          <span className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-500">
            Total Unidades: {formatNumber(totals.total)}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/20 p-2">
              <Package className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-blue-300">
                Total Global
              </p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(totals.total)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/20 p-2">
              <Warehouse className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-purple-300">
                En Bodega
              </p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(totals.warehouse)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-500/20 p-2">
              <Building2 className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-cyan-300">
                En Sedes
              </p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(totals.branches)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-500/20 p-2">
              <Users className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-orange-300">
                En Distribuidores
              </p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(totals.distributors)}
              </p>
            </div>
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 ${totals.unassigned > 0 ? "border-red-500/20 bg-red-500/10" : "border-green-500/20 bg-green-500/10"}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`rounded-lg p-2 ${totals.unassigned > 0 ? "bg-red-500/20" : "bg-green-500/20"}`}
            >
              {totals.unassigned > 0 ? (
                <AlertTriangle className="h-5 w-5 text-red-400" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              )}
            </div>
            <div>
              <p
                className={`text-xs font-medium uppercase ${totals.unassigned > 0 ? "text-red-300" : "text-green-300"}`}
              >
                {totals.unassigned > 0 ? "Sin Asignar" : "Estado Sistema"}
              </p>
              <p className="text-2xl font-bold text-white">
                {totals.unassigned > 0 ? formatNumber(totals.unassigned) : "OK"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <div className="flex gap-4 border-b border-gray-700 p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-900 py-2 pl-10 pr-4 text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-900/50 text-xs font-semibold uppercase text-gray-200">
              <tr>
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4 text-center text-purple-400">
                  Bodega
                </th>
                <th className="px-6 py-4 text-center text-cyan-400">Sedes</th>
                <th className="px-6 py-4 text-center text-orange-400">
                  Distribuidores
                </th>
                <th className="px-6 py-4 text-center text-red-500">
                  Sin Asignar
                </th>
                <th className="px-6 py-4 text-right text-blue-400">
                  Confirmado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredInventory.map(item => (
                <tr
                  key={item.product._id}
                  className="transition-colors hover:bg-gray-700/30"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-700">
                        {item.product.image?.url ? (
                          <img
                            src={item.product.image.url}
                            alt={item.product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Box className="h-full w-full p-2 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.product.category?.name || "Sin categoría"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="bg-purple-500/5 px-6 py-4 text-center font-medium text-purple-300">
                    {formatNumber(item.warehouse)}
                  </td>
                  <td className="bg-cyan-500/5 px-6 py-4 text-center font-medium text-cyan-300">
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-bold">
                        {formatNumber(item.branches)}
                      </span>
                      {item.branchDetails?.length > 0 && (
                        <div className="flex flex-col gap-0.5 text-[10px] text-gray-400">
                          {item.branchDetails.map((d, i) => (
                            <span key={i}>
                              {d.name}: {d.quantity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="bg-orange-500/5 px-6 py-4 text-center font-medium text-orange-300">
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-bold">
                        {formatNumber(item.distributors)}
                      </span>
                      {item.distributorDetails?.length > 0 && (
                        <div className="flex flex-col gap-0.5 text-[10px] text-gray-400">
                          {item.distributorDetails.map((d, i) => (
                            <span key={i}>
                              {d.name}: {d.quantity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  <td
                    className={`px-6 py-4 text-center font-bold ${item.unassigned > 0 ? "bg-red-500/5 text-red-500" : "text-gray-600"}`}
                  >
                    {item.unassigned > 0 ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-lg">
                          ⚠️ {formatNumber(item.unassigned)}
                        </span>
                        <button
                          onClick={async e => {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                `¿Mover estas ${item.unassigned} unidades "fantasma" a Bodega Principal?`
                              )
                            ) {
                              try {
                                await stockService.reconcileStock(
                                  item.product._id
                                );
                                alert(
                                  "Unidades recuperadas y enviadas a Bodega correctamente."
                                );
                                loadData();
                              } catch (err: any) {
                                alert(
                                  "Error: " +
                                    (err.response?.data?.message || err.message)
                                );
                              }
                            }
                          }}
                          className="flex items-center gap-1 rounded bg-red-500 px-2 py-1 text-[10px] font-bold uppercase text-white transition-colors hover:bg-red-600"
                        >
                          <Warehouse className="h-3 w-3" />
                          Enviar a Bodega
                        </button>
                      </div>
                    ) : item.unassigned < 0 ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-xs font-medium text-green-500">
                          +{Math.abs(item.unassigned)} (Sobra)
                        </span>
                        <button
                          onClick={async e => {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                `El sistema declara menos stock del que existe físicamente.\n¿Actualizar el "Total del Sistema" para que coincida con la realidad?`
                              )
                            ) {
                              try {
                                await stockService.syncProductStock(
                                  item.product._id
                                );
                                alert(
                                  "Total del sistema sincronizado correctamente."
                                );
                                loadData();
                              } catch (err: any) {
                                alert(
                                  "Error: " +
                                    (err.response?.data?.message || err.message)
                                );
                              }
                            }
                          }}
                          className="flex items-center gap-1 rounded bg-blue-500/20 px-2 py-1 text-[10px] font-bold uppercase text-blue-400 transition-colors hover:bg-blue-500/30"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Sincronizar
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-xs font-medium text-green-500">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1 font-bold text-blue-400">
                      {formatNumber(item.total)}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    No se encontraron productos en el inventario global.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
