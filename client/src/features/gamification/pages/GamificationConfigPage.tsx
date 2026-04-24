import { useCallback, useEffect, useState } from "react";
import { useBusiness } from "../../../context/BusinessContext";
import { gamificationService } from "../services/gamification.service";
import type {
  GamificationConfig,
  GamificationTier,
} from "../types/gamification.types";

const DEFAULT_TIERS: GamificationTier[] = [
  { name: "Bronce", minPoints: 25000, bonusPercentage: 1 },
  { name: "Plata", minPoints: 50000, bonusPercentage: 3 },
  { name: "Oro", minPoints: 100000, bonusPercentage: 5 },
];

export default function GamificationConfigPage() {
  const { businessId, hydrating } = useBusiness();
  const [config, setConfig] = useState<GamificationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [amountPerPoint, setAmountPerPoint] = useState(1000);
  const [cycleDuration, setCycleDuration] = useState<
    "weekly" | "biweekly" | "monthly"
  >("biweekly");
  const [tiers, setTiers] = useState<GamificationTier[]>(DEFAULT_TIERS);

  const loadConfig = useCallback(async () => {
    if (hydrating || !businessId) return;

    try {
      setLoading(true);
      const data = await gamificationService.getConfig();
      setConfig(data);
      setEnabled(data.enabled || false);
      setAmountPerPoint(data.pointsRatio?.amountPerPoint || 1000);
      setCycleDuration(data.cycle?.duration || "biweekly");
      setTiers(data.tiers?.length ? data.tiers : DEFAULT_TIERS);
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, [businessId, hydrating]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const updated = await gamificationService.updateConfig({
        enabled,
        pointsRatio: { amountPerPoint, currency: "COP" },
        cycle: {
          duration: cycleDuration,
          currentPeriodStart: config?.cycle?.currentPeriodStart ?? null,
          currentPeriodEnd: config?.cycle?.currentPeriodEnd ?? null,
        },
        tiers,
      });

      setConfig(updated);
      setMessage({
        type: "success",
        text: "Configuración guardada exitosamente",
      });
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Error al guardar la configuración",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConsolidate = async () => {
    if (
      !window.confirm(
        "¿Estás seguro de consolidar el periodo actual? Se reiniciarán todos los puntos y se registrará el ganador.",
      )
    ) {
      return;
    }

    try {
      setConsolidating(true);
      setMessage(null);
      const result = await gamificationService.forceConsolidate();
      setMessage({
        type: "success",
        text: result.message || "Periodo consolidado exitosamente",
      });
      loadConfig();
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Error al consolidar el periodo",
      });
    } finally {
      setConsolidating(false);
    }
  };

  const updateTier = (
    index: number,
    field: keyof GamificationTier,
    value: string | number,
  ) => {
    setTiers((prev) =>
      prev.map((tier, i) =>
        i === index ? { ...tier, [field]: value } : tier,
      ),
    );
  };

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    setTiers((prev) => [
      ...prev,
      {
        name: `Nivel ${prev.length + 1}`,
        minPoints: (lastTier?.minPoints || 0) + 25000,
        bonusPercentage: (lastTier?.bonusPercentage || 0) + 1,
      },
    ]);
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          🎮 Configuración de Gamificación
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Configura el sistema de puntos, tiers y ciclos de evaluación para tu
          equipo.
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-400/30 bg-red-500/10 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Enable Toggle */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-white">Activar Gamificación</p>
            <p className="text-xs text-white/40">
              Los empleados empezarán a acumular puntos por cada venta.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              enabled ? "bg-cyan-500" : "bg-white/20"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
                enabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Points Ratio */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60">
          Ratio de Puntos
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-white/40">
              Monto por 1 punto (COP)
            </label>
            <input
              type="number"
              value={amountPerPoint}
              onChange={(e) =>
                setAmountPerPoint(Math.max(1, Number(e.target.value) || 1000))
              }
              className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
              min={1}
            />
          </div>
          <div className="pt-5 text-sm text-white/50">
            = 1 punto por cada ${amountPerPoint.toLocaleString()} COP
          </div>
        </div>
      </div>

      {/* Cycle */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60">
          Ciclo de Evaluación
        </h2>
        <div className="flex gap-2">
          {(
            [
              { value: "weekly", label: "Semanal" },
              { value: "biweekly", label: "Quincenal" },
              { value: "monthly", label: "Mensual" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCycleDuration(opt.value)}
              className={`rounded-xl border px-4 py-2 text-sm transition-all ${
                cycleDuration === opt.value
                  ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-300"
                  : "border-white/20 text-white/50 hover:border-white/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {config?.cycle?.currentPeriodEnd && (
          <p className="mt-2 text-xs text-white/30">
            Periodo actual termina:{" "}
            {new Date(config.cycle.currentPeriodEnd).toLocaleDateString(
              "es-CO",
            )}
          </p>
        )}
      </div>

      {/* Tiers */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
            Tiers de Bonificación
          </h2>
          <button
            type="button"
            onClick={addTier}
            className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white/60 transition-colors hover:border-cyan-300/40 hover:text-white"
          >
            + Agregar Tier
          </button>
        </div>
        <div className="space-y-3">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className="flex items-end gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="flex-1">
                <label className="mb-1 block text-[10px] text-white/40">
                  Nombre
                </label>
                <input
                  type="text"
                  value={tier.name}
                  onChange={(e) => updateTier(index, "name", e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-400/50"
                />
              </div>
              <div className="w-32">
                <label className="mb-1 block text-[10px] text-white/40">
                  Puntos mínimos
                </label>
                <input
                  type="number"
                  value={tier.minPoints}
                  onChange={(e) =>
                    updateTier(
                      index,
                      "minPoints",
                      Math.max(0, Number(e.target.value)),
                    )
                  }
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-400/50"
                  min={0}
                />
              </div>
              <div className="w-24">
                <label className="mb-1 block text-[10px] text-white/40">
                  Bonus %
                </label>
                <input
                  type="number"
                  value={tier.bonusPercentage}
                  onChange={(e) =>
                    updateTier(
                      index,
                      "bonusPercentage",
                      Math.max(0, Math.min(20, Number(e.target.value))),
                    )
                  }
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-400/50"
                  min={0}
                  max={20}
                />
              </div>
              {tiers.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTier(index)}
                  className="mb-0.5 rounded-lg border border-red-400/30 px-2 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleConsolidate}
          disabled={consolidating || !config?.enabled}
          className="rounded-xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-2.5 text-sm font-medium text-yellow-300 transition-all hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {consolidating ? "Consolidando..." : "⚡ Consolidar Periodo"}
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-6 py-2.5 text-sm font-semibold text-cyan-50 transition-all hover:bg-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando..." : "💾 Guardar Configuración"}
        </button>
      </div>
    </div>
  );
}
