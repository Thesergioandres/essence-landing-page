import mongoose from "mongoose";
import Branch from "../../../../models/Branch.js";
import BranchStock from "../../../../models/BranchStock.js";
import DistributorStock from "../../../../models/DistributorStock.js";
import Product from "../models/Product.js";
import StockTransfer from "../../../../models/StockTransfer.js";
import User from "../models/User.js";

const normalizeBranchName = (name) =>
  String(name || "")
    .trim()
    .toLowerCase();
const isBodegaBranch = (branch) =>
  Boolean(branch?.isWarehouse) ||
  normalizeBranchName(branch?.name) === "bodega";

const getBodegaBranchIds = async (businessId) => {
  const branches = await Branch.find({
    business: businessId,
    $or: [{ name: /^bodega$/i }, { isWarehouse: true }],
  })
    .select("_id")
    .lean();
  return branches.map((branch) => branch._id.toString());
};

class StockRepository {
  async assignToDistributor(businessId, distributorId, productId, quantity) {
    const product = await Product.findOne({
      _id: productId,
      business: businessId,
    });
    if (!product || product.warehouseStock < quantity) {
      throw new Error("Stock insuficiente");
    }

    let distStock;
    try {
      distStock = await DistributorStock.findOneAndUpdate(
        {
          distributor: distributorId,
          product: productId,
          business: businessId,
        },
        {
          $inc: { quantity },
          $setOnInsert: {
            distributor: distributorId,
            product: productId,
            business: businessId,
          },
        },
        { new: true, upsert: true },
      );
    } catch (error) {
      if (error?.code === 11000) {
        distStock = await DistributorStock.findOneAndUpdate(
          { distributor: distributorId, product: productId },
          { $inc: { quantity } },
          { new: true },
        );
      } else {
        throw error;
      }
    }

    const updated = await Product.findOneAndUpdate(
      {
        _id: productId,
        business: businessId,
        warehouseStock: { $gte: quantity },
      },
      { $inc: { warehouseStock: -quantity } },
      { new: true },
    );

    if (!updated) {
      distStock.quantity -= quantity;
      await distStock.save();
      throw new Error("Fallo en actualización concurrente");
    }

    const user = await User.findById(distributorId);
    if (user && !user.assignedProducts.includes(productId)) {
      user.assignedProducts.push(productId);
      await user.save();
    }

    return { distStock, product: updated };
  }

  async withdrawFromDistributor(
    businessId,
    distributorId,
    productId,
    quantity,
  ) {
    const normalizedQty = Number(quantity);
    if (!normalizedQty || normalizedQty <= 0) {
      throw new Error("Cantidad inválida");
    }

    const stockUpdate = await DistributorStock.findOneAndUpdate(
      {
        business: businessId,
        distributor: distributorId,
        product: productId,
        quantity: { $gte: normalizedQty },
      },
      { $inc: { quantity: -normalizedQty } },
      { new: true },
    );

    if (!stockUpdate) throw new Error("Stock insuficiente");

    const product = await Product.findOneAndUpdate(
      { _id: productId, business: businessId },
      { $inc: { warehouseStock: normalizedQty } },
      { new: true },
    );

    return { stockUpdate, product };
  }

