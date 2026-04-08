import mongoose from "mongoose";
import Branch from "../../../../models/Branch.js";
import BranchStock from "../../../../models/BranchStock.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";

class BranchRepository {
  async findByBusiness(businessId) {
    return Branch.find({ business: businessId }).sort({ createdAt: -1 }).lean();
  }

  async findById(branchId, businessId) {
    return Branch.findOne({ _id: branchId, business: businessId }).lean();
  }

  async findWarehouse(businessId) {
    return Branch.findOne({ business: businessId, isWarehouse: true });
  }

  async create(data) {
    const branch = await Branch.create(data);
    return branch.toObject();
  }

  async update(branchId, businessId, updates) {
    return Branch.findOneAndUpdate(
      { _id: branchId, business: businessId },
      updates,
      { new: true },
    ).lean();
  }

  async delete(branchId, businessId) {
    const performDelete = async (session) => {
      const query = (modelQuery) =>
        session ? modelQuery.session(session) : modelQuery;

      const branch = await query(
        Branch.findOne({ _id: branchId, business: businessId }),
      );

      if (!branch) {
        return null;
      }

      if (branch.isWarehouse) {
        const err = new Error("No puedes eliminar la bodega principal");
        err.statusCode = 400;
        throw err;
      }

      const confirmedSales = await query(
        Sale.countDocuments({
          business: businessId,
          branch: branchId,
          paymentStatus: "confirmado",
        }),
      );

      if (confirmedSales > 0) {
        const err = new Error(
          "No se puede eliminar una sede que tiene historial de ventas. Prueba desactivándola en su lugar",
        );
        err.statusCode = 400;
        err.code = "BRANCH_HAS_CONFIRMED_SALES";
        err.details = { confirmedSales };
        throw err;
      }

      let warehouse = await query(
        Branch.findOne({ business: businessId, isWarehouse: true }),
      );

      if (!warehouse) {
        const created = await Branch.create(
          [
            {
              business: businessId,
              name: "Bodega",
              isWarehouse: true,
              active: true,
            },
          ],
          session ? { session } : undefined,
        );
        warehouse = Array.isArray(created) ? created[0] : created;
      }

      const branchStocks = await query(
        BranchStock.find({
          business: businessId,
          branch: branchId,
          quantity: { $gt: 0 },
        }),
      );

      await query(
        Sale.updateMany(
          {
            business: businessId,
            branch: branchId,
            $or: [{ branchName: { $exists: false } }, { branchName: "" }],
          },
          { $set: { branchName: branch.name } },
        ),
      );

      for (const stock of branchStocks) {
        await query(
          Product.updateOne(
            { _id: stock.product, business: businessId },
            { $inc: { warehouseStock: stock.quantity } },
          ),
        );
      }

      await query(
        BranchStock.deleteMany({ business: businessId, branch: branchId }),
      );

      await query(Branch.deleteOne({ _id: branchId, business: businessId }));

      return branch.toObject();
    };

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const branch = await performDelete(session);
      if (!branch) {
        await session.abortTransaction();
        return null;
      }

      await session.commitTransaction();
      return branch;
    } catch (error) {
      await session.abortTransaction();
      const message = String(error?.message || "");
      const isTxnUnsupported = message.includes(
        "Transaction numbers are only allowed on a replica set member or mongos",
      );
      if (isTxnUnsupported) {
        return performDelete();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  async ensureWarehouse(businessId) {
    let branch = await this.findWarehouse(businessId);
    if (!branch) {
      branch = await Branch.findOne({ business: businessId, name: "Bodega" });
      if (branch && !branch.isWarehouse) {
        branch.isWarehouse = true;
        await branch.save();
      }
    }
    if (!branch) {
      branch = await this.create({
        business: businessId,
        name: "Bodega",
        isWarehouse: true,
        active: true,
      });
    }
    return branch;
  }
}

export default new BranchRepository();
