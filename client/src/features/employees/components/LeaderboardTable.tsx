import React from "react";
import type {
  GamificationConfig,
  RankingEntry,
} from "../../analytics/types/gamification.types";

interface LeaderboardTableProps {
  rankings: RankingEntry[];
  config: GamificationConfig | null;
  limit?: number;
}

const getNextLevelPoints = (
  points: number,
  config: GamificationConfig | null
) => {
  if (!config?.levels || config.levels.length === 0) return null;
  const sorted = [...config.levels].sort((a, b) => a.minPoints - b.minPoints);
  return sorted.find(level => level.minPoints > points) || null;
};

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  rankings,
  config,
  limit = 10,
}) => {
  if (!rankings || rankings.length === 0) {
    return <p className="py-6 text-center text-gray-400">Sin datos</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm text-gray-300">
        <thead className="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="py-2 pr-4">Pos</th>
            <th className="py-2 pr-4">Empleado</th>
            <th className="py-2 pr-4 text-right">Puntos</th>
            <th className="py-2 pr-4">Rango</th>
            <th className="py-2 text-right">Progreso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {rankings.slice(0, limit).map(entry => {
            const points = entry.totalPoints || 0;
            const nextLevel = getNextLevelPoints(points, config);
            const progressLabel = nextLevel
              ? `${points}/${nextLevel.minPoints}`
              : `${points}`;
            return (
              <tr key={entry.employeeId} className="hover:bg-gray-900/60">
                <td className="py-3 pr-4 font-semibold text-white">
                  #{entry.position}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">
                      {entry.employeeName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {entry.employeeEmail}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-right font-semibold text-emerald-300">
                  {points.toLocaleString()}
                </td>
                <td className="py-3 pr-4 text-sm text-gray-200">
                  {entry.currentLevel || "-"}
                </td>
                <td className="py-3 text-right text-xs text-gray-400">
                  {progressLabel}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LeaderboardTable;
