import { useEffect, useMemo, useState } from "react";
import type {
  EmployeeStats,
  GamificationConfig,
  RankingEntry,
} from "../../analytics/types/gamification.types";
import { authService } from "../../auth/services";
import { gamificationService } from "../../common/services";
import LeaderboardTable from "../components/LeaderboardTable";

export default function EmployeeLevelPage() {
  const userId = authService.getCurrentUser()?._id || "";
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<GamificationConfig | null>(null);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [commissionInfo, setCommissionInfo] = useState({
    bonusCommission: 0,
    position: null as number | null,
  });

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let isActive = true;

    const loadData = async () => {
      try {
        console.log("🚀 Iniciando carga de datos gamificación para:", userId);
        setLoading(true);
        const businessId = localStorage.getItem("businessId") || undefined;

        // Cargar Config
        let configRes = null;
        try {
          configRes = await gamificationService.getConfig();
        } catch (e) {
          console.error("❌ Error loading config:", e);
        }

        if (!isActive) return;

        // Cargar Stats
        let statsRes = null;
        try {
          statsRes = await gamificationService.getEmployeeStats(userId, {
            recalculate: true,
          });
        } catch (e) {
          console.error("❌ Error loading stats:", e);
        }

        if (!isActive) return;

        // Cargar Ranking
        let rankingRes = null;
        try {
          rankingRes = await gamificationService.getRanking({
            period: "current",
            businessId,
          });
        } catch (e) {
          console.error("❌ Error loading ranking:", e);
        }

        if (!isActive) return;

        // Cargar Comisiones
        let commissionRes = null;
        try {
          commissionRes =
            await gamificationService.getAdjustedCommission(userId);
        } catch (e) {
          console.error("❌ Error loading commission:", e);
        }

        if (!isActive) return;

        console.log("✅ Datos cargados exitosamente (parcial o total)");

        setConfig(configRes);
        setStats((statsRes as any)?.stats ?? statsRes ?? null);
        const resolvedRankings = rankingRes?.rankings || [];
        const fallbackPosition = resolvedRankings.find(
          entry => entry.employeeId?.toString() === userId
        )?.position;

        setRanking(resolvedRankings);
        setCommissionInfo({
          bonusCommission: commissionRes?.bonusCommission ?? 0,
          position: commissionRes?.position ?? fallbackPosition ?? null,
        });
      } catch (error) {
        console.error(
          "❌ CRITICAL ERROR rendering employee level page:",
          error
        );
      } finally {
        if (isActive) {
          console.log("🛑 Finalizando estado de carga");
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isActive = false;
    };
  }, [userId]);

  const levels = useMemo(() => {
    if (!config?.levels) return [];
    return [...config.levels].sort((a, b) => a.minPoints - b.minPoints);
  }, [config]);

  const totalPoints = stats?.totalPoints || 0;
  const currentLevel = stats?.currentLevel || "Sin rango";
  const nextLevel = levels.find(level => level.minPoints > totalPoints);
  const progressTarget = nextLevel?.minPoints || totalPoints || 1;
  const progressValue = Math.min(totalPoints, progressTarget);
  const progressPercent = Math.min(
    100,
    Math.round((progressValue / progressTarget) * 100)
  );
  const activeCommission = 20 + (commissionInfo.bonusCommission || 0);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-white">Mi Nivel</h1>
        <p className="mt-2 text-gray-400">
          Tu progreso, puntos y ranking en tiempo real.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-blue-500/30 bg-blue-900/20 p-6">
          <p className="text-sm text-blue-200">Rango actual</p>
          <p className="mt-2 text-2xl font-bold text-white">{currentLevel}</p>
          <p className="mt-1 text-xs text-blue-200">
            Comision activa: {activeCommission}%
          </p>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-900/20 p-6">
          <p className="text-sm text-cyan-200">Puntos acumulados</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {totalPoints.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-cyan-200">
            Posicion: {commissionInfo.position ?? "-"}
          </p>
        </div>
        <div className="rounded-xl border border-purple-500/30 bg-purple-900/20 p-6">
          <p className="text-sm text-purple-200">Progreso al siguiente nivel</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-700">
            <div
              className="bg-linear-to-r h-full rounded-full from-purple-500 to-pink-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-purple-200">
            {nextLevel
              ? `${totalPoints}/${nextLevel.minPoints} pts para ${nextLevel.name}`
              : "Nivel maximo"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Tabla de Rangos
          </h2>
          {levels.length === 0 ? (
            <p className="py-6 text-center text-gray-400">Sin niveles</p>
          ) : (
            <div className="space-y-3">
              {levels.map(level => (
                <div
                  key={level.id}
                  className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {level.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {level.minPoints} pts
                    </p>
                  </div>
                  <span className="text-xs text-emerald-300">
                    +{level.benefits?.commissionBonus || 0}% comision
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Ranking de Employees
          </h2>
          <LeaderboardTable rankings={ranking} config={config} />
        </div>
      </div>
    </div>
  );
}
