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
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-xl text-white">Cargando ranking...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-h-screen bg-gray-900 px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold text-white">🏆 Rankings y Ganadores</h1>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-gray-700">
        <button
          onClick={() => setView("current")}
          className={`px-6 py-3 font-semibold ${
            view === "current"
              ? "border-b-4 border-blue-500 text-blue-400"
              : "text-gray-400 hover:text-blue-400"
          }`}
        >
          📊 Ranking Actual
        </button>
        <button
          onClick={() => setView("history")}
          className={`px-6 py-3 font-semibold ${
            view === "history"
              ? "border-b-4 border-blue-500 text-blue-400"
              : "text-gray-400 hover:text-blue-400"
          }`}
        >
          🏅 Historial de Ganadores
        </button>
      </div>

      {view === "current" && rankingData && (
        <>
          {/* Filtros */}
          <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-6 shadow-md">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block font-medium text-gray-300">
                  Periodo
                </label>
                <select
                  value={period}
                  onChange={e => setPeriod(e.target.value as any)}
                  className="w-full rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="current">Periodo Actual</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              {period === "custom" && (
                <>
                  <div>
                    <label className="mb-2 block font-medium text-gray-300">
                      Fecha Inicio
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-medium text-gray-300">
                      Fecha Fin
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Info del Periodo */}
          <div className="mb-6 rounded-lg bg-linear-to-r from-blue-500 to-purple-600 p-6 text-white shadow-md">
            <h2 className="mb-2 text-2xl font-semibold">
              📅 Periodo: {rankingData.period.type.toUpperCase()}
            </h2>
            <p className="text-lg opacity-90">
              {formatDate(rankingData.period.startDate)} -{" "}
              {formatDate(rankingData.period.endDate)}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Premio en efectivo */}
              <div className="rounded-lg bg-black bg-opacity-20 p-4 backdrop-blur-sm">
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
              <div className="rounded-lg bg-black bg-opacity-20 p-4 backdrop-blur-sm">
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
              <div className="rounded-lg bg-black bg-opacity-20 p-4 backdrop-blur-sm">
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

          {/* Podio de los 3 primeros lugares */}
          {rankingData.rankings.length >= 3 && (
            <div className="mb-6 rounded-lg border border-gray-700 bg-linear-to-br from-gray-800 to-gray-900 p-6 shadow-lg">
              <h2 className="mb-4 text-center text-2xl font-bold text-white">
                🏆 Podio Actual
              </h2>
              <div className="flex items-end justify-center gap-4">
                {/* 2do Lugar */}
                <div className="flex flex-col items-center">
                  <div className="mb-2 flex h-32 w-32 flex-col items-center justify-center rounded-lg border-4 border-gray-400 bg-gray-700 shadow-lg">
                    <div className="text-4xl">🥈</div>
                    <div className="mt-2 text-xs font-bold text-gray-300">2º LUGAR</div>
                  </div>
                  <div className="mt-2 text-center">
                    <p className="font-bold text-white">{rankingData.rankings[1]?.distributorName}</p>
                    <p className="text-sm text-gray-400">{formatCurrency(rankingData.rankings[1]?.totalRevenue || 0)}</p>
                    <span className="mt-1 inline-block rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                      23% ganancia
                    </span>
                  </div>
                </div>

                {/* 1er Lugar */}
                <div className="flex flex-col items-center">
                  <div className="mb-2 flex h-40 w-40 flex-col items-center justify-center rounded-lg border-4 border-yellow-400 bg-linear-to-br from-yellow-500 to-yellow-600 shadow-2xl">
                    <div className="text-5xl">🥇</div>
                    <div className="mt-2 text-sm font-bold text-yellow-900">1º LUGAR</div>
                  </div>
                  <div className="mt-2 text-center">
                    <p className="font-bold text-white">{rankingData.rankings[0]?.distributorName}</p>
                    <p className="text-sm text-gray-400">{formatCurrency(rankingData.rankings[0]?.totalRevenue || 0)}</p>
                    <span className="mt-1 inline-block rounded-full bg-green-600 px-3 py-1 text-xs font-bold text-white">
                      25% ganancia
                    </span>
                  </div>
                </div>

                {/* 3er Lugar */}
                <div className="flex flex-col items-center">
                  <div className="mb-2 flex h-28 w-28 flex-col items-center justify-center rounded-lg border-4 border-orange-600 bg-gray-700 shadow-lg">
                    <div className="text-3xl">🥉</div>
                    <div className="mt-2 text-xs font-bold text-gray-300">3º LUGAR</div>
                  </div>
                  <div className="mt-2 text-center">
                    <p className="font-bold text-white">{rankingData.rankings[2]?.distributorName}</p>
                    <p className="text-sm text-gray-400">{formatCurrency(rankingData.rankings[2]?.totalRevenue || 0)}</p>
                    <span className="mt-1 inline-block rounded-full bg-purple-600 px-3 py-1 text-xs font-bold text-white">
                      21% ganancia
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabla de Ranking */}
          <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow-md">
            <table className="min-w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                    Posición
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                    Distribuidor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                    Nivel
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-300">
                    Ventas
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-300">
                    Ingresos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-300">
                    Ganancia
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-300">
                    Puntos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-300">
                    Victorias
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {rankingData.rankings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-8 text-center text-gray-400"
                    >
                      No hay datos para este periodo
                    </td>
                  </tr>
                ) : (
                  rankingData.rankings.map(rank => (
                    <tr
                      key={rank.distributorId}
                      className={`hover:bg-gray-700 ${
                        rank.position <= 3 ? "bg-yellow-900/30 border-l-4" : ""
                      } ${
                        rank.position === 1 ? "border-yellow-400" :
                        rank.position === 2 ? "border-gray-400" :
                        rank.position === 3 ? "border-orange-600" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <div className="text-3xl">
                            {getPositionBadge(rank.position)}
                          </div>
                          {rank.position <= 3 && (
                            <div className="text-[10px] font-bold uppercase text-yellow-400">
                              {rank.position === 1 ? "1º LUGAR" :
                               rank.position === 2 ? "2º LUGAR" : "3º LUGAR"}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium text-white">
                              {rank.distributorName}
                            </div>
                            <div className="text-sm text-gray-400">
                              {rank.distributorEmail}
                            </div>
                          </div>
                        </div>
                        {rank.position <= 3 && (
                          <div className="mt-2 flex gap-2">
                            <span className="inline-flex items-center rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-bold text-white">
                              {rank.position === 1 ? "25%" :
                               rank.position === 2 ? "23%" : "21%"} ganancia
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="text-2xl">
                          {getLevelBadge(rank.currentLevel)}
                        </span>
                        <span className="ml-2 text-sm capitalize text-gray-300">
                          {rank.currentLevel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="font-semibold text-white">{rank.totalSales}</div>
                        <div className="text-sm text-gray-400">
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
        <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow-md">
          {winnersLoading ? (
            <div className="px-6 py-8 text-center text-white">Cargando historial...</div>
          ) : winners.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400">
              No hay ganadores registrados aún
            </div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                    Periodo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">
                    Ganador 🥇
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-300">
                    Ventas
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-300">
                    Ingresos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-300">
                    Bono
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-300">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {winners.map(winner => (
                  <tr key={winner._id} className="hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="font-medium uppercase text-white">
                        {winner.periodType}
                      </div>
                      <div className="text-sm text-gray-400">
                        {formatDate(winner.startDate)} -{" "}
                        {formatDate(winner.endDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">
                        {winner.winnerName}
                      </div>
                      <div className="text-sm text-gray-400">
                        {winner.winnerEmail}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-semibold text-white">{winner.salesCount}</div>
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
