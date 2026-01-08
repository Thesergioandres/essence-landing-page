import mongoose from "mongoose";
import { invalidateCache } from "../middleware/cache.middleware.js";
import BranchStock from "../models/BranchStock.js";
import Credit from "../models/Credit.js";
import CreditPayment from "../models/CreditPayment.js";
import Customer from "../models/Customer.js";
import DistributorStock from "../models/DistributorStock.js";
import Notification from "../models/Notification.js";
import Product from "../models/Product.js";
import ProfitHistory from "../models/ProfitHistory.js";
import Sale from "../models/Sale.js";
import { recalculateUserBalance } from "../services/profitHistory.service.js";
import { logApiError, logApiInfo, logApiWarn } from "../utils/logger.js";

/**
 * @desc    Crear un nuevo fiado/crédito
 * @route   POST /api/credits
 * @access  Private/Admin
 */
export const createCredit = async (req, res) => {
  const requestId = req.reqId;
  const businessId = req.businessId;
  const userId = req.user?.id;

  try {
    const {
      customerId,
      amount,
      dueDate,
      description,
      items,
      saleId,
      branchId,
    } = req.body;

    if (!customerId || !amount) {
      return res.status(400).json({
        message: "Cliente y monto son obligatorios",
        requestId,
      });
    }

    // Verificar que el cliente existe y pertenece al negocio
    const customer = await Customer.findOne({
      _id: customerId,
      business: businessId,
    });

    if (!customer) {
      logApiError({
        message: "fiado_invalid_client",
        module: "credit",
        requestId,
        businessId,
        userId,
        extra: { customerId },
      });
      return res.status(404).json({
        message: "Cliente no encontrado",
        requestId,
      });
    }

    // Crear el crédito
    const credit = await Credit.create({
      customer: customerId,
      business: businessId,
      sale: saleId || null,
      branch: branchId || null,
      createdBy: userId,
      originalAmount: amount,
      remainingAmount: amount,
      dueDate: dueDate ? new Date(dueDate) : null,
      description,
      items: items || [],
    });

    // Si hay venta asociada, marcarla como fiado
    if (saleId) {
      await Sale.findByIdAndUpdate(saleId, {
        isCredit: true,
        creditId: credit._id,
        paymentStatus: "pending",
      });
    }

    // Actualizar estado del cliente
    await Customer.findByIdAndUpdate(customerId, {
      $inc: { totalDebt: amount },
      $addToSet: { segments: "con_deuda" },
    });

    // Crear notificación
    await Notification.createWithLog(
      {
        business: businessId,
        targetRole: "admin",
        type: "credit_overdue",
        title: "Nuevo fiado registrado",
        message: `Se registró un fiado de $${amount.toFixed(2)} para ${
          customer.name
        }`,
        priority: "medium",
        link: `/credits/${credit._id}`,
        relatedEntity: { type: "Credit", id: credit._id },
      },
      requestId
    );

    logApiInfo({
      message: "fiado_created",
      module: "credit",
      requestId,
      businessId,
      userId,
      extra: { creditId: credit._id.toString(), amount, customerId },
    });

    res.status(201).json({
      success: true,
      credit,
      requestId,
    });
  } catch (error) {
    logApiError({
      message: "Error al crear fiado",
      module: "credit",
      requestId,
      businessId,
      userId,
      stack: error.stack,
    });
    res.status(500).json({
      message: error.message,
      requestId,
    });
  }
};

/**
 * @desc    Obtener todos los créditos del negocio
 * @route   GET /api/credits
 * @access  Private/Admin
 */
