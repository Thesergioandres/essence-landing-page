import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import DistributorStock from "../models/DistributorStock.js";
import Membership from "../models/Membership.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import User from "../models/User.js";

const resolveBusinessId = (req) =>
  req.businessId || req.headers["x-business-id"] || req.query.businessId;

const getBusinessUserIds = async (businessId, reqUser) => {
  const memberships = await Membership.find({
    business: businessId,
    status: "active",
  }).select("user");
  const memberIds = memberships.map((m) => m.user);
  if (reqUser?.role === "super_admin") {
    // super_admin puede ver todos; si no hay members, devolver vacío y se manejará sin filtro
    return memberIds.length ? memberIds : [];
  }
  return memberIds;
};

// @desc    Obtener logs de auditoría con filtros
// @route   GET /api/audit/logs
// @access  Private/Admin
export const getAuditLogs = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const allowedUsers = await getBusinessUserIds(businessId, req.user);
    const isSuperAdmin = req.user?.role === "super_admin";
    if (!isSuperAdmin && allowedUsers.length === 0) {
      return res.json({
        logs: [],
        currentPage: 1,
        totalPages: 0,
        totalLogs: 0,
      });
    }

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

    const filter = { business: businessId };
    if (!isSuperAdmin) {
      filter.user = { $in: allowedUsers };
    }

    if (action) filter.action = action;
    if (module) filter.module = module;
    if (userId) {
      if (
        !isSuperAdmin &&
        !allowedUsers.some((id) => id.toString() === userId.toString())
      ) {
        return res.json({
          logs: [],
          currentPage: 1,
          totalPages: 0,
          totalLogs: 0,
        });
      }
      filter.user = new mongoose.Types.ObjectId(userId);
    }
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
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const allowedUsers = await getBusinessUserIds(businessId, req.user);
    const isSuperAdmin = req.user?.role === "super_admin";

    const log = await AuditLog.findOne({
      _id: req.params.id,
      ...(isSuperAdmin ? {} : { user: { $in: allowedUsers } }),
      business: businessId,
    }).populate("user", "name email role");

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
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const allowedUsers = await getBusinessUserIds(businessId, req.user);
    const isSuperAdmin = req.user?.role === "super_admin";

    // Filtro inicial para la agregación
    const matchStage = {
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      business: businessObjectId,
    };

    if (!isSuperAdmin && allowedUsers.length > 0) {
      matchStage.user = { $in: allowedUsers };
    }

    // 🚀 OPTIMIZACIÓN: Usar Aggregation con $facet para una sola consulta DB eficiente en lugar de fetch + reduce JS
    const [auditResults] = await AuditLog.aggregate([
      { $match: matchStage },
      {
        $facet: {
          actionSummary: [
            { $group: { _id: "$action", count: { $sum: 1 } } },
            { $project: { k: "$_id", v: "$count", _id: 0 } },
          ],
          moduleSummary: [
            { $group: { _id: "$module", count: { $sum: 1 } } },
            { $project: { k: "$_id", v: "$count", _id: 0 } },
          ],
          topUsers: [
            {
              $group: {
                _id: "$userEmail",
                name: { $first: "$userName" },
                email: { $first: "$userEmail" },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $project: { _id: 0, name: 1, email: 1, count: 1 } },
          ],
          totalActions: [{ $count: "count" }],
        },
      },
    ]);

    // Transformar array de key-value a objetos para respuesta consistente
    const transformArrayToObject = (arr) =>
      arr.reduce((acc, curr) => ({ ...acc, [curr.k]: curr.v }), {});

    const actionSummary = transformArrayToObject(auditResults.actionSummary);
    const moduleSummary = transformArrayToObject(auditResults.moduleSummary);
    const topUsers = auditResults.topUsers;
    const totalActions = auditResults.totalActions[0]?.count || 0;

    // Ventas del día (Mantener lógica ligera existente, usar count y sum directo si fuera necesario, pero find es aceptable aquí por volumen)
    const dailySales = await Sale.find({
      saleDate: { $gte: startOfDay, $lte: endOfDay },
      paymentStatus: "confirmado",
      business: businessObjectId,
    }).select("salePrice quantity totalProfit"); // Performance: Solo campos necesarios

    const salesSummary = dailySales.reduce(
      (acc, sale) => {
        acc.count += 1;
        acc.revenue += sale.salePrice * sale.quantity;
        acc.profit += sale.totalProfit;
        acc.units += sale.quantity;
        return acc;
      },
      { count: 0, revenue: 0, profit: 0, units: 0 },
    );

    // Stock al final del día
    const warehouseStock = await Product.aggregate([
      { $match: { business: businessObjectId } },
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
      { $match: { business: businessObjectId } },
      {
        $group: {
          _id: null,
          totalDistributed: { $sum: "$quantity" },
        },
      },
    ]);

    res.json({
      date: targetDate.toISOString().split("T")[0],
      totalActions,
      actionSummary,
      moduleSummary,
      topUsers,
      sales: salesSummary,
      inventory: {
        warehouse: warehouseStock[0] || {
          totalProducts: 0,
          totalWarehouseStock: 0,
          totalStock: 0,
        },
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
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const allowedUsers = await getBusinessUserIds(businessId, req.user);
    const isSuperAdmin = req.user?.role === "super_admin";
    const isAllowed =
      isSuperAdmin ||
      allowedUsers.some((id) => id.toString() === userId.toString());

    if (!isAllowed) {
      return res.status(403).json({ message: "Usuario fuera del negocio" });
    }

    const filter = { user: userId, business: businessId };

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

    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const allowedUsers = await getBusinessUserIds(businessId, req.user);
    const isSuperAdmin = req.user?.role === "super_admin";

    if (!isSuperAdmin && !allowedUsers.length) {
      return res.json({
        entityType,
        entityId,
        totalChanges: 0,
        history: [],
      });
    }

    const logs = await AuditLog.find({
      entityType,
      entityId,
      ...(isSuperAdmin ? {} : { user: { $in: allowedUsers } }),
      business: businessId,
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

    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const allowedUsers = await getBusinessUserIds(businessId, req.user);
    const isSuperAdmin = req.user?.role === "super_admin";

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const matchStage = {
      createdAt: { $gte: startDate },
      business: businessObjectId,
    };

    if (!isSuperAdmin && allowedUsers.length > 0) {
      matchStage.user = { $in: allowedUsers };
    }

    // 🚀 OPTIMIZACIÓN: Usar Aggregation con $facet
    const [auditStats] = await AuditLog.aggregate([
      { $match: matchStage },
      {
        $facet: {
          actionStats: [
            { $group: { _id: "$action", count: { $sum: 1 } } },
            { $project: { k: "$_id", v: "$count", _id: 0 } },
          ],
          moduleStats: [
            { $group: { _id: "$module", count: { $sum: 1 } } },
            { $project: { k: "$_id", v: "$count", _id: 0 } },
          ],
          severityStats: [
            { $group: { _id: "$severity", count: { $sum: 1 } } },
            { $project: { k: "$_id", v: "$count", _id: 0 } },
          ],
          dailyActivity: [
            {
              $group: {
                // Formato YYYY-MM-DD directamente en mongo
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                count: { $sum: 1 },
              },
            },
            { $project: { k: "$_id", v: "$count", _id: 0 } },
          ],
          topUsers: [
            {
              $group: {
                _id: "$userEmail",
                name: { $first: "$userName" },
                email: { $first: "$userEmail" },
                role: { $first: "$userRole" },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { _id: 0, name: 1, email: 1, role: 1, count: 1 } },
          ],
          totalActions: [{ $count: "count" }],
        },
      },
    ]);

    const transformArrayToObject = (arr) =>
      arr.reduce((acc, curr) => ({ ...acc, [curr.k]: curr.v }), {});

    const actionStats = transformArrayToObject(auditStats.actionStats);
    const moduleStats = transformArrayToObject(auditStats.moduleStats);
    const severityStats = transformArrayToObject(auditStats.severityStats);
    const dailyActivity = transformArrayToObject(auditStats.dailyActivity);
    const topUsers = auditStats.topUsers;
    const totalActions = auditStats.totalActions[0]?.count || 0;

    res.json({
      period: `${days} días`,
      totalActions,
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
