import Sale from "../models/Sale.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import DistributorStock from "../models/DistributorStock.js";
import DefectiveProduct from "../models/DefectiveProduct.js";

// @desc    Obtener resumen de ganancias del mes actual
// @route   GET /api/analytics/monthly-profit
// @access  Private/Admin
export const getMonthlyProfit = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Mes anterior para comparación
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Ventas del mes actual
    const currentMonthSales = await Sale.find({
      saleDate: { $gte: startOfMonth, $lte: endOfMonth },
      paymentStatus: "confirmado",
    });

    // Ventas del mes anterior
    const lastMonthSales = await Sale.find({
      saleDate: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      paymentStatus: "confirmado",
    });

    const calculateTotals = (sales) => {
      return sales.reduce(
        (acc, sale) => {
          acc.adminProfit += sale.adminProfit;
          acc.distributorProfit += sale.distributorProfit;
          acc.totalProfit += sale.totalProfit;
          acc.revenue += sale.salePrice * sale.quantity;
          acc.cost += sale.purchasePrice * sale.quantity;
          acc.salesCount += 1;
          acc.unitsCount += sale.quantity;
          return acc;
        },
        {
          adminProfit: 0,
          distributorProfit: 0,
          totalProfit: 0,
          revenue: 0,
          cost: 0,
          salesCount: 0,
          unitsCount: 0,
        }
      );
    };

    const currentMonth = calculateTotals(currentMonthSales);
    const lastMonth = calculateTotals(lastMonthSales);

    // Calcular porcentaje de crecimiento
    const growthPercentage =
      lastMonth.totalProfit > 0
        ? ((currentMonth.totalProfit - lastMonth.totalProfit) / lastMonth.totalProfit) * 100
        : currentMonth.totalProfit > 0
        ? 100
        : 0;

    res.json({
      currentMonth,
      lastMonth,
      growthPercentage: parseFloat(growthPercentage.toFixed(2)),
      averageTicket: currentMonth.salesCount > 0 ? currentMonth.revenue / currentMonth.salesCount : 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener ganancias por producto
// @route   GET /api/analytics/profit-by-product
// @access  Private/Admin
export const getProfitByProduct = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter = { paymentStatus: "confirmado" };
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    const profitByProduct = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$product",
          totalQuantity: { $sum: "$quantity" },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalCost: { $sum: { $multiply: ["$purchasePrice", "$quantity"] } },
          totalAdminProfit: { $sum: "$adminProfit" },
          totalDistributorProfit: { $sum: "$distributorProfit" },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          productId: "$_id",
          productName: "$product.name",
          productImage: "$product.image",
          totalQuantity: 1,
          totalSales: 1,
          totalRevenue: 1,
          totalCost: 1,
          totalAdminProfit: 1,
          totalDistributorProfit: 1,
          totalProfit: 1,
          profitMargin: {
            $cond: [
              { $gt: ["$totalRevenue", 0] },
              { $multiply: [{ $divide: ["$totalProfit", "$totalRevenue"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { totalProfit: -1 } },
    ]);

    res.json(profitByProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener ganancias por distribuidor
// @route   GET /api/analytics/profit-by-distributor
// @access  Private/Admin
export const getProfitByDistributor = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter = { paymentStatus: "confirmado" };
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    const profitByDistributor = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$distributor",
          totalQuantity: { $sum: "$quantity" },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalCost: { $sum: { $multiply: ["$purchasePrice", "$quantity"] } },
          totalAdminProfit: { $sum: "$adminProfit" },
          totalDistributorProfit: { $sum: "$distributorProfit" },
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
      {
        $project: {
          distributorId: "$_id",
          distributorName: "$distributor.name",
          distributorEmail: "$distributor.email",
          totalQuantity: 1,
          totalSales: 1,
          totalRevenue: 1,
          totalCost: 1,
          totalAdminProfit: 1,
          totalDistributorProfit: 1,
          totalProfit: 1,
          averageSale: { $divide: ["$totalRevenue", "$totalSales"] },
        },
      },
      { $sort: { totalAdminProfit: -1 } },
    ]);

    res.json(profitByDistributor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener promedios diarios/semanales/mensuales
// @route   GET /api/analytics/averages
// @access  Private/Admin
export const getAverages = async (req, res) => {
  try {
    const { period = "month" } = req.query; // day, week, month
    
    const now = new Date();
    let startDate, days;

    switch (period) {
      case "day":
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        days = 1;
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        days = 7;
        break;
      case "month":
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        days = now.getDate();
        break;
    }

    const sales = await Sale.find({
      saleDate: { $gte: startDate },
      paymentStatus: "confirmado",
    });

    const totals = sales.reduce(
      (acc, sale) => {
        acc.totalRevenue += sale.salePrice * sale.quantity;
        acc.totalProfit += sale.totalProfit;
        acc.totalSales += 1;
        acc.totalUnits += sale.quantity;
        return acc;
      },
      { totalRevenue: 0, totalProfit: 0, totalSales: 0, totalUnits: 0 }
    );

    res.json({
      period,
      days,
      averageRevenuePerDay: totals.totalRevenue / days,
      averageProfitPerDay: totals.totalProfit / days,
      averageSalesPerDay: totals.totalSales / days,
      averageUnitsPerDay: totals.totalUnits / days,
      totalRevenue: totals.totalRevenue,
      totalProfit: totals.totalProfit,
      totalSales: totals.totalSales,
      totalUnits: totals.totalUnits,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener datos para gráfica de ventas en el tiempo
// @route   GET /api/analytics/sales-timeline
// @access  Private/Admin
export const getSalesTimeline = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    const sales = await Sale.find({
      saleDate: { $gte: startDate },
      paymentStatus: "confirmado",
    }).sort({ saleDate: 1 });

    // Agrupar por día
    const salesByDay = {};
    sales.forEach((sale) => {
      const day = sale.saleDate.toISOString().split("T")[0];
      if (!salesByDay[day]) {
        salesByDay[day] = {
          date: day,
          sales: 0,
          revenue: 0,
          profit: 0,
          units: 0,
          cost: 0,
        };
      }
      salesByDay[day].sales += 1;
      salesByDay[day].revenue += sale.salePrice * sale.quantity;
      salesByDay[day].profit += sale.totalProfit;
      salesByDay[day].units += sale.quantity;
      salesByDay[day].cost += sale.purchasePrice * sale.quantity;
    });

    const timeline = Object.values(salesByDay);
    res.json(timeline);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener resumen financiero completo
// @route   GET /api/analytics/financial-summary
// @access  Private/Admin
export const getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter = { paymentStatus: "confirmado" };
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    const sales = await Sale.find(filter);
    const defectiveProducts = await DefectiveProduct.find({
      status: "confirmado",
      ...(startDate && { reportDate: { $gte: new Date(startDate) } }),
      ...(endDate && { reportDate: { $lte: new Date(endDate) } }),
    });

    // Calcular totales
    const totals = sales.reduce(
      (acc, sale) => {
        acc.totalCost += sale.purchasePrice * sale.quantity;
        acc.totalRevenue += sale.salePrice * sale.quantity;
        acc.totalAdminProfit += sale.adminProfit;
        acc.totalDistributorProfit += sale.distributorProfit;
        acc.totalProfit += sale.totalProfit;
        acc.totalSales += 1;
        acc.totalUnits += sale.quantity;
        return acc;
      },
      {
        totalCost: 0,
        totalRevenue: 0,
        totalAdminProfit: 0,
        totalDistributorProfit: 0,
        totalProfit: 0,
        totalSales: 0,
        totalUnits: 0,
      }
    );

    // Calcular pérdidas por defectuosos
    const defectiveLoss = defectiveProducts.reduce((sum, def) => {
      return sum + def.quantity;
    }, 0);

    res.json({
      ...totals,
      profitMargin: totals.totalRevenue > 0 ? (totals.totalProfit / totals.totalRevenue) * 100 : 0,
      averageTicket: totals.totalSales > 0 ? totals.totalRevenue / totals.totalSales : 0,
      defectiveUnits: defectiveLoss,
      defectiveRate: totals.totalUnits > 0 ? (defectiveLoss / totals.totalUnits) * 100 : 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener dashboard completo de analytics
// @route   GET /api/analytics/dashboard
// @access  Private/Admin
export const getAnalyticsDashboard = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Ventas del mes
    const monthlySales = await Sale.find({
      saleDate: { $gte: startOfMonth },
      paymentStatus: "confirmado",
    });

    // Top productos
    const topProducts = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfMonth },
          paymentStatus: "confirmado",
        },
      },
      {
        $group: {
          _id: "$product",
          totalQuantity: { $sum: "$quantity" },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          name: "$product.name",
          image: "$product.image",
          totalQuantity: 1,
          totalProfit: 1,
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);

    // Top distribuidores
    const topDistributors = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfMonth },
          paymentStatus: "confirmado",
        },
      },
      {
        $group: {
          _id: "$distributor",
          totalSales: { $sum: 1 },
          totalProfit: { $sum: "$adminProfit" },
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
          name: "$distributor.name",
          totalSales: 1,
          totalProfit: 1,
        },
      },
      { $sort: { totalProfit: -1 } },
      { $limit: 5 },
    ]);

    const monthlyTotals = monthlySales.reduce(
      (acc, sale) => {
        acc.totalRevenue += sale.salePrice * sale.quantity;
        acc.totalProfit += sale.totalProfit;
        acc.totalSales += 1;
        return acc;
      },
      { totalRevenue: 0, totalProfit: 0, totalSales: 0 }
    );

    res.json({
      monthlyTotals,
      topProducts,
      topDistributors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
