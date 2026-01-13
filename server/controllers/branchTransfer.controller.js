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

export const createBranchTransfer = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { originBranchId, targetBranchId, items, notes } = req.body;

    if (!originBranchId || !targetBranchId) {
      return res
        .status(400)
        .json({ message: "Origen y destino son obligatorios" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Debes enviar items a transferir" });
    }

    const warehouseBranch = await ensureWarehouseBranch(businessId);
    const originRequestedWarehouse = originBranchId === WAREHOUSE_KEY;
    const targetRequestedWarehouse = targetBranchId === WAREHOUSE_KEY;

    if (originRequestedWarehouse && targetRequestedWarehouse) {
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

    if (originIsWarehouse && targetIsWarehouse) {
      return res
        .status(400)
        .json({ message: "No puedes transferir de bodega a bodega" });
    }

    const productCache = new Map();
    const getProduct = async (productId) => {
      if (productCache.has(productId)) return productCache.get(productId);
      const product = await Product.findOne({
        _id: productId,
        business: businessId,
      });
      productCache.set(productId, product);
      return product;
    };

    // Validar stock disponible en origen
    for (const item of items) {
      const product = await getProduct(item.product);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }

      if (originIsWarehouse) {
        const available = product?.warehouseStock || 0;
        if (available < item.quantity) {
          return res.status(400).json({
            message: `Stock insuficiente en bodega para ${
              product.name || item.product
            }`,
            available,
          });
        }
      } else {
        const stock = await BranchStock.findOne({
          business: businessId,
          branch: origin._id,
          product: item.product,
        });
        const available = stock?.quantity || 0;
        if (available < item.quantity) {
          return res.status(400).json({
            message: `Stock insuficiente en ${origin.name} para producto ${
              product.name || item.product
            }`,
            available,
          });
        }
      }
    }

    const transfer = await BranchTransfer.create({
      business: businessId,
      originBranch: origin._id,
      targetBranch: target._id,
      items,
      notes,
      requestedBy: req.user?.id,
    });

    // 🔒 Usar transacción para garantizar atomicidad
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Aplicar movimientos dentro de la transacción
      for (const item of items) {
        const product = await getProduct(item.product);

        if (originIsWarehouse) {
          // Validar y descontar atómicamente con la sesión
          const updateResult = await Product.findOneAndUpdate(
            {
              _id: item.product,
              business: businessId,
              warehouseStock: { $gte: item.quantity },
            },
            { $inc: { warehouseStock: -item.quantity } },
            { session, new: true }
          );
          if (!updateResult) {
            throw new Error(
              `Stock insuficiente en bodega para ${
                product?.name || item.product
              }`
            );
          }
        } else {
          const updateResult = await BranchStock.findOneAndUpdate(
            {
              business: businessId,
              branch: origin._id,
              product: item.product,
              quantity: { $gte: item.quantity },
            },
            { $inc: { quantity: -item.quantity } },
            { session, new: true }
          );
          if (!updateResult) {
            throw new Error(
              `Stock insuficiente en ${origin.name} para producto ${
                product?.name || item.product
              }`
            );
          }
        }

        if (targetIsWarehouse) {
          await Product.findOneAndUpdate(
            { _id: item.product, business: businessId },
            { $inc: { warehouseStock: item.quantity } },
            { session, new: true, upsert: false }
          );
        } else {
          await BranchStock.findOneAndUpdate(
            { business: businessId, branch: target._id, product: item.product },
            { $inc: { quantity: item.quantity } },
            { session, upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
      }

      transfer.status = "completed";
      transfer.approvedBy = req.user?.id;
      await transfer.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(201).json({ transfer });
    } catch (txError) {
      await session.abortTransaction();
      session.endSession();

      // Eliminar el transfer si falló la transacción
      await BranchTransfer.findByIdAndDelete(transfer._id);

      throw txError;
    }
  } catch (error) {
    console.error("createBranchTransfer error", error);
    const status = error?.statusCode || 500;
    res
      .status(status)
      .json({ message: error?.message || "No se pudo crear la transferencia" });
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
