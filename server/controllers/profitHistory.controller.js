import mongoose from "mongoose";
import ProfitHistory from "../models/ProfitHistory.js";
import Sale from "../models/Sale.js";
import SpecialSale from "../models/SpecialSale.js";
import User from "../models/User.js";
import {
  recalculateUserBalance,
  recordProfitHistory,
} from "../services/profitHistory.service.js";

const resolveBusinessId = (req) =>
  req.businessId || req.headers["x-business-id"] || req.query.businessId;

const buildColombiaDateRange = (startDateStr, endDateStr) => {
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
};

const buildColombiaSingleDay = (dateStr) => {
  if (!dateStr) return null;
  return buildColombiaDateRange(dateStr, dateStr);
};

// @desc    Obtener historial de ganancias de un usuario
// @route   GET /api/profit-history/user/:userId
// @access  Private/Admin o propio usuario
export const getUserProfitHistory = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isGodOrSuper =
      req.user?.role === "god" || req.user?.role === "super_admin";

    if (!businessId && !isGodOrSuper) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { userId } = req.params;
    const { startDate, endDate, type, page = 1, limit = 50, today } = req.query;

    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Construir filtro
    const shouldScopeBusiness = !isGodOrSuper || req.user.id !== userId;

    const filter = {
      user: userId,
      ...(shouldScopeBusiness && businessId ? { business: businessId } : {}),
    };

    const dateRange =
      today === "true"
        ? buildColombiaSingleDay(new Date().toISOString().slice(0, 10))
        : buildColombiaDateRange(startDate, endDate);
    if (dateRange) {
      filter.date = dateRange;
    }

    if (type) filter.type = type;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Obtener historial
    const [history, total] = await Promise.all([
      ProfitHistory.find(filter)
        .populate("product", "name image")
        .populate("sale", "saleId")
        .populate("specialSale", "eventName")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ProfitHistory.countDocuments(filter),
    ]);

    // Calcular totales
    const totals = await ProfitHistory.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = totals[0] || { totalAmount: 0, count: 0 };

    res.json({
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
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener balance actual de un usuario
// @route   GET /api/profit-history/balance/:userId
// @access  Private/Admin o propio usuario
export const getUserBalance = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isGodOrSuper =
      req.user?.role === "god" || req.user?.role === "super_admin";

    if (!businessId && !isGodOrSuper) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Obtener el último registro para el balance actual
    const shouldScopeBusiness = !isGodOrSuper || req.user.id !== userId;

    const lastEntry = await ProfitHistory.findOne({
      user: userId,
      ...(shouldScopeBusiness && businessId ? { business: businessId } : {}),
    })
      .sort({ date: -1 })
      .lean();

    // Calcular totales por tipo
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

    // Construir breakdown por tipo
    const breakdown = {
      venta_normal: 0,
      venta_especial: 0,
      ajuste: 0,
      bonus: 0,
    };

    totals.forEach((item) => {
      if (breakdown.hasOwnProperty(item._id)) {
        breakdown[item._id] = item.total;
      }
    });

    // Calcular balance total
    const totalBalance = totals.reduce((sum, item) => sum + item.total, 0);
    const transactionCount = totals.reduce((sum, item) => sum + item.count, 0);

    res.json({
      totalBalance: lastEntry?.balanceAfter || totalBalance,
      breakdown,
      transactionCount,
      lastUpdate: lastEntry?.date || null,
    });
  } catch (error) {
    console.error("Error en getUserBalance:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener resumen de ganancias por período
// @route   GET /api/profit-history/summary
// @access  Private/Admin
export const getProfitSummary = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId && req.user.role !== "super_admin") {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { startDate, endDate, groupBy = "day" } = req.query;

    const filter = businessId
      ? { business: new mongoose.Types.ObjectId(businessId) }
      : {};
    const dateRange = buildColombiaDateRange(startDate, endDate);
    if (dateRange) {
      filter.date = dateRange;
    }

    // Agrupar por período
    let groupFormat;
    switch (groupBy) {
      case "day":
        groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$date" } };
        break;
      case "week":
        groupFormat = { $dateToString: { format: "%Y-W%V", date: "$date" } };
        break;
      case "month":
        groupFormat = { $dateToString: { format: "%Y-%m", date: "$date" } };
        break;
      default:
        groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$date" } };
    }

    const summary = await ProfitHistory.aggregate([
      { $match: filter },
      {
        $group: {
          _id: groupFormat,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          types: { $addToSet: "$type" },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    // Resumen por tipo de transacción
    const byType = await ProfitHistory.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Top usuarios con más ganancias
    const topUsers = await ProfitHistory.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$user",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$_id",
          userName: "$user.name",
          userEmail: "$user.email",
          userRole: "$user.role",
          totalAmount: 1,
          count: 1,
        },
      },
    ]);

    res.json({
      timeline: summary,
      byType,
      topUsers,
      groupBy,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Registrar un movimiento de ganancia manual (ajuste)
// @route   POST /api/profit-history
// @access  Private/Admin
export const createProfitEntry = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId && req.user.role !== "super_admin") {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { userId, amount, description, type = "ajuste", metadata } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Obtener balance actual
    const lastEntry = await ProfitHistory.findOne({
      user: userId,
      ...(businessId ? { business: businessId } : {}),
    })
      .sort({ date: -1 })
      .lean();

    const currentBalance = lastEntry?.balanceAfter || 0;
    const newBalance = currentBalance + amount;

    // Crear entrada
    const entry = await ProfitHistory.create({
      user: userId,
      type,
      amount,
      description,
      balanceAfter: newBalance,
      metadata,
      business: businessId,
      date: new Date(),
    });

    const populatedEntry = await ProfitHistory.findById(entry._id)
      .populate("user", "name email role")
      .populate("product", "name image");

    res.status(201).json({
      message: "Movimiento registrado exitosamente",
      entry: populatedEntry,
      newBalance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Backfill de historial desde ventas normales (sin borrar historial)
// @route   POST /api/profit-history/backfill/sales
// @access  Private/Admin
export const backfillProfitHistoryFromSales = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId && req.user.role !== "super_admin") {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { startDate, endDate, distributorId, saleId } = req.body || {};

    const adminUser = await User.findOne({
      role: { $in: ["admin", "super_admin"] },
    })
      .select("_id")
      .lean();
    if (!adminUser?._id) {
      return res.status(500).json({ message: "No se encontró usuario admin" });
    }

    const salesFilter = businessId
      ? { business: new mongoose.Types.ObjectId(businessId) }
      : {};

    if (saleId) {
      if (!mongoose.isValidObjectId(saleId)) {
        return res.status(400).json({ message: "saleId inválido" });
      }
      salesFilter._id = new mongoose.Types.ObjectId(saleId);
    }

    if (distributorId) {
      if (!mongoose.isValidObjectId(distributorId)) {
        return res.status(400).json({ message: "distributorId inválido" });
      }
      salesFilter.distributor = new mongoose.Types.ObjectId(distributorId);
    }

    const saleDateRange = buildColombiaDateRange(startDate, endDate);
    if (saleDateRange) {
      salesFilter.saleDate = saleDateRange;
    }

    const sales = await Sale.find(salesFilter)
      .select(
        "_id saleId distributor product quantity salePrice saleDate distributorProfit adminProfit distributorProfitPercentage commissionBonus",
      )
      .sort({ saleDate: 1 })
      .lean();

    let created = 0;
    let skipped = 0;
    const affectedUsers = new Set();

    for (const sale of sales) {
      const desiredEntries = [];

      if (sale.distributor && sale.distributorProfit > 0) {
        desiredEntries.push({
          userId: sale.distributor,
          amount: sale.distributorProfit,
          description: `Comisión por venta ${sale.saleId}`,
          metadata: {
            quantity: sale.quantity,
            salePrice: sale.salePrice,
            saleId: sale.saleId,
            commission: sale.distributorProfitPercentage,
            commissionBonus: sale.commissionBonus,
          },
        });
      }

      if (sale.adminProfit > 0) {
        desiredEntries.push({
          userId: adminUser._id,
          amount: sale.adminProfit,
          description: sale.distributor
            ? `Ganancia de venta ${sale.saleId} (distribuidor)`
            : `Venta directa ${sale.saleId}`,
          metadata: {
            quantity: sale.quantity,
            salePrice: sale.salePrice,
            saleId: sale.saleId,
          },
        });
      }

      for (const entry of desiredEntries) {
        const exists = await ProfitHistory.findOne({
          sale: sale._id,
          user: entry.userId,
          type: "venta_normal",
        })
          .select("_id")
          .lean();

        if (exists?._id) {
          skipped++;
          continue;
        }

        await recordProfitHistory({
          userId: entry.userId,
          type: "venta_normal",
          amount: entry.amount,
          description: entry.description,
          saleId: sale._id,
          productId: sale.product,
          metadata: entry.metadata,
          businessId,
          date: sale.saleDate,
        });

        created++;
        affectedUsers.add(String(entry.userId));
      }
    }

    // Recalcular balances para mantener balanceAfter correcto
    for (const userId of affectedUsers) {
      try {
        await recalculateUserBalance(userId, businessId);
      } catch (e) {
        console.error("Error recalculando balance para", userId, e?.message);
      }
    }

    res.json({
      message: "Backfill completado",
      scannedSales: sales.length,
      created,
      skipped,
      usersUpdated: affectedUsers.size,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener comparativa de ganancias entre períodos
// @route   GET /api/profit-history/comparative
// @access  Private/Admin
export const getComparativeAnalysis = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId && req.user.role !== "super_admin") {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const now = new Date();

    // Este mes
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    // Mes anterior
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    const matchCurrent = {
      date: { $gte: startOfMonth, $lte: endOfMonth },
      ...(businessId
        ? { business: new mongoose.Types.ObjectId(businessId) }
        : {}),
    };
    const matchPrevious = {
      date: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      ...(businessId
        ? { business: new mongoose.Types.ObjectId(businessId) }
        : {}),
    };

    const [thisMonth, lastMonth] = await Promise.all([
      ProfitHistory.aggregate([
        { $match: matchCurrent },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
            avgAmount: { $avg: "$amount" },
          },
        },
      ]),
      ProfitHistory.aggregate([
        { $match: matchPrevious },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
            avgAmount: { $avg: "$amount" },
          },
        },
      ]),
    ]);

    const currentMonth = thisMonth[0] || {
      totalAmount: 0,
      count: 0,
      avgAmount: 0,
    };
    const previousMonth = lastMonth[0] || {
      totalAmount: 0,
      count: 0,
      avgAmount: 0,
    };

    const difference = currentMonth.totalAmount - previousMonth.totalAmount;
    const percentageChange =
      previousMonth.totalAmount > 0
        ? ((currentMonth.totalAmount - previousMonth.totalAmount) /
            previousMonth.totalAmount) *
          100
        : currentMonth.totalAmount > 0
          ? 100
          : 0;

    res.json({
      currentMonth: {
        total: currentMonth.totalAmount || 0,
        count: currentMonth.count || 0,
        avgAmount: currentMonth.avgAmount || 0,
      },
      previousMonth: {
        total: previousMonth.totalAmount || 0,
        count: previousMonth.count || 0,
        avgAmount: previousMonth.avgAmount || 0,
      },
      difference: difference || 0,
      percentageChange: parseFloat(percentageChange.toFixed(2)) || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Overview de ganancias para admins sin depender del historial previo
// @route   GET /api/profit-history/admin/overview
// @access  Private/Admin
export const getAdminProfitHistoryOverview = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isGodOrSuper =
      req.user?.role === "god" || req.user?.role === "super_admin";

    if (!businessId && !isGodOrSuper) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { startDate, endDate, distributorId, limit = 150 } = req.query;

    const saleFilter = businessId
      ? { business: new mongoose.Types.ObjectId(businessId) }
      : {};

    const saleDateRange = buildColombiaDateRange(startDate, endDate);
    if (saleDateRange) {
      saleFilter.saleDate = saleDateRange;
    }

    if (distributorId) {
      if (distributorId === "admin") {
        saleFilter.$or = [
          { distributor: { $exists: false } },
          { distributor: null },
        ];
      } else if (mongoose.isValidObjectId(distributorId)) {
        saleFilter.distributor = new mongoose.Types.ObjectId(distributorId);
      }
    }

    const safeLimit = Math.min(Math.max(parseInt(limit) || 0, 20), 400);

    const sales = await Sale.find(saleFilter)
      .select(
        "saleId saleDate saleGroupId distributor product quantity adminProfit distributorProfit totalProfit netProfit totalAdditionalCosts shippingCost discount paymentStatus",
      )
      .populate("product", "name")
      .populate("distributor", "name email role")
      .sort({ saleDate: -1 })
      .limit(safeLimit)
      .lean();

    const specialSaleFilter = {
      status: "active",
      ...(saleDateRange ? { saleDate: saleDateRange } : {}),
      ...(businessId
        ? { business: new mongoose.Types.ObjectId(businessId) }
        : {}),
    };

    const specialSales = await SpecialSale.find(specialSaleFilter)
      .select(
        "product quantity totalProfit distribution saleDate eventName saleId",
      )
      .sort({ saleDate: -1 })
      .limit(safeLimit)
      .lean();

    const entries = sales.map((sale) => {
      const distributor = sale.distributor;
      const distributorIdValue = distributor?._id?.toString() || null;

      const adminProfit = sale.adminProfit || 0;
      const distributorProfit = sale.distributorProfit || 0;
      const totalProfit =
        sale.totalProfit ?? adminProfit + (distributorProfit ?? 0);

      // Calcular deducciones totales y netProfit
      const totalDeductions =
        (sale.totalAdditionalCosts || 0) +
        (sale.shippingCost || 0) +
        (sale.discount || 0);
      const netProfit = sale.netProfit ?? totalProfit - totalDeductions;

      return {
        id: sale._id.toString(),
        saleId: sale.saleId,
        saleGroupId: sale.saleGroupId?.toString() || sale._id.toString(),
        date: sale.saleDate,
        source: "normal",
        distributorId: distributorIdValue,
        distributorName:
          distributor?.name || distributor?.email || "Venta administrada",
        distributorEmail: distributor?.email || null,
        type: distributorIdValue ? "venta_distribuidor" : "venta_admin",
        adminProfit,
        distributorProfit,
        totalProfit,
        netProfit,
        totalDeductions,
        quantity: sale.quantity,
        productName: sale.product?.name || "",
        paymentStatus: sale.paymentStatus,
      };
    });

    // Agregar entradas de ventas especiales desglosadas por distribución
    specialSales.forEach((sale) => {
      const saleId = sale.saleId || sale._id.toString();
      const productName = sale.product?.name || "";

      sale.distribution.forEach((dist, idx) => {
        const isAdmin = dist.name?.toLowerCase() === "admin";
        if (distributorId === "admin" && !isAdmin) return;
        const amount = dist.amount || 0;
        entries.push({
          id: `${sale._id.toString()}-${idx}`,
          saleId,
          date: sale.saleDate,
          source: "special",
          distributorId: isAdmin ? null : null,
          distributorName: dist.name || "Sin nombre",
          distributorEmail: null,
          type: isAdmin ? "venta_admin" : "venta_distribuidor",
          adminProfit: isAdmin ? amount : 0,
          distributorProfit: !isAdmin ? amount : 0,
          totalProfit: amount,
          netProfit: amount, // Ventas especiales no tienen deducciones
          totalDeductions: 0,
          quantity: sale.quantity,
          productName,
          eventName: sale.eventName,
          paymentStatus: undefined,
        });
      });
    });

    // Contar órdenes únicas por saleGroupId
    const uniqueOrderIds = new Set();
    entries.forEach((entry) => {
      uniqueOrderIds.add(entry.saleGroupId || entry.id);
    });

    const summary = entries.reduce(
      (acc, entry) => {
        acc.totalProfit += entry.totalProfit;
        acc.netProfit += entry.netProfit || entry.totalProfit;
        acc.totalDeductions += entry.totalDeductions || 0;
        acc.adminProfit += entry.adminProfit;
        acc.distributorProfit += entry.distributorProfit;
        acc.count += 1;
        return acc;
      },
      {
        totalProfit: 0,
        netProfit: 0,
        totalDeductions: 0,
        adminProfit: 0,
        distributorProfit: 0,
        count: 0,
      },
    );

    // Agregar conteo de órdenes únicas
    summary.ordersCount = uniqueOrderIds.size;

    summary.averageTicket = summary.count
      ? summary.netProfit / summary.count
      : 0;

    const distributorMap = new Map();

    entries.forEach((entry) => {
      const key = entry.distributorId || entry.distributorName || "admin";
      const current = distributorMap.get(key) || {
        id: entry.distributorId || entry.distributorName || "admin",
        name: entry.distributorName || "Ventas administradas",
        email: entry.distributorEmail,
        totalProfit: 0,
        adminProfit: 0,
        distributorProfit: 0,
        sales: 0,
      };

      current.totalProfit += entry.distributorId
        ? entry.distributorProfit
        : entry.adminProfit;
      current.adminProfit += entry.adminProfit;
      current.distributorProfit += entry.distributorProfit;
      current.sales += 1;

      distributorMap.set(key, current);
    });

    const distributors = Array.from(distributorMap.values()).sort(
      (a, b) => b.totalProfit - a.totalProfit,
    );

    res.json({
      summary,
      distributors,
      entries,
    });
  } catch (error) {
    console.error("Error en getAdminProfitHistoryOverview:", error);
    res.status(500).json({ message: error.message });
  }
};

export default {
  getUserProfitHistory,
  getUserBalance,
  getProfitSummary,
  createProfitEntry,
  getComparativeAnalysis,
  getAdminProfitHistoryOverview,
};
