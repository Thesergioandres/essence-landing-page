import { useEffect, useState, useCallback } from "react";
import { gamificationService } from "../api/services";
import type { PeriodWinner, RankingResponse } from "../types";

const Rankings = () => {
  const [rankingData, setRankingData] = useState<RankingResponse | null>(null);
  const [winners, setWinners] = useState<PeriodWinner[]>([]);
  const [loading, setLoading] = useState(true);
  const [winnersLoading, setWinnersLoading] = useState(false);
  const [view, setView] = useState<"current" | "history">("current");

  // Filtros
  const [period, setPeriod] = useState<"current" | "custom">("current");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadRanking = useCallback(async () => {
    try {
      setLoading(true);
      const params: { period: string; startDate?: string; endDate?: string } = { period };
      if (period === "custom" && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      const data = await gamificationService.getRanking(params);
      setRankingData(data);
    } catch (error) {
      console.error("Error loading ranking:", error);
      alert("Error al cargar el ranking");
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  const loadWinners = async () => {
    try {
      setWinnersLoading(true);
      const data = await gamificationService.getWinners({ limit: 20 });
      setWinners(data.winners);
    } catch (error) {
      console.error("Error loading winners:", error);
      alert("Error al cargar el historial de ganadores");
    } finally {
      setWinnersLoading(false);
    }
  };

  useEffect(() => {
    if (view === "history") {
      loadWinners();
    }
  }, [view]);

  const getLevelBadge = (level: string) => {
    const badges: Record<string, string> = {
      beginner: "🌱",
      bronze: "🥉",
      silver: "🥈",
      gold: "🥇",
      platinum: "💎",
      diamond: "💠",
    };
    return badges[level] || "⭐";
  };

  const getPositionBadge = (position: number) => {
    if (position === 1) return "🥇";
    if (position === 2) return "🥈";
    if (position === 3) return "🥉";
    return `#${position}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Cargando ranking...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">🏆 Rankings y Ganadores</h1>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-gray-300">
        <button
          onClick={() => setView("current")}
          className={`px-6 py-3 font-semibold ${
            view === "current"
              ? "border-b-4 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-blue-600"
          }`}
        >
          📊 Ranking Actual
        </button>
        <button
          onClick={() => setView("history")}
          className={`px-6 py-3 font-semibold ${
            view === "history"
              ? "border-b-4 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-blue-600"
          }`}
        >
          🏅 Historial de Ganadores
        </button>
      </div>

      {view === "current" && rankingData && (
        <>
          {/* Filtros */}
          <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block font-medium text-gray-700">
                  Periodo
                </label>
                <select
                  value={period}
                  onChange={e => setPeriod(e.target.value as any)}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="current">Periodo Actual</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              {period === "custom" && (
                <>
                  <div>
                    <label className="mb-2 block font-medium text-gray-700">
                      Fecha Inicio
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-medium text-gray-700">
                      Fecha Fin
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Info del Periodo */}
          <div className="mb-6 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white shadow-md">
            <h2 className="mb-2 text-2xl font-semibold">
              📅 Periodo: {rankingData.period.type.toUpperCase()}
            </h2>
            <p className="text-lg opacity-90">
              {formatDate(rankingData.period.startDate)} -{" "}
              {formatDate(rankingData.period.endDate)}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Premio en efectivo */}
              <div className="rounded-lg bg-white bg-opacity-20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-2xl">🏆</span>
                  <span className="text-sm opacity-80">Premio 1er Lugar</span>
                </div>
                <div className="text-3xl font-bold">
                  {formatCurrency(rankingData.config.topPerformerBonus)}
                </div>
                <p className="mt-1 text-xs opacity-75">
                  Bono en efectivo cada 15 días
                </p>
              </div>

              {/* Comisiones variables */}
              <div className="rounded-lg bg-white bg-opacity-20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-2xl">💰</span>
                  <span className="text-sm opacity-80">Comisiones Extra</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>🥇 1er lugar:</span>
                    <span className="font-bold">+5% adicional</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🥈 2do lugar:</span>
                    <span className="font-bold">+3% adicional</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🥉 3er lugar:</span>
                    <span className="font-bold">+2% adicional</span>
                  </div>
                </div>
              </div>

              {/* Info del sistema */}
              <div className="rounded-lg bg-white bg-opacity-20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  <span className="text-sm opacity-80">Sistema Activo</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span>✅</span>
                    <span>Evaluación automática</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🔄</span>
                    <span>Cada 15 días</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🎯</span>
                    <span>Ranking en tiempo real</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de Ranking */}
          <div className="overflow-hidden rounded-lg bg-white shadow-md">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-600">
                    Posición
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-600">
                    Distribuidor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-600">
                    Nivel
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-600">
                    Ventas
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-600">
                    Ingresos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-600">
                    Ganancia
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-600">
                    Puntos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-600">
                    Victorias
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rankingData.rankings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No hay datos para este periodo
                    </td>
                  </tr>
                ) : (
                  rankingData.rankings.map(rank => (
                    <tr
                      key={rank.distributorId}
                      className={`hover:bg-gray-50 ${
                        rank.position <= 3 ? "bg-yellow-50" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-2xl">
                          {getPositionBadge(rank.position)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {rank.distributorName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {rank.distributorEmail}
                        </div>
                        {rank.position <= 3 && (
                          <div className="mt-1">
                            <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                              💰 +
                              {rank.position === 1
                                ? "5"
                                : rank.position === 2
                                  ? "3"
                                  : "2"}
                              % comisión
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="text-2xl">
                          {getLevelBadge(rank.currentLevel)}
                        </span>
                        <span className="ml-2 text-sm capitalize text-gray-600">
                          {rank.currentLevel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="font-semibold">{rank.totalSales}</div>
                        <div className="text-sm text-gray-500">
                          {rank.totalUnits} unidades
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-green-600">
                        {formatCurrency(rank.totalRevenue)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-blue-600">
                        {formatCurrency(rank.totalProfit)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                          {rank.totalPoints} pts
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {rank.periodWins > 0 && (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                            🏆 {rank.periodWins}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === "history" && (
        <div className="overflow-hidden rounded-lg bg-white shadow-md">
          {winnersLoading ? (
            <div className="px-6 py-8 text-center">Cargando historial...</div>
          ) : winners.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No hay ganadores registrados aún
            </div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-600">
                    Periodo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-600">
                    Ganador 🥇
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-600">
                    Ventas
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-600">
                    Ingresos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-600">
                    Bono
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-600">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {winners.map(winner => (
                  <tr key={winner._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium uppercase text-gray-900">
                        {winner.periodType}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(winner.startDate)} -{" "}
                        {formatDate(winner.endDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {winner.winnerName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {winner.winnerEmail}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-semibold">{winner.salesCount}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-green-600">
                      {formatCurrency(winner.totalRevenue)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-blue-600">
                      {formatCurrency(winner.bonusAmount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {winner.bonusPaid ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          ✓ Pagado
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                          ⏳ Pendiente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default Rankings;
