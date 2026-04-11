import { useEffect, useState } from "react";
import { useBusiness } from "../../../context/BusinessContext";
import { optimizationTestService } from "../services/common.service";

export default function TestOptimization() {
  const { businessId } = useBusiness();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"sales" | "products">("sales");
  const [time, setTime] = useState<number>(0);
  const [allTime, setAllTime] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    const start = performance.now();
    try {
      let url = "";
      if (mode === "sales") {
        url = allTime
          ? "/sales/optimized-test?allTime=true"
          : "/sales/optimized-test";
      } else {
        url = "/products/test-catalog-optimized";
      }

      const response = await optimizationTestService.runByUrl(url);
      setData(response);
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.message || err.message || "Error desconocido"
      );
    } finally {
      const end = performance.now();
      setTime(Math.round(end - start));
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) {
      fetchData();
    }
  }, [businessId, allTime, mode]); // Reload when mode changes

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-gray-200">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Test de Optimización - {mode === "sales" ? "Ventas" : "Productos"}
          </h1>
          <p className="text-sm text-gray-400">
            Verifica la respuesta y tiempos de los endpoints optimizados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Mode Toggle */}
          <div className="flex rounded-lg bg-gray-800 p-1">
            <button
              onClick={() => setMode("sales")}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                mode === "sales"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Ventas
            </button>
            <button
              onClick={() => setMode("products")}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                mode === "products"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Catálogo
            </button>
          </div>

          {mode === "sales" && (
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={allTime}
                onChange={e => setAllTime(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              Ver todo el histórico
            </label>
          )}

          <button
            onClick={fetchData}
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Cargando..." : "Recargar"}
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-gray-800 p-4">
          <div className="text-sm text-gray-400">Estado</div>
          <div
            className={`text-xl font-bold ${error ? "text-red-400" : "text-green-400"}`}
          >
            {error ? "Error" : loading ? "Cargando..." : "Completado"}
          </div>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <div className="text-sm text-gray-400">Tiempo Respuesta context</div>
          <div className="text-xl font-bold text-blue-400">{time} ms</div>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <div className="text-sm text-gray-400">Registros</div>
          <div className="text-xl font-bold text-purple-400">
            {Array.isArray(data) ? data.length : data?.data?.length || 0}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/50 bg-red-900/20 p-4 text-red-200">
          Error: {error}
        </div>
      ) : (
        <pre className="h-[600px] overflow-auto rounded-lg bg-black p-4 font-mono text-xs text-green-300 shadow-inner">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