  async transferBetweenDistributors(
    businessId,
    fromDistributorId,
    toDistributorId,
    productId,
    quantity,
  ) {
    if (fromDistributorId === toDistributorId) {
      throw new Error("No puedes transferir al mismo distribuidor");
    }
    const fromStock = await DistributorStock.findOne({
      business: businessId,
      distributor: fromDistributorId,
      product: productId,
    });

    if (!fromStock || fromStock.quantity < quantity) {
      throw new Error("Stock insuficiente");
    }

    let toStock = await DistributorStock.findOne({
      business: businessId,
      distributor: toDistributorId,
      product: productId,
    });

    const fromBefore = fromStock.quantity;
    const toBefore = toStock?.quantity || 0;

    fromStock.quantity -= quantity;
    await fromStock.save();

    if (!toStock) {
      toStock = await DistributorStock.create({
        business: businessId,
        distributor: toDistributorId,
        product: productId,
        quantity,
      });
    } else {
      toStock.quantity += quantity;
      await toStock.save();
    }

    const transfer = await StockTransfer.create({
      business: businessId,
      fromDistributor: fromDistributorId,
      toDistributor: toDistributorId,
      product: productId,
      quantity,
      fromStockBefore: fromBefore,
      fromStockAfter: fromStock.quantity,
      toStockBefore: toBefore,
      toStockAfter: toStock.quantity,
      status: "completed",
    });

    const toUser = await User.findById(toDistributorId);
    if (toUser && !toUser.assignedProducts.includes(productId)) {
      toUser.assignedProducts.push(productId);
      await toUser.save();
    }

    return { fromStock, toStock, transfer };
  }

  async transferToBranchFromDistributor(
    businessId,
    fromDistributorId,
    toBranchId,
    productId,
    quantity,
  ) {
    const branch = await Branch.findOne({
      _id: toBranchId,
      business: businessId,
    });

    if (!branch) {
      throw new Error("Sede no encontrada");
    }

    const redirectToWarehouse = isBodegaBranch(branch);

    const fromStock = await DistributorStock.findOne({
      business: businessId,
      distributor: fromDistributorId,
      product: productId,
    });

    if (!fromStock || fromStock.quantity < quantity) {
      throw new Error("Stock insuficiente");
    }

    fromStock.quantity -= quantity;
    await fromStock.save();

    const fromBefore = fromStock.quantity + quantity;
    const fromAfter = fromStock.quantity;

    let toBefore = 0;
    let toAfter = 0;

    if (redirectToWarehouse) {
      const product = await Product.findOne({
        _id: productId,
        business: businessId,
      });
      if (!product) {
        throw new Error("Producto no encontrado");
      }

      toBefore = product.warehouseStock || 0;
      product.warehouseStock = toBefore + quantity;
      toAfter = product.warehouseStock;
      await product.save();

      await StockTransfer.create({
        business: businessId,
        fromDistributor: fromDistributorId,
        toBranch: toBranchId,
        product: productId,
        quantity,
        fromStockBefore: fromBefore,
        fromStockAfter: fromAfter,
        toStockBefore: toBefore,
        toStockAfter: toAfter,
        status: "completed",
      });

      return { fromStock, branchStock: null };
    }

    let branchStock = await BranchStock.findOne({
      business: businessId,
      branch: toBranchId,
      product: productId,
    });

    if (!branchStock) {
      toBefore = 0;
      branchStock = await BranchStock.create({
        business: businessId,
        branch: toBranchId,
        product: productId,
        quantity,
      });
      toAfter = quantity;
    } else {
      toBefore = branchStock.quantity;
      branchStock.quantity += quantity;
      toAfter = branchStock.quantity;
      await branchStock.save();
    }

    await StockTransfer.create({
      business: businessId,
      fromDistributor: fromDistributorId,
      toBranch: toBranchId,
      product: productId,
      quantity,
      fromStockBefore: fromBefore,
      fromStockAfter: fromAfter,
      toStockBefore: toBefore,
      toStockAfter: toAfter,
      status: "completed",
    });

    return { fromStock, branchStock };
  }

