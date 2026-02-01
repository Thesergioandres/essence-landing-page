import Business from "../models/Business.js";
import Credit from "../models/Credit.js";
import Membership from "../models/Membership.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import User from "../models/User.js";

/**
 * Obtener métricas globales del sistema para el panel GOD
 * @route GET /api/users/god/metrics
 */
export const getGlobalMetrics = async (_req, res) => {
  try {
    const [
      totalUsers,
      usersByStatus,
      totalBusinesses,
      businessesByStatus,
      totalProducts,
      totalSales,
      salesMetrics,
      creditMetrics,
      recentUsers,
      recentBusinesses,
      topBusinessesBySales,
    ] = await Promise.all([
      // Total de usuarios (excluyendo god)
      User.countDocuments({ role: { $ne: "god" } }),

      // Usuarios por estado
      User.aggregate([
        { $match: { role: { $ne: "god" } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Total de negocios
      Business.countDocuments(),

      // Negocios por estado
      Business.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

      // Total de productos en el sistema
      Product.countDocuments(),

      // Total de ventas
      Sale.countDocuments(),

      // Métricas de ventas agregadas
      Sale.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$total" },
            totalProfit: { $sum: "$profit" },
            avgSaleValue: { $avg: "$total" },
          },
        },
      ]),

      // Métricas de créditos
      Credit.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            totalPaid: { $sum: "$paidAmount" },
          },
        },
      ]),

      // Usuarios recientes (últimos 10)
      User.find({ role: { $ne: "god" } })
        .select("name email role status createdAt subscriptionExpiresAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),

      // Negocios recientes (últimos 10)
      Business.find()
        .select("name status createdAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),

      // Top 10 negocios por ventas
      Sale.aggregate([
        {
          $group: {
            _id: "$business",
            salesCount: { $sum: 1 },
            totalRevenue: { $sum: "$total" },
            totalProfit: { $sum: "$profit" },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "businesses",
            localField: "_id",
            foreignField: "_id",
            as: "business",
          },
        },
        { $unwind: { path: "$business", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            businessId: "$_id",
            businessName: { $ifNull: ["$business.name", "Sin nombre"] },
            salesCount: 1,
            totalRevenue: 1,
            totalProfit: 1,
          },
        },
      ]),
    ]);

    // Procesar usuarios por estado
    const usersStatusMap = usersByStatus.reduce(
      (acc, item) => {
        acc[item._id || "unknown"] = item.count;
        return acc;
      },
      { pending: 0, active: 0, expired: 0, suspended: 0, paused: 0 },
    );

    // Procesar negocios por estado
    const businessesStatusMap = businessesByStatus.reduce(
      (acc, item) => {
        acc[item._id || "unknown"] = item.count;
        return acc;
      },
      { active: 0, archived: 0 },
    );

    // Procesar métricas de créditos
    const creditsMap = creditMetrics.reduce(
      (acc, item) => {
        acc[item._id] = {
          count: item.count,
          totalAmount: item.totalAmount || 0,
          totalPaid: item.totalPaid || 0,
        };
        return acc;
      },
      {
        pending: { count: 0, totalAmount: 0, totalPaid: 0 },
        paid: { count: 0, totalAmount: 0, totalPaid: 0 },
        overdue: { count: 0, totalAmount: 0, totalPaid: 0 },
      },
    );

    const salesData = salesMetrics[0] || {
      totalRevenue: 0,
      totalProfit: 0,
      avgSaleValue: 0,
    };

    // Calcular usuarios con suscripciones próximas a expirar (próximos 7 días)
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSubscriptions = await User.countDocuments({
      role: { $ne: "god" },
      status: "active",
      subscriptionExpiresAt: { $gte: now, $lte: sevenDaysLater },
    });

    // Calcular memberships activas
    const activeMemberships = await Membership.countDocuments({
      status: "active",
    });

    res.json({
      success: true,
      metrics: {
        users: {
          total: totalUsers,
          byStatus: usersStatusMap,
          expiringSubscriptions,
        },
        businesses: {
          total: totalBusinesses,
          byStatus: businessesStatusMap,
          activeMemberships,
        },
        products: {
          total: totalProducts,
        },
        sales: {
          total: totalSales,
          totalRevenue: salesData.totalRevenue || 0,
          totalProfit: salesData.totalProfit || 0,
          avgSaleValue: salesData.avgSaleValue || 0,
        },
        credits: {
          pending: creditsMap.pending || {
            count: 0,
            totalAmount: 0,
            totalPaid: 0,
          },
          paid: creditsMap.paid || { count: 0, totalAmount: 0, totalPaid: 0 },
          overdue: creditsMap.overdue || {
            count: 0,
            totalAmount: 0,
            totalPaid: 0,
          },
          totalOutstanding:
            (creditsMap.pending?.totalAmount || 0) -
            (creditsMap.pending?.totalPaid || 0) +
            ((creditsMap.overdue?.totalAmount || 0) -
              (creditsMap.overdue?.totalPaid || 0)),
        },
        recentUsers,
        recentBusinesses,
        topBusinessesBySales,
      },
    });
  } catch (error) {
    console.error("getGlobalMetrics error:", error);
    res.status(500).json({
      message: "Error obteniendo métricas globales",
      error: error.message,
    });
  }
};

/**
 * Obtener resumen de suscripciones del sistema
 * @route GET /api/users/god/subscriptions
 */
export const getSubscriptionsSummary = async (_req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [expiringToday, expiringWeek, expiringMonth, recentExpired] =
      await Promise.all([
        // Expiran hoy
        User.countDocuments({
          role: { $ne: "god" },
          subscriptionExpiresAt: {
            $gte: new Date(now.setHours(0, 0, 0, 0)),
            $lt: new Date(now.setHours(23, 59, 59, 999)),
          },
        }),

        // Expiran esta semana
        User.countDocuments({
          role: { $ne: "god" },
          subscriptionExpiresAt: {
            $gte: now,
            $lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        }),

        // Expiran este mes
        User.countDocuments({
          role: { $ne: "god" },
          subscriptionExpiresAt: {
            $gte: now,
            $lt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        }),

        // Expiraron en los últimos 30 días
        User.find({
          role: { $ne: "god" },
          status: "expired",
          subscriptionExpiresAt: { $gte: thirtyDaysAgo, $lt: now },
        })
          .select("name email subscriptionExpiresAt")
          .sort({ subscriptionExpiresAt: -1 })
          .limit(20)
          .lean(),
      ]);

    res.json({
      success: true,
      subscriptions: {
        expiringToday,
        expiringWeek,
        expiringMonth,
        recentExpired,
      },
    });
  } catch (error) {
    console.error("getSubscriptionsSummary error:", error);
    res.status(500).json({
      message: "Error obteniendo resumen de suscripciones",
      error: error.message,
    });
  }
};
