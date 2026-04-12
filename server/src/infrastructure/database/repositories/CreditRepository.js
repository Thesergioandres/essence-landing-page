import mongoose from "mongoose";
import { ConfirmSalePaymentUseCase } from "../../../application/use-cases/sales/ConfirmSalePaymentUseCase.js";
import { applySaleGamification } from "../../services/gamification.service.js";
import Credit from "../models/Credit.js";
import CreditPayment from "../models/CreditPayment.js";
import Customer from "../models/Customer.js";
import Notification from "../models/Notification.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";

const confirmSalePaymentUseCase = new ConfirmSalePaymentUseCase();

class CreditRepository {
  async create(businessId, data, userId, existingSession = null) {
    const {
      customerId,
      amount,
      dueDate,
      description,
      items,
      saleId,
      branchId,
    } = data;

    const ownsSession = !existingSession;
    const session = existingSession || (await mongoose.startSession());
    let createdCredit = null;
    let customerNameForNotification = "Cliente";

    const createCreditCore = async () => {
      const customerQuery = Customer.findOne({
        _id: customerId,
        business: businessId,
      });
      const customer = await customerQuery.session(session);

      if (!customer) throw new Error("Cliente no encontrado");
      customerNameForNotification =
        customer.name || customerNameForNotification;

      const [credit] = await Credit.create(
        [
          {
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
          },
        ],
        { session },
      );

      if (saleId) {
        await Sale.findOneAndUpdate(
          { _id: saleId, business: businessId },
          {
            isCredit: true,
            creditId: credit._id,
            paymentStatus: "pending",
          },
          { session },
        );
      }

      await Customer.findOneAndUpdate(
        { _id: customerId, business: businessId },
        {
          $inc: { totalDebt: amount },
          $addToSet: { segments: "con_deuda" },
        },
        { session },
      );

      if (session) {
        await Notification.create(
          [
            {
              business: businessId,
              targetRole: "admin",
              type: "credit_overdue",
              title: "Nuevo fiado registrado",
              message: `Se registró un fiado de $${Number(amount || 0).toFixed(2)} para ${customerNameForNotification}`,
              priority: "medium",
              link: `/credits/${credit._id}`,
              relatedEntity: { type: "Credit", id: credit._id },
            },
          ],
          { session },
        );
      }

      createdCredit = credit;
    };

    try {
      if (ownsSession) {
        await session.withTransaction(createCreditCore);
      } else {
        await createCreditCore();
      }
    } finally {
      if (ownsSession) {
        await session.endSession();
      }
    }

    return createdCredit;
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
          { path: "employee", select: "name email phone" },
          {
            path: "product",
            select: "name image purchasePrice suggestedPrice",
          },
        ],
      })
      .populate("items.product", "name image purchasePrice suggestedPrice");
  }

  async findPayments(creditId, businessId) {
    const filter = { credit: creditId };
    if (businessId) {
      filter.business = businessId;
    }

    return CreditPayment.find(filter)
      .populate("registeredBy", "name")
      .sort({ createdAt: -1 });
  }

  async registerPayment(paymentInput, existingSession = null) {
    const { creditId, businessId, amount, notes, userId } = paymentInput || {};

    if (!creditId) {
      throw new Error("Crédito no encontrado");
    }

    if (!businessId) {
      throw new Error("Business ID requerido");
    }

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      throw new Error("El monto del abono es inválido");
    }

    const ownsSession = !existingSession;
    const session = existingSession || (await mongoose.startSession());
    let payment = null;
    let updatedCredit = null;
    let pendingGamification = false;
    let saleForGamification = null;

    const registerPaymentCore = async () => {
      const credit = await Credit.findOne({
        _id: creditId,
        business: businessId,
      }).session(session);

      if (!credit) {
        throw new Error("Crédito no encontrado");
      }

      const balanceBefore = Number(credit.remainingAmount || 0);
      const balanceAfter = Math.max(0, balanceBefore - amountNumber);
      const paymentDate = new Date();

      const [createdPayment] = await CreditPayment.create(
        [
          {
            credit: creditId,
            amount: amountNumber,
            notes,
            registeredBy: userId,
            business: credit.business,
            balanceBefore,
            balanceAfter,
            paymentDate,
          },
        ],
        { session },
      );

      credit.paidAmount = Number(credit.paidAmount || 0) + amountNumber;
      credit.remainingAmount = balanceAfter;
      if (balanceAfter <= 0) {
        credit.status = "paid";
        credit.paidAt = paymentDate;
      } else {
        credit.status = "partial";
      }

      if (Array.isArray(credit.paymentHistory)) {
        credit.paymentHistory.push({
          amount: amountNumber,
          paidAt: paymentDate,
          registeredBy: userId,
          notes,
        });
      }

      await credit.save({ session });

      await Customer.findOneAndUpdate(
        { _id: credit.customer, business: businessId },
        { $inc: { totalDebt: -amountNumber } },
        { session },
      );

      if (credit.status === "paid" && credit.sale) {
        const confirmationResult = await confirmSalePaymentUseCase.execute(
          {
            saleId: credit.sale,
            businessId,
            userId,
          },
          {
            session,
            deferGamification: true,
          },
        );

        pendingGamification = confirmationResult.gamificationPending;
        saleForGamification = confirmationResult.sale || null;
      }

      payment = createdPayment;
      updatedCredit = credit;
    };

    try {
      if (ownsSession) {
        await session.withTransaction(registerPaymentCore);
      } else {
        await registerPaymentCore();
      }
    } finally {
      if (ownsSession) {
        await session.endSession();
      }
    }

    if (
      ownsSession &&
      pendingGamification &&
      saleForGamification?.employee
    ) {
      const product = saleForGamification.product
        ? await Product.findById(saleForGamification.product).lean()
        : null;

      await applySaleGamification({
        businessId,
        sale: saleForGamification,
        product,
      });
    }

    return { payment, credit: updatedCredit };
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
