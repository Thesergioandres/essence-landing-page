import mongoose from "mongoose";
import Credit from "../models/Credit.js";
import CreditPayment from "../models/CreditPayment.js";
import Customer from "../models/Customer.js";
import Notification from "../models/Notification.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import { applySaleGamification } from "../../services/gamification.service.js";

class CreditRepository {
  async create(businessId, data, userId) {
    const {
      customerId,
      amount,
      dueDate,
      description,
      items,
      saleId,
      branchId,
    } = data;

    const customer = await Customer.findOne({
      _id: customerId,
      business: businessId,
    });
    if (!customer) throw new Error("Cliente no encontrado");

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

    if (saleId) {
      await Sale.findByIdAndUpdate(saleId, {
        isCredit: true,
        creditId: credit._id,
        paymentStatus: "pending",
      });
    }

    await Customer.findByIdAndUpdate(customerId, {
      $inc: { totalDebt: amount },
      $addToSet: { segments: "con_deuda" },
    });

    await Notification.createWithLog(
      {
        business: businessId,
        targetRole: "admin",
        type: "credit_overdue",
        title: "Nuevo fiado registrado",
        message: `Se registró un fiado de $${amount.toFixed(2)} para ${customer.name}`,
        priority: "medium",
        link: `/credits/${credit._id}`,
        relatedEntity: { type: "Credit", id: credit._id },
      },
      `REQ-${Date.now()}`,
    );

    return credit;
  }

  async findByBusiness(businessId, filters, page, limit, userId, userRole) {
    const filter = { business: businessId };
    if (userRole === "employee") filter.createdBy = userId;
    if (filters.status) filter.status = filters.status;
    if (filters.customerId) filter.customer = filters.customerId;
    if (filters.branchId) filter.branch = filters.branchId;
    if (filters.overdue === "true") {
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

    return { credits, total, pages: Math.ceil(total / parseInt(limit)) };
  }

  async findById(creditId, businessId) {
    return Credit.findOne({ _id: creditId, business: businessId })
      .populate("customer", "name email phone address")
      .populate("branch", "name")
      .populate("createdBy", "name email")
      .populate({
        path: "sale",
        populate: [
          { path: "distributor", select: "name email phone" },
          {
            path: "product",
            select: "name image purchasePrice suggestedPrice",
          },
        ],
      })
      .populate("items.product", "name image purchasePrice suggestedPrice");
  }

  async findPayments(creditId) {
    return CreditPayment.find({ credit: creditId })
      .populate("registeredBy", "name")
      .sort({ createdAt: -1 });
  }

  async registerPayment(creditId, amount, notes, userId) {
    const credit = await Credit.findById(creditId);
    if (!credit) throw new Error("Crédito no encontrado");

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      throw new Error("El monto del abono es inválido");
    }

    const balanceBefore = credit.remainingAmount || 0;
    const balanceAfter = Math.max(0, balanceBefore - amountNumber);

    const payment = await CreditPayment.create({
      credit: creditId,
      amount: amountNumber,
      notes,
      registeredBy: userId,
      business: credit.business,
      balanceBefore,
      balanceAfter,
      paymentDate: new Date(),
    });

    credit.paidAmount += amountNumber;
    credit.remainingAmount = balanceAfter;
    if (credit.remainingAmount <= 0) {
      credit.status = "paid";
      credit.paidAt = new Date();
    } else {
      credit.status = "partial";
    }

    if (Array.isArray(credit.paymentHistory)) {
      credit.paymentHistory.push({
        amount: amountNumber,
        paidAt: new Date(),
        registeredBy: userId,
        notes,
      });
    }

    await credit.save();

    // 💰 FINANCIAL LOGIC FIX:
    // If credit is fully paid, mark the original sale as CONFIRMED so it counts for profit.
    if (credit.status === "paid" && credit.sale) {
      await Sale.findByIdAndUpdate(credit.sale, {
        paymentStatus: "confirmado",
        paymentConfirmedAt: new Date(),
        paymentConfirmedBy: userId,
      });
      const sale = await Sale.findById(credit.sale).lean();
      if (sale?.distributor) {
        const product = sale.product
          ? await Product.findById(sale.product).lean()
          : null;
        await applySaleGamification({
          businessId: credit.business,
          sale,
          product,
        });
      }
      console.log(
        `✅ Credit Paid! Linked Sale ${credit.sale} marked as confirmed.`,
      );
    }

    await Customer.findByIdAndUpdate(credit.customer, {
      $inc: { totalDebt: -amountNumber },
    });

    return { payment, credit };
  }

  async getMetrics(businessId) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const [pending, paid, overdue, paidByStatus] = await Promise.all([
      Credit.aggregate([
        {
          $match: {
            business: businessObjectId,
            status: { $in: ["pending", "partial"] },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: "$originalAmount" },
            totalPaid: { $sum: "$paidAmount" },
          },
        },
      ]),
      Credit.aggregate([
        { $match: { business: businessObjectId, status: "paid" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: "$originalAmount" },
            totalPaid: { $sum: "$paidAmount" },
          },
        },
      ]),
      Credit.aggregate([
        { $match: { business: businessObjectId, status: "overdue" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: "$originalAmount" },
            totalPaid: { $sum: "$paidAmount" },
          },
        },
      ]),
      CreditPayment.aggregate([
        { $match: { business: businessObjectId } },
        {
          $group: {
            _id: "$credit",
            totalPaid: { $sum: "$amount" },
          },
        },
        {
          $lookup: {
            from: "credits",
            localField: "_id",
            foreignField: "_id",
            as: "credit",
          },
        },
        { $unwind: "$credit" },
        {
          $group: {
            _id: "$credit.status",
            totalPaid: { $sum: "$totalPaid" },
          },
        },
      ]),
    ]);

    const paidByStatusMap = paidByStatus.reduce((acc, row) => {
      acc[row._id] = row.totalPaid || 0;
      return acc;
    }, {});

    const paidPending =
      (paidByStatusMap.pending || 0) + (paidByStatusMap.partial || 0);
    const paidPaid = paidByStatusMap.paid || 0;
    const paidOverdue = paidByStatusMap.overdue || 0;

    return {
      pending: {
        ...(pending[0] || { count: 0, totalAmount: 0, totalPaid: 0 }),
        totalPaid: paidPending,
      },
      paid: {
        ...(paid[0] || { count: 0, totalAmount: 0, totalPaid: 0 }),
        totalPaid: paidPaid,
      },
      overdue: {
        ...(overdue[0] || { count: 0, totalAmount: 0, totalPaid: 0 }),
        totalPaid: paidOverdue,
      },
      totalOutstanding:
        (pending[0]?.totalAmount || 0) -
        paidPending +
        (overdue[0]?.totalAmount || 0) -
        paidOverdue,
    };
  }
}

export default new CreditRepository();
