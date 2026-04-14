/**
 * Delete Sale Controller
 * Handles deleting individual sales or sale groups with stock restoration
 */

import mongoose from "mongoose";
import BranchStock from "../../database/models/BranchStock.js";
import Credit from "../../database/models/Credit.js";
import DefectiveProduct from "../../database/models/DefectiveProduct.js";
import EmployeeStock from "../../database/models/EmployeeStock.js";
import Product from "../../database/models/Product.js";
import ProfitHistory from "../../database/models/ProfitHistory.js";
import Promotion from "../../database/models/Promotion.js";
import Sale from "../../database/models/Sale.js";
import { rollbackSaleGamification } from "../../services/gamification.service.js";
import {
  buildPromotionSalesSummary,
  normalizeId,
} from "../../../utils/promotionMetrics.js";
import { SalePersistenceUseCase } from "../../../application/use-cases/repository-gateways/SalePersistenceUseCase.js";

const saleRepository = new SalePersistenceUseCase();

/**
 * Restore stock for a deleted sale
 * @param {Object} sale - The sale being deleted
 * @param {mongoose.ClientSession} session
 */
async function restoreStock(sale, session) {
  if (sale?.isComplementarySale) {
    console.log(
      "📦 [DELETE SALE] Complementary sale detected, skipping stock restore",
    );
    return;
  }

  const productId = sale.product?._id || sale.product;
  const quantity = Number(sale.quantity) || 0;

  if (!productId || !mongoose.isValidObjectId(productId)) {
    console.warn(
      "⚠️ [DELETE SALE] Sale without product reference, skipping stock restore",
      {
        saleId: sale?._id,
        saleGroupId: sale?.saleGroupId,
      },
    );
    return;
  }

  if (quantity <= 0) {
    console.warn(
      "⚠️ [DELETE SALE] Sale without valid quantity, skipping stock restore",
      {
        saleId: sale?._id,
        saleGroupId: sale?.saleGroupId,
        quantity: sale?.quantity,
      },
    );
    return;
  }

  const sourceLocation = sale.sourceLocation || null;
  const businessId = sale.business || null;

  // Determine where stock came from and restore it
  if (
    sourceLocation === "employee" ||
    (!sourceLocation && sale.employee)
  ) {
    await EmployeeStock.findOneAndUpdate(
      {
        employee: sale.employee,
        product: productId,
        ...(businessId ? { business: businessId } : {}),
      },
      { $inc: { quantity } },
      { session, upsert: true },
    );
    console.log(
      `📦 Restored ${quantity} to EmployeeStock for employee ${sale.employee}`,
    );
  } else if (sourceLocation === "branch" || (!sourceLocation && sale.branch)) {
    await BranchStock.findOneAndUpdate(
      {
        branch: sale.branch,
        product: productId,
        ...(businessId ? { business: businessId } : {}),
      },
      { $inc: { quantity } },
      { session, upsert: true },
    );
    console.log(
      `📦 Restored ${quantity} to BranchStock for branch ${sale.branch}`,
    );
  } else {
    await Product.findByIdAndUpdate(
      productId,
      {
        $inc: {
          warehouseStock: quantity,
        },
      },
      { session },
    );
    console.log(`📦 Restored ${quantity} to Warehouse`);
  }

  // Always restore global totalStock counter (only once)
  await Product.findByIdAndUpdate(
    productId,
    { $inc: { totalStock: quantity } },
    { session },
  );
}

/**
 * Delete related records for a sale
 * @param {Object} sale - The sale being deleted
 * @param {mongoose.ClientSession} session
 */
