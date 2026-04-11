import { AlertCircle, Clock, Gift, Star, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useBusiness } from "../context/BusinessContext";
import { customerPointsService } from "../features/customers/services/customer.service";

interface PointsHistory {
  type: "earned" | "redeemed" | "bonus" | "adjustment" | "expired";
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

interface CustomerPointsData {
  currentPoints: number;
  totalEarned: number;
  totalRedeemed: number;
  pointValue: number;
  monetaryValue: number;
  history?: PointsHistory[];
}

interface CustomerPointsCardProps {
  customerId: string;
  customerName: string;
  onPointsChange?: () => void;
}

export default function CustomerPointsCard({
  customerId,
  customerName,
  onPointsChange,
}: CustomerPointsCardProps) {
  const { businessId } = useBusiness();
  const [pointsData, setPointsData] = useState<CustomerPointsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchPoints = async () => {
    if (!customerId || !businessId) return;
    setLoading(true);
    setError(null);
    try {
      const response =
        await customerPointsService.getCustomerPoints(customerId);
      setPointsData(response);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al cargar puntos";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!customerId || !businessId) return;
    try {
      const response =
        await customerPointsService.getCustomerPointsHistory(customerId);
      setPointsData(prev =>
        prev ? { ...prev, history: response.history } : null
      );
      setShowHistory(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al cargar historial";
      setError(message);
    }
  };

  const handleAdjustPoints = async () => {
    if (!customerId || !businessId || !adjustPoints || !adjustReason.trim())
      return;
    setLoading(true);
    setError(null);
    try {
      await customerPointsService.adjustCustomerPoints(customerId, {
        amount: adjustPoints,
        description: adjustReason.trim(),
      });
      await fetchPoints();
      setShowAdjust(false);
      setAdjustPoints(0);
      setAdjustReason("");
      onPointsChange?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al ajustar puntos";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "earned":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "redeemed":
        return <Gift className="h-4 w-4 text-blue-500" />;
      case "bonus":
        return <Star className="h-4 w-4 text-yellow-500" />;
      case "expired":
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Cargar datos al montar si no hay datos
  if (!pointsData && !loading && !error) {
    fetchPoints();
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Star className="h-5 w-5 text-yellow-500" />
          Puntos de Fidelidad
        </h3>
        <span className="text-sm text-gray-500">{customerName}</span>
      </div>

      {loading && !pointsData && (
        <div className="flex justify-center py-4">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-purple-600" />
        </div>
      )}

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {pointsData && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-purple-50 p-3 text-center dark:bg-purple-900/20">
              <div className="text-2xl font-bold text-purple-600">
                {pointsData.currentPoints.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Puntos Actuales</div>
              <div className="text-xs font-medium text-green-600">
                ≈ ${pointsData.monetaryValue.toFixed(2)}
              </div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-900/20">
              <div className="text-xl font-bold text-green-600">
                {pointsData.totalEarned.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Total Ganados</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-900/20">
              <div className="text-xl font-bold text-blue-600">
                {pointsData.totalRedeemed.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Total Canjeados</div>
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            <button
              onClick={fetchHistory}
              className="flex-1 rounded bg-gray-100 px-3 py-2 text-sm transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              Ver Historial
            </button>
            <button
              onClick={() => setShowAdjust(!showAdjust)}
              className="flex-1 rounded bg-purple-100 px-3 py-2 text-sm text-purple-700 transition-colors hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-800/40"
            >
              {showAdjust ? "Cancelar" : "Ajustar Puntos"}
            </button>
          </div>

          {showAdjust && (
            <div className="space-y-3 border-t pt-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Puntos a agregar/quitar
                </label>
                <input
                  type="number"
                  value={adjustPoints}
                  onChange={e => setAdjustPoints(parseInt(e.target.value) || 0)}
                  placeholder="Ej: 100 o -50"
                  className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Razón del ajuste
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Ej: Bonificación por compra especial"
                  className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
              <button
                onClick={handleAdjustPoints}
                disabled={!adjustPoints || !adjustReason.trim() || loading}
                className="w-full rounded bg-purple-600 py-2 text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Procesando..."
                  : adjustPoints > 0
                    ? "Agregar Puntos"
                    : "Quitar Puntos"}
              </button>
            </div>
          )}

          {showHistory && pointsData.history && (
            <div className="border-t pt-4">
              <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Historial de Puntos
              </h4>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {pointsData.history.length === 0 ? (
                  <p className="py-2 text-center text-sm text-gray-500">
                    Sin movimientos
                  </p>
                ) : (
                  pointsData.history.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm dark:bg-gray-700/50"
                    >
                      <div className="flex items-center gap-2">
                        {getTypeIcon(entry.type)}
                        <div>
                          <div className="font-medium">{entry.description}</div>
                          <div className="text-xs text-gray-500">
                            {formatDate(entry.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`font-bold ${
                          entry.amount > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {entry.amount > 0 ? "+" : ""}
                        {entry.amount}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
