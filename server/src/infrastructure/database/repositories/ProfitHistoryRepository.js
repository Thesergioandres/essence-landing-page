/**
 * ProfitHistory Repository - Data Access Layer
 * Handles profit history operations in Hexagonal Architecture
 */

import mongoose from "mongoose";
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

    // Build filter
    const shouldScopeBusiness = !isGodOrSuper;
    const filter = {
      user: userId,
      ...(shouldScopeBusiness && businessId ? { business: businessId } : {}),
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

    const filter = { business: businessId };

    const dateRange = this.buildDateRange(startDate, endDate);
    if (dateRange) {
      filter.date = dateRange;
    }

    if (userId) {
      filter.user = userId;
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
}

export default new ProfitHistoryRepository();
