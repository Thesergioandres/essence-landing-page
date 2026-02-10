/**
 * Delete Sale Controller
 * Handles deleting individual sales or sale groups with stock restoration
 */

import mongoose from "mongoose";
import BranchStock from "../../../../models/BranchStock.js";
import Credit from "../../../../models/Credit.js";
import DefectiveProduct from "../../../../models/DefectiveProduct.js";
import DistributorStock from "../../../../models/DistributorStock.js";
import Product from "../../../../models/Product.js";
import ProfitHistory from "../../../../models/ProfitHistory.js";
import { rollbackSaleGamification } from "../../../../utils/gamificationEngine.js";
import { SaleRepository } from "../../database/repositories/SaleRepository.js";

const saleRepository = new SaleRepository();

/**
 * Restore stock for a deleted sale
 * @param {Object} sale - The sale being deleted
 * @param {mongoose.ClientSession} session
 */
async function restoreStock(sale, session) {
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
    sourceLocation === "distributor" ||
    (!sourceLocation && sale.distributor)
  ) {
    await DistributorStock.findOneAndUpdate(
      {
        distributor: sale.distributor,
        product: productId,
        ...(businessId ? { business: businessId } : {}),
      },
      { $inc: { quantity } },
      { session, upsert: true },
    );
    console.log(
      `📦 Restored ${quantity} to DistributorStock for distributor ${sale.distributor}`,
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

      const sessionOptions = session ? { session } : undefined;

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
