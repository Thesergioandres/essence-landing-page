import mongoose from "mongoose";
import Membership from "../../../infrastructure/database/models/Membership.js";
import Product from "../../../infrastructure/database/models/Product.js";
import ProfitHistory from "../../../infrastructure/database/models/ProfitHistory.js";
import Promotion from "../../../infrastructure/database/models/Promotion.js";
import Sale from "../../../infrastructure/database/models/Sale.js";
import { applySaleGamification } from "../../../infrastructure/services/gamification.service.js";
import {
  buildPromotionSalesSummary,
  normalizeId,
} from "../../../utils/promotionMetrics.js";

const buildConfirmationToken = (saleId, target) =>
  `sale-confirmation:${saleId}:${target}`;

export class ConfirmSalePaymentUseCase {
  async execute(input, options = {}) {
    const { saleId, businessId, userId } = input || {};
    const { session: externalSession = null, deferGamification = false } =
      options || {};

    if (!saleId) {
      const error = new Error("saleId es obligatorio");
      error.statusCode = 400;
      throw error;
    }

    if (!businessId) {
      const error = new Error("businessId es obligatorio");
      error.statusCode = 400;
      throw error;
    }

    const ownsSession = !externalSession;
    const session = externalSession || (await mongoose.startSession());

    let responseSale = null;
    let alreadyConfirmed = false;
    let shouldApplyGamification = false;

    const runConfirmation = async () => {
      const existingSaleQuery = Sale.findOne({
        _id: saleId,
        business: businessId,
      });
      const existingSale = await existingSaleQuery.session(session);

      if (!existingSale) {
        const error = new Error("Venta no encontrada");
        error.statusCode = 404;
        throw error;
      }

      if (existingSale.paymentStatus === "confirmado") {
        responseSale = existingSale.toObject();
        alreadyConfirmed = true;
        return;
      }

      const confirmedAt = new Date();
      const updatedSale = await Sale.findOneAndUpdate(
        {
          _id: existingSale._id,
          business: businessId,
          paymentStatus: { $ne: "confirmado" },
        },
        {
          $set: {
            paymentStatus: "confirmado",
            paymentConfirmedAt: confirmedAt,
            paymentConfirmedBy: userId || null,
          },
        },
        { new: true, session },
      );

      const confirmedSale =
        updatedSale ||
        (await Sale.findOne({ _id: existingSale._id, business: businessId })
          .session(session)
          .lean());

      if (!confirmedSale) {
        const error = new Error("Venta no encontrada");
        error.statusCode = 404;
        throw error;
      }

      const saleDate = confirmedSale.saleDate || confirmedAt;
      await this.upsertProfitHistoryEntries(
        confirmedSale,
        businessId,
        saleDate,
        session,
      );
      await this.applyPromotionMetrics(confirmedSale, businessId, session);

      responseSale =
        typeof confirmedSale.toObject === "function"
          ? confirmedSale.toObject()
          : confirmedSale;

      shouldApplyGamification = Boolean(
        responseSale?.employee && alreadyConfirmed === false,
      );
    };

    try {
      if (ownsSession) {
        await session.withTransaction(runConfirmation);
      } else {
        await runConfirmation();
      }
    } finally {
      if (ownsSession) {
        await session.endSession();
      }
    }

    if (shouldApplyGamification && !deferGamification) {
      const product = responseSale?.product
        ? await Product.findById(responseSale.product).lean()
        : null;

      await applySaleGamification({
        businessId,
        sale: responseSale,
        product,
      });
    }

    return {
      sale: responseSale,
      alreadyConfirmed,
      gamificationPending: shouldApplyGamification && deferGamification,
    };
  }

