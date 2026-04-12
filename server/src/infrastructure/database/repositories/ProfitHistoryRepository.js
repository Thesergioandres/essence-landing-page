/**
 * ProfitHistory Repository - Data Access Layer
 * Handles profit history operations in Hexagonal Architecture
 */

import mongoose from "mongoose";
import Membership from "../models/Membership.js";
import ProfitHistory from "../models/ProfitHistory.js";
import Sale from "../models/Sale.js";
import SpecialSale from "../models/SpecialSale.js";
import User from "../models/User.js";

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
        { $limit: 10 },
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
  async create(data, options = {}) {
    const { session } = options;
    const [created] = await ProfitHistory.create(
      [data],
      session ? { session } : {},
    );
    return created;
  }

  /**
   * Get admin profit overview
   */
  async getAdminOverview(businessId, options = {}) {
    const {
      startDate,
      endDate,
      limit = 150,
      employeeId,
      hideFinancialData = false,
    } = options;
    const dateRange = this.buildDateRange(startDate, endDate);
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const employeeObjectId =
      employeeId && mongoose.isValidObjectId(employeeId)
        ? new mongoose.Types.ObjectId(employeeId)
        : null;
    const isScopedEmployeeView = Boolean(employeeObjectId);

    const filter = {
      business: businessObjectId,
      ...(dateRange ? { date: dateRange } : {}),
      ...(isScopedEmployeeView ? { user: employeeObjectId } : {}),
    };
    const recentEntriesFilter = {
      ...filter,
    };

    // Get employee user IDs for this business
    const employeeMemberships = await Membership.find({
      business: businessObjectId,
      role: "employee",
      status: "active",
    })
      .select("user")
      .lean();
    const employeeUserIds = employeeMemberships.map((m) => m.user);
    const employeeUserObjectIds = employeeUserIds
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
      ...(isScopedEmployeeView ? { user: employeeObjectId } : {}),
      $or: [
        { "metadata.commission": { $gt: 0 } },
        { description: { $regex: /comisi[oó]n/i } },
        ...(employeeUserObjectIds.length > 0
          ? [{ user: { $in: employeeUserObjectIds } }]
          : []),
      ],
    };

    const saleScopeMatch = isScopedEmployeeView
      ? {
          $or: [
            { employee: employeeObjectId },
            { createdBy: employeeObjectId },
          ],
        }
      : {};

    const specialSaleScopeMatch = isScopedEmployeeView
      ? { createdBy: employeeObjectId }
      : {};

    const [
      overview,
      recentEntries,
      byType,
      byUser,
      employeeCommissions,
      employeeBreakdown,
      salesNetProfit,
      specialSalesNetProfit,
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
      // Recent entries (grouped by sale)
      ProfitHistory.aggregate([
        { $match: recentEntriesFilter },
        { $sort: { date: -1, createdAt: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "products",
            localField: "product",
            foreignField: "_id",
            as: "productInfo",
          },
        },
        { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "sales",
            localField: "sale",
            foreignField: "_id",
            as: "saleInfo",
          },
        },
        { $unwind: { path: "$saleInfo", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "users",
            localField: "saleInfo.employee",
            foreignField: "_id",
            as: "saleEmployeeInfo",
          },
        },
        {
          $unwind: {
            path: "$saleEmployeeInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "specialsales",
            localField: "specialSale",
            foreignField: "_id",
            as: "specialSaleInfo",
          },
        },
        {
          $unwind: {
            path: "$specialSaleInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            source: {
              $cond: [
                { $eq: ["$type", "venta_especial"] },
                "special",
                "normal",
              ],
            },
            saleIdField: {
              $ifNull: [
                "$metadata.saleId",
                {
                  $ifNull: [
                    "$saleInfo.saleId",
                    {
                      $ifNull: ["$sale", { $ifNull: ["$specialSale", "$_id"] }],
                    },
                  ],
                },
              ],
            },
            eventNameField: {
              $ifNull: ["$metadata.eventName", "$specialSaleInfo.eventName"],
            },
            productNameField: {
              $ifNull: [
                "$productInfo.name",
                {
                  $ifNull: [
                    "$saleInfo.productName",
                    { $ifNull: ["$metadata.productName", "Sin producto"] },
                  ],
                },
              ],
            },
            employeeNameField: { $ifNull: ["$userInfo.name", "Admin"] },
            employeeEmailField: { $ifNull: ["$userInfo.email", ""] },
            entryDate: {
              $ifNull: [
                "$createdAt",
                {
                  $ifNull: [
                    "$date",
                    {
                      $ifNull: [
                        "$saleInfo.saleDate",
                        {
                          $ifNull: [
                            "$saleInfo.createdAt",
                            "$specialSaleInfo.saleDate",
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            isCommissionEntry: {
              $regexMatch: {
                input: { $ifNull: ["$description", ""] },
                regex: /comisi[oó]n/i,
              },
            },
            isEmployeeUser: {
              $or: [
                { $in: ["$user", employeeUserObjectIds] },
                { $eq: ["$userInfo.role", "employee"] },
              ],
            },
            isCommissionType: { $eq: ["$type", "commission"] },
            amountSafe: { $ifNull: ["$amount", 0] },
            isPromotionEmployee: {
              $and: [
                { $eq: ["$saleInfo.isPromotion", true] },
                { $ne: ["$saleInfo.employee", null] },
              ],
            },
            saleAdminProfit: { $ifNull: ["$saleInfo.adminProfit", null] },
            saleEmployeeProfit: {
              $ifNull: ["$saleInfo.employeeProfit", null],
            },
            saleTotalProfit: { $ifNull: ["$saleInfo.totalProfit", null] },
            saleNetProfit: { $ifNull: ["$saleInfo.netProfit", null] },
            saleAdditionalCosts: {
              $ifNull: ["$saleInfo.totalAdditionalCosts", 0],
            },
            saleDiscount: { $ifNull: ["$saleInfo.discount", 0] },
            saleShippingCost: { $ifNull: ["$saleInfo.shippingCost", 0] },
          },
        },
        {
          $lookup: {
            from: "sales",
            localField: "saleIdField",
            foreignField: "saleId",
            as: "saleInfoBySaleId",
          },
        },
        {
          $unwind: {
            path: "$saleInfoBySaleId",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            resolvedSaleEmployee: {
              $ifNull: [
                "$saleInfo.employee",
                "$saleInfoBySaleId.employee",
              ],
            },
            resolvedSaleIsPromotion: {
              $ifNull: [
                "$saleInfo.isPromotion",
                "$saleInfoBySaleId.isPromotion",
              ],
            },
            saleAdminProfit: {
              $ifNull: ["$saleAdminProfit", "$saleInfoBySaleId.adminProfit"],
            },
            saleEmployeeProfit: {
              $ifNull: [
                "$saleEmployeeProfit",
                "$saleInfoBySaleId.employeeProfit",
              ],
            },
            saleTotalProfit: {
              $ifNull: ["$saleTotalProfit", "$saleInfoBySaleId.totalProfit"],
            },
            saleNetProfit: {
              $ifNull: ["$saleNetProfit", "$saleInfoBySaleId.netProfit"],
            },
            saleAdditionalCosts: {
              $ifNull: [
                "$saleAdditionalCosts",
                { $ifNull: ["$saleInfoBySaleId.totalAdditionalCosts", 0] },
              ],
            },
            saleDiscount: {
              $ifNull: [
                "$saleDiscount",
                { $ifNull: ["$saleInfoBySaleId.discount", 0] },
              ],
            },
            saleShippingCost: {
              $ifNull: [
                "$saleShippingCost",
                { $ifNull: ["$saleInfoBySaleId.shippingCost", 0] },
              ],
            },
            isPromotionEmployee: {
              $and: [
                { $eq: ["$resolvedSaleIsPromotion", true] },
                { $ne: ["$resolvedSaleEmployee", null] },
              ],
            },
          },
        },
        {
          $match: {
            eventNameField: {
              $nin: ["defective_loss", "warranty_profit_adjustment"],
            },
          },
        },
        {
          $addFields: {
            isEmployeeCommission: {
              $or: [
                "$isCommissionType",
                "$isCommissionEntry",
                "$isEmployeeUser",
              ],
            },
            hasEmployeeContext: {
              $or: [
                "$isEmployeeCommission",
                { $ne: ["$resolvedSaleEmployee", null] },
              ],
            },
            employeeProfit: {
              $cond: ["$isEmployeeCommission", "$amountSafe", 0],
            },
            adminProfit: {
              $cond: ["$isEmployeeCommission", 0, "$amountSafe"],
            },
          },
        },
        {
          $group: {
            _id: { source: "$source", saleId: "$saleIdField" },
            id: { $first: "$_id" },
            date: { $first: "$entryDate" },
            saleId: { $first: "$saleIdField" },
            source: { $first: "$source" },
            eventName: { $first: "$eventNameField" },
            employeeName: {
              $first: {
                $ifNull: ["$saleEmployeeInfo.name", "$employeeNameField"],
              },
            },
            employeeEmail: {
              $first: {
                $ifNull: [
                  "$saleEmployeeInfo.email",
                  "$employeeEmailField",
                ],
              },
            },
            productName: { $first: "$productNameField" },
            employeeProfitSum: { $sum: "$employeeProfit" },
            totalProfitSum: { $sum: "$amountSafe" },
            hasEmployeeContext: { $max: "$hasEmployeeContext" },
            isPromotionEmployee: { $max: "$isPromotionEmployee" },
            saleAdminProfit: { $first: "$saleAdminProfit" },
            saleEmployeeProfit: { $first: "$saleEmployeeProfit" },
            saleTotalProfit: { $first: "$saleTotalProfit" },
            saleNetProfit: { $first: "$saleNetProfit" },
            saleAdditionalCosts: { $first: "$saleAdditionalCosts" },
            saleDiscount: { $first: "$saleDiscount" },
            saleShippingCost: { $first: "$saleShippingCost" },
          },
        },
        {
          $addFields: {
            employeeProfit: {
              $cond: [
                "$isPromotionEmployee",
                {
                  $ifNull: ["$saleEmployeeProfit", "$employeeProfitSum"],
                },
                {
                  $ifNull: ["$saleEmployeeProfit", "$employeeProfitSum"],
                },
              ],
            },
            saleAdminNetProfit: {
              $cond: [
                { $ne: ["$saleAdminProfit", null] },
                {
                  $subtract: [
                    {
                      $subtract: [
                        {
                          $subtract: [
                            "$saleAdminProfit",
                            "$saleAdditionalCosts",
                          ],
                        },
                        "$saleDiscount",
                      ],
                    },
                    "$saleShippingCost",
                  ],
                },
                {
                  $cond: [
                    { $ne: ["$saleNetProfit", null] },
                    "$saleNetProfit",
                    null,
                  ],
                },
              ],
            },
            adminProfit: {
              $cond: [
                { $ne: ["$saleAdminProfit", null] },
                "$saleAdminNetProfit",
                {
                  $cond: [
                    { $ne: ["$saleNetProfit", null] },
                    "$saleNetProfit",
                    {
                      $cond: [
                        "$isPromotionEmployee",
                        {
                          $ifNull: [
                            "$saleAdminProfit",
                            {
                              $subtract: [
                                "$totalProfitSum",
                                "$employeeProfitSum",
                              ],
                            },
                          ],
                        },
                        {
                          $cond: [
                            "$hasEmployeeContext",
                            {
                              $subtract: [
                                "$totalProfitSum",
                                "$employeeProfitSum",
                              ],
                            },
                            "$totalProfitSum",
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          $addFields: {
            totalProfit: {
              $cond: [
                "$hasEmployeeContext",
                {
                  $cond: [
                    { $lt: ["$adminProfit", 0] },
                    "$employeeProfit",
                    { $add: ["$employeeProfit", "$adminProfit"] },
                  ],
                },
                "$adminProfit",
              ],
            },
          },
        },
        {
          $match: {
            $expr: {
              $gt: [
                {
                  $abs: {
                    $ifNull: ["$totalProfit", 0],
                  },
                },
                0.009,
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            id: 1,
            date: 1,
            saleId: 1,
            source: 1,
            eventName: 1,
            employeeName: 1,
            employeeEmail: 1,
            productName: 1,
            employeeProfit: 1,
            adminProfit: 1,
            totalProfit: 1,
          },
        },
        { $sort: { date: -1 } },
        { $limit: limit },
      ]),
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
      // Employee commissions total
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
      // Employee commission breakdown (ranking)
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
            name: { $ifNull: ["$userInfo.name", "Empleado"] },
            email: "$userInfo.email",
            sales: 1,
            employeeProfit: "$total",
          },
        },
        { $sort: { employeeProfit: -1 } },
        { $limit: 10 },
      ]),
      Sale.aggregate([
        {
          $match: {
            business: businessObjectId,
            paymentStatus: "confirmado",
            ...(dateRange ? { saleDate: dateRange } : {}),
            ...saleScopeMatch,
          },
        },
        {
          $addFields: {
            adminNetProfit: {
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
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$adminNetProfit" },
          },
        },
      ]),
      SpecialSale.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: "active",
            ...(dateRange ? { saleDate: dateRange } : {}),
            ...specialSaleScopeMatch,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$totalProfit", 0] } },
          },
        },
      ]),
    ]);

    const totals = overview[0] || {
      netProfit: 0,
      grossProfit: 0,
      totalExpenses: 0,
      totalEntries: 0,
    };
    const commissions = employeeCommissions[0] || { total: 0, count: 0 };
    const typeBreakdown = byType.reduce((acc, item) => {
      acc[item._id] = { total: item.total, count: item.count };
      return acc;
    }, {});

    const salesNetTotal = salesNetProfit?.[0]?.total || 0;
    const specialNetTotal = specialSalesNetProfit?.[0]?.total || 0;
    const adminNetFromSales = salesNetTotal + specialNetTotal;
    const totalAdminProfit = adminNetFromSales;

    if (isScopedEmployeeView || hideFinancialData) {
      const scopedProfit =
        commissions.total || totals.netProfit || totals.grossProfit || 0;

      return {
        totalProfit: scopedProfit,
        grossProfit: scopedProfit,
        totalExpenses: 0,
        netProfit: scopedProfit,
        totalAdminProfit: 0,
        totalEmployeeProfit: scopedProfit,
        totalEntries: recentEntries.length,
        totalEmployeeCommissions: commissions.total,
        employeeCommissionEntries: commissions.count,
        employees: employeeBreakdown,
        byType: typeBreakdown,
        topUsers: byUser,
        recentEntries,
        filters: {
          startDate,
          endDate,
          limit,
          employeeId: employeeObjectId
            ? String(employeeObjectId)
            : undefined,
        },
      };
    }

    const employeesWithAdmin = [
      ...employeeBreakdown,
      {
        id: "admin",
        name: "Admin",
        adminProfit: totalAdminProfit,
        employeeProfit: 0,
        sales: 0,
      },
    ];

    return {
      totalProfit: totalAdminProfit,
      grossProfit: totals.grossProfit,
      totalExpenses: totals.totalExpenses,
      netProfit: totalAdminProfit,
      totalAdminProfit,
      totalEmployeeProfit: commissions.total,
      totalEntries: recentEntries.length,
      totalEmployeeCommissions: commissions.total,
      employeeCommissionEntries: commissions.count,
      employees: employeesWithAdmin,
      byType: typeBreakdown,
      topUsers: byUser,
      recentEntries,
      filters: { startDate, endDate, limit },
    };
  }
}

export default new ProfitHistoryRepository();