  async getDistributorStock(businessId, distributorId) {
    const stock = await DistributorStock.find({
      distributor: distributorId,
      business: businessId,
    })
      .populate(
        "product",
        "name image purchasePrice distributorPrice clientPrice",
      )
      .populate("distributor", "name email")
      .lean();

    // Log entries where product is null (potential data integrity issues)
    const nullProductEntries = stock.filter((item) => item.product == null);
    if (nullProductEntries.length > 0) {
      console.warn("DistributorStock entries with null product encountered", {
        businessId,
        distributorId,
        distributorStockIds: nullProductEntries
          .map((item) => item._id)
          .filter((id) => id != null),
      });
    }
    // Filter out entries where product is null (deleted products)
    const validStock = stock.filter((item) => item.product != null);

    const user = await User.findById(distributorId).select("assignedProducts");
    const assignedIds = (user?.assignedProducts || []).map((id) =>
      id.toString(),
    );
    const existingIds = validStock.map((s) => s.product._id.toString());
    const missingIds = assignedIds.filter((id) => !existingIds.includes(id));

    if (missingIds.length > 0) {
      const missing = await Product.find({
        _id: { $in: missingIds },
        business: businessId,
        isDeleted: { $ne: true },
      })
        .select("name image purchasePrice distributorPrice clientPrice")
        .lean();
      missing.forEach((p) =>
        validStock.push({
          _id: `synthetic-${p._id}`,
          distributor: { _id: distributorId },
          product: p,
          quantity: 0,
          lowStockAlert: 5,
          isLowStock: true,
          isSynthetic: true,
        }),
      );
    }

    return validStock.map((item) => ({
      ...item,
      isLowStock: item.quantity <= (item.lowStockAlert || 0),
    }));
  }

  async getBranchStock(businessId, branchId) {
    const filter = businessId ? { business: businessId } : {};

    const bodegaIds = businessId ? await getBodegaBranchIds(businessId) : [];
    const isBodegaId =
      branchId && bodegaIds.includes(String(branchId).toString());

    if (isBodegaId) {
      const products = await Product.find({
        business: businessId,
        isDeleted: { $ne: true },
      })
        .select(
          "name image purchasePrice distributorPrice clientPrice lowStockAlert warehouseStock",
        )
        .lean();

      return products
        .filter((product) => (product.warehouseStock || 0) > 0)
        .map((product) => ({
          _id: `warehouse-${product._id}`,
          branch: branchId,
          product,
          quantity: product.warehouseStock || 0,
          lowStockAlert: product.lowStockAlert || 0,
        }));
    }

    if (branchId) {
      filter.branch = branchId;
    } else if (bodegaIds.length > 0) {
      filter.branch = { $nin: bodegaIds };
    }

    return BranchStock.find(filter)
      .populate("branch", "name")
      .populate(
        "product",
        "name image purchasePrice distributorPrice clientPrice",
      )
      .lean();
  }

  async getGlobalInventory(businessId) {
    // 1. Fetch all products (Warehouse Stock)
    const products = await Product.find({
      business: businessId,
      isDeleted: { $ne: true },
    })
      .select("name image category warehouseStock totalStock")
      .populate("category", "name")
      .lean();

    // 2. Fetch all branch stocks
    const bodegaIds = await getBodegaBranchIds(businessId);
    const bodegaIdSet = new Set(bodegaIds);

    const branchStocks = await BranchStock.find({ business: businessId })
      .populate("branch", "name")
      .lean();

    // 3. Fetch all distributor stocks
    const distributorStocks = await DistributorStock.find({
      business: businessId,
    })
      .populate("distributor", "name")
      .lean();

    // 4. Map and Aggregate
    const inventoryMap = new Map();

    // Initialize with products (Warehouse)
    products.forEach((p) => {
      inventoryMap.set(p._id.toString(), {
        product: p,
        warehouse: p.warehouseStock || 0,
        branches: 0,
        branchDetails: [],
        distributors: 0,
        distributorDetails: [],
        systemTotal: p.totalStock || 0,
      });
    });

    // Add Branch Stock
    branchStocks.forEach((item) => {
      if (!item.product) return;
      if (item.branch && bodegaIdSet.has(item.branch.toString())) return;
      const productId = item.product.toString();
      if (!inventoryMap.has(productId)) return; // Access to deleted product?

      const entry = inventoryMap.get(productId);
      entry.branches += item.quantity || 0;
      entry.branchDetails.push({
        name: item.branch?.name || "Sede desconocida",
        quantity: item.quantity,
      });
    });

    // Add Distributor Stock
    distributorStocks.forEach((item) => {
      if (!item.product) return;
      const productId = item.product.toString();
      if (!inventoryMap.has(productId)) return;

      const entry = inventoryMap.get(productId);
      entry.distributors += item.quantity || 0;
      entry.distributorDetails.push({
        name: item.distributor?.name || "Distribuidor desconocido",
        quantity: item.quantity,
      });
    });

    return Array.from(inventoryMap.values());
  }

