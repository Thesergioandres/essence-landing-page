import mongoose from "mongoose";
import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import BranchTransfer from "../models/BranchTransfer.js";
import Product from "../models/Product.js";

const WAREHOUSE_KEY = "warehouse";
const normalizeBranchName = (name) =>
  String(name || "")
    .trim()
    .toLowerCase();

const isWarehouseBranch = (branch) =>
  Boolean(branch?.isWarehouse) ||
  normalizeBranchName(branch?.name) === "bodega";

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
    const performCreate = async (session) => {
      const query = (modelQuery) =>
        session ? modelQuery.session(session) : modelQuery;

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

      const originBranch = await query(
        Branch.findOne({ _id: originBranchId, business: businessId }),
      );
      const targetBranch = await query(
        Branch.findOne({ _id: targetBranchId, business: businessId }),
      );

      if (!originBranch || !targetBranch) {
        throw new Error("Sede inválida");
      }

      const originIsWarehouse =
        originRequestedWarehouse || isWarehouseBranch(originBranch);
      const targetIsWarehouse =
        targetRequestedWarehouse || isWarehouseBranch(targetBranch);

      const transferItems = [];

      for (const item of data.items) {
        const product = await query(
          Product.findOne({ _id: item.productId, business: businessId }),
        );
        if (!product) {
          throw new Error(`Producto ${item.productId} no encontrado`);
        }

        if (originIsWarehouse) {
          const currentWarehouse = product.warehouseStock || 0;
          if (currentWarehouse < item.quantity) {
            throw new Error(`Stock insuficiente para ${product.name}`);
          }
          product.warehouseStock = currentWarehouse - item.quantity;
        } else {
          const originStock = await query(
            BranchStock.findOne({
              branch: originBranchId,
              product: item.productId,
            }),
          );

          if (!originStock || originStock.quantity < item.quantity) {
            throw new Error(`Stock insuficiente para ${product.name}`);
          }

          originStock.quantity -= item.quantity;
          await originStock.save(session ? { session } : undefined);
        }

        if (targetIsWarehouse) {
          product.warehouseStock =
            (product.warehouseStock || 0) + item.quantity;
        } else {
          let targetStock = await query(
            BranchStock.findOne({
              branch: targetBranchId,
              product: item.productId,
            }),
          );

          if (!targetStock) {
            const created = await BranchStock.create(
              [
                {
                  branch: targetBranchId,
                  product: item.productId,
                  business: businessId,
                  quantity: item.quantity,
                },
              ],
              session ? { session } : undefined,
            );
            targetStock = created[0];
          } else {
            targetStock.quantity += item.quantity;
            await targetStock.save(session ? { session } : undefined);
          }
        }

        if (originIsWarehouse || targetIsWarehouse) {
          await product.save(
            session
              ? { session, validateBeforeSave: false }
              : { validateBeforeSave: false },
          );
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
            requestedBy: userId,
            approvedBy: userId,
            notes: data.notes,
            status: "completed",
          },
        ],
        session ? { session } : undefined,
      );

      return transfer[0];
    };

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const transfer = await performCreate(session);
      await session.commitTransaction();
      return transfer;
    } catch (error) {
      await session.abortTransaction();
      const message = String(error?.message || "");
      const isTxnUnsupported = message.includes(
        "Transaction numbers are only allowed on a replica set member or mongos",
      );
      if (isTxnUnsupported) {
        return performCreate();
      }
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
        .populate("requestedBy", "name email")
        .populate("approvedBy", "name email")
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
      .populate("requestedBy", "name email")
      .populate("approvedBy", "name email")
      .lean();

    return transfer;
  }
}
