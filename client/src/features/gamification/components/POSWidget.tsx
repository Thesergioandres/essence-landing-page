import { useCallback, useEffect, useMemo, useState } from "react";
import { useBusiness } from "../../../context/BusinessContext";
import { gamificationService } from "../services/gamification.service";
import type { MyPointsData, RankingEntry } from "../types/gamification.types";

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  Bronce: {
    bg: "bg-amber-500/10",
    border: "border-amber-400/40",
    text: "text-amber-300",
    glow: "shadow-amber-500/20",
  },
  Plata: {
    bg: "bg-slate-300/10",
    border: "border-slate-300/40",
    text: "text-slate-200",
    glow: "shadow-slate-400/20",
  },
  Oro: {
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/50",
    text: "text-yellow-300",
    glow: "shadow-yellow-500/30",
  },
};

const DEFAULT_TIER_STYLE = {
  bg: "bg-cyan-500/10",
  border: "border-cyan-300/30",
  text: "text-cyan-300",
  glow: "shadow-cyan-500/10",
};

export default function POSWidget() {
  const { businessId, hydrating } = useBusiness();
  const [data, setData] = useState<MyPointsData | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const loadData = useCallback(async () => {
    if (hydrating || !businessId) return;

    try {
      const [pointsData, rankingData] = await Promise.all([
        gamificationService.getMyPoints(),
        gamificationService.getRanking(5),
      ]);

      if (!pointsData.enabled) {
        setData(null);
        return;
      }

      setData(pointsData);
      setRanking(rankingData.ranking || []);
    } catch {
      // Silently fail — gamification is optional
    } finally {
      setLoading(false);
    }
  }, [businessId, hydrating]);

  useEffect(() => {
    loadData();
    // Refresh every 60 seconds
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const tierStyle = useMemo(() => {
    if (!data?.tier?.name) return DEFAULT_TIER_STYLE;
    return TIER_COLORS[data.tier.name] || DEFAULT_TIER_STYLE;
  }, [data?.tier?.name]);

  const progressPercentage = useMemo(() => {
    if (!data?.nextTier || !data.tier) {
      if (!data?.tier && data?.nextTier) {
        // No tier yet, progress towards first tier
        return Math.min(
          100,
          Math.round(
            ((data?.currentPoints || 0) / (data.nextTier.minPoints || 1)) * 100,
          ),
        );
      }
      return 100; // At max tier
    }
    const tierRange = data.nextTier.minPoints - data.tier.minPoints;
    if (tierRange <= 0) return 100;
    const progress = data.currentPoints - data.tier.minPoints;
    return Math.min(100, Math.max(0, Math.round((progress / tierRange) * 100)));
  }, [data]);

  // Don't render if gamification is disabled or loading
  if (loading || !data) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={`fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-2xl border ${tierStyle.border} ${tierStyle.bg} shadow-lg ${tierStyle.glow} backdrop-blur-xl transition-all duration-300 hover:scale-105`}
      >
        <span className="text-2xl">🏆</span>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-80 rounded-2xl border ${tierStyle.border} bg-[rgba(6,14,28,0.95)] shadow-xl ${tierStyle.glow} backdrop-blur-xl transition-all duration-500`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎮</span>
          <h3 className="text-sm font-semibold text-white">Mis Puntos</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${tierStyle.border} ${tierStyle.text}`}
          >
            {data.tier?.name || "Sin Tier"}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="text-xs text-white/50 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Points Display */}
      <div className="px-4 py-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-3xl font-bold tracking-tight text-white">
              {data.currentPoints.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-white/50">puntos este periodo</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60">Posición</p>
            <p className={`text-2xl font-bold ${tierStyle.text}`}>
              #{data.rankPosition}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {data.nextTier && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] text-white/50">
              <span>{data.tier?.name || "Inicio"}</span>
              <span>
                {data.pointsToNextTier.toLocaleString()} pts para{" "}
                {data.nextTier.name}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  data.tier?.name === "Oro"
                    ? "bg-linear-to-r from-yellow-500 to-yellow-300"
                    : data.tier?.name === "Plata"
                      ? "bg-linear-to-r from-slate-400 to-slate-200"
                      : data.tier?.name === "Bronce"
                        ? "bg-linear-to-r from-amber-600 to-amber-400"
                        : "bg-linear-to-r from-cyan-500 to-cyan-300"
                }`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Commission Breakdown */}
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-white/40">
            Comisión desglosada
          </p>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-white/70">Base</span>
            <span className="font-medium text-white">
              {data.isEligibleForBonus
                ? `+ Tier ${data.bonusPercentage > 0 ? `+${data.bonusPercentage}%` : "0%"}`
                : "(fija)"}
            </span>
            {data.isEligibleForBonus && data.bonusPercentage > 0 && (
              <span className={`ml-auto font-bold ${tierStyle.text}`}>
                = +{data.bonusPercentage}% extra
              </span>
            )}
          </div>
          {!data.isEligibleForBonus && (
            <p className="mt-1 text-[10px] text-white/30">
              Tu comisión es fija. Acumulas puntos para el ranking.
            </p>
          )}
        </div>
      </div>

      {/* Mini Ranking */}
      {ranking.length > 0 && (
        <div className="border-t border-white/10 px-4 py-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
            🏆 Ranking del periodo
          </p>
          <div className="space-y-1.5">
            {ranking.slice(0, 3).map((entry) => (
              <div
                key={entry.employeeId}
                className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs ${
                  entry.employeeId === data.rankPosition.toString()
                    ? "bg-white/10"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 text-center font-bold text-white/60">
                    {entry.position === 1
                      ? "🥇"
                      : entry.position === 2
                        ? "🥈"
                        : "🥉"}
                  </span>
                  <span className="max-w-[120px] truncate text-white/80">
                    {entry.employeeName}
                  </span>
                </div>
                <span className="font-mono text-white/60">
                  {entry.currentPoints.toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Period Info */}
      {data.period?.end && (
        <div className="border-t border-white/10 px-4 py-2 text-center text-[10px] text-white/30">
          Periodo finaliza:{" "}
          {new Date(data.period.end).toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "short",
          })}
        </div>
      )}
    </div>
  );
}
