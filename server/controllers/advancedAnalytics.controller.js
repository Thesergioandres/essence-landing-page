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
    const { period = 'week', startDate: customStartDate, endDate: customEndDate } = req.query;
    
    let startDate, groupBy;
    const now = new Date();
    
    // Si se proporcionan fechas personalizadas, usarlas
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    } else {
      // Si no, usar períodos predefinidos más amplios
      switch(period) {
        case 'day':
          startDate = subDays(now, 30); // Últimos 30 días
          groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
          break;
        case 'week':
          startDate = subDays(now, 90); // Últimos 90 días
          groupBy = { $dateToString: { format: "%Y-W%V", date: "$createdAt" } };
          break;
        case 'month':
          startDate = subMonths(now, 12); // Últimos 12 meses
          groupBy = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
          break;
        default:
          startDate = subDays(now, 90); // Por defecto 90 días
          groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
      }
    }

    const matchFilter = { paymentStatus: 'confirmed' };
    if (startDate) {
      matchFilter.createdAt = { $gte: startDate };
    }
    if (customEndDate) {
      matchFilter.createdAt = matchFilter.createdAt || {};
      matchFilter.createdAt.$lte = new Date(customEndDate);
    }

    const timeline = await Sale.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: groupBy,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
          totalProfit: { $sum: "$profit" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log(`Sales Timeline - Found ${timeline.length} records with filter:`, matchFilter);

    // Map the response to match frontend expectations
    const formattedTimeline = timeline.map(item => ({
      period: item._id,
      salesCount: item.totalSales,
      revenue: item.totalRevenue,
      profit: item.totalProfit
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
      { $match: { paymentStatus: 'confirmed' } },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          totalQuantity: { $sum: "$products.quantity" },
          totalRevenue: { $sum: { $multiply: ["$products.quantity", "$products.price"] } },
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
      { $match: { paymentStatus: 'confirmed' } },
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products.product",
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
          totalSales: { $sum: "$products.quantity" },
          totalRevenue: { $sum: { $multiply: ["$products.quantity", "$products.price"] } },
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
      { $match: { paymentStatus: 'confirmed' } },
      {
        $group: {
          _id: "$distributor",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
          totalProfit: { $sum: "$profit" },
          avgOrderValue: { $avg: "$totalPrice" }
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
      { $unwind: "$distributorInfo" },
      {
        $project: {
          name: "$distributorInfo.name",
          email: "$distributorInfo.email",
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
        $group: {
          _id: "$distributor",
          pending: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0] }
          },
          confirmed: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "confirmed"] }, 1, 0] }
          }
        }
      }
    ]);

    const rankingsWithConversion = rankings.map(rank => {
      const salesData = allSales.find(s => s._id.toString() === rank._id.toString());
      const conversionRate = salesData 
        ? ((salesData.confirmed / (salesData.confirmed + salesData.pending)) * 100).toFixed(2)
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

    const visualData = lowStockProducts.map(product => ({
      ...product,
      stockPercentage: ((product.warehouseStock / product.lowStockAlert) * 100).toFixed(0),
      urgency: product.warehouseStock === 0 ? 'critical' : 
               product.warehouseStock <= product.lowStockAlert * 0.5 ? 'high' : 'medium'
    }));

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
          paymentStatus: 'confirmed',
          createdAt: { $gte: startDate }
        }
      },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          totalSold: { $sum: "$products.quantity" },
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
    const startOfToday = startOfDay(today);
    const startOfThisWeek = startOfWeek(today);
    const startOfThisMonth = startOfMonth(today);

    const [dailyStats, weeklyStats, monthlyStats, avgTicket] = await Promise.all([
      // Daily stats
      Sale.aggregate([
        { $match: { createdAt: { $gte: startOfToday }, paymentStatus: 'confirmed' } },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalPrice" },
            profit: { $sum: "$profit" },
            sales: { $sum: 1 }
          }
        }
      ]),
      // Weekly stats
      Sale.aggregate([
        { $match: { createdAt: { $gte: startOfThisWeek }, paymentStatus: 'confirmed' } },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalPrice" },
            profit: { $sum: "$profit" },
            sales: { $sum: 1 }
          }
        }
      ]),
      // Monthly stats
      Sale.aggregate([
        { $match: { createdAt: { $gte: startOfThisMonth }, paymentStatus: 'confirmed' } },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalPrice" },
            profit: { $sum: "$profit" },
            sales: { $sum: 1 }
          }
        }
      ]),
      // Average ticket
      Sale.aggregate([
        { $match: { paymentStatus: 'confirmed' } },
        {
          $group: {
            _id: null,
            avgTicket: { $avg: "$totalPrice" }
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
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));
    const thisMonthStart = startOfMonth(now);

    const [lastMonth, thisMonth] = await Promise.all([
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
            paymentStatus: 'confirmed'
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalPrice" },
            profit: { $sum: "$profit" },
            sales: { $sum: 1 }
          }
        }
      ]),
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: thisMonthStart },
            paymentStatus: 'confirmed'
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalPrice" },
            profit: { $sum: "$profit" },
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
      lastMonth: lastMonthData,
      thisMonth: thisMonthData,
      growth: {
        revenue: parseFloat(calculateGrowth(thisMonthData.revenue, lastMonthData.revenue)),
        profit: parseFloat(calculateGrowth(thisMonthData.profit, lastMonthData.profit)),
        sales: parseFloat(calculateGrowth(thisMonthData.sales, lastMonthData.sales))
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
          totalValue: { $sum: "$totalPrice" }
        }
      }
    ]);

    const funnel = {
      pending: funnelData.find(f => f._id === 'pending') || { count: 0, totalValue: 0 },
      confirmed: funnelData.find(f => f._id === 'confirmed') || { count: 0, totalValue: 0 }
    };

    const total = funnel.pending.count + funnel.confirmed.count;
    funnel.conversionRate = total > 0 ? ((funnel.confirmed.count / total) * 100).toFixed(2) : 0;

    res.json({ funnel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
