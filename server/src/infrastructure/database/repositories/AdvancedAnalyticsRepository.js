import mongoose from "mongoose";
import Credit from "../models/Credit.js";
import DefectiveProduct from "../models/DefectiveProduct.js";
import Expense from "../models/Expense.js";
import Membership from "../models/Membership.js";
import SpecialSale from "../models/SpecialSale.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";

const buildColombiaRange = (startStr, endStr) => {
  if (!startStr && !endStr) return null;

  const range = {};

  if (startStr) {
    const date = new Date(startStr);
    range.$gte = new Date(
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
  if (endStr) {
    const date = new Date(endStr);
    range.$lte = new Date(
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

  return range;
};

const buildSaleRevenueExpression = () => ({
  $ifNull: [
    "$actualPayment",
    {
      $subtract: [
        { $multiply: ["$salePrice", "$quantity"] },
        { $ifNull: ["$discount", 0] },
      ],
    },
  ],
});

const buildAdminNetProfitExpression = () => ({
  $ifNull: [
    "$netProfit",
    {
      $subtract: [
        {
          $subtract: [
            {
              $subtract: [
                { $ifNull: ["$adminProfit", 0] },
                { $ifNull: ["$totalAdditionalCosts", 0] },
              ],
            },
            { $ifNull: ["$discount", 0] },
          ],
        },
        { $ifNull: ["$shippingCost", 0] },
      ],
    },
  ],
});

const buildTotalGroupProfitExpression = () => ({
  $ifNull: [
    "$totalGroupProfit",
    {
      $ifNull: [
        "$totalProfit",
        { $add: ["$adminProfit", "$employeeProfit"] },
      ],
    },
  ],
});

const resolveScopedUserObjectId = (options = {}) => {
  const rawId =
    options.scopeEmployeeId || options.employeeId || options.userId;

  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    return null;
  }

  return new mongoose.Types.ObjectId(rawId);
};

const shouldHideFinancialData = (options = {}) =>
  options?.hideFinancialData === true;

const withSaleScope = (match, scopedUserObjectId) => {
  if (!scopedUserObjectId) {
    return match;
  }

  return {
    ...match,
    $or: [
      { employee: scopedUserObjectId },
      { createdBy: scopedUserObjectId },
    ],
  };
};

const withSpecialSaleScope = (match, scopedUserObjectId) => {
  if (!scopedUserObjectId) {
    return match;
  }

  return {
    ...match,
    createdBy: scopedUserObjectId,
  };
};

export class AdvancedAnalyticsRepository {
  // Financial KPIs - Main dashboard data
  async getFinancialKPIs(businessId, startDate, endDate, options = {}) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);
    const scopedUserObjectId = resolveScopedUserObjectId(options);
    const hideFinancialData = shouldHideFinancialData(options);
    const isScopedFinancialView = Boolean(
      scopedUserObjectId || hideFinancialData,
    );

    const match = withSaleScope(
      {
        business: businessObjectId,
        paymentStatus: "confirmado",
        ...(dateRange ? { saleDate: dateRange } : {}),
      },
      scopedUserObjectId,
    );

    // Get today's data
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));

    const todayMatch = withSaleScope(
      {
        business: businessObjectId,
        paymentStatus: "confirmado",
        saleDate: { $gte: todayStart, $lte: todayEnd },
      },
      scopedUserObjectId,
    );

    // Get this week's data
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekMatch = withSaleScope(
      {
        business: businessObjectId,
        paymentStatus: "confirmado",
        saleDate: { $gte: weekStart, $lte: new Date() },
      },
      scopedUserObjectId,
    );

    // Get this month's data
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - 1);
    const monthMatch = withSaleScope(
      {
        business: businessObjectId,
        paymentStatus: "confirmado",
        saleDate: { $gte: monthStart, $lte: new Date() },
      },
      scopedUserObjectId,
    );

    const specialRangeMatch = withSpecialSaleScope(
      {
        business: businessObjectId,
        status: "active",
        ...(dateRange ? { saleDate: dateRange } : {}),
      },
      scopedUserObjectId,
    );

    const specialTodayMatch = withSpecialSaleScope(
      {
        business: businessObjectId,
        status: "active",
        saleDate: { $gte: todayStart, $lte: todayEnd },
      },
      scopedUserObjectId,
    );

    const specialWeekMatch = withSpecialSaleScope(
      {
        business: businessObjectId,
        status: "active",
        saleDate: { $gte: weekStart, $lte: new Date() },
      },
      scopedUserObjectId,
    );

    const specialMonthMatch = withSpecialSaleScope(
      {
        business: businessObjectId,
        status: "active",
        saleDate: { $gte: monthStart, $lte: new Date() },
      },
      scopedUserObjectId,
    );

    const [
      rangeData,
      rangeSpecialData,
      todayData,
      todaySpecialData,
      weekData,
      weekSpecialData,
      monthData,
      monthSpecialData,
      warrantyRangeData,
      warrantyTodayData,
      warrantyWeekData,
      warrantyMonthData,
      warrantyRevenueRangeData,
      warrantyRevenueTodayData,
      warrantyRevenueWeekData,
      warrantyRevenueMonthData,
      creditPendingRangeData,
      creditPendingTodayData,
      creditPendingWeekData,
      creditPendingMonthData,
      activeEmployees,
      expensesData,
    ] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: {
              $sum: buildSaleRevenueExpression(),
            },
            profit: {
              $sum: buildTotalGroupProfitExpression(),
            },
            netProfit: {
              $sum: buildAdminNetProfitExpression(),
            },
            quantity: { $sum: "$quantity" },
          },
        },
      ]),
      SpecialSale.aggregate([
        { $match: specialRangeMatch },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: { $sum: { $multiply: ["$specialPrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
            netProfit: { $sum: "$totalProfit" },
            quantity: { $sum: "$quantity" },
          },
        },
      ]),
      Sale.aggregate([
        { $match: todayMatch },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: {
              $sum: buildSaleRevenueExpression(),
            },
            profit: {
              $sum: buildTotalGroupProfitExpression(),
            },
            netProfit: {
              $sum: buildAdminNetProfitExpression(),
            },
          },
        },
      ]),
      SpecialSale.aggregate([
        { $match: specialTodayMatch },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: { $sum: { $multiply: ["$specialPrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
            netProfit: { $sum: "$totalProfit" },
          },
        },
      ]),
      Sale.aggregate([
        { $match: weekMatch },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: {
              $sum: buildSaleRevenueExpression(),
            },
            profit: {
              $sum: buildTotalGroupProfitExpression(),
            },
            netProfit: {
              $sum: buildAdminNetProfitExpression(),
            },
          },
        },
      ]),
      SpecialSale.aggregate([
        { $match: specialWeekMatch },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: { $sum: { $multiply: ["$specialPrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
            netProfit: { $sum: "$totalProfit" },
          },
        },
      ]),
      Sale.aggregate([
        { $match: monthMatch },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: {
              $sum: buildSaleRevenueExpression(),
            },
            profit: {
              $sum: buildTotalGroupProfitExpression(),
            },
            netProfit: {
              $sum: buildAdminNetProfitExpression(),
            },
          },
        },
      ]),
      SpecialSale.aggregate([
        { $match: specialMonthMatch },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: { $sum: { $multiply: ["$specialPrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
            netProfit: { $sum: "$totalProfit" },
          },
        },
      ]),
      DefectiveProduct.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["confirmado", "procesado"] },
            lossAmount: { $ne: 0 },
            origin: { $ne: "order" },
            ...(dateRange ? { reportDate: dateRange } : {}),
          },
        },
        { $group: { _id: null, totalLoss: { $sum: "$lossAmount" } } },
      ]),
      DefectiveProduct.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["confirmado", "procesado"] },
            lossAmount: { $ne: 0 },
            origin: { $ne: "order" },
            reportDate: { $gte: todayStart, $lte: todayEnd },
          },
        },
        { $group: { _id: null, totalLoss: { $sum: "$lossAmount" } } },
      ]),
      DefectiveProduct.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["confirmado", "procesado"] },
            lossAmount: { $ne: 0 },
            origin: { $ne: "order" },
            reportDate: { $gte: weekStart, $lte: new Date() },
          },
        },
        { $group: { _id: null, totalLoss: { $sum: "$lossAmount" } } },
      ]),
      DefectiveProduct.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["confirmado", "procesado"] },
            lossAmount: { $ne: 0 },
            origin: { $ne: "order" },
            reportDate: { $gte: monthStart, $lte: new Date() },
          },
        },
        { $group: { _id: null, totalLoss: { $sum: "$lossAmount" } } },
      ]),
      DefectiveProduct.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["confirmado", "procesado"] },
            origin: "customer_warranty",
            ...(dateRange ? { reportDate: dateRange } : {}),
          },
        },
        {
          $group: {
            _id: null,
            totalAdjust: {
              $sum: {
                $subtract: [
                  { $ifNull: ["$priceDifference", 0] },
                  { $ifNull: ["$cashRefund", 0] },
                ],
              },
            },
          },
        },
      ]),
      DefectiveProduct.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["confirmado", "procesado"] },
            origin: "customer_warranty",
            reportDate: { $gte: todayStart, $lte: todayEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalAdjust: {
              $sum: {
                $subtract: [
                  { $ifNull: ["$priceDifference", 0] },
                  { $ifNull: ["$cashRefund", 0] },
                ],
              },
            },
          },
        },
      ]),
      DefectiveProduct.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["confirmado", "procesado"] },
            origin: "customer_warranty",
            reportDate: { $gte: weekStart, $lte: new Date() },
          },
        },
        {
          $group: {
            _id: null,
            totalAdjust: {
              $sum: {
                $subtract: [
                  { $ifNull: ["$priceDifference", 0] },
                  { $ifNull: ["$cashRefund", 0] },
                ],
              },
            },
          },
        },
      ]),
      DefectiveProduct.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["confirmado", "procesado"] },
            origin: "customer_warranty",
            reportDate: { $gte: monthStart, $lte: new Date() },
          },
        },
        {
          $group: {
            _id: null,
            totalAdjust: {
              $sum: {
                $subtract: [
                  { $ifNull: ["$priceDifference", 0] },
                  { $ifNull: ["$cashRefund", 0] },
                ],
              },
            },
          },
        },
      ]),
      Credit.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["pending", "partial", "overdue"] },
            ...(dateRange ? { createdAt: dateRange } : {}),
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$remainingAmount" },
          },
        },
      ]),
      Credit.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["pending", "partial", "overdue"] },
            createdAt: { $gte: todayStart, $lte: todayEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$remainingAmount" },
          },
        },
      ]),
      Credit.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["pending", "partial", "overdue"] },
            createdAt: { $gte: weekStart, $lte: new Date() },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$remainingAmount" },
          },
        },
      ]),
      Credit.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["pending", "partial", "overdue"] },
            createdAt: { $gte: monthStart, $lte: new Date() },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$remainingAmount" },
          },
        },
      ]),
      // Count active employees for this business
      isScopedFinancialView
        ? Promise.resolve(1)
        : Membership.countDocuments({
            business: businessObjectId,
            role: "employee",
            status: "active",
          }),
      // Get expenses summary
      isScopedFinancialView
        ? Promise.resolve([{ totalExpenses: 0, count: 0 }])
        : Expense.aggregate([
            {
              $match: {
                business: businessObjectId,
                ...(dateRange ? { expenseDate: dateRange } : {}),
              },
            },
            {
              $group: {
                _id: null,
                totalExpenses: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
          ]),
    ]);

    const range = rangeData[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
      netProfit: 0,
      quantity: 0,
    };
    const rangeSpecial = rangeSpecialData[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
      netProfit: 0,
      quantity: 0,
    };
    const daily = todayData[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
      netProfit: 0,
    };
    const weekly = weekData[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
      netProfit: 0,
    };
    const monthly = monthData[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
      netProfit: 0,
    };
    const dailySpecial = todaySpecialData[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
      netProfit: 0,
    };
    const weeklySpecial = weekSpecialData[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
      netProfit: 0,
    };
    const monthlySpecial = monthSpecialData[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
      netProfit: 0,
    };
    const warrantyRange = warrantyRangeData[0]?.totalLoss || 0;
    const warrantyDaily = warrantyTodayData[0]?.totalLoss || 0;
    const warrantyWeekly = warrantyWeekData[0]?.totalLoss || 0;
    const warrantyMonthly = warrantyMonthData[0]?.totalLoss || 0;
    const warrantyRevenueRange = warrantyRevenueRangeData[0]?.totalAdjust || 0;
    const warrantyRevenueDaily = warrantyRevenueTodayData[0]?.totalAdjust || 0;
    const warrantyRevenueWeekly = warrantyRevenueWeekData[0]?.totalAdjust || 0;
    const warrantyRevenueMonthly =
      warrantyRevenueMonthData[0]?.totalAdjust || 0;
    const creditRange = creditPendingRangeData[0]?.totalAmount || 0;
    const creditDaily = creditPendingTodayData[0]?.totalAmount || 0;
    const creditWeekly = creditPendingWeekData[0]?.totalAmount || 0;
    const creditMonthly = creditPendingMonthData[0]?.totalAmount || 0;
    const expenses = expensesData[0] || { totalExpenses: 0, count: 0 };

    const scopedWarrantyRange = isScopedFinancialView ? 0 : warrantyRange;
    const scopedWarrantyDaily = isScopedFinancialView ? 0 : warrantyDaily;
    const scopedWarrantyWeekly = isScopedFinancialView ? 0 : warrantyWeekly;
    const scopedWarrantyMonthly = isScopedFinancialView ? 0 : warrantyMonthly;

    const scopedWarrantyRevenueRange = isScopedFinancialView
      ? 0
      : warrantyRevenueRange;
    const scopedWarrantyRevenueDaily = isScopedFinancialView
      ? 0
      : warrantyRevenueDaily;
    const scopedWarrantyRevenueWeekly = isScopedFinancialView
      ? 0
      : warrantyRevenueWeekly;
    const scopedWarrantyRevenueMonthly = isScopedFinancialView
      ? 0
      : warrantyRevenueMonthly;

    const scopedCreditRange = isScopedFinancialView ? 0 : creditRange;
    const scopedCreditDaily = isScopedFinancialView ? 0 : creditDaily;
    const scopedCreditWeekly = isScopedFinancialView ? 0 : creditWeekly;
    const scopedCreditMonthly = isScopedFinancialView ? 0 : creditMonthly;

    const combinedRange = {
      sales: range.sales + rangeSpecial.sales,
      revenue:
        range.revenue + rangeSpecial.revenue + scopedWarrantyRevenueRange,
      profit: range.profit + rangeSpecial.profit,
      netProfit: range.netProfit + rangeSpecial.netProfit,
      quantity: range.quantity + rangeSpecial.quantity,
    };
    const combinedDaily = {
      sales: daily.sales + dailySpecial.sales,
      revenue:
        daily.revenue + dailySpecial.revenue + scopedWarrantyRevenueDaily,
      profit: daily.profit + dailySpecial.profit,
      netProfit: daily.netProfit + dailySpecial.netProfit,
    };
    const combinedWeekly = {
      sales: weekly.sales + weeklySpecial.sales,
      revenue:
        weekly.revenue + weeklySpecial.revenue + scopedWarrantyRevenueWeekly,
      profit: weekly.profit + weeklySpecial.profit,
      netProfit: weekly.netProfit + weeklySpecial.netProfit,
    };
    const combinedMonthly = {
      sales: monthly.sales + monthlySpecial.sales,
      revenue:
        monthly.revenue + monthlySpecial.revenue + scopedWarrantyRevenueMonthly,
      profit: monthly.profit + monthlySpecial.profit,
      netProfit: monthly.netProfit + monthlySpecial.netProfit,
    };

    // 🎯 FIX TASK 2: Calculate REAL Net Profit (Admin Profit - Expenses/Losses)
    const rangeExpenses = Math.abs(expenses.totalExpenses || 0);
    const netSalesProfit =
      combinedRange.netProfit - rangeExpenses - scopedWarrantyRange;
    const dailyNetProfit = combinedDaily.netProfit - scopedWarrantyDaily;
    const weeklyNetProfit = combinedWeekly.netProfit - scopedWarrantyWeekly;
    const monthlyNetProfit = combinedMonthly.netProfit - scopedWarrantyMonthly;

    const response = {
      kpis: {
        todaySales: combinedDaily.sales,
        todayRevenue: combinedDaily.revenue,
        todayProfit: combinedDaily.profit,
        todayNetProfit: dailyNetProfit, // TODO: Add daily expense filtering
        weekSales: combinedWeekly.sales,
        weekRevenue: combinedWeekly.revenue,
        weekProfit: combinedWeekly.profit,
        weekNetProfit: weeklyNetProfit, // TODO: Add weekly expense filtering
        monthSales: combinedMonthly.sales,
        monthRevenue: combinedMonthly.revenue,
        monthProfit: combinedMonthly.profit,
        monthNetProfit: monthlyNetProfit, // TODO: Add monthly expense filtering
        todayAccountsReceivable: scopedCreditDaily,
        weekAccountsReceivable: scopedCreditWeekly,
        monthAccountsReceivable: scopedCreditMonthly,
        accountsReceivable: scopedCreditRange,
        averageTicket:
          combinedRange.sales > 0
            ? combinedRange.revenue / combinedRange.sales
            : 0,
        totalActiveEmployees: activeEmployees,
        totalExpenses: expenses.totalExpenses,
        expensesCount: expenses.count,
      },
      daily: combinedDaily,
      weekly: combinedWeekly,
      monthly: combinedMonthly,
      range: {
        sales: combinedRange.sales,
        revenue: combinedRange.revenue,
        grossProfit: combinedRange.profit, // Renamed for clarity
        netProfit: netSalesProfit, // Ganancia neta de ventas
        quantity: combinedRange.quantity,
        avgTicket:
          combinedRange.sales > 0
            ? combinedRange.revenue / combinedRange.sales
            : 0,
        totalExpenses: expenses.totalExpenses,
        accountsReceivable: scopedCreditRange,
      },
    };

    if (hideFinancialData) {
      response.kpis.todayProfit = 0;
      response.kpis.todayNetProfit = 0;
      response.kpis.weekProfit = 0;
      response.kpis.weekNetProfit = 0;
      response.kpis.monthProfit = 0;
      response.kpis.monthNetProfit = 0;

      response.daily.profit = 0;
      response.daily.netProfit = 0;
      response.weekly.profit = 0;
      response.weekly.netProfit = 0;
      response.monthly.profit = 0;
      response.monthly.netProfit = 0;

      response.range.grossProfit = 0;
      response.range.netProfit = 0;
    }

    return response;
  }

  // Sales funnel
  async getSalesFunnel(businessId, startDate, endDate, options = {}) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);
    const scopedUserObjectId = resolveScopedUserObjectId(options);

    const match = withSaleScope(
      {
        business: businessObjectId,
        ...(dateRange ? { saleDate: dateRange } : {}),
      },
      scopedUserObjectId,
    );

    const specialMatch = withSpecialSaleScope(
      {
        business: businessObjectId,
        status: "active",
        ...(dateRange ? { saleDate: dateRange } : {}),
      },
      scopedUserObjectId,
    );

    const [funnel, specialFunnel] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$paymentStatus",
            count: { $sum: 1 },
            totalValue: { $sum: buildSaleRevenueExpression() },
          },
        },
      ]),
      SpecialSale.aggregate([
        { $match: specialMatch },
        {
          $group: {
            _id: "confirmed",
            count: { $sum: 1 },
            totalValue: {
              $sum: { $multiply: ["$specialPrice", "$quantity"] },
            },
          },
        },
      ]),
    ]);

    const pending = funnel.find((f) => f._id === "pendiente") || {
      count: 0,
      totalValue: 0,
    };
    const confirmed = funnel.find((f) => f._id === "confirmado") || {
      count: 0,
      totalValue: 0,
    };
    const specialConfirmed = specialFunnel[0] || { count: 0, totalValue: 0 };
    const totalConfirmedCount = confirmed.count + specialConfirmed.count;
    const totalConfirmedValue =
      confirmed.totalValue + specialConfirmed.totalValue;
    const total = pending.count + totalConfirmedCount;

    return {
      funnel: {
        pending: { count: pending.count, totalValue: pending.totalValue },
        confirmed: {
          count: totalConfirmedCount,
          totalValue: totalConfirmedValue,
        },
        conversionRate: total > 0 ? (totalConfirmedCount / total) * 100 : 0,
      },
    };
  }

  // Sales timeline
  async getSalesTimeline(
    businessId,
    startDate,
    endDate,
    groupBy = "day",
    options = {},
  ) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);
    const scopedUserObjectId = resolveScopedUserObjectId(options);
    const hideFinancialData = shouldHideFinancialData(options);
    const isScopedFinancialView = Boolean(
      scopedUserObjectId || hideFinancialData,
    );

    const match = withSaleScope(
      {
        business: businessObjectId,
        paymentStatus: "confirmado",
        ...(dateRange ? { saleDate: dateRange } : {}),
      },
      scopedUserObjectId,
    );

    const specialTimelineMatch = withSpecialSaleScope(
      {
        business: businessObjectId,
        status: "active",
        ...(dateRange ? { saleDate: dateRange } : {}),
      },
      scopedUserObjectId,
    );

    let dateFormat;
    switch (groupBy) {
      case "hour":
        dateFormat = "%Y-%m-%d %H:00";
        break;
      case "week":
        dateFormat = "%Y-W%V";
        break;
      case "month":
        dateFormat = "%Y-%m";
        break;
      default:
        dateFormat = "%Y-%m-%d";
    }

    const timeZone = "America/Bogota";

    const timeline = await Sale.aggregate([
      { $match: match },
      {
        $project: {
          saleDate: "$saleDate",
          revenue: buildSaleRevenueExpression(),
          profit: buildTotalGroupProfitExpression(),
          netProfit: buildAdminNetProfitExpression(),
          quantity: "$quantity",
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            { $match: specialTimelineMatch },
            {
              $project: {
                saleDate: "$saleDate",
                revenue: { $multiply: ["$specialPrice", "$quantity"] },
                profit: "$totalProfit",
                netProfit: "$totalProfit",
                quantity: "$quantity",
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: "$saleDate",
              timezone: timeZone,
            },
          },
          salesCount: { $sum: 1 },
          revenue: { $sum: "$revenue" },
          profit: { $sum: "$profit" },
          netProfit: { $sum: "$netProfit" },
          quantity: { $sum: "$quantity" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const warrantyTimeline = isScopedFinancialView
      ? []
      : await DefectiveProduct.aggregate([
          {
            $match: {
              business: businessObjectId,
              status: "confirmado",
              origin: { $ne: "order" },
              ...(dateRange ? { reportDate: dateRange } : {}),
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: dateFormat,
                  date: "$reportDate",
                  timezone: timeZone,
                },
              },
              totalLoss: { $sum: "$lossAmount" },
            },
          },
        ]);

    const warrantyLossByDate = new Map(
      warrantyTimeline.map((item) => [item._id, item.totalLoss || 0]),
    );

    const warrantyRevenueTimeline = isScopedFinancialView
      ? []
      : await DefectiveProduct.aggregate([
          {
            $match: {
              business: businessObjectId,
              status: "confirmado",
              origin: "customer_warranty",
              ...(dateRange ? { reportDate: dateRange } : {}),
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: dateFormat,
                  date: "$reportDate",
                  timezone: timeZone,
                },
              },
              totalAdjust: {
                $sum: {
                  $subtract: [
                    { $ifNull: ["$priceDifference", 0] },
                    { $ifNull: ["$cashRefund", 0] },
                  ],
                },
              },
            },
          },
        ]);

    const warrantyRevenueByDate = new Map(
      warrantyRevenueTimeline.map((item) => [item._id, item.totalAdjust || 0]),
    );

    const totalWarrantyLoss = warrantyTimeline.reduce(
      (sum, item) => sum + (item.totalLoss || 0),
      0,
    );
    const totalWarrantyRevenueAdjust = warrantyRevenueTimeline.reduce(
      (sum, item) => sum + (item.totalAdjust || 0),
      0,
    );

    const total = timeline.reduce(
      (acc, t) => ({
        sales: acc.sales + t.salesCount,
        revenue: acc.revenue + t.revenue,
        profit: acc.profit + t.profit,
        netProfit: acc.netProfit + t.netProfit,
      }),
      { sales: 0, revenue: 0, profit: 0, netProfit: 0 },
    );

    const peak = timeline.reduce(
      (max, t) => (t.salesCount > max.salesCount ? t : max),
      { _id: "", salesCount: 0 },
    );

    const response = {
      timeline: timeline.map((t) => {
        const warrantyLoss = warrantyLossByDate.get(t._id) || 0;
        const warrantyRevenueAdjust = warrantyRevenueByDate.get(t._id) || 0;
        return {
          date: t._id,
          salesCount: t.salesCount,
          revenue: t.revenue + warrantyRevenueAdjust,
          profit: t.profit,
          netProfit: t.netProfit - warrantyLoss,
          quantity: t.quantity,
        };
      }),
      summary: {
        totalSales: total.sales,
        totalRevenue: total.revenue + totalWarrantyRevenueAdjust,
        totalProfit: total.profit,
        totalNetProfit: total.netProfit - totalWarrantyLoss,
        peakDate: peak._id,
        peakSales: peak.salesCount,
      },
    };

    if (hideFinancialData) {
      response.timeline = response.timeline.map((point) => ({
        ...point,
        profit: 0,
        netProfit: 0,
      }));
      response.summary.totalProfit = 0;
      response.summary.totalNetProfit = 0;
    }

    return response;
  }

  // Comparative analysis
  async getComparativeAnalysis(businessId, options = {}) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const now = new Date();
    const scopedUserObjectId = resolveScopedUserObjectId(options);
    const hideFinancialData = shouldHideFinancialData(options);

    // Current period (this month)
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    // Previous period (last month)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    const [currentMonth, lastMonth, currentSpecial, lastSpecial] =
      await Promise.all([
        Sale.aggregate([
          {
            $match: withSaleScope(
              {
                business: businessObjectId,
                paymentStatus: "confirmado",
                saleDate: { $gte: currentMonthStart, $lte: currentMonthEnd },
              },
              scopedUserObjectId,
            ),
          },
          {
            $group: {
              _id: null,
              sales: { $sum: 1 },
              revenue: { $sum: buildSaleRevenueExpression() },
              profit: { $sum: buildTotalGroupProfitExpression() },
            },
          },
        ]),
        Sale.aggregate([
          {
            $match: withSaleScope(
              {
                business: businessObjectId,
                paymentStatus: "confirmado",
                saleDate: { $gte: lastMonthStart, $lte: lastMonthEnd },
              },
              scopedUserObjectId,
            ),
          },
          {
            $group: {
              _id: null,
              sales: { $sum: 1 },
              revenue: { $sum: buildSaleRevenueExpression() },
              profit: { $sum: buildTotalGroupProfitExpression() },
            },
          },
        ]),
        SpecialSale.aggregate([
          {
            $match: withSpecialSaleScope(
              {
                business: businessObjectId,
                status: "active",
                saleDate: { $gte: currentMonthStart, $lte: currentMonthEnd },
              },
              scopedUserObjectId,
            ),
          },
          {
            $group: {
              _id: null,
              sales: { $sum: 1 },
              revenue: {
                $sum: { $multiply: ["$specialPrice", "$quantity"] },
              },
              profit: { $sum: "$totalProfit" },
            },
          },
        ]),
        SpecialSale.aggregate([
          {
            $match: withSpecialSaleScope(
              {
                business: businessObjectId,
                status: "active",
                saleDate: { $gte: lastMonthStart, $lte: lastMonthEnd },
              },
              scopedUserObjectId,
            ),
          },
          {
            $group: {
              _id: null,
              sales: { $sum: 1 },
              revenue: {
                $sum: { $multiply: ["$specialPrice", "$quantity"] },
              },
              profit: { $sum: "$totalProfit" },
            },
          },
        ]),
      ]);

    const currentBase = currentMonth[0] || { sales: 0, revenue: 0, profit: 0 };
    const previousBase = lastMonth[0] || { sales: 0, revenue: 0, profit: 0 };
    const currentSpecialData = currentSpecial[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
    };
    const previousSpecialData = lastSpecial[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
    };

    const current = {
      sales: currentBase.sales + currentSpecialData.sales,
      revenue: currentBase.revenue + currentSpecialData.revenue,
      profit: currentBase.profit + currentSpecialData.profit,
    };
    const previous = {
      sales: previousBase.sales + previousSpecialData.sales,
      revenue: previousBase.revenue + previousSpecialData.revenue,
      profit: previousBase.profit + previousSpecialData.profit,
    };

    const calcChange = (curr, prev) =>
      prev > 0 ? ((curr - prev) / prev) * 100 : 0;

    const response = {
      periods: [
        {
          period: "Este mes",
          sales: current.sales,
          revenue: current.revenue,
          profit: current.profit,
        },
        {
          period: "Mes anterior",
          sales: previous.sales,
          revenue: previous.revenue,
          profit: previous.profit,
        },
      ],
      changes: {
        salesChange: calcChange(current.sales, previous.sales),
        revenueChange: calcChange(current.revenue, previous.revenue),
        profitChange: calcChange(current.profit, previous.profit),
      },
    };

    if (hideFinancialData) {
      response.periods = response.periods.map((period) => ({
        ...period,
        profit: 0,
      }));
      response.changes.profitChange = 0;
    }

    return response;
  }

  async getSalesSummary(businessId, startDate, endDate, options = {}) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);
    const scopedUserObjectId = resolveScopedUserObjectId(options);
    const hideFinancialData = shouldHideFinancialData(options);

    const match = withSaleScope(
      {
        business: businessObjectId,
        paymentStatus: "confirmado",
        ...(dateRange ? { saleDate: dateRange } : {}),
      },
      scopedUserObjectId,
    );

    const specialMatch = withSpecialSaleScope(
      {
        business: businessObjectId,
        status: "active",
        ...(dateRange ? { saleDate: dateRange } : {}),
      },
      scopedUserObjectId,
    );

    const [summary, specialSummary] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: {
              $sum: buildSaleRevenueExpression(),
            },
            totalProfit: { $sum: buildTotalGroupProfitExpression() },
            totalCost: { $sum: { $multiply: ["$purchasePrice", "$quantity"] } },
          },
        },
      ]),
      SpecialSale.aggregate([
        { $match: specialMatch },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: {
              $sum: { $multiply: ["$specialPrice", "$quantity"] },
            },
            totalProfit: { $sum: "$totalProfit" },
            totalCost: { $sum: { $multiply: ["$cost", "$quantity"] } },
          },
        },
      ]),
    ]);

    const baseSummary = summary[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalCost: 0,
    };
    const special = specialSummary[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalCost: 0,
    };

    const response = {
      totalSales: baseSummary.totalSales + special.totalSales,
      totalRevenue: baseSummary.totalRevenue + special.totalRevenue,
      totalProfit: baseSummary.totalProfit + special.totalProfit,
      totalCost: baseSummary.totalCost + special.totalCost,
    };

    if (hideFinancialData) {
      response.totalProfit = 0;
      response.totalCost = 0;
    }

    return response;
  }

  async getTopProducts(
    businessId,
    startDate,
    endDate,
    limit = 10,
    options = {},
  ) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);
    const scopedUserObjectId = resolveScopedUserObjectId(options);

    const match = withSaleScope(
      {
        business: businessObjectId,
        paymentStatus: "confirmado",
        ...(dateRange ? { saleDate: dateRange } : {}),
      },
      scopedUserObjectId,
    );

    const specialMatch = withSpecialSaleScope(
      {
        business: businessObjectId,
        status: "active",
        ...(dateRange ? { saleDate: dateRange } : {}),
        "product.productId": { $exists: true, $ne: null },
      },
      scopedUserObjectId,
    );

    const topProducts = await Sale.aggregate([
      { $match: match },
      {
        $project: {
          product: "$product",
          quantity: "$quantity",
          revenue: buildSaleRevenueExpression(),
          profit: buildTotalGroupProfitExpression(),
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            { $match: specialMatch },
            {
              $project: {
                product: "$product.productId",
                quantity: "$quantity",
                revenue: { $multiply: ["$specialPrice", "$quantity"] },
                profit: "$totalProfit",
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
          totalProfit: { $sum: "$profit" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
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
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      {
        $addFields: {
          "product.category": {
            $ifNull: [{ $arrayElemAt: ["$categoryInfo", 0] }, null],
          },
        },
      },
      {
        $project: {
          categoryInfo: 0,
        },
      },
    ]);

    if (shouldHideFinancialData(options)) {
      return topProducts.map((item) => ({
        ...item,
        totalProfit: 0,
      }));
    }

    return topProducts;
  }

  async getEmployeePerformance(
    businessId,
    startDate,
    endDate,
    options = {},
  ) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);
    const scopedUserObjectId = resolveScopedUserObjectId(options);

    const match = withSaleScope(
      {
        business: businessObjectId,
        employee: { $ne: null },
        ...(dateRange ? { saleDate: dateRange } : {}),
      },
      scopedUserObjectId,
    );

    const performance = await Sale.aggregate([
      { $match: match },
      {
        $addFields: {
          employeeObjId: {
            $convert: {
              input: "$employee",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      { $match: { employeeObjId: { $ne: null } } },
      {
        $group: {
          _id: "$employeeObjId",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: buildSaleRevenueExpression() },
          totalProfit: { $sum: buildTotalGroupProfitExpression() },
          employeeProfit: { $sum: "$employeeProfit" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
    ]);

    if (shouldHideFinancialData(options)) {
      return performance.map((item) => ({
        ...item,
        totalProfit: 0,
        employeeProfit: 0,
      }));
    }

    return performance;
  }

  async getInventoryStatus(businessId, options = {}) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const hideFinancialData = shouldHideFinancialData(options);

    const products = await Product.find({
      business: businessObjectId,
      isDeleted: { $ne: true },
    })
      .select(
        hideFinancialData
          ? "name warehouseStock stock salePrice"
          : "name warehouseStock stock purchasePrice salePrice",
      )
      .lean();

    const lowStockProducts = products.filter((p) => p.warehouseStock < 10);
    const totalInventoryValue = hideFinancialData
      ? 0
      : products.reduce(
          (sum, p) => sum + (p.warehouseStock || 0) * (p.purchasePrice || 0),
          0,
        );

    return {
      totalProducts: products.length,
      lowStockProducts: lowStockProducts.length,
      totalInventoryValue,
      products: products.slice(0, 50),
    };
  }

  async getCreditsSummary(businessId, startDate, endDate, options = {}) {
    if (
      shouldHideFinancialData(options) ||
      resolveScopedUserObjectId(options)
    ) {
      return {
        totalCredits: 0,
        totalAmount: 0,
        totalPending: 0,
        totalPaid: 0,
      };
    }

    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);

    const match = {
      business: businessObjectId,
      ...(dateRange ? { creditDate: dateRange } : {}),
    };

    const summary = await Credit.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalCredits: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, "$pendingAmount", 0],
            },
          },
          totalPaid: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$totalAmount", 0] },
          },
        },
      },
    ]);

    return (
      summary[0] || {
        totalCredits: 0,
        totalAmount: 0,
        totalPending: 0,
        totalPaid: 0,
      }
    );
  }

  async getExpensesSummary(businessId, startDate, endDate, options = {}) {
    if (
      shouldHideFinancialData(options) ||
      resolveScopedUserObjectId(options)
    ) {
      return {
        totalExpenses: 0,
        totalAmount: 0,
      };
    }

    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);

    const match = {
      business: businessObjectId,
      ...(dateRange ? { expenseDate: dateRange } : {}),
    };

    const summary = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    return (
      summary[0] || {
        totalExpenses: 0,
        totalAmount: 0,
      }
    );
  }

  async getSalesByCategory(businessId, startDate, endDate, options = {}) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);
    const scopedUserObjectId = resolveScopedUserObjectId(options);

    const match = withSaleScope(
      {
        business: businessObjectId,
        paymentStatus: "confirmado",
        ...(dateRange ? { saleDate: dateRange } : {}),
      },
      scopedUserObjectId,
    );

    const specialMatch = withSpecialSaleScope(
      {
        business: businessObjectId,
        status: "active",
        ...(dateRange ? { saleDate: dateRange } : {}),
        "product.productId": { $exists: true, $ne: null },
      },
      scopedUserObjectId,
    );

    const salesByCategory = await Sale.aggregate([
      { $match: match },
      {
        $project: {
          product: "$product",
          quantity: "$quantity",
          revenue: buildSaleRevenueExpression(),
          profit: buildTotalGroupProfitExpression(),
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            { $match: specialMatch },
            {
              $project: {
                product: "$product.productId",
                quantity: "$quantity",
                revenue: { $multiply: ["$specialPrice", "$quantity"] },
                profit: "$totalProfit",
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
        $group: {
          _id: "$productInfo.category",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: "$revenue" },
          totalProfit: { $sum: "$profit" },
          totalQuantity: { $sum: "$quantity" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      {
        $addFields: {
          categoryName: {
            $ifNull: [
              { $arrayElemAt: ["$categoryInfo.name", 0] },
              "Sin categoría",
            ],
          },
        },
      },
    ]);

    const categorySummary = salesByCategory.map((cat) => ({
      category: cat.categoryName || cat._id || "Sin categoría",
      sales: cat.totalSales,
      revenue: cat.totalRevenue,
      profit: cat.totalProfit,
      quantity: cat.totalQuantity,
    }));

    if (shouldHideFinancialData(options)) {
      return categorySummary.map((item) => ({
        ...item,
        profit: 0,
      }));
    }

    return categorySummary;
  }

  async getProductRotation(businessId, days = 30, options = {}) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const scopedUserObjectId = resolveScopedUserObjectId(options);

    const saleMatch = withSaleScope(
      {
        business: businessObjectId,
        paymentStatus: "confirmado",
        saleDate: { $gte: startDate },
      },
      scopedUserObjectId,
    );

    const specialMatch = withSpecialSaleScope(
      {
        business: businessObjectId,
        status: "active",
        saleDate: { $gte: startDate },
        "product.productId": { $exists: true, $ne: null },
      },
      scopedUserObjectId,
    );

    const rotation = await Sale.aggregate([
      { $match: saleMatch },
      {
        $project: {
          product: "$product",
          quantity: "$quantity",
          saleDate: "$saleDate",
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            { $match: specialMatch },
            {
              $project: {
                product: "$product.productId",
                quantity: "$quantity",
                saleDate: "$saleDate",
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: "$product",
          totalQuantity: { $sum: "$quantity" },
          salesCount: { $sum: 1 },
          lastSale: { $max: "$saleDate" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
    ]);

    return rotation.map((r) => ({
      productId: r._id,
      productName: r.product.name,
      totalQuantity: r.totalQuantity,
      salesCount: r.salesCount,
      lastSale: r.lastSale,
      rotationRate: r.totalQuantity / days,
    }));
  }

  async getEmployeeRankings(businessId, startDate, endDate, options = {}) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);
    const scopedUserObjectId = resolveScopedUserObjectId(options);

    const match = withSaleScope(
      {
        business: businessObjectId,
        paymentStatus: "confirmado",
        employee: { $ne: null },
        ...(dateRange ? { saleDate: dateRange } : {}),
      },
      scopedUserObjectId,
    );

    const rankings = await Sale.aggregate([
      { $match: match },
      {
        $addFields: {
          employeeObjId: {
            $convert: {
              input: "$employee",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      { $match: { employeeObjId: { $ne: null } } },
      {
        $group: {
          _id: "$employeeObjId",
          totalSalesAll: { $sum: 1 },
          confirmedSales: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "confirmado"] }, 1, 0],
            },
          },
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "confirmado"] },
                buildSaleRevenueExpression(),
                0,
              ],
            },
          },
          totalProfit: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "confirmado"] },
                buildTotalGroupProfitExpression(),
                0,
              ],
            },
          },
          employeeProfit: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "confirmado"] },
                "$employeeProfit",
                0,
              ],
            },
          },
          totalQuantity: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "confirmado"] },
                "$quantity",
                0,
              ],
            },
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "employeeInfo",
        },
      },
      {
        $unwind: { path: "$employeeInfo", preserveNullAndEmptyArrays: true },
      },
    ]);

    const mappedRankings = rankings.map((r, index) => ({
      rank: index + 1,
      employeeId: r._id,
      employeeName: r.employeeInfo?.name || "Sin nombre",
      employeeEmail: r.employeeInfo?.email,
      totalSales: r.confirmedSales,
      totalRevenue: r.totalRevenue,
      totalProfit: r.totalProfit,
      employeeProfit: r.employeeProfit,
      totalQuantity: r.totalQuantity,
      conversionRate:
        r.totalSalesAll > 0 ? (r.confirmedSales / r.totalSalesAll) * 100 : 0,
    }));

    if (shouldHideFinancialData(options)) {
      return mappedRankings.map((item) => ({
        ...item,
        totalProfit: 0,
        employeeProfit: 0,
      }));
    }

    return mappedRankings;
  }

  async getLowStockVisual(businessId, options = {}) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const hideFinancialData = shouldHideFinancialData(options);

    const products = await Product.find({
      business: businessObjectId,
      warehouseStock: { $lt: 10 },
    })
      .select(
        hideFinancialData
          ? "name warehouseStock stock salePrice category"
          : "name warehouseStock stock purchasePrice salePrice category",
      )
      .sort({ warehouseStock: 1 })
      .limit(20)
      .lean();

    return {
      count: products.length,
      products: products.map((p) => ({
        id: p._id,
        name: p.name,
        stock: p.warehouseStock || 0,
        minStock: 10,
        category: p.category || "Sin categoría",
        value: hideFinancialData
          ? 0
          : (p.warehouseStock || 0) * (p.purchasePrice || 0),
      })),
    };
  }
}
