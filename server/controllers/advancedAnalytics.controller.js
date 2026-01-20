import { subDays } from "date-fns";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";

const resolveBusinessId = (req) =>
  req.businessId || req.headers["x-business-id"] || req.query.businessId;

const buildColombiaSaleDateFilter = (startDateStr, endDateStr) => {
  if (!startDateStr && !endDateStr) return null;

  const saleDate = {};

  if (startDateStr) {
    // 00:00 Colombia = 05:00 UTC
    const date = new Date(startDateStr);
    saleDate.$gte = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        5,
        0,
        0,
        0,
      ),
    );
  }

  if (endDateStr) {
    // 23:59:59 Colombia = 04:59:59 UTC del día siguiente
    const date = new Date(endDateStr);
    saleDate.$lte = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1,
        4,
        59,
        59,
        999,
      ),
    );
  }

  return saleDate;
};

// @desc    Get sales timeline data
// @route   GET /api/advanced-analytics/sales-timeline
// @access  Private/Admin
export const getSalesTimeline = async (req, res) => {
  try {
    const {
      period = "month",
      startDate: customStartDate,
      endDate: customEndDate,
    } = req.query;

    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const timezone = "America/Bogota";
    let groupBy;

    const opDate = {
      $ifNull: [
        "$saleDate",
        { $ifNull: ["$paymentConfirmedAt", "$createdAt"] },
      ],
    };

    // Determinar agrupación según período
    switch (period) {
      case "day":
        groupBy = {
          $dateToString: {
            format: "%Y-%m-%d",
            date: opDate,
            timezone,
          },
        };
        break;
      case "week":
        groupBy = {
          $dateToString: {
            format: "%Y-W%V",
            date: opDate,
            timezone,
          },
        };
        break;
      case "month":
        groupBy = {
          $dateToString: {
            format: "%Y-%m",
            date: opDate,
            timezone,
          },
        };
        break;
      default:
        groupBy = {
          $dateToString: {
            format: "%Y-%m",
            date: opDate,
            timezone,
          },
        };
    }

    // Construir filtro - SIN restricción de fecha por defecto
    const matchFilter = {
      paymentStatus: "confirmado",
      business: businessObjectId,
    };

    // Solo aplicar filtros de fecha si se proporcionan explícitamente
    const saleDateFilter = buildColombiaSaleDateFilter(
      customStartDate,
      customEndDate,
    );
    const opDateMatch = saleDateFilter
      ? { $match: { opDate: saleDateFilter } }
      : null;

    const timeline = await Sale.aggregate([
      { $match: matchFilter },
      { $addFields: { opDate } },
      ...(opDateMatch ? [opDateMatch] : []),
      {
        $project: {
          opDate: 1,
          revenue: { $multiply: ["$salePrice", "$quantity"] },
          // Usar netProfit si existe, sino totalProfit menos deducciones
          profit: {
            $ifNull: [
              "$netProfit",
              {
                $subtract: [
                  { $ifNull: ["$totalProfit", 0] },
                  {
                    $add: [
                      { $ifNull: ["$totalAdditionalCosts", 0] },
                      { $ifNull: ["$shippingCost", 0] },
                      { $ifNull: ["$discount", 0] },
                    ],
                  },
                ],
              },
            ],
          },
          // Para contar órdenes únicas
          saleGroupId: { $ifNull: ["$saleGroupId", "$_id"] },
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            { $match: { status: "active", business: businessObjectId } },
            ...(saleDateFilter
              ? [
                  {
                    $addFields: {
                      opDate: { $ifNull: ["$saleDate", "$createdAt"] },
                    },
                  },
                  { $match: { opDate: saleDateFilter } },
                ]
              : [
                  {
                    $addFields: {
                      opDate: { $ifNull: ["$saleDate", "$createdAt"] },
                    },
                  },
                ]),
            {
              $project: {
                opDate: 1,
                revenue: { $multiply: ["$specialPrice", "$quantity"] },
                // Ventas especiales no tienen deducciones
                profit: { $ifNull: ["$totalProfit", 0] },
                // Cada venta especial es una orden única
                saleGroupId: "$_id",
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupBy.$dateToString.format,
              date: "$opDate",
              timezone,
            },
          },
          totalSales: { $sum: 1 },
          // Contar órdenes únicas por saleGroupId
          saleGroupIds: { $addToSet: { $ifNull: ["$saleGroupId", "$_id"] } },
          totalRevenue: { $sum: "$revenue" },
          totalProfit: { $sum: "$profit" },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 100 },
    ]);

    console.log(`Sales Timeline - Found ${timeline.length} records`);

    // Map the response to match frontend expectations
    const formattedTimeline = timeline.map((item) => ({
      period: item._id,
      salesCount: item.totalSales,
      ordersCount: item.saleGroupIds?.length || item.totalSales,
      revenue: item.totalRevenue || 0,
      profit: item.totalProfit || 0,
    }));

    res.json({ timeline: formattedTimeline });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get top selling products
// @route   GET /api/advanced-analytics/top-products
// @access  Private/Admin
export const getTopProducts = async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;

    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const matchFilter = {
      paymentStatus: "confirmado",
      business: businessObjectId,
    };
    const saleDateFilter = buildColombiaSaleDateFilter(startDate, endDate);
    if (saleDateFilter) {
      matchFilter.saleDate = saleDateFilter;
    }

    const topProducts = await Sale.aggregate([
      { $match: matchFilter },
      {
        $project: {
          product: "$product",
          quantity: "$quantity",
          revenue: { $multiply: ["$salePrice", "$quantity"] },
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            { $match: { status: "active", business: businessObjectId } },
            ...(saleDateFilter
              ? [{ $match: { saleDate: saleDateFilter } }]
              : []),
            { $match: { "product.productId": { $exists: true, $ne: null } } },
            {
              $project: {
                product: "$product.productId",
                quantity: "$quantity",
                revenue: { $multiply: ["$specialPrice", "$quantity"] },
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: "$product",
          totalQuantity: { $sum: "$quantity" },
          totalRevenue: { $sum: "$revenue" },
          salesCount: { $sum: 1 },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $project: {
          name: "$productInfo.name",
          totalQuantity: 1,
          totalRevenue: 1,
          salesCount: 1,
          image: "$productInfo.image",
        },
      },
    ]);

    res.json({ topProducts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get sales by category
// @route   GET /api/advanced-analytics/sales-by-category
// @access  Private/Admin
export const getSalesByCategory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const matchFilter = {
      paymentStatus: "confirmado",
      business: businessObjectId,
    };
    const saleDateFilter = buildColombiaSaleDateFilter(startDate, endDate);
    if (saleDateFilter) {
      matchFilter.saleDate = saleDateFilter;
    }

    const salesByCategory = await Sale.aggregate([
      { $match: matchFilter },
      {
        $project: {
          product: "$product",
          quantity: "$quantity",
          revenue: { $multiply: ["$salePrice", "$quantity"] },
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            { $match: { status: "active", business: businessObjectId } },
            ...(saleDateFilter
              ? [{ $match: { saleDate: saleDateFilter } }]
              : []),
            { $match: { "product.productId": { $exists: true, $ne: null } } },
            {
              $project: {
                product: "$product.productId",
                quantity: "$quantity",
                revenue: { $multiply: ["$specialPrice", "$quantity"] },
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $group: {
          _id: "$categoryInfo._id",
          name: { $first: "$categoryInfo.name" },
          totalSales: { $sum: "$quantity" },
          totalRevenue: { $sum: "$revenue" },
          color: { $first: "$categoryInfo.color" },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    res.json({ categoryDistribution: salesByCategory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get distributor rankings
// @route   GET /api/advanced-analytics/distributor-rankings
// @access  Private/Admin
export const getDistributorRankings = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const saleDateFilter = buildColombiaSaleDateFilter(startDate, endDate);

    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const confirmedMatch = {
      paymentStatus: "confirmado",
      distributor: { $exists: true, $ne: null },
      business: businessObjectId,
    };

    if (saleDateFilter) {
      confirmedMatch.saleDate = saleDateFilter;
    }

    const rankings = await Sale.aggregate([
      {
        $match: {
          ...confirmedMatch,
        },
      },
      {
        $project: {
          distributor: "$distributor",
          revenue: { $multiply: ["$salePrice", "$quantity"] },
          profit: "$totalProfit",
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            { $match: { status: "active", business: businessObjectId } },
            ...(saleDateFilter
              ? [{ $match: { saleDate: saleDateFilter } }]
              : []),
            {
              $project: {
                distributor: null, // ventas especiales tratadas como admin
                revenue: { $multiply: ["$specialPrice", "$quantity"] },
                profit: "$totalProfit",
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: "$distributor",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: "$revenue" },
          totalProfit: { $sum: "$profit" },
          avgOrderValue: { $avg: "$revenue" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "distributorInfo",
        },
      },
      {
        $unwind: {
          path: "$distributorInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          name: {
            $ifNull: ["$distributorInfo.name", "Ventas administradas"],
          },
          email: { $ifNull: ["$distributorInfo.email", ""] },
          totalSales: 1,
          totalRevenue: 1,
          totalProfit: 1,
          avgOrderValue: 1,
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    // Calculate conversion rate
    const allMatch = {
      distributor: { $exists: true, $ne: null },
      business: businessObjectId,
    };
    if (saleDateFilter) {
      allMatch.saleDate = saleDateFilter;
    }

    const allSales = await Sale.aggregate([
      { $match: allMatch },
      {
        $group: {
          _id: "$distributor",
          pendiente: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "pendiente"] }, 1, 0] },
          },
          confirmado: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "confirmado"] }, 1, 0] },
          },
        },
      },
    ]);

    const rankingsWithConversion = rankings.map((rank) => {
      const salesData = allSales.find(
        (s) => s._id && rank._id && s._id.toString() === rank._id.toString(),
      );
      const total = salesData ? salesData.confirmado + salesData.pendiente : 0;
      const conversionRate =
        total > 0 ? ((salesData.confirmado / total) * 100).toFixed(2) : 0;

      return {
        ...rank,
        conversionRate: parseFloat(conversionRate),
      };
    });

    res.json({ rankings: rankingsWithConversion });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get low stock alerts with visual data
// @route   GET /api/advanced-analytics/low-stock-visual
// @access  Private/Admin
export const getLowStockVisual = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const lowStockProducts = await Product.find({
      business: businessId,
      $expr: { $lte: ["$warehouseStock", "$lowStockAlert"] },
    })
      .populate("category", "name")
      .sort({ warehouseStock: 1 })
      .lean();

    const visualData = lowStockProducts.map((product) => {
      // Calcular porcentaje basado en el nivel de alerta como 100%
      const maxStock = product.lowStockAlert * 2 || 100; // Asumimos que el doble del alert es el máximo
      const percentage = Math.min(
        (product.warehouseStock / maxStock) * 100,
        100,
      );

      return {
        productId: product._id,
        productName: product.name,
        currentStock: product.warehouseStock,
        lowStockAlert: product.lowStockAlert,
        categoryName: product.category?.name || "Sin categoría",
        stockPercentage: parseFloat(percentage.toFixed(1)),
        urgency:
          product.warehouseStock === 0
            ? "critical"
            : product.warehouseStock <= product.lowStockAlert * 0.5
              ? "critical"
              : product.warehouseStock <= product.lowStockAlert
                ? "warning"
                : "normal",
      };
    });

    res.json({ lowStockProducts: visualData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get product rotation analysis
// @route   GET /api/advanced-analytics/product-rotation
// @access  Private/Admin
export const getProductRotation = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const startDate = subDays(new Date(), parseInt(days));

    const rotation = await Sale.aggregate([
      {
        $match: {
          paymentStatus: "confirmado",
          saleDate: { $gte: startDate },
          business: businessObjectId,
        },
      },
      {
        $project: {
          product: "$product",
          quantity: "$quantity",
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            {
              $match: {
                status: "active",
                saleDate: { $gte: startDate },
                business: businessObjectId,
              },
            },
            { $match: { "product.productId": { $exists: true, $ne: null } } },
            {
              $project: {
                product: "$product.productId",
                quantity: "$quantity",
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: "$product",
          totalSold: { $sum: "$quantity" },
          frequency: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      { $match: { "productInfo.business": businessObjectId } },
      {
        $project: {
          name: "$productInfo.name",
          totalSold: 1,
          frequency: 1,
          currentStock: "$productInfo.totalStock",
          rotationRate: {
            $divide: [
              "$totalSold",
              { $add: ["$totalSold", "$productInfo.totalStock"] },
            ],
          },
        },
      },
      { $sort: { rotationRate: -1 } },
    ]);

    res.json({ productRotation: rotation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get financial KPIs
// @route   GET /api/advanced-analytics/financial-kpis
// @access  Private/Admin
export const getFinancialKPIs = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const today = new Date();
    const { startDate, endDate } = req.query;

    // Ajustar a zona horaria de Colombia (UTC-5)
    // El día en Colombia comienza a las 5:00 AM UTC y termina a las 4:59:59 AM UTC del día siguiente
    const colombiaOffset = -5 * 60; // -5 horas en minutos
    const colombiaTime = new Date(today.getTime() + colombiaOffset * 60000);

    // Inicio y fin del día actual en Colombia (00:00-23:59:59 Colombia = 05:00-04:59:59 UTC)
    const startOfToday = new Date(
      Date.UTC(
        colombiaTime.getUTCFullYear(),
        colombiaTime.getUTCMonth(),
        colombiaTime.getUTCDate(),
        5,
        0,
        0,
        0,
      ),
    );
    const endOfToday = new Date(
      Date.UTC(
        colombiaTime.getUTCFullYear(),
        colombiaTime.getUTCMonth(),
        colombiaTime.getUTCDate() + 1,
        4,
        59,
        59,
        999,
      ),
    );

    // Inicio de la semana en Colombia
    const dayOfWeek = colombiaTime.getUTCDay();
    const startOfThisWeek = new Date(startOfToday);
    startOfThisWeek.setUTCDate(startOfToday.getUTCDate() - dayOfWeek);

    // Inicio del mes en Colombia
    const startOfThisMonth = new Date(
      Date.UTC(
        colombiaTime.getUTCFullYear(),
        colombiaTime.getUTCMonth(),
        1,
        5,
        0,
        0,
        0,
      ),
    );

    const baseMatch = {
      paymentStatus: "confirmado",
      business: businessObjectId,
    };

    // Si vienen filtros manuales, úsalos para todo (override), sino usamos ventanas relativas
    const customDateFilter = buildColombiaSaleDateFilter(startDate, endDate);

    const buildStatsPipeline = (fromDate, toDate = null) => {
      const dateMatch = { $gte: fromDate };
      if (toDate) {
        dateMatch.$lte = toDate;
      }

      return [
        { $match: baseMatch },
        {
          $addFields: {
            opDate: {
              $ifNull: [
                "$saleDate",
                { $ifNull: ["$paymentConfirmedAt", "$createdAt"] },
              ],
            },
          },
        },
        { $match: { opDate: dateMatch } },
        {
          $project: {
            opDate: 1,
            revenue: { $multiply: ["$salePrice", "$quantity"] },
            // Usar netProfit si existe, sino totalProfit menos deducciones
            profit: {
              $ifNull: [
                "$netProfit",
                {
                  $subtract: [
                    { $ifNull: ["$totalProfit", 0] },
                    {
                      $add: [
                        { $ifNull: ["$totalAdditionalCosts", 0] },
                        { $ifNull: ["$shippingCost", 0] },
                        { $ifNull: ["$discount", 0] },
                      ],
                    },
                  ],
                },
              ],
            },
            // Para contar órdenes únicas
            saleGroupId: { $ifNull: ["$saleGroupId", "$_id"] },
          },
        },
        {
          $unionWith: {
            coll: "specialsales",
            pipeline: [
              { $match: { status: "active", business: businessObjectId } },
              {
                $addFields: {
                  opDate: { $ifNull: ["$saleDate", "$createdAt"] },
                },
              },
              { $match: { opDate: dateMatch } },
              {
                $project: {
                  opDate: 1,
                  revenue: { $multiply: ["$specialPrice", "$quantity"] },
                  // Ventas especiales no tienen deducciones, usar totalProfit directamente
                  profit: { $ifNull: ["$totalProfit", 0] },
                  // Cada venta especial es una orden única
                  saleGroupId: "$_id",
                },
              },
            ],
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$revenue" },
            profit: { $sum: "$profit" },
            salesDocs: { $sum: 1 },
            saleGroupIds: { $addToSet: "$saleGroupId" },
          },
        },
        {
          $addFields: {
            sales: { $size: "$saleGroupIds" },
          },
        },
      ];
    };

    const [
      dailyStats,
      weeklyStats,
      monthlyStats,
      avgTicket,
      activeDistributors,
    ] = await Promise.all([
      // Si hay filtro custom, úsalo en diario también (para exportar/rango)
      Sale.aggregate(
        customDateFilter
          ? buildStatsPipeline(customDateFilter.$gte, customDateFilter.$lte)
          : buildStatsPipeline(startOfToday, endOfToday),
      ),
      Sale.aggregate(
        customDateFilter
          ? buildStatsPipeline(customDateFilter.$gte, customDateFilter.$lte)
          : buildStatsPipeline(startOfThisWeek),
      ),
      Sale.aggregate(
        customDateFilter
          ? buildStatsPipeline(customDateFilter.$gte, customDateFilter.$lte)
          : buildStatsPipeline(startOfThisMonth),
      ),
      // Average ticket
      Sale.aggregate([
        {
          $match: {
            ...baseMatch,
            ...(customDateFilter ? { saleDate: customDateFilter } : {}),
          },
        },
        {
          $project: {
            ticket: { $multiply: ["$salePrice", "$quantity"] },
          },
        },
        {
          $unionWith: {
            coll: "specialsales",
            pipeline: [
              { $match: { status: "active", business: businessObjectId } },
              ...(customDateFilter
                ? [{ $match: { saleDate: customDateFilter } }]
                : []),
              {
                $project: {
                  ticket: { $multiply: ["$specialPrice", "$quantity"] },
                },
              },
            ],
          },
        },
        {
          $group: {
            _id: null,
            avgTicket: { $avg: "$ticket" },
          },
        },
      ]),
      Sale.distinct("distributor", {
        ...baseMatch,
        distributor: { $exists: true, $ne: null },
        ...(customDateFilter ? { saleDate: customDateFilter } : {}),
      }),
    ]);

    const daily = dailyStats[0] || { revenue: 0, profit: 0, sales: 0 };
    const weekly = weeklyStats[0] || { revenue: 0, profit: 0, sales: 0 };
    const monthly = monthlyStats[0] || { revenue: 0, profit: 0, sales: 0 };
    const avgTicketValue = avgTicket[0]?.avgTicket || 0;

    const kpis = {
      todaySales: daily.sales || 0,
      todayRevenue: daily.revenue || 0,
      todayProfit: daily.profit || 0,
      weekSales: weekly.sales || 0,
      weekRevenue: weekly.revenue || 0,
      weekProfit: weekly.profit || 0,
      monthSales: monthly.sales || 0,
      monthRevenue: monthly.revenue || 0,
      monthProfit: monthly.profit || 0,
      averageTicket: avgTicketValue,
      totalActiveDistributors: Array.isArray(activeDistributors)
        ? activeDistributors.length
        : 0,
    };

    res.json({
      daily,
      weekly,
      monthly,
      avgTicket: avgTicketValue,
      kpis,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get comparative analysis
// @route   GET /api/advanced-analytics/comparative-analysis
// @access  Private/Admin
export const getComparativeAnalysis = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const now = new Date();

    // Ajustar a zona horaria de Colombia (UTC-5)
    const colombiaOffset = -5 * 60; // -5 horas en minutos
    const colombiaTime = new Date(now.getTime() + colombiaOffset * 60000);

    // Inicio del mes actual en Colombia (día 1 a las 00:00 Colombia = 05:00 UTC)
    const thisMonthStart = new Date(
      Date.UTC(
        colombiaTime.getUTCFullYear(),
        colombiaTime.getUTCMonth(),
        1,
        5,
        0,
        0,
        0,
      ),
    );

    // Mes anterior
    const lastMonthYear =
      colombiaTime.getUTCMonth() === 0
        ? colombiaTime.getUTCFullYear() - 1
        : colombiaTime.getUTCFullYear();
    const lastMonthNum =
      colombiaTime.getUTCMonth() === 0 ? 11 : colombiaTime.getUTCMonth() - 1;

    const lastMonthStart = new Date(
      Date.UTC(lastMonthYear, lastMonthNum, 1, 5, 0, 0, 0),
    );
    const lastMonthEnd = new Date(thisMonthStart.getTime() - 1); // 1 milisegundo antes del inicio del mes actual

    console.log("Comparative Analysis Dates:", {
      now: now.toISOString(),
      colombiaTime: colombiaTime.toISOString(),
      lastMonthStart: lastMonthStart.toISOString(),
      lastMonthEnd: lastMonthEnd.toISOString(),
      thisMonthStart: thisMonthStart.toISOString(),
    });

    const aggregateWindow = (start, end = null) => [
      { $match: { paymentStatus: "confirmado", business: businessObjectId } },
      {
        $project: {
          saleDate: 1,
          revenue: { $multiply: ["$salePrice", "$quantity"] },
          // Usar netProfit si existe, sino totalProfit menos deducciones
          profit: {
            $ifNull: [
              "$netProfit",
              {
                $subtract: [
                  { $ifNull: ["$totalProfit", 0] },
                  {
                    $add: [
                      { $ifNull: ["$totalAdditionalCosts", 0] },
                      { $ifNull: ["$shippingCost", 0] },
                      { $ifNull: ["$discount", 0] },
                    ],
                  },
                ],
              },
            ],
          },
          // Para contar órdenes únicas
          saleGroupId: { $ifNull: ["$saleGroupId", "$_id"] },
        },
      },
      {
        $match: {
          saleDate: end ? { $gte: start, $lte: end } : { $gte: start },
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            { $match: { status: "active", business: businessObjectId } },
            {
              $project: {
                saleDate: "$saleDate",
                revenue: { $multiply: ["$specialPrice", "$quantity"] },
                profit: "$totalProfit",
                // Cada venta especial es una orden única
                saleGroupId: "$_id",
              },
            },
            {
              $match: end
                ? { saleDate: { $gte: start, $lte: end } }
                : { saleDate: { $gte: start } },
            },
          ],
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$revenue" },
          profit: { $sum: "$profit" },
          salesDocs: { $sum: 1 },
          saleGroupIds: { $addToSet: "$saleGroupId" },
        },
      },
      {
        $addFields: {
          sales: { $size: "$saleGroupIds" },
        },
      },
    ];

    const [lastMonth, thisMonth] = await Promise.all([
      Sale.aggregate(aggregateWindow(lastMonthStart, lastMonthEnd)),
      Sale.aggregate(aggregateWindow(thisMonthStart)),
    ]);

    const lastMonthData = lastMonth[0] || { revenue: 0, profit: 0, sales: 0 };
    const thisMonthData = thisMonth[0] || { revenue: 0, profit: 0, sales: 0 };

    const calculateGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return (((current - previous) / previous) * 100).toFixed(2);
    };

    res.json({
      comparison: {
        previousMonth: lastMonthData,
        currentMonth: thisMonthData,
        growth: {
          salesGrowth: parseFloat(
            calculateGrowth(thisMonthData.sales, lastMonthData.sales),
          ),
          revenueGrowth: parseFloat(
            calculateGrowth(thisMonthData.revenue, lastMonthData.revenue),
          ),
          profitGrowth: parseFloat(
            calculateGrowth(thisMonthData.profit, lastMonthData.profit),
          ),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get sales funnel data
// @route   GET /api/advanced-analytics/sales-funnel
// @access  Private/Admin
export const getSalesFunnel = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const matchFilter = {};
    const saleDateFilter = buildColombiaSaleDateFilter(startDate, endDate);
    if (saleDateFilter) {
      matchFilter.saleDate = saleDateFilter;
    }
    matchFilter.business = businessObjectId;

    const funnelData = await Sale.aggregate([
      {
        $match: matchFilter,
      },
      {
        $project: {
          status: "$paymentStatus",
          value: { $multiply: ["$salePrice", "$quantity"] },
          // Para contar órdenes únicas
          saleGroupId: { $ifNull: ["$saleGroupId", "$_id"] },
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            { $match: { status: "active", business: businessObjectId } },
            ...(saleDateFilter
              ? [{ $match: { saleDate: saleDateFilter } }]
              : []),
            {
              $project: {
                status: "confirmado", // tratamos ventas especiales activas como confirmadas
                value: { $multiply: ["$specialPrice", "$quantity"] },
                // Cada venta especial es una orden única
                saleGroupId: "$_id",
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: "$status",
          countDocs: { $sum: 1 },
          totalValue: { $sum: "$value" },
          saleGroupIds: { $addToSet: "$saleGroupId" },
        },
      },
      {
        $addFields: {
          count: { $size: "$saleGroupIds" },
        },
      },
    ]);

    const funnel = {
      pending: funnelData.find((f) => f._id === "pendiente") || {
        count: 0,
        totalValue: 0,
      },
      confirmed: funnelData.find((f) => f._id === "confirmado") || {
        count: 0,
        totalValue: 0,
      },
    };

    const total = funnel.pending.count + funnel.confirmed.count;
    funnel.conversionRate =
      total > 0
        ? parseFloat(((funnel.confirmed.count / total) * 100).toFixed(2))
        : 0;

    res.json({ funnel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