async function deleteRelatedRecords(sale, session) {
  // Delete profit history entries
  const profitHistoryQuery = {
    $or: [
      { sale: sale._id },
      { "metadata.saleId": sale._id.toString() },
      ...(sale.saleId ? [{ "metadata.saleId": sale.saleId }] : []),
      { "metadata.saleGroupId": sale.saleGroupId },
    ],
  };

  if (session) {
    await ProfitHistory.deleteMany(profitHistoryQuery).session(session);
  } else {
    await ProfitHistory.deleteMany(profitHistoryQuery);
  }

  // Delete credits if payment was credit
  if (sale.paymentType === "credit" || sale.paymentMethodId === "credit") {
    const creditQuery = {
      $or: [{ sale: sale._id }, { "metadata.saleId": sale._id.toString() }],
    };

    if (session) {
      await Credit.deleteMany(creditQuery).session(session);
    } else {
      await Credit.deleteMany(creditQuery);
    }
  }
}

async function restoreDefectiveStock(reports, session) {
  if (!reports || reports.length === 0) return;

  for (const report of reports) {
    const isCustomerWarranty =
      report.origin === "customer_warranty" && report.replacementProduct;
    const productId = isCustomerWarranty
      ? report.replacementProduct
      : report.product;
    const quantity =
      Number(
        isCustomerWarranty ? report.replacementQuantity : report.quantity,
      ) || 0;
    const stockOrigin = isCustomerWarranty
      ? report.replacementStockOrigin || report.stockOrigin
      : report.stockOrigin;
    const branchId = isCustomerWarranty
      ? report.replacementBranch
      : report.branch;
    const employeeId = isCustomerWarranty
      ? report.replacementEmployee
      : report.employee;

    if (!productId || !mongoose.isValidObjectId(productId) || quantity <= 0) {
      continue;
    }

    if (stockOrigin === "employee" && employeeId) {
      await EmployeeStock.findOneAndUpdate(
        {
          employee: employeeId,
          product: productId,
          ...(report.business ? { business: report.business } : {}),
        },
        { $inc: { quantity } },
        { session, upsert: true },
      );
    } else if (stockOrigin === "branch" && branchId) {
      await BranchStock.findOneAndUpdate(
        {
          branch: branchId,
          product: productId,
          ...(report.business ? { business: report.business } : {}),
        },
        { $inc: { quantity } },
        { session, upsert: true },
      );
    } else {
      await Product.findByIdAndUpdate(
        productId,
        { $inc: { warehouseStock: quantity } },
        { session },
      );
    }

    await Product.findByIdAndUpdate(
      productId,
      { $inc: { totalStock: quantity } },
      { session },
    );
  }
}

async function rollbackPromotionMetrics({ businessId, sale, session }) {
  if (!sale?.isPromotion || !sale?.promotion || !sale?.promotionMetricsApplied)
    return;

  const promotionId = normalizeId(sale.promotion);
  if (!promotionId) return;

  const promotion = await Promotion.findOne({
    _id: promotionId,
    business: businessId,
  })
    .select("_id totalStock currentStock comboItems")
    .lean();

  if (!promotion) return;

  const groupFilter = sale.saleGroupId
    ? {
        business: businessId,
        saleGroupId: sale.saleGroupId,
        promotion: promotionId,
      }
    : { _id: sale._id };

  const remainingSales = sale.saleGroupId
    ? await Sale.find(groupFilter).lean()
    : [];

  const fullSales = [...remainingSales, sale];
  const fullSummary = buildPromotionSalesSummary(promotion, fullSales);
  const remainingSummary = remainingSales.length
    ? buildPromotionSalesSummary(promotion, remainingSales)
    : { usageCount: 0, unitsSold: 0, revenue: 0 };

  const usageDelta = fullSummary.usageCount - remainingSummary.usageCount;
  const unitsDelta = fullSummary.unitsSold - remainingSummary.unitsSold;
  const revenueDelta = fullSummary.revenue - remainingSummary.revenue;

  if (usageDelta <= 0 && unitsDelta <= 0 && revenueDelta <= 0) return;

  const update = {
    $inc: {
      usageCount: -usageDelta,
      totalRevenue: -revenueDelta,
      totalUnitsSold: -unitsDelta,
    },
  };

  const currentStock = promotion.currentStock ?? promotion.totalStock ?? null;
  if (currentStock !== null) {
    update.$set = {
      currentStock: Math.max(0, Number(currentStock) + usageDelta),
    };
  }

  await Promotion.updateOne(
    { _id: promotionId, business: businessId },
    update,
    session ? { session } : undefined,
  );
}

