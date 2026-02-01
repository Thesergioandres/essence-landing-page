import mongoose from "mongoose";
import Credit from "../../../../models/Credit.js";
import CreditPayment from "../../../../models/CreditPayment.js";
import Customer from "../../../../models/Customer.js";
import Notification from "../../../../models/Notification.js";
import Sale from "../../../../models/Sale.js";

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
    if (userRole === "distribuidor") filter.createdBy = userId;
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

    const payment = await CreditPayment.create({
      credit: creditId,
      amount,
      notes,
      registeredBy: userId,
      business: credit.business,
    });

    credit.paidAmount += amount;
    credit.remainingAmount -= amount;
    if (credit.remainingAmount <= 0) {
      credit.status = "paid";
      credit.paidAt = new Date();
    } else {
      credit.status = "partial";
    }

    credit.paymentHistory.push({
      amount,
      paidAt: new Date(),
      registeredBy: userId,
      notes,
    });

    await credit.save();

    await Customer.findByIdAndUpdate(credit.customer, {
      $inc: { totalDebt: -amount },
    });

    return { payment, credit };
  }

  async getMetrics(businessId) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const [pending, paid, overdue] = await Promise.all([
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
    ]);

    return {
      pending: pending[0] || { count: 0, totalAmount: 0, totalPaid: 0 },
      paid: paid[0] || { count: 0, totalAmount: 0, totalPaid: 0 },
      overdue: overdue[0] || { count: 0, totalAmount: 0, totalPaid: 0 },
      totalOutstanding:
        (pending[0]?.totalAmount || 0) -
        (pending[0]?.totalPaid || 0) +
        (overdue[0]?.totalAmount || 0) -
        (overdue[0]?.totalPaid || 0),
    };
  }
}

export default new CreditRepository();
