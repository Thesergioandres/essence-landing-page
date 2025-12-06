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
        evaluationPeriod: evaluationPeriod as "daily" | "weekly" | "biweekly" | "monthly" | "custom",
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

  const updateSalesTarget = (index: number, field: keyof SalesTarget, value: string | number) => {
    const updated = [...salesTargets];
    updated[index] = { ...updated[index], [field]: value };
    setSalesTargets(updated);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">⚙️ Configuración de Gamificación</h1>

      {/* Periodo de Evaluación */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-2xl font-semibold mb-4">Periodo de Evaluación</h2>

        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">
            Tipo de Periodo
          </label>
          <select
            value={evaluationPeriod}
            onChange={(e) => setEvaluationPeriod(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-gray-700 font-medium mb-2">
              Días del Periodo Personalizado
            </label>
            <input
              type="number"
              min="1"
              value={customPeriodDays}
              onChange={(e) => setCustomPeriodDays(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Bonos */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-2xl font-semibold mb-4">💰 Bonos por Posición</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              🥇 Primer Lugar
            </label>
            <input
              type="number"
              value={topPerformerBonus}
              onChange={(e) => setTopPerformerBonus(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              🥈 Segundo Lugar
            </label>
            <input
              type="number"
              value={secondPlaceBonus}
              onChange={(e) => setSecondPlaceBonus(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              🥉 Tercer Lugar
            </label>
            <input
              type="number"
              value={thirdPlaceBonus}
              onChange={(e) => setThirdPlaceBonus(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Sistema de Puntos */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-2xl font-semibold mb-4">⭐ Sistema de Puntos</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Puntos por Venta
            </label>
            <input
              type="number"
              value={pointsPerSale}
              onChange={(e) => setPointsPerSale(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Puntos por Peso
            </label>
            <input
              type="number"
              step="0.001"
              value={pointsPerPeso}
              onChange={(e) => setPointsPerPeso(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Metas de Ventas */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-2xl font-semibold mb-4">🎯 Metas de Ventas</h2>

        {salesTargets.map((target, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 border border-gray-200 rounded">
            <div>
              <label className="block text-gray-700 text-sm mb-1">Nivel</label>
              <input
                type="text"
                value={target.level}
                onChange={(e) => updateSalesTarget(index, "level", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="Bronce"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm mb-1">Monto Mínimo</label>
              <input
                type="number"
                value={target.minAmount}
                onChange={(e) => updateSalesTarget(index, "minAmount", Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm mb-1">Bono</label>
              <input
                type="number"
                value={target.bonus}
                onChange={(e) => updateSalesTarget(index, "bonus", Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm mb-1">Badge</label>
              <input
                type="text"
                value={target.badge}
                onChange={(e) => updateSalesTarget(index, "badge", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="🥉"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => removeSalesTarget(index)}
                className="w-full px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addSalesTarget}
          className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          + Agregar Meta
        </button>
      </div>

      {/* Guardar Configuración */}
      <div className="flex justify-end mb-8">
        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? "Guardando..." : "💾 Guardar Configuración"}
        </button>
      </div>

      {/* Evaluación Manual */}
      <div className="bg-linear-to-r from-purple-500 to-indigo-600 p-6 rounded-lg shadow-md text-white">
        <h2 className="text-2xl font-semibold mb-4">🏆 Evaluar Periodo Manualmente</h2>
        <p className="mb-4 opacity-90">
          Calcula el ganador del periodo y asigna bonos automáticamente
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block font-medium mb-2">Fecha de Inicio</label>
            <input
              type="date"
              value={evalStartDate}
              onChange={(e) => setEvalStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-white rounded-md text-gray-900 focus:ring-2 focus:ring-white"
            />
          </div>

          <div>
            <label className="block font-medium mb-2">Fecha de Fin</label>
            <input
              type="date"
              value={evalEndDate}
              onChange={(e) => setEvalEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-white rounded-md text-gray-900 focus:ring-2 focus:ring-white"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block font-medium mb-2">Notas (Opcional)</label>
          <textarea
            value={evalNotes}
            onChange={(e) => setEvalNotes(e.target.value)}
            className="w-full px-4 py-2 border border-white rounded-md text-gray-900 focus:ring-2 focus:ring-white"
            rows={3}
            placeholder="Notas sobre este periodo..."
          />
        </div>

        <button
          onClick={handleEvaluatePeriod}
          disabled={evaluating}
          className="w-full px-6 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:bg-gray-100 disabled:bg-gray-300 disabled:text-gray-600"
        >
          {evaluating ? "Evaluando..." : "🚀 Evaluar Periodo"}
        </button>
      </div>
    </div>
  );
};

export default GamificationConfigPage;