async function rollbackPromotionMetricsForGroup({
  businessId,
  sales,
  session,
}) {
  const promotionGroups = new Map();

  sales.forEach((sale) => {
    if (
      !sale?.isPromotion ||
      !sale?.promotion ||
      !sale?.promotionMetricsApplied
    )
      return;
    const promotionId = normalizeId(sale.promotion);
    if (!promotionId) return;
    if (!promotionGroups.has(promotionId)) {
      promotionGroups.set(promotionId, []);
    }
    promotionGroups.get(promotionId).push(sale);
  });

  for (const [promotionId, promotionSales] of promotionGroups.entries()) {
    const promotion = await Promotion.findOne({
      _id: promotionId,
      business: businessId,
    })
      .select("_id totalStock currentStock comboItems")
      .lean();

    if (!promotion) continue;

    const summary = buildPromotionSalesSummary(promotion, promotionSales);
    if (summary.usageCount <= 0) continue;

    const update = {
      $inc: {
        usageCount: -summary.usageCount,
        totalRevenue: -summary.revenue,
        totalUnitsSold: -summary.unitsSold,
      },
    };

    const currentStock = promotion.currentStock ?? promotion.totalStock ?? null;
    if (currentStock !== null) {
      update.$set = {
        currentStock: Math.max(0, Number(currentStock) + summary.usageCount),
      };
    }

    await Promotion.updateOne(
      { _id: promotionId, business: businessId },
      update,
      session ? { session } : undefined,
    );
  }
}

/**
 * DELETE /api/v2/sales/:saleId
 * Delete a single sale
 */