  async upsertProfitHistoryEntries(sale, businessId, saleDate, session) {
    if (sale?.employee && Number(sale.employeeProfit || 0) > 0) {
      const employeeToken = buildConfirmationToken(sale._id, "employee");

      await ProfitHistory.updateOne(
        {
          business: businessId,
          sale: sale._id,
          user: sale.employee,
          "metadata.confirmationToken": employeeToken,
        },
        {
          $setOnInsert: {
            business: businessId,
            user: sale.employee,
            type: "venta_normal",
            amount: Number(sale.employeeProfit || 0),
            sale: sale._id,
            product: sale.product,
            description: `Comisión por venta ${sale.saleId || sale._id}`,
            date: saleDate,
            metadata: {
              quantity: Number(sale.quantity || 0),
              salePrice: Number(sale.salePrice || 0),
              saleId: sale.saleId,
              commission: sale.employeeProfitPercentage,
              confirmationToken: employeeToken,
            },
          },
        },
        { upsert: true, session },
      );
    }

    if (Number(sale?.adminProfit || 0) <= 0) {
      return;
    }

    const adminMembership = await Membership.findOne({
      business: businessId,
      role: "admin",
      status: "active",
    })
      .select("user")
      .session(session)
      .lean();

    if (!adminMembership?.user) {
      return;
    }

    const adminToken = buildConfirmationToken(sale._id, "admin");

    await ProfitHistory.updateOne(
      {
        business: businessId,
        sale: sale._id,
        user: adminMembership.user,
        "metadata.confirmationToken": adminToken,
      },
      {
        $setOnInsert: {
          business: businessId,
          user: adminMembership.user,
          type: "venta_normal",
          amount: Number(sale.adminProfit || 0),
          sale: sale._id,
          product: sale.product,
          description: sale.employee
            ? `Ganancia de venta ${sale.saleId || sale._id} (empleado)`
            : `Venta directa ${sale.saleId || sale._id}`,
          date: saleDate,
          metadata: {
            quantity: Number(sale.quantity || 0),
            salePrice: Number(sale.salePrice || 0),
            saleId: sale.saleId,
            confirmationToken: adminToken,
          },
        },
      },
      { upsert: true, session },
    );
  }

  async applyPromotionMetrics(sale, businessId, session) {
    if (
      !sale?.isPromotion ||
      !sale?.promotion ||
      sale?.promotionMetricsApplied
    ) {
      return;
    }

    const promotionId = normalizeId(sale.promotion);
    if (!promotionId) {
      return;
    }

    const groupFilter = sale.saleGroupId
      ? {
          business: businessId,
          saleGroupId: sale.saleGroupId,
          promotion: promotionId,
          promotionMetricsApplied: { $ne: true },
        }
      : {
          _id: sale._id,
          business: businessId,
          promotionMetricsApplied: { $ne: true },
        };

    const [promotion, promotionSales] = await Promise.all([
      Promotion.findOne({ _id: promotionId, business: businessId })
        .select("_id totalStock currentStock comboItems")
        .session(session)
        .lean(),
      Sale.find(groupFilter).session(session).lean(),
    ]);

    if (
      !promotion ||
      !Array.isArray(promotionSales) ||
      promotionSales.length === 0
    ) {
      return;
    }

    const summary = buildPromotionSalesSummary(promotion, promotionSales);
    if (!summary?.usageCount || summary.usageCount <= 0) {
      return;
    }

    const update = {
      $inc: {
        usageCount: summary.usageCount,
        totalRevenue: summary.revenue,
        totalUnitsSold: summary.unitsSold,
      },
    };

    const currentStock = promotion.currentStock ?? promotion.totalStock ?? null;
    if (currentStock !== null) {
      update.$set = {
        currentStock: Math.max(0, Number(currentStock) - summary.usageCount),
      };
    }

    await Promotion.updateOne(
      { _id: promotionId, business: businessId },
      update,
      { session },
    );

    await Sale.updateMany(
      { _id: { $in: promotionSales.map((entry) => entry._id) } },
      { $set: { promotionMetricsApplied: true } },
      { session },
    );
  }
}
