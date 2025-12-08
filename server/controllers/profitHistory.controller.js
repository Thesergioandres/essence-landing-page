import ProfitHistory from "../models/ProfitHistory.js";
import User from "../models/User.js";
import Sale from "../models/Sale.js";
import SpecialSale from "../models/SpecialSale.js";

// @desc    Obtener historial de ganancias de un usuario
// @route   GET /api/profit-history/user/:userId
// @access  Private/Admin o propio usuario
export const getUserProfitHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, type, page = 1, limit = 50 } = req.query;

    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Construir filtro
    const filter = { user: userId };
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
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
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Obtener el último registro para el balance actual
    const lastEntry = await ProfitHistory.findOne({ user: userId })
      .sort({ date: -1 })
      .lean();

    // Calcular totales por tipo
    const totals = await ProfitHistory.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalByType = totals.reduce((acc, item) => {
      acc[item._id] = {
        total: item.total,
        count: item.count,
      };
      return acc;
    }, {});

    // Calcular balance total
    const totalBalance = totals.reduce((sum, item) => sum + item.total, 0);

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      balance: lastEntry?.balanceAfter || totalBalance,
      totalByType,
      lastUpdate: lastEntry?.date || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener resumen de ganancias por período
// @route   GET /api/profit-history/summary
// @access  Private/Admin
export const getProfitSummary = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
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
    const { userId, amount, description, type = "ajuste", metadata } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Obtener balance actual
    const lastEntry = await ProfitHistory.findOne({ user: userId })
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

// @desc    Obtener comparativa de ganancias entre períodos
// @route   GET /api/profit-history/comparative
// @access  Private/Admin
export const getComparativeAnalysis = async (req, res) => {
  try {
    const now = new Date();
    
    // Este mes
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // Mes anterior
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonth, lastMonth] = await Promise.all([
      ProfitHistory.aggregate([
        { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
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
        { $match: { date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
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

    const currentMonth = thisMonth[0] || { totalAmount: 0, count: 0, avgAmount: 0 };
    const previousMonth = lastMonth[0] || { totalAmount: 0, count: 0, avgAmount: 0 };

    const growth = previousMonth.totalAmount > 0
      ? ((currentMonth.totalAmount - previousMonth.totalAmount) / previousMonth.totalAmount) * 100
      : currentMonth.totalAmount > 0 ? 100 : 0;

    res.json({
      currentMonth,
      previousMonth,
      growth: parseFloat(growth.toFixed(2)),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export default {
  getUserProfitHistory,
  getUserBalance,
  getProfitSummary,
  createProfitEntry,
  getComparativeAnalysis,
};
