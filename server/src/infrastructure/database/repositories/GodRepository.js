/**
 * God Repository - Data Access Layer
 * Handles super admin operations (metrics, user management)
 */

import AnalysisLog from "../models/AnalysisLog.js";
import AuditLog from "../models/AuditLog.js";
import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import BranchTransfer from "../models/BranchTransfer.js";
import Business from "../models/Business.js";
import BusinessAssistantConfig from "../models/BusinessAssistantConfig.js";
import Category from "../models/Category.js";
import Credit from "../models/Credit.js";
import CreditPayment from "../models/CreditPayment.js";
import Customer from "../models/Customer.js";
import DefectiveProduct from "../models/DefectiveProduct.js";
import DeliveryMethod from "../models/DeliveryMethod.js";
import EmployeeStats from "../models/EmployeeStats.js";
import EmployeeStock from "../models/EmployeeStock.js";
import Expense from "../models/Expense.js";
import GamificationConfig from "../models/GamificationConfig.js";
import InventoryEntry from "../models/InventoryEntry.js";
import IssueReport from "../models/IssueReport.js";
import Membership from "../models/Membership.js";
import Notification from "../models/Notification.js";
import PaymentMethod from "../models/PaymentMethod.js";
import PeriodWinner from "../models/PeriodWinner.js";
import PointsHistory from "../models/PointsHistory.js";
import Product from "../models/Product.js";
import ProfitHistory from "../models/ProfitHistory.js";
import Promotion from "../models/Promotion.js";
import Provider from "../models/Provider.js";
import PushSubscription from "../models/PushSubscription.js";
import RefreshToken from "../models/RefreshToken.js";
import Sale from "../models/Sale.js";
import Segment from "../models/Segment.js";
import SpecialSale from "../models/SpecialSale.js";
import Stock from "../models/Stock.js";
import StockTransfer from "../models/StockTransfer.js";
import User from "../models/User.js";

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
          // 💰 CASH FLOW: Solo ventas confirmadas para revenue/profit globales
          $match: { paymentStatus: "confirmado" },
        },
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
   * Delete user and all associated data (HARD DELETE - CASCADE)
   * Eliminates:
   * - The User document
   * - All Business where user is owner (admin)
   * - All Employees linked to those businesses and their user accounts
   * - All operational data: Products, Categories, Sales, Customers, Credits, Inventories, etc.
   */
  async deleteUser(userId, godUserId) {
    const user = await User.findById(userId);
    if (!user) return null;

    // Prevent god from deleting themselves
    if (godUserId === userId) {
      throw new Error("No puedes eliminarte a ti mismo");
    }

    // Prevent deleting god users
    if (user.role === "god") {
      throw new Error("No se puede eliminar un usuario god");
    }

    // 1. Find all businesses where this user is OWNER (admin role in membership)
    const ownerMemberships = await Membership.find({
      user: userId,
      role: "admin",
    }).select("business");
    const ownedBusinessIds = ownerMemberships.map((m) => m.business);

    // 2. Find ALL memberships in those businesses (includes employees)
    const allMembershipsInBusiness = await Membership.find({
      business: { $in: ownedBusinessIds },
    }).select("user");

    // Get unique employee user IDs (excluding the main user being deleted)
    const employeeUserIds = [
      ...new Set(
        allMembershipsInBusiness
          .map((m) => m.user.toString())
          .filter((id) => id !== userId),
      ),
    ];

    // 3. Delete all business-related operational data
    const deletionStats = {
      businesses: 0,
      employeeUsers: 0,
      products: 0,
      sales: 0,
      customers: 0,
      credits: 0,
      categories: 0,
      inventoryEntries: 0,
      otherDocuments: 0,
    };

    if (ownedBusinessIds.length > 0) {
      // Delete all operational data for owned businesses
      const results = await Promise.all([
        // Core business data
        Business.deleteMany({ _id: { $in: ownedBusinessIds } }),
        Membership.deleteMany({ business: { $in: ownedBusinessIds } }),

        // Products & Categories
        Product.deleteMany({ business: { $in: ownedBusinessIds } }),
        Category.deleteMany({ business: { $in: ownedBusinessIds } }),

        // Sales & Financial
        Sale.deleteMany({ business: { $in: ownedBusinessIds } }),
        Credit.deleteMany({ business: { $in: ownedBusinessIds } }),
        CreditPayment.deleteMany({ business: { $in: ownedBusinessIds } }),
        Expense.deleteMany({ business: { $in: ownedBusinessIds } }),
        SpecialSale.deleteMany({ business: { $in: ownedBusinessIds } }),
        ProfitHistory.deleteMany({ business: { $in: ownedBusinessIds } }),

        // Customers & Providers
        Customer.deleteMany({ business: { $in: ownedBusinessIds } }),
        Provider.deleteMany({ business: { $in: ownedBusinessIds } }),
        Segment.deleteMany({ business: { $in: ownedBusinessIds } }),

        // Inventory & Stock
        Stock.deleteMany({ business: { $in: ownedBusinessIds } }),
        StockTransfer.deleteMany({ business: { $in: ownedBusinessIds } }),
        InventoryEntry.deleteMany({ business: { $in: ownedBusinessIds } }),
        DefectiveProduct.deleteMany({ business: { $in: ownedBusinessIds } }),

        // Branches
        Branch.deleteMany({ business: { $in: ownedBusinessIds } }),
        BranchStock.deleteMany({ business: { $in: ownedBusinessIds } }),
        BranchTransfer.deleteMany({ business: { $in: ownedBusinessIds } }),

        // Employees
        EmployeeStock.deleteMany({ business: { $in: ownedBusinessIds } }),
        EmployeeStats.deleteMany({ business: { $in: ownedBusinessIds } }),

        // Promotions & Gamification
        Promotion.deleteMany({ business: { $in: ownedBusinessIds } }),
        GamificationConfig.deleteMany({ business: { $in: ownedBusinessIds } }),
        PeriodWinner.deleteMany({ business: { $in: ownedBusinessIds } }),
        PointsHistory.deleteMany({ business: { $in: ownedBusinessIds } }),

        // Configuration & Settings
        BusinessAssistantConfig.deleteMany({
          business: { $in: ownedBusinessIds },
        }),
        PaymentMethod.deleteMany({ business: { $in: ownedBusinessIds } }),
        DeliveryMethod.deleteMany({ business: { $in: ownedBusinessIds } }),

        // Notifications & Logs
        Notification.deleteMany({ business: { $in: ownedBusinessIds } }),
        IssueReport.deleteMany({ business: { $in: ownedBusinessIds } }),
        AuditLog.deleteMany({ business: { $in: ownedBusinessIds } }),
        AnalysisLog.deleteMany({ business: { $in: ownedBusinessIds } }),
      ]);

      // Collect deletion stats
      deletionStats.businesses = results[0].deletedCount;
      deletionStats.products = results[2].deletedCount;
      deletionStats.categories = results[3].deletedCount;
      deletionStats.sales = results[4].deletedCount;
      deletionStats.credits = results[5].deletedCount;
      deletionStats.customers = results[10].deletedCount;
      deletionStats.inventoryEntries = results[15].deletedCount;
    }

    // 4. Delete employee user accounts (only those who don't own other businesses)
    for (const employeeUserId of employeeUserIds) {
      // Check if this employee owns any OTHER business
      const otherOwnedBusinesses = await Membership.countDocuments({
        user: employeeUserId,
        role: "admin",
        business: { $nin: ownedBusinessIds },
      });

      if (otherOwnedBusinesses === 0) {
        // Safe to delete - they don't own other businesses
        // Delete their memberships in other businesses first
        await Membership.deleteMany({ user: employeeUserId });

        // Delete user-specific data
        await Promise.all([
          RefreshToken.deleteMany({ user: employeeUserId }),
          PushSubscription.deleteMany({ user: employeeUserId }),
          Notification.deleteMany({ user: employeeUserId }),
        ]);

        // Delete the user account
        await User.findByIdAndDelete(employeeUserId);
        deletionStats.employeeUsers++;
      }
    }

    // 5. Delete the main user's remaining data
    await Promise.all([
      // Delete any remaining memberships (where user is not owner)
      Membership.deleteMany({ user: userId }),
      RefreshToken.deleteMany({ user: userId }),
      PushSubscription.deleteMany({ user: userId }),
      Notification.deleteMany({ user: userId }),
    ]);

    // 6. Delete the main user
    await user.deleteOne();

    return {
      deletedBusinesses: ownedBusinessIds.length,
      deletedEmployeeUsers: deletionStats.employeeUsers,
      deletedProducts: deletionStats.products,
      deletedSales: deletionStats.sales,
      deletedCustomers: deletionStats.customers,
      deletedCredits: deletionStats.credits,
      deletedCategories: deletionStats.categories,
      deletedInventoryEntries: deletionStats.inventoryEntries,
    };
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