export const getCredits = async (req, res) => {
  const requestId = req.reqId;
  const businessId = req.businessId;

  try {
    const {
      status,
      customerId,
      branchId,
      overdue,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = { business: businessId };

    if (status) filter.status = status;
    if (customerId) filter.customer = customerId;
    if (branchId) filter.branch = branchId;
    if (overdue === "true") {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $in: ["pending", "partial"] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [credits, total] = await Promise.all([
      Credit.find(filter)
        .populate("customer", "name email phone")
        .populate("branch", "name")
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Credit.countDocuments(filter),
    ]);

    // Marcar automáticamente los vencidos
    const now = new Date();
    for (const credit of credits) {
      if (
        credit.dueDate &&
        now > credit.dueDate &&
        credit.status !== "paid" &&
        credit.status !== "cancelled" &&
        credit.status !== "overdue"
      ) {
        credit.status = "overdue";
        credit.statusHistory.push({
          status: "overdue",
          changedAt: now,
          note: "Marcado como vencido automáticamente",
        });
        await credit.save();

        logApiWarn({
          message: "fiado_overdue",
          module: "credit",
          requestId,
          businessId: businessId?.toString(),
          extra: { creditId: credit._id.toString() },
        });
      }
    }

    res.json({
      success: true,
      credits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      requestId,
    });
  } catch (error) {
    logApiError({
      message: "Error al obtener créditos",
      module: "credit",
      requestId,
      businessId,
      stack: error.stack,
    });
    res.status(500).json({
      message: error.message,
      requestId,
    });
  }
};

/**
 * @desc    Obtener un crédito por ID
 * @route   GET /api/credits/:id
 * @access  Private/Admin
 */
export const getCreditById = async (req, res) => {
  const requestId = req.reqId;
  const businessId = req.businessId;

  try {
    const credit = await Credit.findOne({
      _id: req.params.id,
      business: businessId,
    })
      .populate("customer", "name email phone address")
      .populate("branch", "name")
      .populate("createdBy", "name")
      .populate("sale")
      .populate("items.product", "name");

    if (!credit) {
      return res.status(404).json({
        message: "Crédito no encontrado",
        requestId,
      });
    }

    // Obtener historial de pagos
    const payments = await CreditPayment.find({ credit: credit._id })
      .populate("registeredBy", "name")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      credit,
      payments,
      requestId,
    });
  } catch (error) {
    logApiError({
      message: "Error al obtener crédito",
      module: "credit",
      requestId,
      businessId,
      stack: error.stack,
    });
    res.status(500).json({
      message: error.message,
      requestId,
    });
  }
};

/**
 * @desc    Registrar pago de un crédito
 * @route   POST /api/credits/:id/payments
 * @access  Private/Admin
 */
export const registerPayment = async (req, res) => {
  const requestId = req.reqId;
  const businessId = req.businessId;
  const userId = req.user?.id;

  try {
    const { amount, paymentMethod, notes, branchId, paymentDate } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "El monto debe ser mayor a 0",
        requestId,
      });
    }

    const credit = await Credit.findOne({
      _id: req.params.id,
      business: businessId,
    }).populate("customer", "name");

    if (!credit) {
      return res.status(404).json({
        message: "Crédito no encontrado",
        requestId,
      });
    }

    if (credit.status === "paid" || credit.status === "cancelled") {
      return res.status(400).json({
        message: "Este crédito ya está cerrado",
        requestId,
      });
    }

    if (amount > credit.remainingAmount) {
      return res.status(400).json({
        message: `El monto excede el saldo pendiente ($${credit.remainingAmount.toFixed(
          2
        )})`,
        requestId,
      });
    }

    const balanceBefore = credit.remainingAmount;
    const balanceAfter = balanceBefore - amount;

    // Crear registro de pago
    const payment = await CreditPayment.create({
      credit: credit._id,
      business: businessId,
      amount,
      paymentMethod: paymentMethod || "cash",
      registeredBy: userId,
      branch: branchId || null,
      notes,
      balanceBefore,
      balanceAfter,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
    });

    // Actualizar crédito
    credit.paidAmount += amount;
    credit.remainingAmount = balanceAfter;
    credit.lastPaymentAt = new Date();

    if (balanceAfter === 0) {
      credit.status = "paid";
      credit.paidAt = new Date();
      credit.statusHistory.push({
        status: "paid",
        changedAt: new Date(),
        changedBy: userId,
        note: `Pagado completo. Último pago: $${amount.toFixed(2)}`,
      });

      // Actualizar venta asociada si existe
      if (credit.sale) {
        await Sale.findByIdAndUpdate(credit.sale, {
          paymentStatus: "paid",
        });
      }
    } else {
      credit.status = "partial";
      credit.statusHistory.push({
        status: "partial",
        changedAt: new Date(),
        changedBy: userId,
        note: `Pago parcial: $${amount.toFixed(
          2
        )}. Saldo: $${balanceAfter.toFixed(2)}`,
      });
    }

    await credit.save();

    // Actualizar deuda del cliente
    await Customer.findByIdAndUpdate(credit.customer, {
      $inc: { totalDebt: -amount },
    });

    // Crear notificación
    await Notification.createWithLog(
      {
        business: businessId,
        targetRole: "admin",
        type: "credit_payment",
        title: "Pago de fiado recibido",
        message: `${credit.customer.name} pagó $${amount.toFixed(
          2
        )}. Saldo: $${balanceAfter.toFixed(2)}`,
        priority: balanceAfter === 0 ? "low" : "medium",
        link: `/credits/${credit._id}`,
        relatedEntity: { type: "Credit", id: credit._id },
      },
      requestId
    );

    logApiInfo({
      message: "fiado_payment_registered",
      module: "credit",
      requestId,
      businessId,
      userId,
      extra: {
        creditId: credit._id.toString(),
        amount,
        balanceAfter,
        status: credit.status,
      },
    });

    res.json({
      success: true,
      payment,
      credit,
      requestId,
    });
  } catch (error) {
    logApiError({
      message: "Error al registrar pago",
      module: "credit",
      requestId,
      businessId,
      userId,
      stack: error.stack,
    });
    res.status(500).json({
      message: error.message,
      requestId,
    });
  }
};

