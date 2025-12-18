import { useCallback, useEffect, useState } from "react";
import { businessAssistantService } from "../api/services";
import type {
  BusinessAssistantRecommendationItem,
  BusinessAssistantRecommendationsResponse,
} from "../types";

const formatCurrencyCOP = (value: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
};

const badgeClasses = (action: string) => {
  switch (action) {
    case "buy_more_inventory":
      return "bg-green-600/20 text-green-200 border border-green-500/30";
    case "pause_purchases":
      return "bg-yellow-600/20 text-yellow-200 border border-yellow-500/30";
    case "decrease_price":
      return "bg-pink-600/20 text-pink-200 border border-pink-500/30";
    case "increase_price":
      return "bg-purple-600/20 text-purple-200 border border-purple-500/30";
    case "run_promotion":
      return "bg-blue-600/20 text-blue-200 border border-blue-500/30";
    case "review_margin":
      return "bg-orange-600/20 text-orange-200 border border-orange-500/30";
    default:
      return "bg-gray-700/40 text-gray-200 border border-gray-600/40";
  }
};

const actionLabel = (action: string) => {
  switch (action) {
    case "buy_more_inventory":
      return "Comprar más inventario";
    case "pause_purchases":
      return "Pausar compras";
    case "decrease_price":
      return "Bajar precio";
    case "increase_price":
      return "Subir precio";
    case "run_promotion":
      return "Hacer promoción";
    case "review_margin":
      return "Revisar margen";
    default:
      return "Mantener";
  }
};

export default function BusinessAssistant() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] =
    useState<BusinessAssistantRecommendationsResponse | null>(null);

  const fetchRecommendations = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await businessAssistantService.getRecommendations();
      setData(response);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || "No se pudieron cargar recomendaciones"
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const renderPrimary = (item: BusinessAssistantRecommendationItem) => {
    const primary = item.recommendation.primary;
    if (!primary) {
      return (
        <span className="inline-flex items-center rounded-full border border-gray-600/40 bg-gray-700/40 px-2 py-1 text-xs text-gray-200">
          Sin acción
        </span>
      );
    }

    const label = actionLabel(primary.action);

    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs ${badgeClasses(
          primary.action
        )}`}
      >
        <span className="font-semibold">{label}</span>
        {typeof primary.confidence === "number" && (
          <span className="text-[11px] text-gray-200/80">
            {(primary.confidence * 100).toFixed(0)}%
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">Business Assistant</h1>
        <p className="mt-2 text-gray-300">
          Recomendaciones automáticas por producto basadas en datos reales
          (rotación, tendencia, margen y stock).
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-gray-400">
            {data?.generatedAt ? (
              <span>
                Generado: {new Date(data.generatedAt).toLocaleString("es-CO")}
              </span>
            ) : (
              <span>Generando recomendaciones…</span>
            )}
          </div>

          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="rounded-md bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-xl text-gray-200">Analizando productos…</div>
        </div>
      ) : (data?.recommendations || []).length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 text-gray-300">
          No hay recomendaciones para mostrar.
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-4 md:hidden">
            {(data?.recommendations || []).map(item => (
              <div
                key={item.productId}
                className="rounded-xl border border-gray-700 bg-gray-800/50 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-white">
                      {item.productName}
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      Stock bodega: {item.stock.warehouseStock} · Margen:{" "}
                      {item.metrics.recentMarginPct.toFixed(1)}%
                    </p>
                  </div>
                  {renderPrimary(item)}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
                    <p className="text-xs text-gray-400">
                      Unidades ({item.metrics.recentDays}d)
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {item.metrics.recentUnits}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
                    <p className="text-xs text-gray-400">Tendencia</p>
                    <p
                      className={`text-sm font-semibold ${
                        item.metrics.unitsGrowthPct >= 0
                          ? "text-green-300"
                          : "text-red-300"
                      }`}
                    >
                      {item.metrics.unitsGrowthPct >= 0 ? "+" : ""}
                      {item.metrics.unitsGrowthPct.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {item.recommendation.primary?.suggestedQty ? (
                  <p className="mt-3 text-sm text-green-200">
                    Sugerencia: comprar{" "}
                    {item.recommendation.primary.suggestedQty} unidades.
                  </p>
                ) : null}
                {typeof item.recommendation.primary?.suggestedChangePct ===
                "number" ? (
                  <p className="mt-3 text-sm text-blue-200">
                    Sugerencia: ajuste de precio{" "}
                    {item.recommendation.primary.suggestedChangePct}%.
                  </p>
                ) : null}

                <div className="mt-4">
                  <p className="text-sm font-semibold text-gray-200">
                    Justificación
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-300">
                    {(item.recommendation.justification || [])
                      .slice(0, 4)
                      .map((j, idx) => (
                        <li key={idx}>{j}</li>
                      ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-700 bg-gray-800/50 md:block">
            <table className="w-full">
              <thead className="bg-gray-900/50 text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-left">Acción</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Unidades</th>
                  <th className="px-4 py-3 text-right">Tendencia</th>
                  <th className="px-4 py-3 text-right">Margen</th>
                  <th className="px-4 py-3 text-right">Ingresos</th>
                  <th className="px-4 py-3 text-left">Justificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700 text-gray-200">
                {(data?.recommendations || []).map(item => (
                  <tr
                    key={item.productId}
                    className="align-top hover:bg-gray-900/30"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">
                        {item.productName}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Precio promedio:{" "}
                        {formatCurrencyCOP(item.metrics.recentAvgPrice)} · vs
                        categoría: {item.metrics.priceVsCategoryPct.toFixed(1)}%
                      </p>
                    </td>
                    <td className="px-4 py-3">{renderPrimary(item)}</td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold">
                        {item.stock.warehouseStock}
                      </p>
                      <p className="text-xs text-gray-400">
                        Alerta: {item.stock.lowStockAlert}
                        {item.metrics.daysCover !== null
                          ? ` · Cobertura: ${item.metrics.daysCover}d`
                          : ""}
                      </p>
                      {item.recommendation.primary?.suggestedQty ? (
                        <p className="mt-1 text-xs text-green-200">
                          +{item.recommendation.primary.suggestedQty} uds
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {item.metrics.recentUnits}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        item.metrics.unitsGrowthPct >= 0
                          ? "text-green-300"
                          : "text-red-300"
                      }`}
                    >
                      {item.metrics.unitsGrowthPct >= 0 ? "+" : ""}
                      {item.metrics.unitsGrowthPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold">
                        {item.metrics.recentMarginPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold">
                        {formatCurrencyCOP(item.metrics.recentRevenue)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
                        {(item.recommendation.justification || [])
                          .slice(0, 3)
                          .map((j, idx) => (
                            <li key={idx}>{j}</li>
                          ))}
                      </ul>
                      {typeof item.recommendation.primary
                        ?.suggestedChangePct === "number" ? (
                        <p className="mt-2 text-xs text-blue-200">
                          Sugerencia: ajuste de precio{" "}
                          {item.recommendation.primary.suggestedChangePct}%.
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data?.window && (
            <p className="mt-4 text-sm text-gray-400">
              Nota:{" "}
              {data.recommendations[0]?.recommendation.notes ||
                "Las recomendaciones se basan en ventas confirmadas y stock actual."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