  async getAlerts(businessId) {
    const lowWarehouse = await Product.find({
      business: businessId,
      isDeleted: { $ne: true },
      $expr: { $lte: ["$warehouseStock", "$lowStockAlert"] },
    }).lean();

    const lowDist = await DistributorStock.find({ business: businessId })
      .populate("product", "name")
      .populate("distributor", "name email")
      .lean();

    return {
      warehouseAlerts: lowWarehouse,
      distributorAlerts: lowDist.filter((i) => i.quantity <= i.lowStockAlert),
    };
  }

  async getAllowedBranches(businessId, allowedBranchIds = []) {
    const branchFilter = {
      business: businessId,
      active: true,
      ...(Array.isArray(allowedBranchIds) && allowedBranchIds.length > 0
        ? { _id: { $in: allowedBranchIds } }
        : {}),
    };

    const branches = await Branch.find(branchFilter)
      .select("name address isWarehouse")
      .lean();

    if (branches.length === 0) return [];

    const branchIds = branches.map((b) => b._id);
    const stocks = await BranchStock.find({
      business: businessId,
      branch: { $in: branchIds },
    })
      .populate("product", "name image clientPrice distributorPrice")
      .lean();

    const stockByBranch = new Map();
    stocks.forEach((item) => {
      if (!item.branch || !item.product) return;
      const key = item.branch.toString();
      if (!stockByBranch.has(key)) stockByBranch.set(key, []);
      stockByBranch.get(key).push({
        product: item.product,
        quantity: item.quantity || 0,
      });
    });

    return branches.map((branch) => {
      const stock = stockByBranch.get(branch._id.toString()) || [];
      const totalUnits = stock.reduce((sum, s) => sum + (s.quantity || 0), 0);
      return {
        _id: branch._id,
        name: branch.name,
        address: branch.address,
        isWarehouse: branch.isWarehouse,
        stock,
        totalProducts: stock.length,
        totalUnits,
      };
    });
  }

  async createTransfer(
    businessId,
    fromDistId,
    fromBranchId,
    toDistId,
    toBranchId,
    productId,
    quantity,
    userId,
  ) {
    return StockTransfer.create({
      business: businessId,
      product: productId,
      fromDistributor: fromDistId || null,
      fromBranch: fromBranchId || null,
      toDistributor: toDistId || null,
      toBranch: toBranchId || null,
      quantity,
      createdBy: userId,
      status: "pending",
    });
  }

  async reconcileStock(businessId, productId) {
    // Buscar el producto
    const product = await Product.findOne({
      _id: productId,
      business: businessId,
    });

    if (!product) {
      throw new Error("Producto no encontrado");
    }

    // Calcular stock asignado en distribuidores
    const distStocks = await DistributorStock.find({
      product: productId,
      business: businessId,
    });
    const totalDistributor = distStocks.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0,
    );

