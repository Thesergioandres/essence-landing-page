import DistributorStats from "../models/DistributorStats.js";
import GamificationConfig from "../models/GamificationConfig.js";
import PeriodWinner from "../models/PeriodWinner.js";
import Sale from "../models/Sale.js";
import { getDistributorCommissionInfo } from "../utils/distributorPricing.js";

// @desc    Obtener comisión ajustada por ranking para un distribuidor
// @route   GET /api/gamification/commission/:distributorId
// @access  Private
export const getAdjustedCommission = async (req, res) => {
  try {
    const { distributorId } = req.params;
    const info = await getDistributorCommissionInfo(distributorId);

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
    const config = await GamificationConfig.findOne();

    let startDate, endDate;

    if (period === "current") {
      const now = new Date();
      if (config?.evaluationPeriod === "monthly") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59
        );
      } else if (config?.evaluationPeriod === "weekly") {
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59);
      } else if (config?.evaluationPeriod === "custom") {
        startDate = new Date();
        startDate.setDate(
          startDate.getDate() - (config.customPeriodDays || 30)
        );
        endDate = new Date();
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date();
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
        let profitPercentage = 20;

        if (position === 1) {
          positionBadge = "🥇";
          positionLabel = "PRIMER LUGAR";
          profitPercentage = 25;
        } else if (position === 2) {
          positionBadge = "🥈";
          positionLabel = "SEGUNDO LUGAR";
          profitPercentage = 23;
        } else if (position === 3) {
          positionBadge = "🥉";
          positionLabel = "TERCER LUGAR";
          profitPercentage = 21;
        } else {
          positionBadge = `#${position}`;
          positionLabel = `POSICIÓN ${position}`;
          profitPercentage = 20;
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
    const config = await GamificationConfig.findOne();

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Obtener top distribuidores del periodo
    const topDistributors = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: start, $lte: end },
          paymentStatus: "confirmado",
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

    const winners = await PeriodWinner.find()
      .sort({ endDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate("winner", "name email")
      .populate("topPerformers.distributor", "name email");

    const total = await PeriodWinner.countDocuments();

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

    res.json({
      stats,
      currentRankingPosition: position,
      totalDistributors: allStats.length,
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
