import { useEffect, useState } from "react";
import type {
  ActiveMultiplier,
  LevelConfig,
  SalesTarget,
} from "../../analytics/types/gamification.types";
import { gamificationService } from "../../common/services";

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
  const [top1CommissionBonus, setTop1CommissionBonus] = useState<number>(5);
  const [top2CommissionBonus, setTop2CommissionBonus] = useState<number>(3);
  const [top3CommissionBonus, setTop3CommissionBonus] = useState<number>(1);
  const [minAdminProfitForRanking, setMinAdminProfitForRanking] =
    useState<number>(0);
  const [currentPeriodStart, setCurrentPeriodStart] = useState<string>("");
  const [pointsPerSale, setPointsPerSale] = useState<number>(10);
  const [pointsPerPeso, setPointsPerPeso] = useState<number>(0.01);
  const [salesTargets, setSalesTargets] = useState<SalesTarget[]>([]);
  const [pointsPerCurrencyUnit, setPointsPerCurrencyUnit] =
    useState<number>(0.001);
  const [pointsPerSaleConfirmed, setPointsPerSaleConfirmed] =
    useState<number>(10);
  const [penaltyPerDayLate, setPenaltyPerDayLate] = useState<number>(5);
  const [pointsBase, setPointsBase] = useState<"sale" | "commission">("sale");
  const [baseCommissionPercentage, setBaseCommissionPercentage] =
    useState<number>(20);
  const [baseCommissionInitial, setBaseCommissionInitial] = useState<
    number | null
  >(null);
  const [levels, setLevels] = useState<LevelConfig[]>([]);
  const [activeMultipliers, setActiveMultipliers] = useState<
    ActiveMultiplier[]
  >([]);
  const [cycleDuration, setCycleDuration] = useState<string>("monthly");
  const [cycleCustomDays, setCycleCustomDays] = useState<number>(30);
  const [resetPolicyType, setResetPolicyType] = useState<string>("reset");
  const [resetCarryPercent, setResetCarryPercent] = useState<number>(0);

  // Evaluation form
  const [evalStartDate, setEvalStartDate] = useState("");
  const [evalEndDate, setEvalEndDate] = useState("");
  const [evalNotes, setEvalNotes] = useState("");

  const sampleRevenue = 1000000;
  const pointsPerThousand = (pointsPerCurrencyUnit || 0) * 1000;
  const commissionBaseAmount =
    (sampleRevenue * (baseCommissionPercentage || 0)) / 100;
  const pointsBaseAmount =
    pointsBase === "commission" ? commissionBaseAmount : sampleRevenue;
  const pointsFromCurrency = pointsBaseAmount * (pointsPerCurrencyUnit || 0);
  const pointsFromSaleConfirmed = pointsPerSaleConfirmed || 0;
  const pointsFromSaleLegacy = pointsPerSale || 0;
  const pointsFromPesoLegacy = sampleRevenue * (pointsPerPeso || 0);
  const estimatedRuleTotal = pointsFromCurrency + pointsFromSaleConfirmed;
  const estimatedLegacyTotal = pointsFromPesoLegacy + pointsFromSaleLegacy;

  const sortedLevels = [...levels].sort(
    (a, b) => (a.minPoints || 0) - (b.minPoints || 0)
  );
  const nextLevel = sortedLevels.find(level => (level.minPoints || 0) > 0);

  const warnings: string[] = [];
  if (
    (pointsPerCurrencyUnit || 0) <= 0 &&
    (pointsPerSaleConfirmed || 0) <= 0 &&
    (pointsPerSale || 0) <= 0 &&
    (pointsPerPeso || 0) <= 0
  ) {
    warnings.push("No hay reglas de puntos activas.");
  }
  if ((pointsPerCurrencyUnit || 0) > 0.01) {
    warnings.push("Puntos por $1 muy alto: revisa el factor.");
  }
  if ((pointsPerSaleConfirmed || 0) > 200) {
    warnings.push("Puntos por venta confirmada muy alto.");
  }
  if ((penaltyPerDayLate || 0) > (pointsPerSaleConfirmed || 0)) {
    warnings.push("Penalizacion diaria supera puntos por venta.");
  }
  if (
    (pointsPerCurrencyUnit || 0) > 0 &&
    ((pointsPerSale || 0) > 0 || (pointsPerPeso || 0) > 0)
  ) {
    warnings.push("Se estan sumando reglas base y motor avanzado.");
  }
  if (resetPolicyType === "carry" && resetCarryPercent > 80) {
    warnings.push("Reset con carry alto: puede inflar el ranking.");
  }
  if ((baseCommissionPercentage || 0) <= 0) {
    warnings.push("Comision base en 0: employees sin ganancia.");
  }
  if ((baseCommissionPercentage || 0) > 50) {
    warnings.push("Comision base alta: revisa la rentabilidad.");
  }
  if (
    baseCommissionInitial !== null &&
    baseCommissionPercentage !== baseCommissionInitial
  ) {
    warnings.push(
      "Comision base cambiada: el precio employee se recalcula por precio cliente si no hay override manual."
    );
  }
  for (let i = 1; i < sortedLevels.length; i += 1) {
    if (
      (sortedLevels[i].minPoints || 0) <= (sortedLevels[i - 1].minPoints || 0)
    ) {
      warnings.push("Los niveles deben tener puntos minimos crecientes.");
      break;
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await gamificationService.getConfig();

      // Populate form
      setEvaluationPeriod(data.evaluationPeriod || "monthly");
      setCustomPeriodDays(data.customPeriodDays || 30);
      setTopPerformerBonus(data.topPerformerBonus ?? 1000);
      setSecondPlaceBonus(data.secondPlaceBonus ?? 500);
      setThirdPlaceBonus(data.thirdPlaceBonus ?? 250);
      setTop1CommissionBonus(data.top1CommissionBonus ?? 5);
      setTop2CommissionBonus(data.top2CommissionBonus ?? 3);
      setTop3CommissionBonus(data.top3CommissionBonus ?? 1);
      setMinAdminProfitForRanking(data.minAdminProfitForRanking ?? 0);
      setCurrentPeriodStart(
        data.currentPeriodStart ? data.currentPeriodStart.slice(0, 10) : ""
      );
      setPointsPerSale(data.pointsPerSale ?? 10);
      setPointsPerPeso(data.pointsPerPeso ?? 0.01);
      setSalesTargets(data.salesTargets || []);
      setPointsPerCurrencyUnit(
        data.generalRules?.pointsPerCurrencyUnit ?? 0.001
      );
      setPointsPerSaleConfirmed(
        data.generalRules?.pointsPerSaleConfirmed ?? 10
      );
      setPenaltyPerDayLate(data.generalRules?.penaltyPerDayLate ?? 5);
      setPointsBase(data.generalRules?.pointsBase || "sale");
      const baseCommission = data.baseCommissionPercentage ?? 20;
      setBaseCommissionPercentage(baseCommission);
      setBaseCommissionInitial(baseCommission);
      setLevels(data.levels || []);
      setActiveMultipliers(data.activeMultipliers || []);
      setCycleDuration(data.cycle?.duration || "monthly");
      setCycleCustomDays(data.cycle?.customDays || 30);
      setResetPolicyType(data.resetPolicy?.type || "reset");
      setResetCarryPercent(data.resetPolicy?.carryPercent ?? 0);
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
      const baseCommissionChanged =
        baseCommissionInitial !== null &&
        baseCommissionPercentage !== baseCommissionInitial;
      await gamificationService.updateConfig({
        generalRules: {
          pointsPerCurrencyUnit,
          pointsPerSaleConfirmed,
          penaltyPerDayLate,
          pointsBase,
        },
        baseCommissionPercentage,
        levels,
        activeMultipliers,
        cycle: {
          duration: cycleDuration as
            | "monthly"
            | "quarterly"
            | "annual"
            | "infinite"
            | "custom",
          customDays: cycleCustomDays,
        },
        resetPolicy: {
          type: resetPolicyType as "reset" | "carry" | "downlevel",
          carryPercent: resetCarryPercent,
        },
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
        top1CommissionBonus,
        top2CommissionBonus,
        top3CommissionBonus,
        minAdminProfitForRanking,
        currentPeriodStart: currentPeriodStart
          ? new Date(currentPeriodStart).toISOString()
          : undefined,
        pointsPerSale,
        pointsPerPeso,
        salesTargets,
      });
      await gamificationService.recalculatePoints();
      if (baseCommissionChanged) {
        alert(
          "Comision base cambiada: el precio employee se recalcula por precio cliente si no hay override manual."
        );
      } else {
        alert("Configuración guardada correctamente");
      }
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

  const addLevel = () => {
    const nextId = Math.max(0, ...levels.map(level => level.id)) + 1;
    setLevels([
      ...levels,
      {
        id: nextId,
        name: "",
        minPoints: 0,
        benefits: { commissionBonus: 0, discountBonus: 0 },
      },
    ]);
  };

  const updateLevel = (
    index: number,
    field: "name" | "minPoints" | "commissionBonus" | "discountBonus",
    value: string | number
  ) => {
    const updated = [...levels];
    const current = updated[index];
    if (!current) return;
    if (field === "name" || field === "minPoints") {
      updated[index] = { ...current, [field]: value } as any;
    } else {
      updated[index] = {
        ...current,
        benefits: {
          ...current.benefits,
          [field === "commissionBonus" ? "commissionBonus" : "discountBonus"]:
            value,
        },
      };
    }
    setLevels(updated);
  };

  const removeLevel = (index: number) => {
    setLevels(levels.filter((_, i) => i !== index));
  };

  const addMultiplier = () => {
    setActiveMultipliers([
      ...activeMultipliers,
      {
        type: "custom",
        targetType: "all",
        targetId: "",
        value: 1,
        active: true,
      },
    ]);
  };

  const updateMultiplier = (
    index: number,
    field: keyof ActiveMultiplier,
    value: string | number | boolean
  ) => {
    const updated = [...activeMultipliers];
    updated[index] = { ...updated[index], [field]: value } as ActiveMultiplier;
    setActiveMultipliers(updated);
  };

  const removeMultiplier = (index: number) => {
    setActiveMultipliers(activeMultipliers.filter((_, i) => i !== index));
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          ⚙️ Configuración de Gamificación
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          Define como se calculan los puntos, los rankings y los incentivos.
          Cambios aqui afectan el desempeño de employees en tiempo real.
        </p>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-cyan-500/40 bg-cyan-900/20 p-4">
          <p className="text-xs uppercase text-cyan-200">Paso 1</p>
          <p className="mt-1 text-sm font-semibold text-white">
            Define el periodo
          </p>
          <p className="mt-1 text-xs text-cyan-100/80">
            Ajusta la ventana de ranking y el inicio actual.
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/40 bg-amber-900/20 p-4">
          <p className="text-xs uppercase text-amber-200">Paso 2</p>
          <p className="mt-1 text-sm font-semibold text-white">
            Configura puntos y bonos
          </p>
          <p className="mt-1 text-xs text-amber-100/80">
            Reglas de puntos, bonos por posicion y penalizaciones.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-900/20 p-4">
          <p className="text-xs uppercase text-emerald-200">Paso 3</p>
          <p className="mt-1 text-sm font-semibold text-white">
            Ajusta niveles y metas
          </p>
          <p className="mt-1 text-xs text-emerald-100/80">
            Rangos, multiplicadores y metas de ventas.
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-blue-500/40 bg-blue-900/20 p-4">
          <p className="text-xs uppercase text-blue-200">Resumen rapido</p>
          <p className="mt-1 text-sm font-semibold text-white">
            Estimado por $1,000,000
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {Math.round(estimatedRuleTotal).toLocaleString()} pts
          </p>
          <p className="mt-1 text-xs text-blue-100/80">
            Motor reglas ({pointsBase === "commission" ? "comision" : "venta"}):{" "}
            {pointsFromCurrency.toFixed(0)} por monto +{" "}
            {pointsFromSaleConfirmed.toFixed(0)} por venta.
          </p>
          <p className="mt-1 text-xs text-blue-100/70">
            Sistema base: {Math.round(estimatedLegacyTotal)} pts.
          </p>
          <p className="mt-1 text-xs text-blue-100/70">
            Base comision: {baseCommissionPercentage}%.
          </p>
        </div>
        <div className="rounded-xl border border-purple-500/40 bg-purple-900/20 p-4">
          <p className="text-xs uppercase text-purple-200">Proximo nivel</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {nextLevel ? nextLevel.name : "Sin niveles"}
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {nextLevel ? `${nextLevel.minPoints} pts` : "-"}
          </p>
          <p className="mt-1 text-xs text-purple-100/80">
            Ajusta los niveles si quieres una progresion mas corta.
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/40 bg-amber-900/20 p-4">
          <p className="text-xs uppercase text-amber-200">Alertas</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {warnings.length ? "Revisa estos puntos" : "Sin alertas"}
          </p>
          <div className="mt-2 space-y-1 text-xs text-amber-100/90">
            {warnings.length ? (
              warnings.map((warning, index) => (
                <div key={index}>• {warning}</div>
              ))
            ) : (
              <div>Todo parece consistente.</div>
            )}
          </div>
          <p className="mt-3 text-xs text-amber-100/70">
            Tip: para 2 puntos por cada $1000, usa 0.002 en "Puntos por $1".
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-teal-500/40 bg-teal-900/20 p-6">
        <h2 className="text-2xl font-semibold text-white">
          Comision Base del Employee
        </h2>
        <p className="mt-2 text-sm text-teal-100/80">
          Este porcentaje define la ganancia base del employee y afecta el
          POS, el calculo del "A entregar al admin" y la comision reportada.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block font-medium text-teal-100">
              Comision base (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={baseCommissionPercentage}
              onChange={e =>
                setBaseCommissionPercentage(Number(e.target.value))
              }
              className="w-full rounded-md border border-teal-400/40 bg-teal-950/40 px-4 py-2 text-white focus:ring-2 focus:ring-teal-400"
            />
            <p className="mt-1 text-xs text-teal-100/70">
              Ej: 25 = comision base del 25%.
            </p>
          </div>
          <div className="rounded-lg border border-teal-400/20 bg-teal-950/30 p-4 text-xs text-teal-100/80">
            Si activas bonos por ranking, se suman automaticamente sobre esta
            base. Ej: base 25% + bono 2.5% = 27.5%.
          </div>
        </div>
      </div>

      {/* Periodo de Evaluación */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/80 p-6">
        <h2 className="text-2xl font-semibold text-white">
          Periodo de Evaluacion
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Controla la ventana que se usa para el ranking y la evaluacion.
        </p>

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
          <p className="mt-1 text-xs text-gray-400">
            Selecciona con que frecuencia se reinicia el ranking.
          </p>
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
            <p className="mt-1 text-xs text-gray-400">
              Define cuantos dias durara cada ciclo.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block font-medium text-gray-300">
              Inicio del periodo actual
            </label>
            <input
              type="date"
              value={currentPeriodStart}
              onChange={e => setCurrentPeriodStart(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Para alinear el rango con el deploy (ej. 2025-12-27).
            </p>
          </div>
          <div>
            <label className="mb-2 block font-medium text-gray-300">
              Ganancia mínima admin para entrar al ranking
            </label>
            <input
              type="number"
              min="0"
              value={minAdminProfitForRanking}
              onChange={e =>
                setMinAdminProfitForRanking(Number(e.target.value))
              }
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Evita rankings con ventas demasiado bajas.
            </p>
          </div>
        </div>
      </div>

      {/* Bonos */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/80 p-6">
        <h2 className="text-2xl font-semibold text-white">
          💰 Bonos por Posicion
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Premia a los mejores employees del periodo.
        </p>

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
            <p className="mt-1 text-xs text-gray-400">
              Bono fijo para el lider del ranking.
            </p>
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
            <p className="mt-1 text-xs text-gray-400">
              Reconocimiento para el segundo lugar.
            </p>
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
            <p className="mt-1 text-xs text-gray-400">
              Incentivo para el tercer lugar.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block font-medium text-gray-300">
              % Extra 1er Lugar
            </label>
            <input
              type="number"
              value={top1CommissionBonus}
              onChange={e => setTop1CommissionBonus(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Incremento temporal de comision.
            </p>
          </div>
          <div>
            <label className="mb-2 block font-medium text-gray-300">
              % Extra 2do Lugar
            </label>
            <input
              type="number"
              value={top2CommissionBonus}
              onChange={e => setTop2CommissionBonus(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Se suma a la comision base.
            </p>
          </div>
          <div>
            <label className="mb-2 block font-medium text-gray-300">
              % Extra 3er Lugar
            </label>
            <input
              type="number"
              value={top3CommissionBonus}
              onChange={e => setTop3CommissionBonus(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Ideal para mantener competicion sana.
            </p>
          </div>
        </div>
      </div>

      {/* Sistema de Puntos */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/80 p-6">
        <h2 className="text-2xl font-semibold text-white">
          ⭐ Sistema de Puntos
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Reglas simples para sumar puntos por cada venta.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Este bloque es el sistema base. El motor avanzado esta en "Motor de
          Reglas".
        </p>

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
            <p className="mt-1 text-xs text-gray-400">
              Puntos fijos por cada venta confirmada.
            </p>
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
            <p className="mt-1 text-xs text-gray-400">
              Refuerza el ticket promedio con un extra variable.
            </p>
          </div>
        </div>
      </div>

      {/* Motor de Reglas */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/80 p-6">
        <h2 className="text-2xl font-semibold text-white">
          🧮 Motor de Reglas
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Parametros avanzados para ajustar el calculo de puntos.
        </p>
        <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-900/20 p-4">
          <p className="text-sm font-semibold text-white">
            Atajo: puntos por cada $1000
          </p>
          <p className="mt-1 text-xs text-blue-100/80">
            Define aqui cuantos puntos quieres por cada $1000 vendidos.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-blue-100">
                Puntos por $1000
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={Number(pointsPerThousand.toFixed(3))}
                onChange={e =>
                  setPointsPerCurrencyUnit(Number(e.target.value) / 1000)
                }
                className="w-full rounded border border-blue-400/40 bg-blue-950/40 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-blue-100">
                Equivalente en Puntos por $1
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={Number(pointsPerCurrencyUnit.toFixed(6))}
                onChange={e => setPointsPerCurrencyUnit(Number(e.target.value))}
                className="w-full rounded border border-blue-400/40 bg-blue-950/40 px-3 py-2 text-sm text-white"
              />
              <p className="mt-1 text-xs text-blue-100/70">
                Ej: 0.002 = 2 puntos por cada $1000.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block font-medium text-gray-300">
              Base para puntos porcentuales
            </label>
            <select
              value={pointsBase}
              onChange={e =>
                setPointsBase(e.target.value as "sale" | "commission")
              }
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="sale">Venta total</option>
              <option value="commission">Comision del employee</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Si eliges comision, los puntos se calculan sobre la ganancia base.
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 text-xs text-gray-300">
            Consejo: usa "Comision" si quieres que el esfuerzo se mida por
            margen y no por volumen.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block font-medium text-gray-300">
              Puntos por $1 (unidad)
            </label>
            <input
              type="number"
              step="0.0001"
              value={pointsPerCurrencyUnit}
              onChange={e => setPointsPerCurrencyUnit(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Ej: 0.002 = 2 puntos por cada 1000.
            </p>
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-300">
              Puntos por venta confirmada
            </label>
            <input
              type="number"
              value={pointsPerSaleConfirmed}
              onChange={e => setPointsPerSaleConfirmed(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Se suma cuando la venta queda confirmada.
            </p>
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-300">
              Penalizacion por dia de mora
            </label>
            <input
              type="number"
              value={penaltyPerDayLate}
              onChange={e => setPenaltyPerDayLate(Number(e.target.value))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Resta puntos si hay pagos atrasados.
            </p>
          </div>
        </div>
      </div>

      {/* Niveles */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/80 p-6">
        <h2 className="text-2xl font-semibold text-white">
          🧗 Niveles y Rangos
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Define como crecen los employees y que beneficios obtienen.
        </p>

        {levels.map((level, index) => (
          <div
            key={level.id}
            className="mb-4 grid grid-cols-1 gap-4 rounded-lg border border-gray-800 bg-gray-950/40 p-4 md:grid-cols-5"
          >
            <div>
              <label className="mb-1 block text-sm text-gray-300">Nombre</label>
              <input
                type="text"
                value={level.name}
                onChange={e => updateLevel(index, "name", e.target.value)}
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="Espartano"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300">
                Puntos minimos
              </label>
              <input
                type="number"
                value={level.minPoints}
                onChange={e =>
                  updateLevel(index, "minPoints", Number(e.target.value))
                }
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              />
              <p className="mt-1 text-xs text-gray-500">
                Desde cuantos puntos se activa este nivel.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300">
                % Comision extra
              </label>
              <input
                type="number"
                step="0.1"
                value={level.benefits?.commissionBonus || 0}
                onChange={e =>
                  updateLevel(index, "commissionBonus", Number(e.target.value))
                }
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              />
              <p className="mt-1 text-xs text-gray-500">
                Se suma a la comision base del employee.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300">
                % Descuento compra
              </label>
              <input
                type="number"
                step="0.1"
                value={level.benefits?.discountBonus || 0}
                onChange={e =>
                  updateLevel(index, "discountBonus", Number(e.target.value))
                }
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              />
              <p className="mt-1 text-xs text-gray-500">
                Descuento aplicado a compras internas.
              </p>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => removeLevel(index)}
                className="w-full rounded bg-red-500/90 px-3 py-2 text-sm text-white hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addLevel}
          className="mt-2 rounded bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600"
        >
          + Agregar Nivel
        </button>
      </div>

      {/* Multiplicadores */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/80 p-6">
        <h2 className="text-2xl font-semibold text-white">
          ⚡ Multiplicadores Activos
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Aumenta puntos por categoria, producto o eventos especiales.
        </p>

        {activeMultipliers.map((multiplier, index) => (
          <div
            key={index}
            className="mb-4 grid grid-cols-1 gap-4 rounded-lg border border-gray-800 bg-gray-950/40 p-4 md:grid-cols-5"
          >
            <div>
              <label className="mb-1 block text-sm text-gray-300">Tipo</label>
              <select
                value={multiplier.type}
                onChange={e => updateMultiplier(index, "type", e.target.value)}
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              >
                <option value="custom">custom</option>
                <option value="weekend">weekend</option>
                <option value="category">category</option>
                <option value="product">product</option>
                <option value="all">all</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Define el origen del multiplicador.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300">Target</label>
              <select
                value={multiplier.targetType || "all"}
                onChange={e =>
                  updateMultiplier(index, "targetType", e.target.value)
                }
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              >
                <option value="all">all</option>
                <option value="weekend">weekend</option>
                <option value="category">category</option>
                <option value="product">product</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Indica el tipo de objetivo.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300">
                Target ID
              </label>
              <input
                type="text"
                value={multiplier.targetId || ""}
                onChange={e =>
                  updateMultiplier(index, "targetId", e.target.value)
                }
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder="ID producto o categoria"
              />
              <p className="mt-1 text-xs text-gray-500">
                Dejalo vacio si aplica a todos.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300">Valor</label>
              <input
                type="number"
                step="0.1"
                value={multiplier.value}
                onChange={e =>
                  updateMultiplier(index, "value", Number(e.target.value))
                }
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              />
              <p className="mt-1 text-xs text-gray-500">
                Ej: 1.5 = 50% mas puntos.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() =>
                  updateMultiplier(index, "active", !multiplier.active)
                }
                className="w-full rounded bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600"
              >
                {multiplier.active ? "Activo" : "Inactivo"}
              </button>
              <button
                onClick={() => removeMultiplier(index)}
                className="w-full rounded bg-red-500/90 px-3 py-2 text-sm text-white hover:bg-red-600"
              >
                X
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addMultiplier}
          className="mt-2 rounded bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600"
        >
          + Agregar Multiplicador
        </button>
      </div>

      {/* Ciclos y Reset */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/80 p-6">
        <h2 className="text-2xl font-semibold text-white">⏳ Ciclos y Reset</h2>
        <p className="mt-2 text-sm text-gray-400">
          Decide cada cuanto reiniciar puntos y que porcentaje se conserva.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block font-medium text-gray-300">
              Duracion del torneo
            </label>
            <select
              value={cycleDuration}
              onChange={e => setCycleDuration(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
              <option value="annual">Anual</option>
              <option value="infinite">Infinito</option>
              <option value="custom">Personalizado</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Controla cada cuanto se reinicia el ciclo.
            </p>
          </div>

          {cycleDuration === "custom" && (
            <div>
              <label className="mb-2 block font-medium text-gray-300">
                Dias personalizados
              </label>
              <input
                type="number"
                min="1"
                value={cycleCustomDays}
                onChange={e => setCycleCustomDays(Number(e.target.value))}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Usa esta opcion si tienes ciclos especiales.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block font-medium text-gray-300">
              Politica de reset
            </label>
            <select
              value={resetPolicyType}
              onChange={e => setResetPolicyType(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="reset">Reset a 0</option>
              <option value="carry">Mantener %</option>
              <option value="downlevel">Bajar nivel</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Define como quedan los puntos al iniciar un nuevo ciclo.
            </p>
          </div>

          {resetPolicyType === "carry" && (
            <div>
              <label className="mb-2 block font-medium text-gray-300">
                % que se mantiene
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={resetCarryPercent}
                onChange={e => setResetCarryPercent(Number(e.target.value))}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Ej: 30 = conserva el 30% del puntaje.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Metas de Ventas */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/80 p-6">
        <h2 className="text-2xl font-semibold text-white">
          🎯 Metas de Ventas
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Bonificaciones por cumplir metas de facturacion.
        </p>

        {salesTargets.map((target, index) => (
          <div
            key={index}
            className="mb-4 grid grid-cols-1 gap-4 rounded-lg border border-gray-800 bg-gray-950/40 p-4 md:grid-cols-5"
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
              <p className="mt-1 text-xs text-gray-500">
                Nombre visible de la meta.
              </p>
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
              <p className="mt-1 text-xs text-gray-500">
                Ventas requeridas para activar el bono.
              </p>
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
              <p className="mt-1 text-xs text-gray-500">
                Bono fijo por lograr la meta.
              </p>
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
              <p className="mt-1 text-xs text-gray-500">
                Icono que se muestra al employee.
              </p>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => removeSalesTarget(index)}
                className="w-full rounded bg-red-500/90 px-3 py-2 text-sm text-white hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addSalesTarget}
          className="mt-2 rounded bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600"
        >
          + Agregar Meta
        </button>
      </div>

      {/* Guardar Configuración */}
      <div className="mb-8 rounded-xl border border-blue-500/40 bg-blue-900/20 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-white">
              Guardar configuracion
            </p>
            <p className="text-sm text-blue-100/80">
              Al guardar se recalculan los puntos con la nueva configuracion.
            </p>
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? "Guardando..." : "💾 Guardar Configuracion"}
          </button>
        </div>
      </div>

      {/* Evaluación Manual */}
      <div className="bg-linear-to-r rounded-xl from-slate-800 to-slate-700 p-6 text-white shadow-md">
        <h2 className="text-2xl font-semibold">
          🏆 Evaluar Periodo Manualmente
        </h2>
        <p className="mb-4 mt-2 text-sm text-slate-200/80">
          Calcula el ganador del periodo y asigna bonos automaticamente.
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
            <p className="mt-1 text-xs text-slate-200/80">
              Usa el mismo rango que el periodo configurado.
            </p>
          </div>

          <div>
            <label className="mb-2 block font-medium">Fecha de Fin</label>
            <input
              type="date"
              value={evalEndDate}
              onChange={e => setEvalEndDate(e.target.value)}
              className="w-full rounded-md border border-white/20 bg-white/10 px-4 py-2 text-white focus:ring-2 focus:ring-white"
            />
            <p className="mt-1 text-xs text-slate-200/80">
              Solo se consideran ventas confirmadas.
            </p>
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
