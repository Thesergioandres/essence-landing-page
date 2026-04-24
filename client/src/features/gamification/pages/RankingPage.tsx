import { useCallback, useEffect, useState } from "react";
import { useBusiness } from "../../../context/BusinessContext";
import { gamificationService } from "../services/gamification.service";
import type { GamificationTier, RankingEntry } from "../types/gamification.types";

const TIER_BADGE_CLASSES: Record<string, string> = {
  Bronce: "bg-amber-500/20 text-amber-300 border-amber-400/40",
  Plata: "bg-slate-300/20 text-slate-200 border-slate-300/40",
  Oro: "bg-yellow-400/20 text-yellow-300 border-yellow-400/50",
};

const MEDAL_EMOJIS = ["🥇", "🥈", "🥉"];

export default function RankingPage() {
  const { businessId, hydrating } = useBusiness();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [tiers, setTiers] = useState<GamificationTier[]>([]);
  const [period, setPeriod] = useState<{
    start: string | null;
    end: string | null;
    duration: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);

  const loadRanking = useCallback(async () => {
    if (hydrating || !businessId) return;

    try {
      setLoading(true);
      const data = await gamificationService.getRanking(50);
      setEnabled(data.enabled);
      setRanking(data.ranking || []);
      setTiers(data.tiers || []);
      setPeriod(data.period);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [businessId, hydrating]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="mb-4 text-5xl">🎮</div>
        <h2 className="text-xl font-semibold text-white">
          Gamificación no está habilitada
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Pide a tu administrador que active el sistema de puntos y rankings.
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🏆 Ranking</h1>
          <p className="text-sm text-white/50">
            Periodo: {formatDate(period?.start ?? null)} —{" "}
            {formatDate(period?.end ?? null)}
            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase">
              {period?.duration || "quincenal"}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={loadRanking}
          className="rounded-xl border border-white/20 px-3 py-2 text-xs text-white/70 transition-colors hover:border-cyan-300/40 hover:text-white"
        >
          Actualizar
        </button>
      </div>

      {/* Tiers Legend */}
      {tiers.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl border px-3 py-1.5 text-xs ${
                TIER_BADGE_CLASSES[tier.name] ||
                "border-cyan-300/30 bg-cyan-500/10 text-cyan-300"
              }`}
            >
              {tier.name}: {tier.minPoints.toLocaleString()} pts → +
              {tier.bonusPercentage}%
            </div>
          ))}
        </div>
      )}

      {/* Ranking Table */}
      {ranking.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 py-12 text-center text-sm text-white/40">
          Aún no hay empleados con puntos en este periodo.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Empleado</th>
                <th className="px-4 py-3 text-center font-medium">Tier</th>
                <th className="px-4 py-3 text-right font-medium">Puntos</th>
                <th className="px-4 py-3 text-right font-medium">
                  Bonus
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Siguiente Tier
                </th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((entry) => (
                <tr
                  key={entry.employeeId}
                  className="border-b border-white/5 transition-colors hover:bg-white/5"
                >
                  <td className="px-4 py-3 text-center text-lg">
                    {entry.position <= 3
                      ? MEDAL_EMOJIS[entry.position - 1]
                      : (
                          <span className="text-sm text-white/50">
                            {entry.position}
                          </span>
                        )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">
                      {entry.employeeName}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {entry.employeeEmail}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {entry.tier ? (
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          TIER_BADGE_CLASSES[entry.tier.name] ||
                          "border-white/20 bg-white/10 text-white/60"
                        }`}
                      >
                        {entry.tier.name}
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-white">
                    {entry.currentPoints.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {entry.bonusPercentage > 0 ? (
                      <span className="text-emerald-400">
                        +{entry.bonusPercentage}%
                      </span>
                    ) : (
                      <span className="text-white/30">0%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-white/50">
                    {entry.nextTier ? (
                      <>
                        {entry.pointsToNextTier.toLocaleString()} pts →{" "}
                        {entry.nextTier.name}
                      </>
                    ) : (
                      <span className="text-yellow-300">🌟 Max</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
