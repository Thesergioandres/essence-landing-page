import AuditLog from "../models/AuditLog.js";
import DistributorStock from "../models/DistributorStock.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import User from "../models/User.js";

// @desc    Obtener logs de auditoría con filtros
// @route   GET /api/audit/logs
// @access  Private/Admin
export const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      module,
      userId,
      startDate,
      endDate,
      severity,
      entityType,
      entityId,
    } = req.query;

    const filter = {};

    if (action) filter.action = action;
    if (module) filter.module = module;
    if (userId) filter.user = userId;
    if (severity) filter.severity = severity;
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate("user", "name email role");

    res.json({
      logs,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalLogs: total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener log específico por ID
// @route   GET /api/audit/logs/:id
// @access  Private/Admin
export const getAuditLogById = async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id).populate("user", "name email role");

    if (!log) {
      return res.status(404).json({ message: "Log no encontrado" });
    }

    res.json(log);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener resumen de actividad diaria
// @route   GET /api/audit/daily-summary
// @access  Private/Admin
export const getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Logs del día
    const dailyLogs = await AuditLog.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    // Resumen por acción
    const actionSummary = dailyLogs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    // Resumen por módulo
    const moduleSummary = dailyLogs.reduce((acc, log) => {
      acc[log.module] = (acc[log.module] || 0) + 1;
      return acc;
    }, {});

    // Usuarios más activos
    const userActivity = dailyLogs.reduce((acc, log) => {
      const key = log.userEmail;
      if (!acc[key]) {
        acc[key] = { name: log.userName, email: log.userEmail, count: 0 };
      }
      acc[key].count += 1;
      return acc;
    }, {});

    const topUsers = Object.values(userActivity)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Ventas del día
    const dailySales = await Sale.find({
      saleDate: { $gte: startOfDay, $lte: endOfDay },
      paymentStatus: "confirmado",
    });

    const salesSummary = dailySales.reduce(
      (acc, sale) => {
        acc.count += 1;
        acc.revenue += sale.salePrice * sale.quantity;
        acc.profit += sale.totalProfit;
        acc.units += sale.quantity;
        return acc;
      },
      { count: 0, revenue: 0, profit: 0, units: 0 }
    );

    // Stock al final del día
    const warehouseStock = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalWarehouseStock: { $sum: "$warehouseStock" },
          totalStock: { $sum: "$totalStock" },
        },
      },
    ]);

    const distributorStock = await DistributorStock.aggregate([
      {
        $group: {
          _id: null,
          totalDistributed: { $sum: "$quantity" },
        },
      },
    ]);

    res.json({
      date: targetDate.toISOString().split("T")[0],
      totalActions: dailyLogs.length,
      actionSummary,
      moduleSummary,
      topUsers,
      sales: salesSummary,
      inventory: {
        warehouse: warehouseStock[0] || { totalProducts: 0, totalWarehouseStock: 0, totalStock: 0 },
        distributed: distributorStock[0]?.totalDistributed || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener actividad de un usuario específico
// @route   GET /api/audit/user-activity/:userId
// @access  Private/Admin
export const getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    const filter = { user: userId };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const user = await User.findById(userId).select("name email role");

    // Estadísticas
    const actionCounts = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    const moduleCounts = logs.reduce((acc, log) => {
      acc[log.module] = (acc[log.module] || 0) + 1;
      return acc;
    }, {});

    res.json({
      user,
      totalActions: logs.length,
      actionCounts,
      moduleCounts,
      recentLogs: logs.slice(0, 20),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener historial de una entidad específica
// @route   GET /api/audit/entity-history/:entityType/:entityId
// @access  Private/Admin
export const getEntityHistory = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit = 50 } = req.query;

    const logs = await AuditLog.find({
      entityType,
      entityId,
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("user", "name email role");

    res.json({
      entityType,
      entityId,
      totalChanges: logs.length,
      history: logs,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener estadísticas generales de auditoría
// @route   GET /api/audit/stats
// @access  Private/Admin
export const getAuditStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const logs = await AuditLog.find({
      createdAt: { $gte: startDate },
    });

    // Total de acciones por tipo
    const actionStats = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    // Total de acciones por módulo
    const moduleStats = logs.reduce((acc, log) => {
      acc[log.module] = (acc[log.module] || 0) + 1;
      return acc;
    }, {});

    // Total de acciones por severidad
    const severityStats = logs.reduce((acc, log) => {
      acc[log.severity] = (acc[log.severity] || 0) + 1;
      return acc;
    }, {});

    // Actividad por día
    const dailyActivity = logs.reduce((acc, log) => {
      const day = log.createdAt.toISOString().split("T")[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});

    // Usuarios más activos
    const userActivity = logs.reduce((acc, log) => {
      const key = log.userEmail;
      if (!acc[key]) {
        acc[key] = { name: log.userName, email: log.userEmail, role: log.userRole, count: 0 };
      }
      acc[key].count += 1;
      return acc;
    }, {});

    const topUsers = Object.values(userActivity)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      period: `${days} días`,
      totalActions: logs.length,
      actionStats,
      moduleStats,
      severityStats,
      dailyActivity,
      topUsers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Eliminar logs antiguos
// @route   DELETE /api/audit/cleanup
// @access  Private/Admin
export const cleanupOldLogs = async (req, res) => {
  try {
    const { days = 90 } = req.body;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const result = await AuditLog.deleteMany({
      createdAt: { $lt: cutoffDate },
      severity: { $nin: ["error", "critical"] }, // Mantener logs críticos
    });

    res.json({
      message: `Se eliminaron ${result.deletedCount} logs antiguos`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
