/**
 * ProfitHistory Repository - Data Access Layer
 * Handles profit history operations in Hexagonal Architecture
 */

import mongoose from "mongoose";
import Membership from "../../../../models/Membership.js";
import ProfitHistory from "../../../../models/ProfitHistory.js";
import User from "../../../../models/User.js";

class ProfitHistoryRepository {
  /**
   * Build Colombia date range (UTC-5)
   */
  buildDateRange(startDateStr, endDateStr) {
    if (!startDateStr && !endDateStr) return null;

    const range = {};

    if (startDateStr) {
      const date = new Date(startDateStr);
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

    if (endDateStr) {
      const date = new Date(endDateStr);
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
  }

  /**
   * Get user profit history with filters
   */
  async getUserHistory(userId, businessId, filters = {}, isGodOrSuper = false) {
    const { startDate, endDate, type, page = 1, limit = 50, today } = filters;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return null;
    }

    // Convert IDs to ObjectId for consistent matching
    const userObjectId =
      typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
    const businessObjectId =
      businessId && typeof businessId === "string"
        ? new mongoose.Types.ObjectId(businessId)
        : businessId;

    // Build filter
    const shouldScopeBusiness = !isGodOrSuper;
    const filter = {
      user: userObjectId,
      ...(shouldScopeBusiness && businessObjectId
        ? { business: businessObjectId }
        : {}),
    };

    const dateRange = today
      ? this.buildDateRange(
          new Date().toISOString().slice(0, 10),
          new Date().toISOString().slice(0, 10),
        )
      : this.buildDateRange(startDate, endDate);

    if (dateRange) {
      filter.date = dateRange;
    }

    if (type) filter.type = type;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get history and totals
    const [history, total, totals] = await Promise.all([
      ProfitHistory.find(filter)
        .populate("product", "name image")
        .populate("sale", "saleId")
        .populate("specialSale", "eventName")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ProfitHistory.countDocuments(filter),
      ProfitHistory.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summary = totals[0] || { totalAmount: 0, count: 0 };

    return {
      history,
      summary: {
        totalAmount: summary.totalAmount,
        count: summary.count,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Get user balance
   */
  async getUserBalance(userId, businessId, isGodOrSuper = false) {
    const user = await User.findById(userId);
    if (!user) {
      return null;
    }

    const shouldScopeBusiness = !isGodOrSuper;

    // Get last entry for current balance
    const lastEntry = await ProfitHistory.findOne({
      user: userId,
      ...(shouldScopeBusiness && businessId ? { business: businessId } : {}),
    })
      .sort({ date: -1 })
      .lean();

    // Calculate totals by type
    const totals = await ProfitHistory.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          ...(shouldScopeBusiness && businessId
            ? { business: new mongoose.Types.ObjectId(businessId) }
            : {}),
        },
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const breakdown = totals.reduce((acc, item) => {
      acc[item._id] = { total: item.total, count: item.count };
      return acc;
    }, {});

    return {
      userId: user._id,
      userName: user.name,
      currentBalance: lastEntry?.currentBalance || 0,
      lastUpdated: lastEntry?.date,
      breakdown,
    };
  }

  /**
   * Get profit summary
   */
  async getSummary(businessId, filters = {}) {
    const { startDate, endDate, userId } = filters;

    // Convert businessId to ObjectId for aggregation matching
    const businessObjectId =
      typeof businessId === "string"
        ? new mongoose.Types.ObjectId(businessId)
        : businessId;

    const filter = { business: businessObjectId };

    const dateRange = this.buildDateRange(startDate, endDate);
    if (dateRange) {
      filter.date = dateRange;
    }

    if (userId) {
      filter.user =
        typeof userId === "string"
          ? new mongoose.Types.ObjectId(userId)
          : userId;
    }

    const [totals, byUser] = await Promise.all([
      ProfitHistory.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      ProfitHistory.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$user",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        { $unwind: "$userDetails" },
        {
          $project: {
            userId: "$_id",
            userName: "$userDetails.name",
            userEmail: "$userDetails.email",
            total: 1,
            count: 1,
          },
        },
        { $sort: { total: -1 } },
      ]),
    ]);

    const breakdown = totals.reduce((acc, item) => {
      acc[item._id] = { total: item.total, count: item.count };
      return acc;
    }, {});

    return {
      breakdown,
      byUser,
      filters: { startDate, endDate, userId },
    };
  }

  /**
   * Create profit entry
   */
  async create(data) {
    return await ProfitHistory.create(data);
  }

  /**
   * Get admin profit overview
   */
  async getAdminOverview(businessId, options = {}) {
    const { startDate, endDate, limit = 150 } = options;
    const dateRange = this.buildDateRange(startDate, endDate);
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const filter = {
      business: businessObjectId,
      ...(dateRange ? { date: dateRange } : {}),
    };

    // Get distributor user IDs for this business
    const distributorMemberships = await Membership.find({
      business: businessObjectId,
      role: "distribuidor",
      status: "active",
    })
      .select("user")
      .lean();
    const distributorUserIds = distributorMemberships.map((m) => m.user);
    const distributorUserObjectIds = distributorUserIds
      .filter((id) => id != null)
      .map((id) => {
        if (id instanceof mongoose.Types.ObjectId) return id;
        if (typeof id === "string" && mongoose.isValidObjectId(id)) {
          return new mongoose.Types.ObjectId(id);
        }
        return null;
      })
      .filter((id) => id !== null);

    const commissionMatch = {
      ...filter,
      $or: [
        { "metadata.commission": { $gt: 0 } },
        { description: { $regex: /comisi[oó]n/i } },
        ...(distributorUserObjectIds.length > 0
          ? [{ user: { $in: distributorUserObjectIds } }]
          : []),
      ],
    };

    const [
      overview,
      recentEntries,
      byType,
      byUser,
      distributorCommissions,
      distributorBreakdown,
    ] = await Promise.all([
      // Total overview
      ProfitHistory.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            netProfit: { $sum: "$amount" },
            grossProfit: {
              $sum: {
                $cond: [{ $gt: ["$amount", 0] }, "$amount", 0],
              },
            },
            totalExpenses: {
              $sum: {
                $cond: [{ $lt: ["$amount", 0] }, "$amount", 0],
              },
            },
            totalEntries: { $sum: 1 },
          },
        },
      ]),
      // Recent entries
      ProfitHistory.find(filter)
        .populate("user", "name email")
        .populate("product", "name")
        .populate("sale")
        .populate("specialSale", "eventName")
        .sort({ date: -1 })
        .limit(limit)
        .lean(),
      // By type breakdown
      ProfitHistory.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      // By user breakdown
      ProfitHistory.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$user",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            userId: "$_id",
            userName: { $ifNull: ["$userInfo.name", "Usuario Desconocido"] },
            total: 1,
            count: 1,
          },
        },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),
      // Distributor commissions total
      ProfitHistory.aggregate([
        { $match: commissionMatch },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      // Distributor commission breakdown (ranking)
      ProfitHistory.aggregate([
        { $match: commissionMatch },
        {
          $group: {
            _id: "$user",
            total: { $sum: "$amount" },
            sales: { $sum: 1 },
          },
        },
        {
          $addFields: {
            userObjId: {
              $convert: {
                input: "$_id",
                to: "objectId",
                onError: "$_id",
                onNull: "$_id",
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userObjId",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            id: { $toString: "$_id" },
            name: { $ifNull: ["$userInfo.name", "Distribuidor"] },
            email: "$userInfo.email",
            sales: 1,
            distributorProfit: "$total",
          },
        },
        { $sort: { distributorProfit: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const totals = overview[0] || {
      netProfit: 0,
      grossProfit: 0,
      totalExpenses: 0,
      totalEntries: 0,
    };
    const commissions = distributorCommissions[0] || { total: 0, count: 0 };
    const typeBreakdown = byType.reduce((acc, item) => {
      acc[item._id] = { total: item.total, count: item.count };
      return acc;
    }, {});

    // Transform recentEntries to match frontend expectations
    const transformedEntries = recentEntries.map((entry) => ({
      id: entry._id,
      date: entry.date,
      saleId: entry.metadata?.saleId || entry.sale?._id || entry._id,
      source: entry.type === "venta_especial" ? "special" : "normal",
      eventName:
        entry.metadata?.eventName || entry.specialSale?.eventName || null,
      distributorName: entry.user?.name || "Admin",
      distributorEmail: entry.user?.email || "",
      productName: entry.product?.name || entry.description || "-",
      distributorProfit: entry.metadata?.commission || 0,
      adminProfit: entry.amount - (entry.metadata?.commission || 0),
      netProfit: entry.amount,
      totalProfit: entry.amount,
    }));

    const netProfitAdjusted = totals.netProfit - commissions.total;
    const totalAdminProfit = netProfitAdjusted;

    const distributorsWithAdmin = [
      ...distributorBreakdown,
      {
        id: "admin",
        name: "Admin",
        adminProfit: totalAdminProfit,
        distributorProfit: 0,
        sales: 0,
      },
    ];

    return {
      totalProfit: netProfitAdjusted,
      grossProfit: totals.grossProfit,
      totalExpenses: totals.totalExpenses,
      netProfit: netProfitAdjusted,
      totalAdminProfit,
      totalDistributorProfit: commissions.total,
      totalEntries: totals.totalEntries,
      totalDistributorCommissions: commissions.total,
      distributorCommissionEntries: commissions.count,
      distributors: distributorsWithAdmin,
      byType: typeBreakdown,
      topUsers: byUser,
      recentEntries: transformedEntries,
      filters: { startDate, endDate, limit },
    };
  }
}

export default new ProfitHistoryRepository();