    // Calcular stock asignado en sucursales
    const bodegaIds = await getBodegaBranchIds(businessId);
    const branchStocks = await BranchStock.find({
      product: productId,
      business: businessId,
      ...(bodegaIds.length > 0 ? { branch: { $nin: bodegaIds } } : {}),
    });
    const totalBranch = branchStocks.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0,
    );

    // Calcular unidades sin asignar (fantasma)
    const unassigned =
      (product.totalStock || 0) -
      (product.warehouseStock || 0) -
      totalDistributor -
      totalBranch;

    if (unassigned <= 0) {
      throw new Error("No hay unidades sin asignar para reconciliar");
    }

    // Mover unidades fantasma a bodega principal
    product.warehouseStock = (product.warehouseStock || 0) + unassigned;
    await product.save();

    return {
      unitsReconciled: unassigned,
      newWarehouseStock: product.warehouseStock,
      totalStock: product.totalStock,
    };
  }

  async syncProductStock(businessId, productId) {
    const product = await Product.findOne({
      _id: productId,
      business: businessId,
    });

    if (!product) {
      throw new Error("Producto no encontrado");
    }

    const distStocks = await DistributorStock.find({
      product: productId,
      business: businessId,
    });
    const totalDistributor = distStocks.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0,
    );

    const bodegaIds = await getBodegaBranchIds(businessId);
    const branchStocks = await BranchStock.find({
      product: productId,
      business: businessId,
      ...(bodegaIds.length > 0 ? { branch: { $nin: bodegaIds } } : {}),
    });
    const totalBranch = branchStocks.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0,
    );

    const warehouseStock = product.warehouseStock || 0;
    const syncedTotal = warehouseStock + totalDistributor + totalBranch;

    product.totalStock = syncedTotal;
    await product.save();

    return {
      totalStock: product.totalStock,
      warehouseStock,
      totalDistributor,
      totalBranch,
    };
  }

  async getTransferHistory(businessId, filters = {}) {
    const query = { business: businessId };

    if (filters.fromDistributor) {
      query.fromDistributor = filters.fromDistributor;
    }

    if (filters.toDistributor) {
      query.toDistributor = filters.toDistributor;
    }

    if (filters.product) {
      query.product = filters.product;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    const page = parseInt(filters.page, 10) || 1;
    const limit = parseInt(filters.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const aggregateMatch = {
      business: new mongoose.Types.ObjectId(businessId),
    };

    if (query.fromDistributor) {
      aggregateMatch.fromDistributor = new mongoose.Types.ObjectId(
        query.fromDistributor,
      );
    }

    if (query.toDistributor) {
      aggregateMatch.toDistributor = new mongoose.Types.ObjectId(
        query.toDistributor,
      );
    }

    if (query.product) {
      aggregateMatch.product = new mongoose.Types.ObjectId(query.product);
    }

    if (query.status) {
      aggregateMatch.status = query.status;
    }

    if (query.createdAt) {
      aggregateMatch.createdAt = query.createdAt;
    }

    const [transfers, total, statsAgg] = await Promise.all([
      StockTransfer.find(query)
        .populate("fromDistributor", "name email")
        .populate("toDistributor", "name email")
        .populate("toBranch", "name")
        .populate("product", "name image")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StockTransfer.countDocuments(query),
      StockTransfer.aggregate([
        { $match: aggregateMatch },
        {
          $group: {
            _id: null,
            totalTransfers: { $sum: 1 },
            totalQuantity: { $sum: "$quantity" },
          },
        },
      ]),
    ]);

    const stats = statsAgg[0] || { totalTransfers: 0, totalQuantity: 0 };
    const normalizedTransfers = transfers.map((transfer) => ({
      ...transfer,
      product:
        transfer.product ||
        (transfer.product === null
          ? { _id: null, name: "Producto Eliminado" }
          : transfer.product),
      fromDistributor:
        transfer.fromDistributor ||
        (transfer.fromDistributor === null
          ? { _id: null, name: "Distribuidor" }
          : transfer.fromDistributor),
      toDistributor:
        transfer.toDistributor ||
        (transfer.toDistributor === null
          ? { _id: null, name: "Distribuidor" }
          : transfer.toDistributor),
    }));

    return {
      transfers: normalizedTransfers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats,
    };
  }
}

export default new StockRepository();