/**
 * @desc    Obtener historial de pagos de un crédito
 * @route   GET /api/credits/:id/payments
 * @access  Private/Admin
 */
export const getPaymentHistory = async (req, res) => {
  const requestId = req.reqId;
  const businessId = req.businessId;

  try {
    const credit = await Credit.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!credit) {
      return res.status(404).json({
        message: "Crédito no encontrado",
        requestId,
      });
    }

    const payments = await CreditPayment.find({ credit: credit._id })
      .populate("registeredBy", "name")
      .populate("branch", "name")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments,
      requestId,
    });
  } catch (error) {
    logApiError({
      message: "Error al obtener historial de pagos",
      module: "credit",
      requestId,
      businessId,
      stack: error.stack,
    });
    res.status(500).json({
      message: error.message,
      requestId,
    });
  }
};

/**
 * Función auxiliar para restaurar stock y métricas cuando se cancela/elimina un crédito
 */
const restoreStockAndMetricsFromSale = async (
  sale,
  businessId,
  requestId,
  options = {}
) => {
  if (!sale) return { restored: false };

  const product = await Product.findById(sale.product);
  if (!product) return { restored: false };

  const quantity = sale.quantity;
  const costAtSale = sale.averageCostAtSale || sale.purchasePrice;

  // Restaurar stock según el origen de la venta
  if (sale.branch) {
    // Verificar si es bodega
    const Branch = (await import("../models/Branch.js")).default;
    const branch = await Branch.findById(sale.branch);

    if (branch?.isWarehouse) {
      product.warehouseStock = (product.warehouseStock || 0) + quantity;
    } else {
      await BranchStock.findOneAndUpdate(
        { business: businessId, branch: sale.branch, product: product._id },
        { $inc: { quantity: quantity } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  } else if (sale.distributor) {
    await DistributorStock.findOneAndUpdate(
      { distributor: sale.distributor, product: product._id },
      { $inc: { quantity: quantity } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } else {
    // Venta sin sede ni distribuidor: devolver a warehouseStock
    product.warehouseStock = (product.warehouseStock || 0) + quantity;
  }

  // Actualizar totalStock y totalInventoryValue
  product.totalStock += quantity;
  product.totalInventoryValue =
    (product.totalInventoryValue || 0) + quantity * costAtSale;
  await product.save();

  // Eliminar entradas de ProfitHistory y recalcular balances
  await ProfitHistory.deleteMany({
    sale: sale._id,
    business: businessId,
  });

  // Recalcular balances de usuarios relacionados
  const User = (await import("../models/User.js")).default;
  const adminUser = await User.findOne({
    role: { $in: ["admin", "super_admin"] },
    business: businessId,
  });
  const profitUsers = [
    sale.distributor?.toString(),
    adminUser?._id?.toString(),
  ].filter(Boolean);

  for (const userId of profitUsers) {
    try {
      await recalculateUserBalance(userId, businessId);
    } catch (balanceError) {
      logApiWarn({
        message: "Error recalculando balance",
        module: "credit",
        requestId,
        extra: { userId, error: balanceError.message },
      });
    }
  }

  // Ajustar métricas de cliente
  if (sale.customer) {
    const saleAmount = Number(sale.salePrice || 0) * Number(quantity || 0);
    await Customer.findByIdAndUpdate(sale.customer, {
      $inc: {
        totalSpend: -saleAmount,
        ordersCount: -1,
      },
    });
  }

  // Invalidar caché
  await invalidateCache("cache:analytics:*");
  await invalidateCache("cache:gamification:*");
  await invalidateCache("cache:sales:*");
  await invalidateCache("cache:distributors:*");
  await invalidateCache("cache:businessAssistant:*");

  logApiInfo({
    message: "stock_and_metrics_restored",
    module: "credit",
    requestId,
    extra: {
      productId: product._id,
      quantity,
      saleId: sale._id,
    },
  });

  return { restored: true, quantity, productId: product._id };
};

/**
 * @desc    Cancelar un crédito
 * @route   POST /api/credits/:id/cancel
 * @access  Private/Admin
 */
export const cancelCredit = async (req, res) => {
  const requestId = req.reqId;
  const businessId = req.businessId;
  const userId = req.user?.id;

  try {
    const { reason, restoreStock = true } = req.body;

    const credit = await Credit.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!credit) {
      return res.status(404).json({
        message: "Crédito no encontrado",
        requestId,
      });
    }

    if (credit.status === "paid") {
      return res.status(400).json({
        message: "No se puede cancelar un crédito pagado",
        requestId,
      });
    }

    // Si tiene venta asociada y se solicita restaurar stock
    let stockRestored = false;
    let saleDeleted = false;

    if (restoreStock && credit.sale) {
      const sale = await Sale.findById(credit.sale);
      if (sale) {
        const result = await restoreStockAndMetricsFromSale(
          sale,
          businessId,
          requestId
        );
        stockRestored = result.restored;

        // Eliminar la venta asociada
        await Sale.findByIdAndDelete(sale._id);
        saleDeleted = true;

        logApiInfo({
          message: "sale_deleted_on_cancel",
          module: "credit",
          requestId,
          extra: { saleId: sale._id },
        });
      }
    }

    credit.status = "cancelled";
    credit.statusHistory.push({
      status: "cancelled",
      changedAt: new Date(),
      changedBy: userId,
      note: reason || "Cancelado por administrador",
    });

    await credit.save();

    // Reducir deuda del cliente
    await Customer.findByIdAndUpdate(credit.customer, {
      $inc: { totalDebt: -credit.remainingAmount },
    });

    logApiInfo({
      message: "fiado_cancelled",
      module: "credit",
      requestId,
      businessId,
      userId,
      extra: {
        creditId: credit._id.toString(),
        stockRestored,
        saleDeleted,
      },
    });

    res.json({
      success: true,
      credit,
      stockRestored,
      saleDeleted,
      requestId,
    });
  } catch (error) {
    logApiError({
      message: "Error al cancelar crédito",
      module: "credit",
      requestId,
      businessId,
      userId,
      stack: error.stack,
    });
    res.status(500).json({
      message: error.message,
      requestId,
    });
  }
};

/**
 * @desc    Obtener métricas de créditos/fiados
 * @route   GET /api/credits/metrics
 * @access  Private/Admin
 */
export const getCreditMetrics = async (req, res) => {
  const requestId = req.reqId;
  const businessId = req.businessId;

  try {
    const { branchId, startDate, endDate } = req.query;

    // Para agregaciones, convertir businessId a ObjectId
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const matchFilter = { business: businessObjectId };
    if (branchId) matchFilter.branch = new mongoose.Types.ObjectId(branchId);

    // Métricas agregadas
    const [
      totalStats,
      overdueStats,
      byStatusStats,
      topDebtors,
      recentPayments,
    ] = await Promise.all([
      // Total de créditos
      Credit.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalCredits: { $sum: 1 },
            totalOriginalAmount: { $sum: "$originalAmount" },
            totalRemainingAmount: { $sum: "$remainingAmount" },
            totalPaidAmount: { $sum: "$paidAmount" },
          },
        },
      ]),

      // Créditos vencidos
      Credit.aggregate([
        {
          $match: {
            ...matchFilter,
            status: { $in: ["pending", "partial", "overdue"] },
            dueDate: { $lt: new Date() },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: "$remainingAmount" },
          },
        },
      ]),

      // Por estado
      Credit.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            amount: { $sum: "$remainingAmount" },
          },
        },
      ]),

      // Top deudores
      Credit.aggregate([
        {
          $match: {
            ...matchFilter,
            status: { $in: ["pending", "partial", "overdue"] },
          },
        },
        {
          $group: {
            _id: "$customer",
            totalDebt: { $sum: "$remainingAmount" },
            creditsCount: { $sum: 1 },
          },
        },
        { $sort: { totalDebt: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "customers",
            localField: "_id",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $project: {
            customerId: "$_id",
            customerName: "$customer.name",
            customerPhone: "$customer.phone",
            totalDebt: 1,
            creditsCount: 1,
          },
        },
      ]),

      // Pagos recientes
      CreditPayment.find({ business: businessId })
        .populate("credit", "customer")
        .populate("registeredBy", "name")
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    const metrics = {
      total: totalStats[0] || {
        totalCredits: 0,
        totalOriginalAmount: 0,
        totalRemainingAmount: 0,
        totalPaidAmount: 0,
      },
      overdue: overdueStats[0] || { count: 0, amount: 0 },
      byStatus: byStatusStats.reduce((acc, s) => {
        acc[s._id] = { count: s.count, amount: s.amount };
        return acc;
      }, {}),
      topDebtors,
      recentPayments,
      recoveryRate:
        totalStats[0]?.totalOriginalAmount > 0
          ? (
              (totalStats[0]?.totalPaidAmount /
                totalStats[0]?.totalOriginalAmount) *
              100
            ).toFixed(2)
          : 0,
    };

    res.json({
      success: true,
      metrics,
      requestId,
    });
  } catch (error) {
    logApiError({
      message: "Error al obtener métricas de créditos",
      module: "credit",
      requestId,
      businessId,
      stack: error.stack,
    });
    res.status(500).json({
      message: error.message,
      requestId,
    });
  }
};

