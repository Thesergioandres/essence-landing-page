import mongoose from "mongoose";
import Credit from "../../../../models/Credit.js";
import CreditPayment from "../../../../models/CreditPayment.js";
import Expense from "../../../../models/Expense.js";
import Membership from "../../../../models/Membership.js";
import Product from "../../../../models/Product.js";
import Sale from "../../../../models/Sale.js";
import SpecialSale from "../../../../models/SpecialSale.js";

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

export class AdvancedAnalyticsRepository {
  // Financial KPIs - Main dashboard data
  async getFinancialKPIs(businessId, startDate, endDate) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);

    const match = {
      business: businessObjectId,
      paymentStatus: "confirmado",
      ...(dateRange ? { saleDate: dateRange } : {}),
    };

    // Get today's data
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));

    const todayMatch = {
      business: businessObjectId,
      paymentStatus: "confirmado",
      saleDate: { $gte: todayStart, $lte: todayEnd },
    };

    // Get this week's data
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekMatch = {
      business: businessObjectId,
      paymentStatus: "confirmado",
      saleDate: { $gte: weekStart, $lte: new Date() },
    };

    // Get this month's data
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - 1);
    const monthMatch = {
      business: businessObjectId,
      paymentStatus: "confirmado",
      saleDate: { $gte: monthStart, $lte: new Date() },
    };

    const [
      rangeData,
      rangeSpecialData,
      todayData,
      todaySpecialData,
      weekData,
      weekSpecialData,
      monthData,
      monthSpecialData,
      creditRangeData,
      creditTodayData,
      creditWeekData,
      creditMonthData,
      activeDistributors,
      expensesData,
    ] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $eq: ["$isCredit", true] },
                  0,
                  { $multiply: ["$salePrice", "$quantity"] },
                ],
              },
            },
            profit: {
              $sum: {
                $ifNull: [
                  "$totalProfit",
                  {
                    $ifNull: [
                      "$netProfit",
                      { $add: ["$adminProfit", "$distributorProfit"] },
                    ],
                  },
                ],
              },
            },
            quantity: { $sum: "$quantity" },
          },
        },
      ]),
      SpecialSale.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: "active",
            ...(dateRange ? { saleDate: dateRange } : {}),
          },
        },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: { $sum: { $multiply: ["$specialPrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
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
              $sum: {
                $cond: [
                  { $eq: ["$isCredit", true] },
                  0,
                  { $multiply: ["$salePrice", "$quantity"] },
                ],
              },
            },
            profit: {
              $sum: {
                $ifNull: [
                  "$totalProfit",
                  {
                    $ifNull: [
                      "$netProfit",
                      { $add: ["$adminProfit", "$distributorProfit"] },
                    ],
                  },
                ],
              },
            },
          },
        },
      ]),
      SpecialSale.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: "active",
            saleDate: { $gte: todayStart, $lte: todayEnd },
          },
        },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: { $sum: { $multiply: ["$specialPrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
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
              $sum: {
                $cond: [
                  { $eq: ["$isCredit", true] },
                  0,
                  { $multiply: ["$salePrice", "$quantity"] },
                ],
              },
            },
            profit: {
              $sum: {
                $ifNull: [
                  "$totalProfit",
                  {
                    $ifNull: [
                      "$netProfit",
                      { $add: ["$adminProfit", "$distributorProfit"] },
                    ],
                  },
                ],
              },
            },
          },
        },
      ]),
      SpecialSale.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: "active",
            saleDate: { $gte: weekStart, $lte: new Date() },
          },
        },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: { $sum: { $multiply: ["$specialPrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
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
              $sum: {
                $cond: [
                  { $eq: ["$isCredit", true] },
                  0,
                  { $multiply: ["$salePrice", "$quantity"] },
                ],
              },
            },
            profit: {
              $sum: {
                $ifNull: [
                  "$totalProfit",
                  {
                    $ifNull: [
                      "$netProfit",
                      { $add: ["$adminProfit", "$distributorProfit"] },
                    ],
                  },
                ],
              },
            },
          },
        },
      ]),
      SpecialSale.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: "active",
            saleDate: { $gte: monthStart, $lte: new Date() },
          },
        },
        {
          $group: {
            _id: null,
            sales: { $sum: 1 },
            revenue: { $sum: { $multiply: ["$specialPrice", "$quantity"] } },
            profit: { $sum: "$totalProfit" },
          },
        },
      ]),
      CreditPayment.aggregate([
        {
          $match: {
            business: businessObjectId,
            ...(dateRange ? { paymentDate: dateRange } : {}),
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),
      CreditPayment.aggregate([
        {
          $match: {
            business: businessObjectId,
            paymentDate: { $gte: todayStart, $lte: todayEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),
      CreditPayment.aggregate([
        {
          $match: {
            business: businessObjectId,
            paymentDate: { $gte: weekStart, $lte: new Date() },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),
      CreditPayment.aggregate([
        {
          $match: {
            business: businessObjectId,
            paymentDate: { $gte: monthStart, $lte: new Date() },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),
      // Count active distributors for this business
      Membership.countDocuments({
        business: businessObjectId,
        role: "distribuidor",
        status: "active",
      }),
      // Get expenses summary
      Expense.aggregate([
        {
          $match: {
            business: businessObjectId,
            ...(dateRange ? { date: dateRange } : {}),
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
      quantity: 0,
    };
    const rangeSpecial = rangeSpecialData[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
      quantity: 0,
    };
    const daily = todayData[0] || { sales: 0, revenue: 0, profit: 0 };
    const weekly = weekData[0] || { sales: 0, revenue: 0, profit: 0 };
    const monthly = monthData[0] || { sales: 0, revenue: 0, profit: 0 };
    const dailySpecial = todaySpecialData[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
    };
    const weeklySpecial = weekSpecialData[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
    };
    const monthlySpecial = monthSpecialData[0] || {
      sales: 0,
      revenue: 0,
      profit: 0,
    };
    const creditRange = creditRangeData[0]?.totalAmount || 0;
    const creditDaily = creditTodayData[0]?.totalAmount || 0;
    const creditWeekly = creditWeekData[0]?.totalAmount || 0;
    const creditMonthly = creditMonthData[0]?.totalAmount || 0;
    const expenses = expensesData[0] || { totalExpenses: 0, count: 0 };

    const combinedRange = {
      sales: range.sales + rangeSpecial.sales,
      revenue: range.revenue + rangeSpecial.revenue,
      profit: range.profit + rangeSpecial.profit,
      quantity: range.quantity + rangeSpecial.quantity,
    };
    const combinedDaily = {
      sales: daily.sales + dailySpecial.sales,
      revenue: daily.revenue + dailySpecial.revenue,
      profit: daily.profit + dailySpecial.profit,
    };
    const combinedWeekly = {
      sales: weekly.sales + weeklySpecial.sales,
      revenue: weekly.revenue + weeklySpecial.revenue,
      profit: weekly.profit + weeklySpecial.profit,
    };
    const combinedMonthly = {
      sales: monthly.sales + monthlySpecial.sales,
      revenue: monthly.revenue + monthlySpecial.revenue,
      profit: monthly.profit + monthlySpecial.profit,
    };

    // 🎯 FIX TASK 2: Calculate REAL Net Profit (Gross Profit - Expenses)
    const realNetProfit = combinedRange.profit - expenses.totalExpenses;
    const dailyNetProfit = combinedDaily.profit; // No daily expenses aggregation yet
    const weeklyNetProfit = combinedWeekly.profit; // Would need week-specific expenses
    const monthlyNetProfit = combinedMonthly.profit; // Would need month-specific expenses

    return {
      kpis: {
        todaySales: combinedDaily.sales,
        todayRevenue: combinedDaily.revenue + creditDaily,
        todayProfit: combinedDaily.profit,
        todayNetProfit: dailyNetProfit, // TODO: Add daily expense filtering
        weekSales: combinedWeekly.sales,
        weekRevenue: combinedWeekly.revenue + creditWeekly,
        weekProfit: combinedWeekly.profit,
        weekNetProfit: weeklyNetProfit, // TODO: Add weekly expense filtering
        monthSales: combinedMonthly.sales,
        monthRevenue: combinedMonthly.revenue + creditMonthly,
        monthProfit: combinedMonthly.profit,
        monthNetProfit: monthlyNetProfit, // TODO: Add monthly expense filtering
        averageTicket:
          combinedRange.sales > 0
            ? combinedRange.revenue / combinedRange.sales
            : 0,
        totalActiveDistributors: activeDistributors,
        totalExpenses: expenses.totalExpenses,
        expensesCount: expenses.count,
      },
      daily: combinedDaily,
      weekly: combinedWeekly,
      monthly: combinedMonthly,
      range: {
        sales: combinedRange.sales,
        revenue: combinedRange.revenue + creditRange,
        grossProfit: combinedRange.profit, // Renamed for clarity
        netProfit: realNetProfit, // 🎯 Real Net Profit = Gross - Expenses
        quantity: combinedRange.quantity,
        avgTicket:
          combinedRange.sales > 0
            ? combinedRange.revenue / combinedRange.sales
            : 0,
        totalExpenses: expenses.totalExpenses,
      },
    };
  }

  // Sales funnel
  async getSalesFunnel(businessId, startDate, endDate) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);

    const match = {
      business: businessObjectId,
      ...(dateRange ? { saleDate: dateRange } : {}),
    };

    const [funnel, specialFunnel] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$paymentStatus",
            count: { $sum: 1 },
            totalValue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          },
        },
      ]),
      SpecialSale.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: "active",
            ...(dateRange ? { saleDate: dateRange } : {}),
          },
        },
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
  async getSalesTimeline(businessId, startDate, endDate, groupBy = "day") {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);

    const match = {
      business: businessObjectId,
      paymentStatus: "confirmado",
      ...(dateRange ? { saleDate: dateRange } : {}),
    };

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

    const timeline = await Sale.aggregate([
      { $match: match },
      {
        $project: {
          saleDate: "$saleDate",
          revenue: { $multiply: ["$salePrice", "$quantity"] },
          profit: "$totalProfit",
          quantity: "$quantity",
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            {
              $match: {
                business: businessObjectId,
                status: "active",
                ...(dateRange ? { saleDate: dateRange } : {}),
              },
            },
            {
              $project: {
                saleDate: "$saleDate",
                revenue: { $multiply: ["$specialPrice", "$quantity"] },
                profit: "$totalProfit",
                quantity: "$quantity",
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$saleDate" } },
          salesCount: { $sum: 1 },
          revenue: { $sum: "$revenue" },
          profit: { $sum: "$profit" },
          quantity: { $sum: "$quantity" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const total = timeline.reduce(
      (acc, t) => ({
        sales: acc.sales + t.salesCount,
        revenue: acc.revenue + t.revenue,
        profit: acc.profit + t.profit,
      }),
      { sales: 0, revenue: 0, profit: 0 },
    );

    const peak = timeline.reduce(
      (max, t) => (t.salesCount > max.salesCount ? t : max),
      { _id: "", salesCount: 0 },
    );

    return {
      timeline: timeline.map((t) => ({
        date: t._id,
        salesCount: t.salesCount,
        revenue: t.revenue,
        profit: t.profit,
        quantity: t.quantity,
      })),
      summary: {
        totalSales: total.sales,
        totalRevenue: total.revenue,
        totalProfit: total.profit,
        peakDate: peak._id,
        peakSales: peak.salesCount,
      },
    };
  }

  // Comparative analysis
  async getComparativeAnalysis(businessId) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const now = new Date();

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
            $match: {
              business: businessObjectId,
              paymentStatus: "confirmado",
              saleDate: { $gte: currentMonthStart, $lte: currentMonthEnd },
            },
          },
          {
            $group: {
              _id: null,
              sales: { $sum: 1 },
              revenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
              profit: { $sum: "$totalProfit" },
            },
          },
        ]),
        Sale.aggregate([
          {
            $match: {
              business: businessObjectId,
              paymentStatus: "confirmado",
              saleDate: { $gte: lastMonthStart, $lte: lastMonthEnd },
            },
          },
          {
            $group: {
              _id: null,
              sales: { $sum: 1 },
              revenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
              profit: { $sum: "$totalProfit" },
            },
          },
        ]),
        SpecialSale.aggregate([
          {
            $match: {
              business: businessObjectId,
              status: "active",
              saleDate: { $gte: currentMonthStart, $lte: currentMonthEnd },
            },
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
            $match: {
              business: businessObjectId,
              status: "active",
              saleDate: { $gte: lastMonthStart, $lte: lastMonthEnd },
            },
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

    return {
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
  }

  async getSalesSummary(businessId, startDate, endDate) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);

    const match = {
      business: businessObjectId,
      paymentStatus: "confirmado",
      ...(dateRange ? { saleDate: dateRange } : {}),
    };

    const [summary, specialSummary] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: {
              $sum: { $multiply: ["$salePrice", "$quantity"] },
            },
            totalProfit: { $sum: "$totalProfit" },
            totalCost: { $sum: { $multiply: ["$purchasePrice", "$quantity"] } },
          },
        },
      ]),
      SpecialSale.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: "active",
            ...(dateRange ? { saleDate: dateRange } : {}),
          },
        },
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

    return {
      totalSales: baseSummary.totalSales + special.totalSales,
      totalRevenue: baseSummary.totalRevenue + special.totalRevenue,
      totalProfit: baseSummary.totalProfit + special.totalProfit,
      totalCost: baseSummary.totalCost + special.totalCost,
    };
  }

  async getTopProducts(businessId, startDate, endDate, limit = 10) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);

    const match = {
      business: businessObjectId,
      paymentStatus: "confirmado",
      ...(dateRange ? { saleDate: dateRange } : {}),
    };

    const topProducts = await Sale.aggregate([
      { $match: match },
      {
        $project: {
          product: "$product",
          quantity: "$quantity",
          salePrice: "$salePrice",
          totalProfit: "$totalProfit",
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            {
              $match: {
                business: businessObjectId,
                status: "active",
                ...(dateRange ? { saleDate: dateRange } : {}),
                "product.productId": { $exists: true, $ne: null },
              },
            },
            {
              $project: {
                product: "$product.productId",
                quantity: "$quantity",
                salePrice: "$specialPrice",
                totalProfit: "$totalProfit",
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: "$product",
          totalQuantity: { $sum: "$quantity" },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
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

    return topProducts;
  }

  async getDistributorPerformance(businessId, startDate, endDate) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);

    const match = {
      business: businessObjectId,
      paymentStatus: "confirmado",
      distributor: { $ne: null },
      ...(dateRange ? { saleDate: dateRange } : {}),
    };

    const performance = await Sale.aggregate([
      { $match: match },
      {
        $addFields: {
          distributorObjId: {
            $convert: {
              input: "$distributor",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      { $match: { distributorObjId: { $ne: null } } },
      {
        $group: {
          _id: "$distributorObjId",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
          distributorProfit: { $sum: "$distributorProfit" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "distributor",
        },
      },
      { $unwind: { path: "$distributor", preserveNullAndEmptyArrays: true } },
    ]);

    return performance;
  }

  async getInventoryStatus(businessId) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const products = await Product.find({
      business: businessObjectId,
      isDeleted: { $ne: true },
    })
      .select("name warehouseStock stock purchasePrice salePrice")
      .lean();

    const lowStockProducts = products.filter((p) => p.warehouseStock < 10);
    const totalInventoryValue = products.reduce(
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

  async getCreditsSummary(businessId, startDate, endDate) {
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

  async getExpensesSummary(businessId, startDate, endDate) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);

    const match = {
      business: businessObjectId,
      ...(dateRange ? { date: dateRange } : {}),
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

  async getSalesByCategory(businessId, startDate, endDate) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);

    const match = {
      business: businessObjectId,
      paymentStatus: "confirmado",
      ...(dateRange ? { saleDate: dateRange } : {}),
    };

    const salesByCategory = await Sale.aggregate([
      { $match: match },
      {
        $project: {
          product: "$product",
          quantity: "$quantity",
          salePrice: "$salePrice",
          totalProfit: "$totalProfit",
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            {
              $match: {
                business: businessObjectId,
                status: "active",
                ...(dateRange ? { saleDate: dateRange } : {}),
                "product.productId": { $exists: true, $ne: null },
              },
            },
            {
              $project: {
                product: "$product.productId",
                quantity: "$quantity",
                salePrice: "$specialPrice",
                totalProfit: "$totalProfit",
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
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
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

    return salesByCategory.map((cat) => ({
      category: cat.categoryName || cat._id || "Sin categoría",
      sales: cat.totalSales,
      revenue: cat.totalRevenue,
      profit: cat.totalProfit,
      quantity: cat.totalQuantity,
    }));
  }

  async getProductRotation(businessId, days = 30) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rotation = await Sale.aggregate([
      {
        $match: {
          business: businessObjectId,
          paymentStatus: "confirmado",
          saleDate: { $gte: startDate },
        },
      },
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
            {
              $match: {
                business: businessObjectId,
                status: "active",
                saleDate: { $gte: startDate },
                "product.productId": { $exists: true, $ne: null },
              },
            },
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

  async getDistributorRankings(businessId, startDate, endDate) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);

    const match = {
      business: businessObjectId,
      paymentStatus: "confirmado",
      distributor: { $ne: null },
      ...(dateRange ? { saleDate: dateRange } : {}),
    };

    const rankings = await Sale.aggregate([
      { $match: match },
      {
        $addFields: {
          distributorObjId: {
            $convert: {
              input: "$distributor",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      { $match: { distributorObjId: { $ne: null } } },
      {
        $group: {
          _id: "$distributorObjId",
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
          distributorProfit: { $sum: "$distributorProfit" },
          totalQuantity: { $sum: "$quantity" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "distributorInfo",
        },
      },
      {
        $unwind: { path: "$distributorInfo", preserveNullAndEmptyArrays: true },
      },
    ]);

    return rankings.map((r, index) => ({
      rank: index + 1,
      distributorId: r._id,
      distributorName: r.distributorInfo?.name || "Sin nombre",
      distributorEmail: r.distributorInfo?.email,
      totalSales: r.totalSales,
      totalRevenue: r.totalRevenue,
      totalProfit: r.totalProfit,
      distributorProfit: r.distributorProfit,
      totalQuantity: r.totalQuantity,
    }));
  }

  async getLowStockVisual(businessId) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const products = await Product.find({
      business: businessObjectId,
      warehouseStock: { $lt: 10 },
    })
      .select("name warehouseStock stock purchasePrice salePrice category")
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
        value: (p.warehouseStock || 0) * (p.purchasePrice || 0),
      })),
    };
  }
}
