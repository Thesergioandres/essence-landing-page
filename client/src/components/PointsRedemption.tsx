import { CheckCircle, Gift, Star, XCircle } from "lucide-react";
import { useState } from "react";
import { useBusiness } from "../context/BusinessContext";
import { customerPointsService } from "../features/customers/services/customer.service";

interface RedemptionValidation {
  valid: boolean;
  errors: string[];
  redemptionValue: number;
  customerPoints: number;
}

interface PointsRedemptionProps {
  customerId: string;
  businessId?: string;
  saleTotal: number;
  onRedemptionChange: (data: {
    points: number;
    discountAmount: number;
  }) => void;
}

export default function PointsRedemption({
  customerId,
  businessId: propBusinessId,
  saleTotal,
  onRedemptionChange,
}: PointsRedemptionProps) {
  const { businessId: contextBusinessId } = useBusiness();
  const businessId = propBusinessId || contextBusinessId;
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [validation, setValidation] = useState<RedemptionValidation | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [customerPoints, setCustomerPoints] = useState<number | null>(null);

  // Cargar puntos del cliente
  const fetchCustomerPoints = async () => {
    if (!customerId || !businessId) return;
    try {
      const response =
        await customerPointsService.getCustomerPoints(customerId);
      setCustomerPoints(response.currentPoints);
    } catch {
      setCustomerPoints(0);
    }
  };

  // Validar redención
  const validateRedemption = async (points: number) => {
    if (!customerId || !businessId || points <= 0) {
      setValidation(null);
      onRedemptionChange({ points: 0, discountAmount: 0 });
      return;
    }

    setLoading(true);
    try {
      const response = await customerPointsService.validateCustomerRedemption(
        customerId,
        {
          pointsToRedeem: points,
          saleTotal,
        }
      );
      setValidation(response);
      if (response.valid) {
        onRedemptionChange({
          points,
          discountAmount: response.redemptionValue,
        });
      } else {
        onRedemptionChange({ points: 0, discountAmount: 0 });
      }
    } catch (err) {
      setValidation({
        valid: false,
        errors: [err instanceof Error ? err.message : "Error de validación"],
        redemptionValue: 0,
        customerPoints: customerPoints || 0,
      });
      onRedemptionChange({ points: 0, discountAmount: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handlePointsChange = (value: string) => {
    const points = parseInt(value) || 0;
    setPointsToRedeem(points);
    validateRedemption(points);
  };

  const applyMaxPoints = () => {
    if (customerPoints && customerPoints > 0) {
      // Calcular el máximo que puede aplicar (50% del total)
      const maxValue = saleTotal * 0.5;
      const maxPoints = Math.min(customerPoints, Math.floor(maxValue / 0.01));
      const validPoints = Math.max(100, maxPoints); // Mínimo 100
      setPointsToRedeem(validPoints);
      validateRedemption(validPoints);
    }
  };

  const clearRedemption = () => {
    setPointsToRedeem(0);
    setValidation(null);
    onRedemptionChange({ points: 0, discountAmount: 0 });
  };

  // Cargar puntos al montar
  if (customerPoints === null && customerId) {
    fetchCustomerPoints();
  }

  if (!customerId) {
    return null;
  }

  return (
    <div className="bg-linear-to-r rounded-lg border from-purple-50 to-blue-50 p-4 dark:from-purple-900/20 dark:to-blue-900/20">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 font-medium text-purple-700 dark:text-purple-300">
          <Gift className="h-5 w-5" />
          Canjear Puntos
        </h4>
        {customerPoints !== null && (
          <span className="flex items-center gap-1 text-sm">
            <Star className="h-4 w-4 text-yellow-500" />
            {customerPoints.toLocaleString()} disponibles
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="number"
            value={pointsToRedeem || ""}
            onChange={e => handlePointsChange(e.target.value)}
            placeholder="Puntos a canjear (mín. 100)"
            min={0}
            max={customerPoints || undefined}
            className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <button
          type="button"
          onClick={applyMaxPoints}
          disabled={!customerPoints || customerPoints < 100}
          className="rounded bg-purple-600 px-3 py-2 text-sm text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Máx
        </button>
        {pointsToRedeem > 0 && (
          <button
            type="button"
            onClick={clearRedemption}
            className="rounded bg-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Limpiar
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-purple-600" />
          Validando...
        </div>
      )}

      {validation && !loading && (
        <div className="mt-3">
          {validation.valid ? (
            <div className="flex items-center justify-between rounded bg-green-100 p-2 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Descuento aplicable
              </span>
              <span className="text-lg font-bold">
                -${validation.redemptionValue.toFixed(2)}
              </span>
            </div>
          ) : (
            <div className="rounded bg-red-100 p-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              <div className="mb-1 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                No se puede aplicar
              </div>
              <ul className="list-inside list-disc text-sm">
                {validation.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">
        Mínimo 100 puntos • Máximo 50% del total • 100 pts = $1.00
      </div>
    </div>
  );
}
