import { useEffect, useState } from "react";
import { gamificationService } from "../api/services";
import type { SalesTarget } from "../types";

const GamificationConfigPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  // Form states
  const [evaluationPeriod, setEvaluationPeriod] = useState<string>("monthly");
  const [customPeriodDays, setCustomPeriodDays] = useState<number>(30);
  const [topPerformerBonus, setTopPerformerBonus] = useState<number>(1000);
  const [secondPlaceBonus, setSecondPlaceBonus] = useState<number>(500);
  const [thirdPlaceBonus, setThirdPlaceBonus] = useState<number>(250);
  const [pointsPerSale, setPointsPerSale] = useState<number>(10);
  const [pointsPerPeso, setPointsPerPeso] = useState<number>(0.01);
  const [salesTargets, setSalesTargets] = useState<SalesTarget[]>([]);

  // Evaluation form
  const [evalStartDate, setEvalStartDate] = useState("");
  const [evalEndDate, setEvalEndDate] = useState("");
  const [evalNotes, setEvalNotes] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await gamificationService.getConfig();

      // Populate form
      setEvaluationPeriod(data.evaluationPeriod);
      setCustomPeriodDays(data.customPeriodDays || 30);
      setTopPerformerBonus(data.topPerformerBonus);
      setSecondPlaceBonus(data.secondPlaceBonus);
      setThirdPlaceBonus(data.thirdPlaceBonus);
      setPointsPerSale(data.pointsPerSale);
      setPointsPerPeso(data.pointsPerPeso);
      setSalesTargets(data.salesTargets);
    } catch (error) {
      console.error("Error loading config:", error);
      alert("Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await gamificationService.updateConfig({
        evaluationPeriod: evaluationPeriod as
          | "daily"
          | "weekly"
          | "biweekly"
          | "monthly"
          | "custom",
        customPeriodDays,
        topPerformerBonus,
        secondPlaceBonus,
        thirdPlaceBonus,
        pointsPerSale,
        pointsPerPeso,
        salesTargets,
      });
      alert("Configuración guardada correctamente");
      loadConfig();
    } catch (error) {
      console.error("Error saving config:", error);
      alert("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleEvaluatePeriod = async () => {
    if (!evalStartDate || !evalEndDate) {
      alert("Por favor, selecciona las fechas del periodo");
      return;
    }

    if (new Date(evalStartDate) > new Date(evalEndDate)) {
      alert("La fecha de inicio debe ser anterior a la fecha de fin");
      return;
    }

    try {
      setEvaluating(true);
      const result = await gamificationService.evaluatePeriod({
        startDate: evalStartDate,
        endDate: evalEndDate,
        notes: evalNotes,
      });
      alert(`Periodo evaluado. Ganador: ${result.winner.winnerName}`);
      setEvalStartDate("");
      setEvalEndDate("");
      setEvalNotes("");
    } catch (error: any) {
      console.error("Error evaluating period:", error);
      alert(error.response?.data?.message || "Error al evaluar el periodo");
    } finally {
      setEvaluating(false);
    }
  };

  const addSalesTarget = () => {
    setSalesTargets([
      ...salesTargets,
      { level: "", minAmount: 0, bonus: 0, badge: "⭐" },
    ]);
  };

  const removeSalesTarget = (index: number) => {
    setSalesTargets(salesTargets.filter((_, i) => i !== index));
  };

  const updateSalesTarget = (
    index: number,
    field: keyof SalesTarget,
    value: string | number
  ) => {
    const updated = [...salesTargets];
    updated[index] = { ...updated[index], [field]: value };
    setSalesTargets(updated);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-gray-200">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold text-white">
        ⚙️ Configuración de Gamificación
      </h1>

      {/* Periodo de Evaluación */}
      <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-2xl font-semibold text-white">
          Periodo de Evaluación
        </h2>

        <div className="mb-4">
          <label className="mb-2 block font-medium text-gray-300">
            Tipo de Periodo
          </label>
          <select
            value={evaluationPeriod}
            onChange={e => setEvaluationPeriod(e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quincenal</option>
            <option value="monthly">Mensual</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        {evaluationPeriod === "custom" && (
          <div className="mb-4">
            <label className="mb-2 block font-medium text-gray-300">
              Días del Periodo Personalizado
            </label>
            <input
              type="number"
              min="1"
              value={customPeriodDays}
              onChange={e => setCustomPeriodDays(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Bonos */}
      <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-2xl font-semibold text-white">
          💰 Bonos por Posición
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block font-medium text-gray-300">
              🥇 Primer Lugar
            </label>
            <input
              type="number"
              value={topPerformerBonus}
              onChange={e => setTopPerformerBonus(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-300">
              🥈 Segundo Lugar
            </label>
            <input
              type="number"
              value={secondPlaceBonus}
              onChange={e => setSecondPlaceBonus(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-300">
              🥉 Tercer Lugar
            </label>
            <input
              type="number"
              value={thirdPlaceBonus}
              onChange={e => setThirdPlaceBonus(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Sistema de Puntos */}
      <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-2xl font-semibold text-white">
          ⭐ Sistema de Puntos
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block font-medium text-gray-300">
              Puntos por Venta
            </label>
            <input
              type="number"
              value={pointsPerSale}
              onChange={e => setPointsPerSale(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-300">
              Puntos por Peso
            </label>
            <input
              type="number"
              step="0.001"
              value={pointsPerPeso}
              onChange={e => setPointsPerPeso(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Metas de Ventas */}
      <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-2xl font-semibold text-white">
          🎯 Metas de Ventas
        </h2>

        {salesTargets.map((target, index) => (
          <div
            key={index}
            className="mb-4 grid grid-cols-1 gap-4 rounded border border-gray-800 p-4 md:grid-cols-5"
          >
            <div>
              <label className="mb-1 block text-sm text-gray-300">Nivel</label>
              <input
                type="text"
                value={target.level}
                onChange={e =>
                  updateSalesTarget(index, "level", e.target.value)
                }
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="Bronce"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">
                Monto Mínimo
              </label>
              <input
                type="number"
                value={target.minAmount}
                onChange={e =>
                  updateSalesTarget(index, "minAmount", Number(e.target.value))
                }
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">Bono</label>
              <input
                type="number"
                value={target.bonus}
                onChange={e =>
                  updateSalesTarget(index, "bonus", Number(e.target.value))
                }
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">Badge</label>
              <input
                type="text"
                value={target.badge}
                onChange={e =>
                  updateSalesTarget(index, "badge", e.target.value)
                }
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="🥉"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => removeSalesTarget(index)}
                className="w-full rounded bg-red-500 px-3 py-2 text-sm text-white hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addSalesTarget}
          className="mt-2 rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600"
        >
          + Agregar Meta
        </button>
      </div>

      {/* Guardar Configuración */}
      <div className="mb-8 flex justify-end">
        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? "Guardando..." : "💾 Guardar Configuración"}
        </button>
      </div>

      {/* Evaluación Manual */}
      <div className="bg-linear-to-r rounded-lg from-purple-500 to-indigo-600 p-6 text-white shadow-md">
        <h2 className="mb-4 text-2xl font-semibold">
          🏆 Evaluar Periodo Manualmente
        </h2>
        <p className="mb-4 opacity-90">
          Calcula el ganador del periodo y asigna bonos automáticamente
        </p>

        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block font-medium">Fecha de Inicio</label>
            <input
              type="date"
              value={evalStartDate}
              onChange={e => setEvalStartDate(e.target.value)}
              className="w-full rounded-md border border-white/20 bg-white/10 px-4 py-2 text-white focus:ring-2 focus:ring-white"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">Fecha de Fin</label>
            <input
              type="date"
              value={evalEndDate}
              onChange={e => setEvalEndDate(e.target.value)}
              className="w-full rounded-md border border-white/20 bg-white/10 px-4 py-2 text-white focus:ring-2 focus:ring-white"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-2 block font-medium">Notas (Opcional)</label>
          <textarea
            value={evalNotes}
            onChange={e => setEvalNotes(e.target.value)}
            className="w-full rounded-md border border-white/20 bg-white/10 px-4 py-2 text-white focus:ring-2 focus:ring-white"
            rows={3}
            placeholder="Notas sobre este periodo..."
          />
        </div>

        <button
          onClick={handleEvaluatePeriod}
          disabled={evaluating}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/50"
        >
          {evaluating ? "Evaluando..." : "🚀 Evaluar Periodo"}
        </button>
      </div>
    </div>
  );
};

export default GamificationConfigPage;
