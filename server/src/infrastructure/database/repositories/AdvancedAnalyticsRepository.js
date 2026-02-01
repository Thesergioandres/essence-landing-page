import mongoose from "mongoose";
import Credit from "../../../../models/Credit.js";
import Expense from "../../../../models/Expense.js";
import Product from "../../../../models/Product.js";
import Sale from "../../../../models/Sale.js";

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
  async getSalesSummary(businessId, startDate, endDate) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const dateRange = buildColombiaRange(startDate, endDate);

    const match = {
      business: businessObjectId,
      paymentStatus: "confirmado",
      ...(dateRange ? { saleDate: dateRange } : {}),
    };

    const summary = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
          totalCost: { $sum: { $multiply: ["$purchasePrice", "$quantity"] } },
        },
      },
    ]);

    return (
      summary[0] || {
        totalSales: 0,
        totalRevenue: 0,
        totalProfit: 0,
        totalCost: 0,
      }
    );
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
        $group: {
          _id: "$distributor",
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
      { $unwind: "$distributor" },
    ]);

    return performance;
  }

  async getInventoryStatus(businessId) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const products = await Product.find({ business: businessObjectId })
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
}
