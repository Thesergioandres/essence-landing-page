import Sale from "../models/Sale.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import DistributorStock from "../models/DistributorStock.js";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, format } from "date-fns";

// @desc    Get sales timeline data
// @route   GET /api/advanced-analytics/sales-timeline
// @access  Private/Admin
export const getSalesTimeline = async (req, res) => {
  try {
    const { period = 'month', startDate: customStartDate, endDate: customEndDate } = req.query;
    
    let groupBy;
    
    // Determinar agrupación según período
    switch(period) {
      case 'day':
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } };
        break;
      case 'week':
        groupBy = { $dateToString: { format: "%Y-W%V", date: "$saleDate" } };
        break;
      case 'month':
        groupBy = { $dateToString: { format: "%Y-%m", date: "$saleDate" } };
        break;
      default:
        groupBy = { $dateToString: { format: "%Y-%m", date: "$saleDate" } };
    }

    // Construir filtro - SIN restricción de fecha por defecto
    const matchFilter = { paymentStatus: 'confirmado' };
    
    // Solo aplicar filtros de fecha si se proporcionan explícitamente
    if (customStartDate || customEndDate) {
      matchFilter.saleDate = {};
      if (customStartDate) {
        matchFilter.saleDate.$gte = new Date(customStartDate);
      }
      if (customEndDate) {
        matchFilter.saleDate.$lte = new Date(customEndDate);
      }
    }

    const timeline = await Sale.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: groupBy,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 100 } // Limitar a últimos 100 períodos para no sobrecargar
    ]);

    console.log(`Sales Timeline - Found ${timeline.length} records`);

    // Map the response to match frontend expectations
    const formattedTimeline = timeline.map(item => ({
      period: item._id,
      salesCount: item.totalSales,
      revenue: item.totalRevenue || 0,
      profit: item.totalProfit || 0
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
    const { limit = 10 } = req.query;

    const topProducts = await Sale.aggregate([
      { $match: { paymentStatus: 'confirmado' } },
      {
        $group: {
          _id: "$product",
          totalQuantity: { $sum: "$quantity" },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $project: {
          name: "$productInfo.name",
          totalQuantity: 1,
          totalRevenue: 1,
          salesCount: 1,
          image: "$productInfo.image"
        }
      }
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
    const salesByCategory = await Sale.aggregate([
      { $match: { paymentStatus: 'confirmado' } },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "categoryInfo"
        }
      },
      { $unwind: "$categoryInfo" },
      {
        $group: {
          _id: "$categoryInfo._id",
          name: { $first: "$categoryInfo.name" },
          totalSales: { $sum: "$quantity" },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          color: { $first: "$categoryInfo.color" }
        }
      },
      { $sort: { totalRevenue: -1 } }
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
    const rankings = await Sale.aggregate([
      { 
        $match: { 
          paymentStatus: 'confirmado',
          distributor: { $exists: true, $ne: null }
        } 
      },
      {
        $group: {
          _id: "$distributor",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
          avgOrderValue: { $avg: { $multiply: ["$salePrice", "$quantity"] } }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "distributorInfo"
        }
      },
      { 
        $unwind: { 
          path: "$distributorInfo",
          preserveNullAndEmptyArrays: true 
        } 
      },
      {
        $project: {
          name: { $ifNull: ["$distributorInfo.name", "Distribuidor desconocido"] },
          email: { $ifNull: ["$distributorInfo.email", ""] },
          totalSales: 1,
          totalRevenue: 1,
          totalProfit: 1,
          avgOrderValue: 1
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // Calculate conversion rate
    const allSales = await Sale.aggregate([
      {
        $match: {
          distributor: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$distributor",
          pendiente: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "pendiente"] }, 1, 0] }
          },
          confirmado: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "confirmado"] }, 1, 0] }
          }
        }
      }
    ]);

    const rankingsWithConversion = rankings.map(rank => {
      const salesData = allSales.find(s => s._id && rank._id && s._id.toString() === rank._id.toString());
      const total = salesData ? (salesData.confirmado + salesData.pendiente) : 0;
      const conversionRate = total > 0
        ? ((salesData.confirmado / total) * 100).toFixed(2)
        : 0;
      
      return {
        ...rank,
        conversionRate: parseFloat(conversionRate)
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
    const lowStockProducts = await Product.find({
      $expr: { $lte: ["$warehouseStock", "$lowStockAlert"] }
    })
    .populate('category', 'name')
    .sort({ warehouseStock: 1 })
    .lean();

    const visualData = lowStockProducts.map(product => {
      // Calcular porcentaje basado en el nivel de alerta como 100%
      const maxStock = product.lowStockAlert * 2 || 100; // Asumimos que el doble del alert es el máximo
      const percentage = Math.min(((product.warehouseStock / maxStock) * 100), 100);
      
      return {
        productId: product._id,
        productName: product.name,
        currentStock: product.warehouseStock,
        lowStockAlert: product.lowStockAlert,
        categoryName: product.category?.name || 'Sin categoría',
        stockPercentage: parseFloat(percentage.toFixed(1)),
        urgency: product.warehouseStock === 0 ? 'critical' : 
                 product.warehouseStock <= product.lowStockAlert * 0.5 ? 'critical' :
                 product.warehouseStock <= product.lowStockAlert ? 'warning' : 'normal'
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
    const startDate = subDays(new Date(), parseInt(days));

    const rotation = await Sale.aggregate([
      {
        $match: {
          paymentStatus: 'confirmado',
          saleDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$product",
          totalSold: { $sum: "$quantity" },
          frequency: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $project: {
          name: "$productInfo.name",
          totalSold: 1,
          frequency: 1,
          currentStock: "$productInfo.totalStock",
          rotationRate: {
            $divide: ["$totalSold", { $add: ["$totalSold", "$productInfo.totalStock"] }]
          }
        }
      },
      { $sort: { rotationRate: -1 } }
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
    const today = new Date();
    
    // Ajustar a zona horaria de Colombia (UTC-5)
    // El día en Colombia comienza a las 5:00 AM UTC y termina a las 4:59:59 AM UTC del día siguiente
    const colombiaOffset = -5 * 60; // -5 horas en minutos
    const colombiaTime = new Date(today.getTime() + colombiaOffset * 60000);
    
    // Inicio del día actual en Colombia (medianoche Colombia = 5:00 AM UTC)
    const startOfToday = new Date(Date.UTC(
      colombiaTime.getUTCFullYear(),
      colombiaTime.getUTCMonth(),
      colombiaTime.getUTCDate(),
      5, 0, 0, 0
    ));
    
    // Inicio de la semana en Colombia
    const dayOfWeek = colombiaTime.getUTCDay();
    const startOfThisWeek = new Date(startOfToday);
    startOfThisWeek.setUTCDate(startOfToday.getUTCDate() - dayOfWeek);
    
    // Inicio del mes en Colombia
    const startOfThisMonth = new Date(Date.UTC(
      colombiaTime.getUTCFullYear(),
      colombiaTime.getUTCMonth(),
      1,
      5, 0, 0, 0
    ));

    console.log('KPI Dates:', {
      now: today.toISOString(),
      colombiaTime: colombiaTime.toISOString(),
      startOfToday: startOfToday.toISOString(),
      startOfThisWeek: startOfThisWeek.toISOString(),
      startOfThisMonth: startOfThisMonth.toISOString()
    });

    const [dailyStats, weeklyStats, monthlyStats, avgTicket] = await Promise.all([
      // Daily stats
      Sale.aggregate([
        { $match: { saleDate: { $gte: startOfToday }, paymentStatus: 'confirmado' } },
        {
          $group: {
            _id: null,
            revenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
            sales: { $sum: 1 }
          }
        }
      ]),
      // Weekly stats
      Sale.aggregate([
        { $match: { saleDate: { $gte: startOfThisWeek }, paymentStatus: 'confirmado' } },
        {
          $group: {
            _id: null,
            revenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
            sales: { $sum: 1 }
          }
        }
      ]),
      // Monthly stats
      Sale.aggregate([
        { $match: { saleDate: { $gte: startOfThisMonth }, paymentStatus: 'confirmado' } },
        {
          $group: {
            _id: null,
            revenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
            sales: { $sum: 1 }
          }
        }
      ]),
      // Average ticket
      Sale.aggregate([
        { $match: { paymentStatus: 'confirmado' } },
        {
          $group: {
            _id: null,
            avgTicket: { $avg: { $multiply: ["$salePrice", "$quantity"] } }
          }
        }
      ])
    ]);

    res.json({
      daily: dailyStats[0] || { revenue: 0, profit: 0, sales: 0 },
      weekly: weeklyStats[0] || { revenue: 0, profit: 0, sales: 0 },
      monthly: monthlyStats[0] || { revenue: 0, profit: 0, sales: 0 },
      avgTicket: avgTicket[0]?.avgTicket || 0
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
    const now = new Date();
    
    // Ajustar a zona horaria de Colombia (UTC-5)
    const colombiaOffset = -5 * 60; // -5 horas en minutos
    const colombiaTime = new Date(now.getTime() + colombiaOffset * 60000);
    
    // Inicio del mes actual en Colombia (día 1 a las 00:00 Colombia = 05:00 UTC)
    const thisMonthStart = new Date(Date.UTC(
      colombiaTime.getUTCFullYear(),
      colombiaTime.getUTCMonth(),
      1,
      5, 0, 0, 0
    ));
    
    // Mes anterior
    const lastMonthYear = colombiaTime.getUTCMonth() === 0 ? colombiaTime.getUTCFullYear() - 1 : colombiaTime.getUTCFullYear();
    const lastMonthNum = colombiaTime.getUTCMonth() === 0 ? 11 : colombiaTime.getUTCMonth() - 1;
    
    const lastMonthStart = new Date(Date.UTC(lastMonthYear, lastMonthNum, 1, 5, 0, 0, 0));
    const lastMonthEnd = new Date(thisMonthStart.getTime() - 1); // 1 milisegundo antes del inicio del mes actual

    console.log('Comparative Analysis Dates:', {
      now: now.toISOString(),
      colombiaTime: colombiaTime.toISOString(),
      lastMonthStart: lastMonthStart.toISOString(),
      lastMonthEnd: lastMonthEnd.toISOString(),
      thisMonthStart: thisMonthStart.toISOString()
    });

    const [lastMonth, thisMonth] = await Promise.all([
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: lastMonthStart, $lte: lastMonthEnd },
            paymentStatus: 'confirmado'
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
            sales: { $sum: 1 }
          }
        }
      ]),
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: thisMonthStart },
            paymentStatus: 'confirmado'
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
            sales: { $sum: 1 }
          }
        }
      ])
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
          salesGrowth: parseFloat(calculateGrowth(thisMonthData.sales, lastMonthData.sales)),
          revenueGrowth: parseFloat(calculateGrowth(thisMonthData.revenue, lastMonthData.revenue)),
          profitGrowth: parseFloat(calculateGrowth(thisMonthData.profit, lastMonthData.profit))
        }
      }
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
    const funnelData = await Sale.aggregate([
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ["$salePrice", "$quantity"] } }
        }
      }
    ]);

    const funnel = {
      pending: funnelData.find(f => f._id === 'pendiente') || { count: 0, totalValue: 0 },
      confirmed: funnelData.find(f => f._id === 'confirmado') || { count: 0, totalValue: 0 }
    };

    const total = funnel.pending.count + funnel.confirmed.count;
    funnel.conversionRate = total > 0 ? parseFloat(((funnel.confirmed.count / total) * 100).toFixed(2)) : 0;

    res.json({ funnel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
