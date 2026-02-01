import mongoose from "mongoose";
import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import BranchTransfer from "../models/BranchTransfer.js";
import Product from "../models/Product.js";

const resolveBusinessId = (req) =>
  req?.businessId || req?.headers?.["x-business-id"] || req?.query?.businessId;

const WAREHOUSE_KEY = "warehouse";

const ensureWarehouseBranch = async (businessId) => {
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
};

const validateBranch = async (businessId, branchId) => {
  const branch = await Branch.findOne({ _id: branchId, business: businessId });
  if (!branch) {
    const err = new Error("Sede inválida para este negocio");
    err.statusCode = 404;
    throw err;
  }
  return branch;
};

const internalCreateBranchTransfer = async (
  req,
  res,
  useTransaction = true,
) => {
  const session = useTransaction ? await mongoose.startSession() : null;
  let transactionStarted = false;

  try {
    const businessId = resolveBusinessId(req);
    const { originBranchId, targetBranchId, items, notes } = req.body;

    if (useTransaction) {
      try {
        session.startTransaction();
        transactionStarted = true;
      } catch (e) {
        transactionStarted = false;
      }
    }

    const opt = transactionStarted ? { session } : {};

    const warehouseBranch = await ensureWarehouseBranch(businessId);
    const originRequestedWarehouse = originBranchId === WAREHOUSE_KEY;
    const targetRequestedWarehouse = targetBranchId === WAREHOUSE_KEY;

    if (originRequestedWarehouse && targetRequestedWarehouse) {
      if (transactionStarted) await session.abortTransaction();
      if (session) session.endSession();
      return res
        .status(400)
        .json({ message: "No puedes transferir de bodega a bodega" });
    }

    const origin = originRequestedWarehouse
      ? warehouseBranch
      : await validateBranch(businessId, originBranchId);

    const target = targetRequestedWarehouse
      ? warehouseBranch
      : await validateBranch(businessId, targetBranchId);

    const originIsWarehouse = originRequestedWarehouse || origin?.isWarehouse;
    const targetIsWarehouse = targetRequestedWarehouse || target?.isWarehouse;

    const [transfer] = await BranchTransfer.create(
      [
        {
          business: businessId,
          originBranch: origin._id,
          targetBranch: target._id,
          items,
          notes,
          requestedBy: req.user?.id,
          status: "completed",
        },
      ],
      opt,
    );

    const productCache = new Map();
    for (const item of items) {
      let product = productCache.get(item.product);
      if (!product) {
        const query = Product.findOne({
          _id: item.product,
          business: businessId,
        });
        if (transactionStarted) query.session(session);
        product = await query;
        productCache.set(item.product, product);
      }

      if (!product) throw new Error(`Producto no encontrado: ${item.product}`);

      if (originIsWarehouse) {
        const updateResult = await Product.findOneAndUpdate(
          {
            _id: item.product,
            business: businessId,
            warehouseStock: { $gte: item.quantity },
          },
          { $inc: { warehouseStock: -item.quantity } },
          { ...opt, new: true },
        );
        if (!updateResult)
          throw new Error(`Stock insuficiente en bodega para ${product.name}`);
      } else {
        const updateResult = await BranchStock.findOneAndUpdate(
          {
            business: businessId,
            branch: origin._id,
            product: item.product,
            quantity: { $gte: item.quantity },
          },
          { $inc: { quantity: -item.quantity } },
          { ...opt, new: true },
        );
        if (!updateResult)
          throw new Error(
            `Stock insuficiente en ${origin.name} para ${product.name}`,
          );
      }

      if (targetIsWarehouse) {
        await Product.findOneAndUpdate(
          { _id: item.product, business: businessId },
          { $inc: { warehouseStock: item.quantity } },
          { ...opt, new: true, upsert: false },
        );
      } else {
        await BranchStock.findOneAndUpdate(
          { business: businessId, branch: target._id, product: item.product },
          { $inc: { quantity: item.quantity } },
          { ...opt, upsert: true, new: true, setDefaultsOnInsert: true },
        );
      }
    }

    if (transactionStarted) await session.commitTransaction();
    if (session) session.endSession();

    return res
      .status(201)
      .json({ message: "Transferencia completada correctamente", transfer });
  } catch (error) {
    if (transactionStarted && session.inTransaction()) {
      await session.abortTransaction();
    }
    if (session) session.endSession();

    if (
      useTransaction &&
      error.message.includes("replica set member or mongos")
    ) {
      console.warn(
        "[DB] Transactions not supported. Fallback to non-transactional.",
      );
      return internalCreateBranchTransfer(req, res, false);
    }
    throw error;
  }
};

export const createBranchTransfer = async (req, res) => {
  try {
    console.log(
      "[DEBUG] createBranchTransfer body:",
      JSON.stringify(req.body, null, 2),
    );
    await internalCreateBranchTransfer(req, res, true);
  } catch (error) {
    console.error("createBranchTransfer error:", error);
    const status =
      error.name === "CastError"
        ? 400
        : error.statusCode || error.status || 500;
    res.status(status).json({
      message: error?.message || "No se pudo realizar la transferencia",
      debugError: error?.message,
      debugStack:
        process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

export const listBranchTransfers = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const transfers = await BranchTransfer.find({ business: businessId })
      .sort({ createdAt: -1 })
      .populate("originBranch", "name")
      .populate("targetBranch", "name")
      .populate("requestedBy", "name email")
      .populate("approvedBy", "name email");

    res.json({ data: transfers });
  } catch (error) {
    console.error("listBranchTransfers error", error);
    res
      .status(500)
      .json({ message: "No se pudieron obtener las transferencias" });
  }
};