export async function deleteSale(req, res) {
  console.log("🗑️  [DELETE SALE] Función llamada");
  const runDelete = async (useTransaction) => {
    const session = useTransaction ? await mongoose.startSession() : null;

    try {
      if (useTransaction) {
        session.startTransaction();
      }

      const { saleId } = req.params;
      const businessId =
        req.businessId || req.headers["x-business-id"] || req.business?._id;

      if (!businessId) {
        if (useTransaction) {
          await session.abortTransaction();
        }
        return res.status(400).json({
          success: false,
          message: "Falta x-business-id",
        });
      }

      console.log("🗑️  [DELETE SALE] Params:", {
        saleId,
        businessId,
        hasBusiness: !!req.business,
      });

      // Delete the sale and get info
      const { sale, restoredStock } = await saleRepository.deleteById(
        saleId,
        businessId,
        session || undefined,
      );

      // Restore stock
      await restoreStock(sale, session || undefined);

      // Delete related records
      await deleteRelatedRecords(sale, session || undefined);

      if (sale.saleGroupId) {
        const remainingSales = await Sale.find({
          business: businessId,
          saleGroupId: sale.saleGroupId,
          _id: { $ne: sale._id },
        })
          .select("_id")
          .lean();

        if (!remainingSales || remainingSales.length === 0) {
          const defectiveReports = await DefectiveProduct.find({
            business: businessId,
            saleGroupId: sale.saleGroupId,
          }).lean();

          await restoreDefectiveStock(defectiveReports, session || undefined);

          const sessionOptions = session ? { session } : undefined;
          await DefectiveProduct.deleteMany(
            {
              business: businessId,
              saleGroupId: sale.saleGroupId,
            },
            sessionOptions,
          );
        }
      }

      await rollbackPromotionMetrics({
        businessId,
        sale,
        session: session || undefined,
      });

      // Roll back gamification points if they were applied
      await rollbackSaleGamification({ sale });

      if (useTransaction) {
        await session.commitTransaction();
      }

      return res.json({
        success: true,
        message: "Venta eliminada correctamente",
        data: {
          saleId: sale._id,
          productId: sale.product,
          restoredStock,
        },
      });
    } catch (error) {
      if (useTransaction) {
        await session.abortTransaction();
      }
      console.error("❌ [DELETE SALE] Error:", error);
      console.error("❌ Stack:", error.stack);

      if (error.message === "Venta no encontrada") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (useTransaction && error?.code === 20) {
        console.warn(
          "⚠️ [DELETE SALE] Transactions not supported, retrying without transaction",
        );
        return runDelete(false);
      }

      return res.status(500).json({
        success: false,
        message: "Error al eliminar la venta",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    } finally {
      if (session) {
        session.endSession();
      }
    }
  };

  return runDelete(true);
}

/**
 * DELETE /api/v2/sales/group/:saleGroupId
 * Delete all sales in a group (cart transaction)
 */
export async function deleteSaleGroup(req, res) {
  console.log("🗑️  [DELETE GROUP] Función llamada");
  const runDelete = async (useTransaction) => {
    const session = useTransaction ? await mongoose.startSession() : null;

    try {
      if (useTransaction) {
        session.startTransaction();
      }

      const { saleGroupId } = req.params;
      const businessId =
        req.businessId || req.headers["x-business-id"] || req.business?._id;

      if (!businessId) {
        if (useTransaction) {
          await session.abortTransaction();
        }
        return res.status(400).json({
          success: false,
          message: "Falta x-business-id",
        });
      }

      console.log("🗑️  [DELETE GROUP] Params:", {
        saleGroupId,
        businessId,
        hasBusiness: !!req.business,
      });

      // Get and delete all sales in the group
      const { deletedCount, totalRestoredStock, sales } =
        await saleRepository.deleteByGroupId(
          saleGroupId,
          businessId,
          session || undefined,
        );

      // Restore stock and delete related records for each sale
      for (const sale of sales) {
        await restoreStock(sale, session || undefined);
        await deleteRelatedRecords(sale, session || undefined);
        await rollbackSaleGamification({ sale });
      }

      await rollbackPromotionMetricsForGroup({
        businessId,
        sales,
        session: session || undefined,
      });

      const sessionOptions = session ? { session } : undefined;

      const defectiveReports = await DefectiveProduct.find({
        business: businessId,
        saleGroupId,
      }).lean();

      await restoreDefectiveStock(defectiveReports, session || undefined);

      // Delete defective products linked to this group
      await DefectiveProduct.deleteMany(
        {
          business: businessId,
          $or: [{ saleGroupId }, { "metadata.saleGroupId": saleGroupId }],
        },
        sessionOptions,
      );

      // Delete profit history for the group
      await ProfitHistory.deleteMany(
        {
          business: businessId,
          "metadata.saleGroupId": saleGroupId,
        },
        sessionOptions,
      );

      // Delete credits for the group
      await Credit.deleteMany(
        {
          business: businessId,
          saleGroupId,
        },
        sessionOptions,
      );

      if (useTransaction) {
        await session.commitTransaction();
      }

      return res.json({
        success: true,
        message: `${deletedCount} ventas eliminadas correctamente`,
        data: {
          saleGroupId,
          deletedSales: deletedCount,
          deletedCredits: 0, // Could count if needed
          deletedWarranties: 0, // Could count if needed
          stockRestored: totalRestoredStock,
        },
      });
    } catch (error) {
      if (useTransaction) {
        await session.abortTransaction();
      }
      console.error("❌ [DELETE GROUP] Error:", error);
      console.error("❌ Stack:", error.stack);

      if (error.message === "Grupo de ventas no encontrado") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (useTransaction && error?.code === 20) {
        console.warn(
          "⚠️ [DELETE GROUP] Transactions not supported, retrying without transaction",
        );
        return runDelete(false);
      }

      return res.status(500).json({
        success: false,
        message: "Error al eliminar el grupo de ventas",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    } finally {
      if (session) {
        session.endSession();
      }
    }
  };

  return runDelete(true);
}
