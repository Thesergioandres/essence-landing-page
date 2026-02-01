/**
 * God Repository - Data Access Layer
 * Handles super admin operations (metrics, user management)
 */

import AuditLog from "../../../../models/AuditLog.js";
import Branch from "../../../../models/Branch.js";
import BranchStock from "../../../../models/BranchStock.js";
import BranchTransfer from "../../../../models/BranchTransfer.js";
import Business from "../../../../models/Business.js";
import BusinessAssistantConfig from "../../../../models/BusinessAssistantConfig.js";
import Category from "../../../../models/Category.js";
import Credit from "../../../../models/Credit.js";
import CreditPayment from "../../../../models/CreditPayment.js";
import Customer from "../../../../models/Customer.js";
import DefectiveProduct from "../../../../models/DefectiveProduct.js";
import DistributorStats from "../../../../models/DistributorStats.js";
import DistributorStock from "../../../../models/DistributorStock.js";
import Expense from "../../../../models/Expense.js";
import GamificationConfig from "../../../../models/GamificationConfig.js";
import InventoryEntry from "../../../../models/InventoryEntry.js";
import IssueReport from "../../../../models/IssueReport.js";
import Membership from "../../../../models/Membership.js";
import Notification from "../../../../models/Notification.js";
import PeriodWinner from "../../../../models/PeriodWinner.js";
import Product from "../../../../models/Product.js";
import ProfitHistory from "../../../../models/ProfitHistory.js";
import Promotion from "../../../../models/Promotion.js";
import Provider from "../../../../models/Provider.js";
import Sale from "../../../../models/Sale.js";
import Segment from "../../../../models/Segment.js";
import SpecialSale from "../../../../models/SpecialSale.js";
import Stock from "../../../../models/Stock.js";
import StockTransfer from "../../../../models/StockTransfer.js";
import User from "../../../../models/User.js";

class GodRepository {
  /**
   * Add duration to date (helper)
   */
  addDuration(baseDate, { days = 0, months = 0, years = 0 }) {
    const date = new Date(baseDate || Date.now());
    if (years) date.setFullYear(date.getFullYear() + Number(years));
    if (months) date.setMonth(date.getMonth() + Number(months));
    if (days) date.setDate(date.getDate() + Number(days));
    return date;
  }

