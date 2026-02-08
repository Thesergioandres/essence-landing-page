import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LoadingSpinner } from "../../../shared/components/ui";
import {
  productService,
  stockService,
} from "../../inventory/services/inventory.service";
import type { Product, ProductHistoryEntry } from "../types/product.types";

type StockSummary = {
  warehouse: number;
  distributors: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const resolveNoteLabel = (entry: ProductHistoryEntry) =>
  entry.notes || entry.purchaseGroupId || entry.requestId || "-";

const resolveInventoryProductId = (entry: any) => {
  const productValue = entry?.product;
  if (productValue && typeof productValue === "object") {
    return String(productValue._id || "");
  }
  return String(productValue || "");
};

export default function AdminProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<ProductHistoryEntry[]>([]);
  const [stockSummary, setStockSummary] = useState<StockSummary>({
    warehouse: 0,
    distributors: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        setError("ID de producto no válido");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [productData, historyData, globalStock] = await Promise.all([
          productService.getById(id),
          productService.getHistory(id),
          stockService.getGlobalInventory(),
        ]);

        const inventoryMatch = globalStock.inventory.find(
          item => resolveInventoryProductId(item) === id
        );

        setProduct(productData);
        setHistory(historyData || []);
        setStockSummary({
          warehouse:
            inventoryMatch?.warehouse ?? productData.warehouseStock ?? 0,
          distributors: inventoryMatch?.distributors ?? 0,
        });
      } catch (err) {
        console.error("Error loading product detail:", err);
        setError("No se pudo cargar el producto");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [id]);

  const marginData = useMemo(() => {
    const salePrice = Number(product?.clientPrice || 0);
    const averageCost = Number(product?.averageCost || 0);
    if (!salePrice || !averageCost) {
      return { value: 0, percent: 0, hasData: false };
    }
    const value = salePrice - averageCost;
    const percent = (value / salePrice) * 100;
    return { value, percent, hasData: true };
  }, [product]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" message="Cargando detalle..." />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
        <p>{error || "Producto no encontrado"}</p>
        <button
          onClick={() => navigate("/admin/products")}
          className="mt-4 rounded-lg border border-red-400/60 px-4 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/10"
        >
          Volver a productos
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-purple-300">
            Detalle de producto
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            {product.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/admin/products")}
            className="rounded-lg border border-gray-700 px-4 py-2 text-xs font-semibold text-gray-300 transition hover:border-purple-400 hover:text-white"
          >
            Volver
          </button>
          <button
            onClick={() => navigate(`/admin/products/${product._id}/edit`)}
            className="rounded-lg border border-purple-500/60 px-4 py-2 text-xs font-semibold text-purple-200 transition hover:bg-purple-600/20"
          >
            Editar producto
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
        <section className="rounded-2xl border border-gray-700/60 bg-gray-900/60 p-5 shadow-lg">
          <h2 className="text-base font-semibold text-white">
            Ficha tecnica actual
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            Resumen operativo y financiero con el ultimo costo promedio.
          </p>

          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-gray-700/60 bg-gray-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                Precios vigentes
              </p>
              <div className="mt-3 grid gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Venta publico</span>
                  <span className="font-semibold text-white">
                    {formatCurrency(Number(product.clientPrice || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Precio B2B</span>
                  <span className="font-semibold text-white">
                    {formatCurrency(Number(product.distributorPrice || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Costo promedio</span>
                  <span className="font-semibold text-white">
                    {formatCurrency(Number(product.averageCost || 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-700/60 bg-gray-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                Stock real
              </p>
              <div className="mt-3 grid gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Bodega central</span>
                  <span className="font-semibold text-white">
                    {stockSummary.warehouse} uds
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Distribuidores</span>
                  <span className="font-semibold text-white">
                    {stockSummary.distributors} uds
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-700/60 bg-gray-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                Rendimiento
              </p>
              {marginData.hasData ? (
                <div className="mt-3">
                  <p className="text-2xl font-semibold text-emerald-400">
                    {marginData.percent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400">
                    Margen aproximado: {formatCurrency(marginData.value)}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-400">
                  Sin datos suficientes para calcular margen.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-700/60 bg-gray-900/60 p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white">
                Historial de entradas
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                ADN del producto, ordenado de la mas reciente a la mas antigua.
              </p>
            </div>
            <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs text-purple-200">
              {history.length} registros
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900/70 text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Cantidad</th>
                  <th className="px-4 py-3">Costo unitario</th>
                  <th className="px-4 py-3">Inversion total</th>
                  <th className="px-4 py-3">Documento/nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm text-gray-200">
                {history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-xs text-gray-400"
                    >
                      No hay entradas registradas.
                    </td>
                  </tr>
                ) : (
                  history.map((entry, index) => {
                    const previous = history[index + 1];
                    const currentCost = Number(entry.unitCost || 0);
                    const previousCost = Number(previous?.unitCost || 0);
                    const hasComparison = Boolean(previous);
                    const delta = currentCost - previousCost;
                    const trend =
                      delta > 0 ? "up" : delta < 0 ? "down" : "flat";

                    return (
                      <tr key={entry._id} className="hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-gray-300">
                          {formatDate(entry.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          {entry.provider?.name || "Sin proveedor"}
                        </td>
                        <td className="px-4 py-3">{entry.quantity} uds</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">
                              {formatCurrency(currentCost)}
                            </span>
                            {hasComparison && trend !== "flat" && (
                              <span
                                className={
                                  trend === "up"
                                    ? "rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300"
                                    : "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300"
                                }
                              >
                                {trend === "up" ? "Subio" : "Bajo"}
                              </span>
                            )}
                          </div>
                          {entry.averageCostAfter ? (
                            <p className="mt-1 text-[11px] text-gray-500">
                              Promedio: {formatCurrency(entry.averageCostAfter)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-semibold text-purple-200">
                          {formatCurrency(Number(entry.totalCost || 0))}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {resolveNoteLabel(entry)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
