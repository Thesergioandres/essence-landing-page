import mongoose from "mongoose";
import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import EmployeeStock from "../models/EmployeeStock.js";
import Product from "../models/Product.js";
import StockTransfer from "../models/StockTransfer.js";
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
  async runInTransaction(handler) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await handler(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async assignToEmployee(businessId, employeeId, productId, quantity) {
    const normalizedQty = Number(quantity);
    if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
      throw new Error("Cantidad inválida");
    }

    return this.runInTransaction(async (session) => {
      const product = await Product.findOneAndUpdate(
        {
          _id: productId,
          business: businessId,
          warehouseStock: { $gte: normalizedQty },
        },
        { $inc: { warehouseStock: -normalizedQty } },
        { new: true, session },
      );

      if (!product) {
        throw new Error("Stock insuficiente");
      }

      let distStock;
      try {
        distStock = await EmployeeStock.findOneAndUpdate(
          {
            employee: employeeId,
            product: productId,
            business: businessId,
          },
          {
            $inc: { quantity: normalizedQty },
            $setOnInsert: {
              employee: employeeId,
              product: productId,
              business: businessId,
            },
          },
          { new: true, upsert: true, session },
        );
      } catch (error) {
        if (error?.code === 11000) {
          distStock = await EmployeeStock.findOneAndUpdate(
            {
              employee: employeeId,
              product: productId,
              business: businessId,
            },
            { $inc: { quantity: normalizedQty } },
            { new: true, session },
          );
        } else {
          throw error;
        }
      }

      const user = await User.findById(employeeId).session(session);
      if (
        user &&
        !user.assignedProducts.some(
          (assignedProductId) =>
            String(assignedProductId) === String(productId),
        )
      ) {
        user.assignedProducts.push(productId);
        await user.save({ session });
      }

      return { distStock, product };
    });
  }

  async withdrawFromEmployee(
    businessId,
    employeeId,
    productId,
    quantity,
  ) {
    const normalizedQty = Number(quantity);
    if (!normalizedQty || normalizedQty <= 0) {
      throw new Error("Cantidad inválida");
    }

    return this.runInTransaction(async (session) => {
      const stockUpdate = await EmployeeStock.findOneAndUpdate(
        {
          business: businessId,
          employee: employeeId,
          product: productId,
          quantity: { $gte: normalizedQty },
        },
        { $inc: { quantity: -normalizedQty } },
        { new: true, session },
      );

      if (!stockUpdate) throw new Error("Stock insuficiente");

      const product = await Product.findOneAndUpdate(
        { _id: productId, business: businessId },
        { $inc: { warehouseStock: normalizedQty } },
        { new: true, session },
      );

      return { stockUpdate, product };
    });
  }

  async transferBetweenEmployees(
    businessId,
    fromEmployeeId,
    toEmployeeId,
    productId,
    quantity,
  ) {
    if (fromEmployeeId === toEmployeeId) {
      throw new Error("No puedes transferir al mismo empleado");
    }

    const normalizedQty = Number(quantity);
    if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
      throw new Error("Cantidad inválida");
    }

    return this.runInTransaction(async (session) => {
      const fromStock = await EmployeeStock.findOneAndUpdate(
        {
          business: businessId,
          employee: fromEmployeeId,
          product: productId,
          quantity: { $gte: normalizedQty },
        },
        { $inc: { quantity: -normalizedQty } },
        { new: true, session },
      );

      if (!fromStock) {
        throw new Error("Stock insuficiente");
      }

      const fromBefore = Number(fromStock.quantity || 0) + normalizedQty;

      const toStock = await EmployeeStock.findOneAndUpdate(
        {
          business: businessId,
          employee: toEmployeeId,
          product: productId,
        },
        {
          $inc: { quantity: normalizedQty },
          $setOnInsert: {
            business: businessId,
            employee: toEmployeeId,
            product: productId,
          },
        },
        { new: true, upsert: true, session },
      );

      const toAfter = Number(toStock?.quantity || 0);
      const toBefore = Math.max(0, toAfter - normalizedQty);

      const [transfer] = await StockTransfer.create(
        [
          {
            business: businessId,
            fromEmployee: fromEmployeeId,
            toEmployee: toEmployeeId,
            product: productId,
            quantity: normalizedQty,
            fromStockBefore: fromBefore,
            fromStockAfter: Number(fromStock.quantity || 0),
            toStockBefore: toBefore,
            toStockAfter: toAfter,
            status: "completed",
          },
        ],
        { session },
      );

      const toUser = await User.findById(toEmployeeId).session(session);
      if (
        toUser &&
        !toUser.assignedProducts.some(
          (assignedProductId) =>
            String(assignedProductId) === String(productId),
        )
      ) {
        toUser.assignedProducts.push(productId);
        await toUser.save({ session });
      }

      return { fromStock, toStock, transfer };
    });
  }

  async transferToBranchFromEmployee(
    businessId,
    fromEmployeeId,
    toBranchId,
    productId,
    quantity,
  ) {
    const normalizedQty = Number(quantity);
    if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
      throw new Error("Cantidad inválida");
    }

    return this.runInTransaction(async (session) => {
      const branch = await Branch.findOne({
        _id: toBranchId,
        business: businessId,
      }).session(session);

      if (!branch) {
        throw new Error("Sede no encontrada");
      }

      const redirectToWarehouse = isBodegaBranch(branch);

      const fromStock = await EmployeeStock.findOneAndUpdate(
        {
          business: businessId,
          employee: fromEmployeeId,
          product: productId,
          quantity: { $gte: normalizedQty },
        },
        { $inc: { quantity: -normalizedQty } },
        { new: true, session },
      );

      if (!fromStock) {
        throw new Error("Stock insuficiente");
      }

      const fromBefore = Number(fromStock.quantity || 0) + normalizedQty;
      const fromAfter = Number(fromStock.quantity || 0);

      let toBefore = 0;
      let toAfter = 0;
      let branchStock = null;

      if (redirectToWarehouse) {
        const product = await Product.findOneAndUpdate(
          {
            _id: productId,
            business: businessId,
          },
          { $inc: { warehouseStock: normalizedQty } },
          { new: true, session },
        );

        if (!product) {
          throw new Error("Producto no encontrado");
        }

        toAfter = Number(product.warehouseStock || 0);
        toBefore = Math.max(0, toAfter - normalizedQty);
      } else {
        branchStock = await BranchStock.findOneAndUpdate(
          {
            business: businessId,
            branch: toBranchId,
            product: productId,
          },
          {
            $inc: { quantity: normalizedQty },
            $setOnInsert: {
              business: businessId,
              branch: toBranchId,
              product: productId,
            },
          },
          { new: true, upsert: true, session },
        );

        toAfter = Number(branchStock?.quantity || 0);
        toBefore = Math.max(0, toAfter - normalizedQty);
      }

      await StockTransfer.create(
        [
          {
            business: businessId,
            fromEmployee: fromEmployeeId,
            toBranch: toBranchId,
            product: productId,
            quantity: normalizedQty,
            fromStockBefore: fromBefore,
            fromStockAfter: fromAfter,
            toStockBefore: toBefore,
            toStockAfter: toAfter,
            status: "completed",
          },
        ],
        { session },
      );

      return {
        fromStock,
        branchStock: redirectToWarehouse ? null : branchStock,
      };
    });
  }

  async getEmployeeStock(businessId, employeeId) {
    const stock = await EmployeeStock.find({
      employee: employeeId,
      business: businessId,
    })
      .populate(
        "product",
        "name image purchasePrice employeePrice clientPrice",
      )
      .populate("employee", "name email")
      .lean();

    // Log entries where product is null (potential data integrity issues)
    const nullProductEntries = stock.filter((item) => item.product == null);
    if (nullProductEntries.length > 0) {
      console.warn("EmployeeStock entries with null product encountered", {
        businessId,
        employeeId,
        employeeStockIds: nullProductEntries
          .map((item) => item._id)
          .filter((id) => id != null),
      });
    }
    // Filter out entries where product is null (deleted products)
    const validStock = stock.filter((item) => item.product != null);

    const user = await User.findById(employeeId).select("assignedProducts");
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
        .select("name image purchasePrice employeePrice clientPrice")
        .lean();
      missing.forEach((p) =>
        validStock.push({
          _id: `synthetic-${p._id}`,
          employee: { _id: employeeId },
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
          "name image purchasePrice employeePrice clientPrice lowStockAlert warehouseStock",
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
        "name image purchasePrice employeePrice clientPrice",
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

    // 3. Fetch all employee stocks
    const employeeStocks = await EmployeeStock.find({
      business: businessId,
    })
      .populate("employee", "name")
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
        employees: 0,
        employeeDetails: [],
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

    // Add Employee Stock
    employeeStocks.forEach((item) => {
      if (!item.product) return;
      const productId = item.product.toString();
      if (!inventoryMap.has(productId)) return;

      const entry = inventoryMap.get(productId);
      entry.employees += item.quantity || 0;
      entry.employeeDetails.push({
        name: item.employee?.name || "Empleado desconocido",
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

    const lowDist = await EmployeeStock.find({ business: businessId })
      .populate("product", "name")
      .populate("employee", "name email")
      .lean();

    return {
      warehouseAlerts: lowWarehouse,
      employeeAlerts: lowDist.filter((i) => i.quantity <= i.lowStockAlert),
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
      .populate("product", "name image clientPrice employeePrice")
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
      fromEmployee: fromDistId || null,
      fromBranch: fromBranchId || null,
      toEmployee: toDistId || null,
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

    // Calcular stock asignado en empleados
    const distStocks = await EmployeeStock.find({
      product: productId,
      business: businessId,
    });
    const totalEmployee = distStocks.reduce(
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
      totalEmployee -
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

    const distStocks = await EmployeeStock.find({
      product: productId,
      business: businessId,
    });
    const totalEmployee = distStocks.reduce(
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
    const syncedTotal = warehouseStock + totalEmployee + totalBranch;

    product.totalStock = syncedTotal;
    await product.save();

    return {
      totalStock: product.totalStock,
      warehouseStock,
      totalEmployee,
      totalBranch,
    };
  }

  async getTransferHistory(businessId, filters = {}) {
    const query = { business: businessId };

    if (filters.fromEmployee) {
      query.fromEmployee = filters.fromEmployee;
    }

    if (filters.toEmployee) {
      query.toEmployee = filters.toEmployee;
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

    if (query.fromEmployee) {
      aggregateMatch.fromEmployee = new mongoose.Types.ObjectId(
        query.fromEmployee,
      );
    }

    if (query.toEmployee) {
      aggregateMatch.toEmployee = new mongoose.Types.ObjectId(
        query.toEmployee,
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
        .populate("fromEmployee", "name email")
        .populate("toEmployee", "name email")
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
      fromEmployee:
        transfer.fromEmployee ||
        (transfer.fromEmployee === null
          ? { _id: null, name: "Empleado" }
          : transfer.fromEmployee),
      toEmployee:
        transfer.toEmployee ||
        (transfer.toEmployee === null
          ? { _id: null, name: "Empleado" }
          : transfer.toEmployee),
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