  /**
   * Get global metrics for God panel
   */
  async getGlobalMetrics() {
    const [
      totalUsers,
      usersByStatus,
      totalBusinesses,
      businessesByStatus,
      totalProducts,
      totalSales,
      salesMetrics,
      creditMetrics,
      recentUsers,
      recentBusinesses,
      topBusinessesBySales,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: "god" } }),
      User.aggregate([
        { $match: { role: { $ne: "god" } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Business.countDocuments(),
      Business.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Product.countDocuments(),
      Sale.countDocuments(),
      Sale.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$total" },
            totalProfit: { $sum: "$profit" },
            avgSaleValue: { $avg: "$total" },
          },
        },
      ]),
      Credit.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            totalPaid: { $sum: "$paidAmount" },
          },
        },
      ]),
      User.find({ role: { $ne: "god" } })
        .select("name email role status createdAt subscriptionExpiresAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Business.find()
        .select("name status createdAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Sale.aggregate([
        {
          $group: {
            _id: "$business",
            salesCount: { $sum: 1 },
            totalRevenue: { $sum: "$total" },
            totalProfit: { $sum: "$profit" },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "businesses",
            localField: "_id",
            foreignField: "_id",
            as: "businessDetails",
          },
        },
        { $unwind: "$businessDetails" },
        {
          $project: {
            businessId: "$_id",
            businessName: "$businessDetails.name",
            salesCount: 1,
            totalRevenue: 1,
            totalProfit: 1,
          },
        },
      ]),
    ]);

    // Format data
    const usersStatusMap = usersByStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const businessStatusMap = businessesByStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const creditsMap = creditMetrics.reduce((acc, item) => {
      acc[item._id] = {
        count: item.count,
        totalAmount: item.totalAmount,
        totalPaid: item.totalPaid,
      };
      return acc;
    }, {});

    return {
      users: {
        total: totalUsers,
        active: usersStatusMap.active || 0,
        expired: usersStatusMap.expired || 0,
        suspended: usersStatusMap.suspended || 0,
        paused: usersStatusMap.paused || 0,
      },
      businesses: {
        total: totalBusinesses,
        active: businessStatusMap.active || 0,
        inactive: businessStatusMap.inactive || 0,
      },
      products: { total: totalProducts },
      sales: {
        total: totalSales,
        totalRevenue: salesMetrics[0]?.totalRevenue || 0,
        totalProfit: salesMetrics[0]?.totalProfit || 0,
        avgSaleValue: salesMetrics[0]?.avgSaleValue || 0,
      },
      credits: {
        pending: creditsMap.pending || {
          count: 0,
          totalAmount: 0,
          totalPaid: 0,
        },
        paid: creditsMap.paid || { count: 0, totalAmount: 0, totalPaid: 0 },
        overdue: creditsMap.overdue || {
          count: 0,
          totalAmount: 0,
          totalPaid: 0,
        },
        totalOutstanding:
          (creditsMap.pending?.totalAmount || 0) -
          (creditsMap.pending?.totalPaid || 0) +
          ((creditsMap.overdue?.totalAmount || 0) -
            (creditsMap.overdue?.totalPaid || 0)),
      },
      recentUsers,
      recentBusinesses,
      topBusinessesBySales,
    };
  }

  /**
   * Get subscriptions summary
   */
  async getSubscriptionsSummary() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [expiringToday, expiringWeek, expiringMonth, recentExpired] =
      await Promise.all([
        User.countDocuments({
          role: { $ne: "god" },
          subscriptionExpiresAt: {
            $gte: new Date(now.setHours(0, 0, 0, 0)),
            $lt: new Date(now.setHours(23, 59, 59, 999)),
          },
        }),
        User.countDocuments({
          role: { $ne: "god" },
          subscriptionExpiresAt: {
            $gte: now,
            $lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        }),
        User.countDocuments({
          role: { $ne: "god" },
          subscriptionExpiresAt: {
            $gte: now,
            $lt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        }),
        User.find({
          role: { $ne: "god" },
          status: "expired",
          subscriptionExpiresAt: { $gte: thirtyDaysAgo, $lt: now },
        })
          .select("name email subscriptionExpiresAt")
          .sort({ subscriptionExpiresAt: -1 })
          .limit(20)
          .lean(),
      ]);

    return {
      expiringToday,
      expiringWeek,
      expiringMonth,
      recentExpired,
    };
  }

  /**
   * List all users
   */
  async listUsers() {
    return await User.find({}).select("-password").sort({ createdAt: -1 });
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email) {
    return await User.findOne({ email }).select("-password");
  }

  /**
   * Activate user
   */
  async activateUser(userId, { days = 30, months = 0, years = 0 }) {
    const user = await User.findById(userId);
    if (!user) return null;

    user.status = "active";
    user.active = true;
    user.subscriptionExpiresAt = this.addDuration(Date.now(), {
      days,
      months,
      years,
    });
    user.pausedRemainingMs = 0;
    await user.save();

    return user;
  }

  /**
   * Suspend user
   */
  async suspendUser(userId) {
    const user = await User.findById(userId);
    if (!user) return null;

    user.status = "suspended";
    user.active = false;
    await user.save();

    return user;
  }

  /**
   * Delete user and all associated data
   */
  async deleteUser(userId, godUserId) {
    const user = await User.findById(userId);
    if (!user) return null;

    // Prevent god from deleting themselves
    if (godUserId === userId) {
      throw new Error("No puedes eliminarte a ti mismo");
    }

    // Get all business IDs for the user
    const memberships = await Membership.find({ user: userId }).select(
      "business",
    );
    const businessIds = memberships.map((m) => m.business);

    // Delete all business-related data
    if (businessIds.length > 0) {
      await Promise.all([
        Business.deleteMany({ _id: { $in: businessIds } }),
        Membership.deleteMany({ business: { $in: businessIds } }),
        Product.deleteMany({ business: { $in: businessIds } }),
        Sale.deleteMany({ business: { $in: businessIds } }),
        Credit.deleteMany({ business: { $in: businessIds } }),
        CreditPayment.deleteMany({ business: { $in: businessIds } }),
        Expense.deleteMany({ business: { $in: businessIds } }),
        Customer.deleteMany({ business: { $in: businessIds } }),
        Provider.deleteMany({ business: { $in: businessIds } }),
        Category.deleteMany({ business: { $in: businessIds } }),
        Stock.deleteMany({ business: { $in: businessIds } }),
        StockTransfer.deleteMany({ business: { $in: businessIds } }),
        Branch.deleteMany({ business: { $in: businessIds } }),
        BranchStock.deleteMany({ business: { $in: businessIds } }),
        BranchTransfer.deleteMany({ business: { $in: businessIds } }),
        DistributorStock.deleteMany({ business: { $in: businessIds } }),
        DistributorStats.deleteMany({ business: { $in: businessIds } }),
        InventoryEntry.deleteMany({ business: { $in: businessIds } }),
        DefectiveProduct.deleteMany({ business: { $in: businessIds } }),
        SpecialSale.deleteMany({ business: { $in: businessIds } }),
        ProfitHistory.deleteMany({ business: { $in: businessIds } }),
        Promotion.deleteMany({ business: { $in: businessIds } }),
        Segment.deleteMany({ business: { $in: businessIds } }),
        Notification.deleteMany({ business: { $in: businessIds } }),
        IssueReport.deleteMany({ business: { $in: businessIds } }),
        AuditLog.deleteMany({ business: { $in: businessIds } }),
        GamificationConfig.deleteMany({ business: { $in: businessIds } }),
        PeriodWinner.deleteMany({ business: { $in: businessIds } }),
        BusinessAssistantConfig.deleteMany({ business: { $in: businessIds } }),
      ]);
    }

    // Delete user
    await user.deleteOne();

    return { deletedBusinesses: businessIds.length };
  }

  /**
   * Extend subscription
   */
  async extendSubscription(userId, { days = 0, months = 0, years = 0 }) {
    const user = await User.findById(userId);
    if (!user) return null;

    const base =
      user.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt) > new Date()
        ? user.subscriptionExpiresAt
        : Date.now();

    user.subscriptionExpiresAt = this.addDuration(base, {
      days,
      months,
      years,
    });
    user.status = "active";
    user.active = true;
    await user.save();

    return user;
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(userId) {
    const user = await User.findById(userId);
    if (!user) return null;

    if (user.status !== "active") {
      throw new Error("Solo se puede pausar desde estado active");
    }

    if (!user.subscriptionExpiresAt) {
      throw new Error("El usuario no tiene suscripción activa");
    }

    const remaining =
      new Date(user.subscriptionExpiresAt).getTime() - Date.now();
    user.pausedRemainingMs = Math.max(0, remaining);
    user.subscriptionExpiresAt = null;
    user.status = "paused";
    user.active = false;
    await user.save();

    return user;
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(userId) {
    const user = await User.findById(userId);
    if (!user) return null;

    if (user.status !== "paused") {
      throw new Error("Solo se puede reanudar desde estado paused");
    }

    const remaining = user.pausedRemainingMs || 0;
    const expiresAt = new Date(Date.now() + remaining);
    user.subscriptionExpiresAt = expiresAt;
    user.pausedRemainingMs = 0;
    user.status = "active";
    user.active = true;
    await user.save();

    return user;
  }
}

export default new GodRepository();