/**
 * @desc    Eliminar un crédito
 * @route   DELETE /api/credits/:id
 * @access  Private/Admin
 */
export const deleteCredit = async (req, res) => {
  const requestId = req.reqId;
  const businessId = req.businessId;
  const userId = req.user?.id;
  const { id } = req.params;

  try {
    // Verificar que el crédito existe y pertenece al negocio
    const credit = await Credit.findOne({
      _id: id,
      business: businessId,
    });

    if (!credit) {
      return res.status(404).json({
        message: "Crédito no encontrado",
        requestId,
      });
    }

    // No permitir eliminar créditos con pagos parciales o pagados
    if (credit.status === "paid") {
      return res.status(400).json({
        message: "No se puede eliminar un crédito que ya fue pagado",
        requestId,
      });
    }

    if (credit.paidAmount > 0) {
      return res.status(400).json({
        message:
          "No se puede eliminar un crédito con pagos parciales. Cancélalo en su lugar.",
        requestId,
      });
    }

    // Si el crédito tiene una venta asociada, restaurar stock y métricas
    let stockRestored = false;
    if (credit.sale) {
      const sale = await Sale.findById(credit.sale);
      if (sale) {
        const result = await restoreStockAndMetricsFromSale(
          sale,
          businessId,
          requestId
        );
        stockRestored = result.restored;

        // Eliminar la venta asociada
        await Sale.findByIdAndDelete(sale._id);
        logApiInfo({
          message: "sale_deleted_with_credit",
          module: "credit",
          requestId,
          extra: { saleId: sale._id },
        });
      }
    }

    // Restar la deuda del cliente
    if (credit.customer) {
      await Customer.findByIdAndUpdate(credit.customer, {
        $inc: { totalDebt: -credit.remainingAmount },
      });
    }

    // Eliminar el crédito
    await Credit.findByIdAndDelete(id);

    logApiInfo({
      message: "fiado_deleted",
      module: "credit",
      requestId,
      businessId,
      userId,
      extra: { creditId: id, stockRestored },
    });

    res.status(200).json({
      message: "Crédito eliminado exitosamente. El stock ha sido restaurado.",
      stockRestored,
      requestId,
    });
  } catch (error) {
    logApiError({
      message: "fiado_delete_error",
      module: "credit",
      requestId,
      businessId,
      userId,
      error,
    });

    res.status(500).json({
      message: "Error al eliminar el crédito",
      error: error.message,
      requestId,
    });
  }
};

/**
 * @desc    Obtener créditos de un cliente específico
 * @route   GET /api/credits/customer/:customerId
 * @access  Private/Admin
 */
export const getCustomerCredits = async (req, res) => {
  const requestId = req.reqId;
  const businessId = req.businessId;

  try {
    const { customerId } = req.params;

    const credits = await Credit.find({
      business: businessId,
      customer: customerId,
    })
      .populate("branch", "name")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    const summary = {
      totalCredits: credits.length,
      totalOriginal: credits.reduce((sum, c) => sum + c.originalAmount, 0),
      totalPending: credits
        .filter((c) => ["pending", "partial", "overdue"].includes(c.status))
        .reduce((sum, c) => sum + c.remainingAmount, 0),
      totalPaid: credits.reduce((sum, c) => sum + c.paidAmount, 0),
    };

    res.json({
      success: true,
      credits,
      summary,
      requestId,
    });
  } catch (error) {
    logApiError({
      message: "Error al obtener créditos del cliente",
      module: "credit",
      requestId,
      businessId,
      stack: error.stack,
    });
    res.status(500).json({
      message: error.message,
      requestId,
    });
  }
};
