import mongoose from "mongoose";
import Credit from "../models/Credit.js";
import DistributorStats from "../models/DistributorStats.js";
import GamificationConfig from "../models/GamificationConfig.js";
import Membership from "../models/Membership.js";
import PeriodWinner from "../models/PeriodWinner.js";
import Sale from "../models/Sale.js";
import { getDistributorCommissionInfo } from "../utils/distributorPricing.js";

const resolveBusinessId = (req) =>
  req.businessId || req.headers["x-business-id"] || req.query.businessId;

const getBusinessDistributorIds = async (businessId) => {
  // Solo distribuidores; no usamos admins para limitar el ranking
  const memberships = await Membership.find({
    business: businessId,
    status: "active",
    role: { $in: ["distribuidor"] },
  }).select("user");
  return memberships.map((m) => m.user);
};

// @desc    Obtener comisión ajustada por ranking para un distribuidor
// @route   GET /api/gamification/commission/:distributorId
// @access  Private
export const getAdjustedCommission = async (req, res) => {
  try {
    const { distributorId } = req.params;
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const allowedDistributors = await getBusinessDistributorIds(businessId);
    if (
      allowedDistributors.length &&
      !allowedDistributors.some((id) => id.toString() === distributorId)
    ) {
      return res
        .status(403)
        .json({ message: "Distribuidor fuera del negocio" });
    }
    const info = await getDistributorCommissionInfo(distributorId, businessId);

    res.json({
      position: info.position,
      bonusCommission: info.bonusCommission,
      periodStart: info.periodStart,
      periodEnd: info.periodEnd,
      totalDistributors: info.totalDistributors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verificar y ejecutar auto-evaluación si es necesario
// @route   POST /api/gamification/check-period
// @access  Private/Admin
export const checkAndEvaluatePeriod = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const allowedDistributors = await getBusinessDistributorIds(businessId);

    const config = await GamificationConfig.findOne();

    if (!config || !config.autoEvaluate) {
      return res.json({ message: "Auto-evaluación desactivada" });
    }

    const now = new Date();
    const startDate = config.currentPeriodStart || now;
    let periodDuration = 15; // días por defecto

    if (config.evaluationPeriod === "biweekly") {
      periodDuration = 15;
    } else if (config.evaluationPeriod === "monthly") {
      periodDuration = 30;
    } else if (config.evaluationPeriod === "weekly") {
      periodDuration = 7;
    } else if (config.evaluationPeriod === "custom") {
      periodDuration = config.customPeriodDays || 15;
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + periodDuration);

    // Verificar si el período ha terminado
    if (now < endDate) {
      return res.json({
        message: "El período aún no ha terminado",
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        daysRemaining: Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)),
      });
    }

    // El período ha terminado, evaluar
    const topDistributors = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startDate, $lte: endDate },
          paymentStatus: "confirmado",
          business: businessObjectId,
          ...(allowedDistributors.length
            ? { distributor: { $in: allowedDistributors } }
            : {}),
        },
      },
      {
        $group: {
          _id: "$distributor",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "distributor",
        },
      },
      { $unwind: "$distributor" },
      { $sort: { totalRevenue: -1 } },
      { $limit: 3 },
    ]);

    if (topDistributors.length === 0) {
      // No hay ventas, iniciar nuevo período sin ganador
      config.currentPeriodStart = now;
      await config.save();
      return res.json({
        message: "No hay ventas en el período, iniciando nuevo período",
        newPeriodStart: now,
      });
    }

    const winner = topDistributors[0];
    const bonuses = [
      config.topPerformerBonus || 50000,
      config.secondPlaceBonus || 0,
      config.thirdPlaceBonus || 0,
    ];

    // Crear registro de ganador
    const periodWinner = await PeriodWinner.create({
      business: businessObjectId,
      periodType: config.evaluationPeriod,
      startDate: startDate,
      endDate: endDate,
      winner: winner._id,
      winnerName: winner.distributor.name,
      winnerEmail: winner.distributor.email,
      totalSales: winner.totalSales,
      totalRevenue: winner.totalRevenue,
      totalProfit: winner.totalProfit,
      salesCount: winner.totalSales,
      bonusAmount: bonuses[0],
      topPerformers: topDistributors.map((dist, index) => ({
        distributor: dist._id,
        position: index + 1,
        totalRevenue: dist.totalRevenue,
        salesCount: dist.totalSales,
        bonus: bonuses[index] || 0,
      })),
      notes: "Evaluación automática del sistema",
    });

    // Actualizar estadísticas de distribuidores
    for (let i = 0; i < topDistributors.length; i++) {
      const dist = topDistributors[i];
      let stats = await DistributorStats.findOne({ distributor: dist._id });

      if (!stats) {
        stats = await DistributorStats.create({
          distributor: dist._id,
        });
      }

      stats.totalBonusEarned += bonuses[i] || 0;
      stats.pendingBonuses += bonuses[i] || 0;

      if (i === 0) {
        stats.periodWins += 1;
        stats.achievements.push({
          type: "top_performer",
          name: "Ganador del Periodo",
          description: `Primer lugar del ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}`,
          badge: "🏆",
          earnedAt: new Date(),
          value: bonuses[0],
        });
      }

      if (i < 3) {
        stats.topThreeFinishes += 1;
      }

      await stats.save();
    }

    // Iniciar nuevo período
    config.currentPeriodStart = now;
    config.lastEvaluationDate = now;
    await config.save();

    res.json({
      message: "Período evaluado automáticamente",
      winner: periodWinner,
      newPeriodStart: now,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener o crear configuración de gamificación
// @route   GET /api/gamification/config
// @access  Private/Admin
export const getConfig = async (req, res) => {
  try {
    let config = await GamificationConfig.findOne();

    if (!config) {
      config = await GamificationConfig.create({
        evaluationPeriod: "biweekly",
        customPeriodDays: 15,
        topPerformerBonus: 50000,
        secondPlaceBonus: 0,
        thirdPlaceBonus: 0,
        top1CommissionBonus: 5,
        top2CommissionBonus: 3,
        top3CommissionBonus: 2,
        autoEvaluate: true,
        currentPeriodStart: new Date(),
        salesTargets: [
          { level: "bronze", minAmount: 10000, bonus: 200, badge: "🥉" },
          { level: "silver", minAmount: 25000, bonus: 500, badge: "🥈" },
          { level: "gold", minAmount: 50000, bonus: 1000, badge: "🥇" },
          { level: "platinum", minAmount: 100000, bonus: 2500, badge: "💎" },
        ],
      });
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Actualizar configuración de gamificación
// @route   PUT /api/gamification/config
// @access  Private/Admin
export const updateConfig = async (req, res) => {
  try {
    const {
      evaluationPeriod,
      customPeriodDays,
      topPerformerBonus,
      secondPlaceBonus,
      thirdPlaceBonus,
      top1CommissionBonus,
      top2CommissionBonus,
      top3CommissionBonus,
      autoEvaluate,
      salesTargets,
      productBonuses,
      pointsPerSale,
      pointsPerPeso,
      minAdminProfitForRanking,
      currentPeriodStart,
    } = req.body;

    let config = await GamificationConfig.findOne();

    if (!config) {
      config = await GamificationConfig.create(req.body);
    } else {
      Object.assign(config, {
        evaluationPeriod,
        customPeriodDays,
        topPerformerBonus,
        secondPlaceBonus,
        thirdPlaceBonus,
        top1CommissionBonus,
        top2CommissionBonus,
        top3CommissionBonus,
        autoEvaluate,
        salesTargets,
        productBonuses,
        pointsPerSale,
        pointsPerPeso,
        minAdminProfitForRanking,
        ...(currentPeriodStart ? { currentPeriodStart } : {}),
      });
      await config.save();
    }

    res.json({ message: "Configuración actualizada", config });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener ranking actual
// @route   GET /api/gamification/ranking
// @access  Private
export const getRanking = async (req, res) => {
  try {
    const { period = "current" } = req.query;
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const allowedDistributors = await getBusinessDistributorIds(businessId);
    const config = await GamificationConfig.findOne();

    let startDate, endDate;

    if (period === "current") {
      const now = new Date();
      // Si hay currentPeriodStart guardado, úsalo para mantener el mismo rango
      const persistedStart = config?.currentPeriodStart
        ? new Date(config.currentPeriodStart)
        : null;

      const evalPeriod = config?.evaluationPeriod || "biweekly";
      let periodDays = 15;
      if (evalPeriod === "monthly") periodDays = 30;
      else if (evalPeriod === "weekly") periodDays = 7;
      else if (evalPeriod === "custom")
        periodDays = config?.customPeriodDays || 15;

      startDate =
        persistedStart ||
        (() => {
          if (evalPeriod === "monthly") {
            return new Date(now.getFullYear(), now.getMonth(), 1);
          }
          if (evalPeriod === "weekly") {
            const d = new Date(now);
            // Semana que termina hoy: últimos 7 días
            d.setDate(now.getDate() - 6);
            d.setHours(0, 0, 0, 0);
            return d;
          }
          // biweekly/custom sin persistedStart: últimos periodDays días
          const d = new Date(now);
          d.setDate(now.getDate() - (periodDays - 1));
          d.setHours(0, 0, 0, 0);
          return d;
        })();

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + (periodDays - 1));
      endDate.setHours(23, 59, 59, 999);

      // No ir más allá de hoy
      if (endDate > now) {
        endDate = now;
      }
    } else {
      startDate = new Date(req.query.startDate);
      endDate = new Date(req.query.endDate);
    }

    // Obtener ventas del periodo
    const rankings = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startDate, $lte: endDate },
          paymentStatus: "confirmado",
          business: businessObjectId,
          ...(allowedDistributors.length
            ? { distributor: { $in: allowedDistributors } }
            : {}),
        },
      },
      {
        $group: {
          _id: "$distributor",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
          totalUnits: { $sum: "$quantity" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "distributor",
        },
      },
      { $unwind: "$distributor" },
      {
        $project: {
          distributorId: "$_id",
          distributorName: "$distributor.name",
          distributorEmail: "$distributor.email",
          totalSales: 1,
          totalRevenue: 1,
          totalProfit: 1,
          totalUnits: 1,
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    // Agregar estadísticas de cada distribuidor
    const rankingsWithStats = await Promise.all(
      rankings.map(async (rank, index) => {
        const stats = await DistributorStats.findOne({
          distributor: rank.distributorId,
        });

        const position = index + 1;
        let positionBadge = "";
        let positionLabel = "";
        const basePct = 20;
        const bonuses = [
          config?.top1CommissionBonus || 0,
          config?.top2CommissionBonus || 0,
          config?.top3CommissionBonus || 0,
        ];
        let profitPercentage = basePct;

        if (position === 1) {
          positionBadge = "🥇";
          positionLabel = "PRIMER LUGAR";
          profitPercentage = basePct + bonuses[0];
        } else if (position === 2) {
          positionBadge = "🥈";
          positionLabel = "SEGUNDO LUGAR";
          profitPercentage = basePct + bonuses[1];
        } else if (position === 3) {
          positionBadge = "🥉";
          positionLabel = "TERCER LUGAR";
          profitPercentage = basePct + bonuses[2];
        } else {
          positionBadge = `#${position}`;
          positionLabel = `POSICIÓN ${position}`;
          profitPercentage = basePct;
        }

        return {
          ...rank,
          position,
          positionBadge,
          positionLabel,
          profitPercentage,
          totalPoints: stats?.totalPoints || 0,
          currentLevel: stats?.currentLevel || "beginner",
          periodWins: stats?.periodWins || 0,
        };
      })
    );

    res.json({
      period: {
        startDate,
        endDate,
        type: period === "current" ? config?.evaluationPeriod : "custom",
      },
      rankings: rankingsWithStats,
      config: {
        topPerformerBonus: config?.topPerformerBonus || 0,
        secondPlaceBonus: config?.secondPlaceBonus || 0,
        thirdPlaceBonus: config?.thirdPlaceBonus || 0,
        top1CommissionBonus: config?.top1CommissionBonus || 0,
        top2CommissionBonus: config?.top2CommissionBonus || 0,
        top3CommissionBonus: config?.top3CommissionBonus || 0,
        evaluationPeriod: config?.evaluationPeriod,
        customPeriodDays: config?.customPeriodDays,
        currentPeriodStart: config?.currentPeriodStart,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Evaluar periodo y determinar ganador
// @route   POST /api/gamification/evaluate
// @access  Private/Admin
export const evaluatePeriod = async (req, res) => {
  try {
    const { startDate, endDate, notes } = req.body;
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const allowedDistributors = await getBusinessDistributorIds(businessId);
    const config = await GamificationConfig.findOne();

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Obtener top distribuidores del periodo
    const topDistributors = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: start, $lte: end },
          paymentStatus: "confirmado",
          business: businessObjectId,
          ...(allowedDistributors.length
            ? { distributor: { $in: allowedDistributors } }
            : {}),
        },
      },
      {
        $group: {
          _id: "$distributor",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "distributor",
        },
      },
      { $unwind: "$distributor" },
      { $sort: { totalRevenue: -1 } },
      { $limit: 3 },
    ]);

    if (topDistributors.length === 0) {
      return res.status(400).json({ message: "No hay ventas en este periodo" });
    }

    const winner = topDistributors[0];
    const bonuses = [
      config?.topPerformerBonus || 1000,
      config?.secondPlaceBonus || 500,
      config?.thirdPlaceBonus || 250,
    ];

    // Crear registro de ganador
    const periodWinner = await PeriodWinner.create({
      business: businessObjectId,
      periodType: config?.evaluationPeriod || "custom",
      startDate: start,
      endDate: end,
      winner: winner._id,
      winnerName: winner.distributor.name,
      winnerEmail: winner.distributor.email,
      totalSales: winner.totalSales,
      totalRevenue: winner.totalRevenue,
      totalProfit: winner.totalProfit,
      salesCount: winner.totalSales,
      bonusAmount: bonuses[0],
      topPerformers: topDistributors.map((dist, index) => ({
        distributor: dist._id,
        position: index + 1,
        totalRevenue: dist.totalRevenue,
        salesCount: dist.totalSales,
        bonus: bonuses[index] || 0,
      })),
      notes,
    });

    // Actualizar estadísticas de distribuidores
    for (let i = 0; i < topDistributors.length; i++) {
      const dist = topDistributors[i];
      let stats = await DistributorStats.findOne({ distributor: dist._id });

      if (!stats) {
        stats = await DistributorStats.create({
          distributor: dist._id,
        });
      }

      stats.totalBonusEarned += bonuses[i] || 0;
      stats.pendingBonuses += bonuses[i] || 0;

      if (i === 0) {
        stats.periodWins += 1;
        stats.achievements.push({
          type: "top_performer",
          name: "Ganador del Periodo",
          description: `Primer lugar del ${start.toLocaleDateString()} al ${end.toLocaleDateString()}`,
          badge: "🏆",
          earnedAt: new Date(),
          value: bonuses[0],
        });
      }

      if (i < 3) {
        stats.topThreeFinishes += 1;
      }

      await stats.save();
    }

    // Actualizar última evaluación en config
    config.lastEvaluationDate = new Date();
    await config.save();

    res.json({
      message: "Periodo evaluado correctamente",
      winner: periodWinner,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener historial de ganadores
// @route   GET /api/gamification/winners
// @access  Private
export const getWinners = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const allowedDistributors = await getBusinessDistributorIds(businessId);

    // Construir filtro: si hay distribuidores autorizados, limitar a ellos;
    // si no, usar el negocio (incluyendo docs legacy sin business guardado)
    const filters = [];
    if (allowedDistributors.length) {
      filters.push({ winner: { $in: allowedDistributors } });
      filters.push({
        "topPerformers.distributor": { $in: allowedDistributors },
      });
    } else {
      filters.push({ business: businessId });
      filters.push({ business: { $exists: false } });
    }

    const baseQuery = filters.length ? { $or: filters } : {};

    const winners = await PeriodWinner.find(baseQuery)
      .sort({ endDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate("winner", "name email")
      .populate("topPerformers.distributor", "name email");

    const total = await PeriodWinner.countDocuments(baseQuery);

    res.json({
      winners,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener estadísticas de un distribuidor
// @route   GET /api/gamification/stats/:distributorId
// @access  Private
export const getDistributorStats = async (req, res) => {
  try {
    const { distributorId } = req.params;
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const allowedDistributors = await getBusinessDistributorIds(businessId);
    if (
      allowedDistributors.length &&
      !allowedDistributors.some((id) => id.toString() === distributorId)
    ) {
      return res
        .status(403)
        .json({ message: "Distribuidor fuera del negocio" });
    }

    let stats = await DistributorStats.findOne({
      distributor: distributorId,
    }).populate("distributor", "name email");

    if (!stats) {
      stats = await DistributorStats.create({
        distributor: distributorId,
      });
      await stats.populate("distributor", "name email");
    }

    // Obtener posición en ranking actual
    const allStats = await DistributorStats.find().sort({ totalPoints: -1 });
    const position =
      allStats.findIndex((s) => s.distributor.toString() === distributorId) + 1;

    // Calcular estadísticas de créditos en tiempo real
    const creditStats = await Credit.aggregate([
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          createdBy: new mongoose.Types.ObjectId(distributorId),
        },
      },
      {
        $group: {
          _id: null,
          totalCredits: { $sum: 1 },
          totalAmount: { $sum: "$originalAmount" },
          totalCollected: { $sum: "$paidAmount" },
          totalPending: {
            $sum: {
              $cond: [
                { $in: ["$status", ["pending", "partial"]] },
                "$remainingAmount",
                0,
              ],
            },
          },
          totalOverdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$status", ["pending", "partial", "overdue"]] },
                    { $lt: ["$dueDate", new Date()] },
                  ],
                },
                "$remainingAmount",
                0,
              ],
            },
          },
        },
      },
    ]);

    const creditInfo = creditStats[0] || {
      totalCredits: 0,
      totalAmount: 0,
      totalCollected: 0,
      totalPending: 0,
      totalOverdue: 0,
    };

    res.json({
      stats,
      currentRankingPosition: position,
      totalDistributors: allStats.length,
      creditStats: {
        totalCreditsGenerated: creditInfo.totalCredits,
        totalCreditsAmount: creditInfo.totalAmount,
        creditsCollected: creditInfo.totalCollected,
        creditsPending: creditInfo.totalPending,
        creditsOverdue: creditInfo.totalOverdue,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Marcar bono como pagado
// @route   PUT /api/gamification/winners/:winnerId/pay
// @access  Private/Admin
export const markBonusPaid = async (req, res) => {
  try {
    const { winnerId } = req.params;

    const winner = await PeriodWinner.findById(winnerId);
    if (!winner) {
      return res.status(404).json({ message: "Ganador no encontrado" });
    }

    winner.bonusPaid = true;
    winner.bonusPaidAt = new Date();
    await winner.save();

    // Actualizar estadísticas del distribuidor
    const stats = await DistributorStats.findOne({
      distributor: winner.winner,
    });
    if (stats) {
      stats.pendingBonuses -= winner.bonusAmount;
      stats.paidBonuses += winner.bonusAmount;
      stats.lastBonusDate = new Date();
      await stats.save();
    }

    res.json({ message: "Bono marcado como pagado", winner });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener logros disponibles
// @route   GET /api/gamification/achievements
// @access  Private
export const getAchievements = async (req, res) => {
  try {
    const config = await GamificationConfig.findOne();

    const achievements = [
      {
        type: "sales_target",
        levels: config?.salesTargets || [],
      },
      {
        type: "top_performer",
        description: "Gana el primer lugar en un periodo",
        badge: "🏆",
      },
      {
        type: "streak",
        description: "Mantén una racha de ventas consecutivas",
        badge: "🔥",
      },
    ];

    res.json(achievements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
