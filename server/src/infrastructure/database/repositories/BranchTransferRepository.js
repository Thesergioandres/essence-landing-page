import mongoose from "mongoose";
import Branch from "../../../../models/Branch.js";
import BranchStock from "../../../../models/BranchStock.js";
import BranchTransfer from "../../../../models/BranchTransfer.js";
import Product from "../../../../models/Product.js";

const WAREHOUSE_KEY = "warehouse";

export class BranchTransferRepository {
  async ensureWarehouse(businessId) {
    let branch = await Branch.findOne({
      business: businessId,
      isWarehouse: true,
    });

    if (!branch) {
      branch = await Branch.findOne({ business: businessId, name: "Bodega" });
      if (branch && !branch.isWarehouse) {
        branch.isWarehouse = true;
        await branch.save();
      }
    }

    if (!branch) {
      branch = await Branch.create({
        business: businessId,
        name: "Bodega",
        isWarehouse: true,
        active: true,
      });
    }

    return branch;
  }

  async create(data, businessId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const warehouseBranch = await this.ensureWarehouse(businessId);
      const originRequestedWarehouse = data.originBranchId === WAREHOUSE_KEY;
      const targetRequestedWarehouse = data.targetBranchId === WAREHOUSE_KEY;

      if (originRequestedWarehouse && targetRequestedWarehouse) {
        throw new Error("No puedes transferir de bodega a bodega");
      }

      const originBranchId = originRequestedWarehouse
        ? warehouseBranch._id
        : data.originBranchId;
      const targetBranchId = targetRequestedWarehouse
        ? warehouseBranch._id
        : data.targetBranchId;

      const originBranch = await Branch.findOne({
        _id: originBranchId,
        business: businessId,
      });
      const targetBranch = await Branch.findOne({
        _id: targetBranchId,
        business: businessId,
      });

      if (!originBranch || !targetBranch) {
        throw new Error("Sede inválida");
      }

      const transferItems = [];

      for (const item of data.items) {
        const product = await Product.findOne({
          _id: item.productId,
          business: businessId,
        });
        if (!product) {
          throw new Error(`Producto ${item.productId} no encontrado`);
        }

        const originStock = await BranchStock.findOne({
          branch: originBranchId,
          product: item.productId,
        });

        if (!originStock || originStock.quantity < item.quantity) {
          throw new Error(`Stock insuficiente para ${product.name}`);
        }

        originStock.quantity -= item.quantity;
        await originStock.save({ session });

        let targetStock = await BranchStock.findOne({
          branch: targetBranchId,
          product: item.productId,
        });

        if (!targetStock) {
          targetStock = await BranchStock.create(
            [
              {
                branch: targetBranchId,
                product: item.productId,
                business: businessId,
                quantity: item.quantity,
              },
            ],
            { session },
          );
          targetStock = targetStock[0];
        } else {
          targetStock.quantity += item.quantity;
          await targetStock.save({ session });
        }

        transferItems.push({
          product: item.productId,
          productName: product.name,
          quantity: item.quantity,
        });
      }

      const transfer = await BranchTransfer.create(
        [
          {
            business: businessId,
            originBranch: originBranchId,
            targetBranch: targetBranchId,
            items: transferItems,
            transferredBy: userId,
            notes: data.notes,
            status: "completed",
          },
        ],
        { session },
      );

      await session.commitTransaction();
      return transfer[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async findByBusiness(businessId, filters = {}) {
    const query = { business: businessId };

    if (filters.originBranch) {
      query.originBranch = filters.originBranch;
    }

    if (filters.targetBranch) {
      query.targetBranch = filters.targetBranch;
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [transfers, total] = await Promise.all([
      BranchTransfer.find(query)
        .populate("originBranch", "name")
        .populate("targetBranch", "name")
        .populate("transferredBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BranchTransfer.countDocuments(query),
    ]);

    return {
      transfers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id, businessId) {
    const transfer = await BranchTransfer.findOne({
      _id: id,
      business: businessId,
    })
      .populate("originBranch", "name")
      .populate("targetBranch", "name")
      .populate("transferredBy", "name email")
      .lean();

    return transfer;
  }
}
