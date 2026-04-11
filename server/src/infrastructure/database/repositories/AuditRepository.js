import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import Membership from "../models/Membership.js";
import Product from "../models/Product.js";

export class AuditRepository {
  async getBusinessUserIds(businessId, isSuperAdmin) {
    const memberships = await Membership.find({
      business: businessId,
      status: "active",
    }).select("user");

    const memberIds = memberships.map((m) => m.user);

    if (isSuperAdmin) {
      return memberIds.length ? memberIds : [];
    }

    return memberIds;
  }

  async findLogs(businessId, isSuperAdmin, filters = {}) {
    const allowedUsers = await this.getBusinessUserIds(
      businessId,
      isSuperAdmin,
    );

    if (!isSuperAdmin && allowedUsers.length === 0) {
      return {
        logs: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          pages: 0,
        },
      };
    }

    const filter = { business: businessId };

    if (!isSuperAdmin && allowedUsers.length) {
      filter.user = { $in: allowedUsers };
    }

    if (filters.action) {
      filter.action = filters.action;
    }

    if (filters.module) {
      filter.module = filters.module;
    }

    if (filters.userId) {
      filter.user = filters.userId;
    }

    if (filters.startDate || filters.endDate) {
      filter.createdAt = {};
      if (filters.startDate) {
        filter.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        filter.createdAt.$lte = new Date(filters.endDate);
      }
    }

    if (filters.severity) {
      filter.severity = filters.severity;
    }

    if (filters.entityType) {
      filter.entityType = filters.entityType;
    }

    if (filters.entityId) {
      filter.entityId = filters.entityId;
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id, businessId) {
    const log = await AuditLog.findOne({
      _id: id,
      business: businessId,
    }).lean();
    return log;
  }

  async getStats(businessId, filters = {}) {
    const match = { business: new mongoose.Types.ObjectId(businessId) };

    if (filters.startDate || filters.endDate) {
      match.createdAt = {};
      if (filters.startDate) {
        match.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        match.createdAt.$lte = new Date(filters.endDate);
      }
    }

    const [actionStats, moduleStats, userStats, severityStats] =
      await Promise.all([
        AuditLog.aggregate([
          { $match: match },
          { $group: { _id: "$action", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        AuditLog.aggregate([
          { $match: match },
          { $group: { _id: "$module", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        AuditLog.aggregate([
          { $match: match },
          { $group: { _id: "$user", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        AuditLog.aggregate([
          { $match: match },
          { $group: { _id: "$severity", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
      ]);

    return {
      actionStats,
      moduleStats,
      userStats,
      severityStats,
    };
  }

  async getDailySummary(businessId, date) {
    const baseDate = date ? new Date(date) : new Date();
    const dayStart = new Date(baseDate);
    const dayEnd = new Date(baseDate);
    dayStart.setHours(0, 0, 0, 0);
    dayEnd.setHours(23, 59, 59, 999);

    const match = {
      business: new mongoose.Types.ObjectId(businessId),
      createdAt: { $gte: dayStart, $lte: dayEnd },
    };

    const [totalActions, salesAgg, topUsersAgg, warehouseAgg] =
      await Promise.all([
        AuditLog.countDocuments(match),
        AuditLog.aggregate([
          { $match: { ...match, action: "sale_registered" } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              profit: {
                $sum: { $ifNull: ["$metadata.totalProfit", 0] },
              },
            },
          },
        ]),
        AuditLog.aggregate([
          { $match: match },
          {
            $group: {
              _id: "$user",
              name: { $first: "$userName" },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ]),
        Product.aggregate([
          { $match: { business: new mongoose.Types.ObjectId(businessId) } },
          {
            $group: {
              _id: null,
              totalWarehouseStock: { $sum: "$warehouseStock" },
            },
          },
        ]),
      ]);

    const salesSummary = salesAgg[0] || { count: 0, profit: 0 };
    const warehouseSummary = warehouseAgg[0] || { totalWarehouseStock: 0 };

    return {
      date: dayStart.toISOString().split("T")[0],
      totalActions,
      sales: {
        count: salesSummary.count || 0,
        profit: salesSummary.profit || 0,
      },
      inventory: {
        warehouse: {
          totalWarehouseStock: warehouseSummary.totalWarehouseStock || 0,
        },
      },
      topUsers: topUsersAgg.map((user) => ({
        name: user.name || "Usuario",
        count: user.count || 0,
      })),
    };
  }
}
