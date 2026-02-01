import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import InventoryEntry from "../models/InventoryEntry.js";
import Product from "../models/Product.js";
import Provider from "../models/Provider.js";

const resolveBusinessId = (req) =>
  req.businessId || req.headers["x-business-id"] || req.query.businessId;

const ensureBranch = async (businessId, branchId) => {
  if (!branchId) return null;
  const branch = await Branch.findOne({ _id: branchId, business: businessId });
  if (!branch) throw new Error("Sede inválida para este negocio");
  return branch;
};

const generateRequestId = () => {
  const now = new Date();
  return `REQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}${String(now.getDate()).padStart(2, "0")}-${now.getTime()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
};

export const createInventoryEntry = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const {
      product: productId,
      quantity,
      branch: branchId,
      provider: providerId,
      notes,
      unitCost: rawUnitCost,
    } = req.body;

    if (!productId || !quantity) {
      return res
        .status(400)
        .json({ message: "producto y cantidad son obligatorios" });
    }

    const product = await Product.findOne({
      _id: productId,
      $or: [
        { business: businessId },
        { business: { $exists: false } },
        { business: null },
      ],
    });
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const branch = await ensureBranch(businessId, branchId);
    if (providerId) {
      const provider = await Provider.findOne({
        _id: providerId,
        business: businessId,
      });
      if (!provider) {
        return res.status(404).json({ message: "Proveedor no encontrado" });
      }
    }

    const destination = branch ? "branch" : "warehouse";
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      return res.status(400).json({ message: "Cantidad inválida" });
    }

    // Calcular costo unitario (usar el proporcionado o el purchasePrice del producto)
    const unitCost =
      Number(rawUnitCost) > 0
        ? Number(rawUnitCost)
        : product.purchasePrice || 0;
    const totalCost = qty * unitCost;

    // === CÁLCULO DE COSTO PROMEDIO PONDERADO ===
    const previousStock = product.totalStock || 0;

    // Si no hay totalInventoryValue inicializado, calcularlo desde el stock y costo actual
    const currentCost = product.averageCost || product.purchasePrice || 0;
    const previousValue =
      product.totalInventoryValue && product.totalInventoryValue > 0
        ? product.totalInventoryValue
        : previousStock * currentCost;

    const newTotalStock = previousStock + qty;
    const newTotalValue = previousValue + totalCost;
    const newAverageCost =
      newTotalStock > 0 ? newTotalValue / newTotalStock : unitCost;

    // Actualizar producto con nuevo costo promedio
    product.totalStock = newTotalStock;
    product.totalInventoryValue = newTotalValue;
    product.averageCost = newAverageCost;
    product.lastCostUpdate = new Date();

    if (destination === "branch") {
      await BranchStock.findOneAndUpdate(
        { business: businessId, branch: branch._id, product: product._id },
        { $inc: { quantity: qty } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } else {
      product.warehouseStock = (product.warehouseStock || 0) + qty;
    }
    await product.save({ validateBeforeSave: false });

    const entry = await InventoryEntry.create({
      business: businessId,
      branch: branch?._id || null,
      product: product._id,
      provider: providerId || null,
      user: req.user.id,
      quantity: qty,
      unitCost,
      totalCost,
      averageCostAfter: newAverageCost,
      notes,
      destination,
      requestId: req.body.requestId || generateRequestId(),
      purchaseGroupId: req.body.purchaseGroupId || null, // ⭐ Campo para agrupar recepciones
    });

    res.status(201).json({
      entry,
      costInfo: {
        previousAverageCost:
          previousStock > 0
            ? previousValue / previousStock
            : product.purchasePrice,
        newAverageCost,
        totalInventoryValue: newTotalValue,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const listInventoryEntries = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const {
      branchId,
      providerId,
      productId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;
    const filter = { business: businessId };

    if (branchId) filter.branch = branchId;
    if (providerId) filter.provider = providerId;
    if (productId) filter.product = productId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [entries, total] = await Promise.all([
      InventoryEntry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("product", "name")
        .populate("branch", "name")
        .populate("provider", "name")
        .populate("user", "name email")
        .lean(),
      InventoryEntry.countDocuments(filter),
    ]);

    res.json({
      entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProductHistory = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { productId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const filter = { business: businessId, product: productId };

    const [entries, total] = await Promise.all([
      InventoryEntry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("product", "name")
        .populate("branch", "name")
        .populate("provider", "name")
        .populate("user", "name email")
        .lean(),
      InventoryEntry.countDocuments(filter),
    ]);

    res.json({
      entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getInventorySummary = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { startDate, endDate } = req.query;
    const filter = { business: businessId };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const entries = await InventoryEntry.find(filter)
      .populate("provider", "name")
      .lean();

    const totalEntries = entries.length;
    const totalUnits = entries.reduce((sum, e) => sum + e.quantity, 0);

    const byDestination = {
      warehouse: entries
        .filter((e) => e.destination === "warehouse")
        .reduce((sum, e) => sum + e.quantity, 0),
      branch: entries
        .filter((e) => e.destination === "branch")
        .reduce((sum, e) => sum + e.quantity, 0),
    };

    const providerMap = new Map();
    entries.forEach((e) => {
      if (e.provider) {
        const providerId = e.provider._id.toString();
        const providerName = e.provider.name;
        if (!providerMap.has(providerId)) {
          providerMap.set(providerId, {
            provider: providerName,
            count: 0,
            units: 0,
          });
        }
        const stats = providerMap.get(providerId);
        stats.count += 1;
        stats.units += e.quantity;
      }
    });

    const byProvider = Array.from(providerMap.values());

    res.json({
      totalEntries,
      totalUnits,
      byDestination,
      byProvider,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Editar una entrada de inventario
 * Solo permite editar notas y proveedor, no la cantidad ni destino
 */
export const updateInventoryEntry = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { id } = req.params;
    const { notes, provider: providerId } = req.body;

    const entry = await InventoryEntry.findOne({
      _id: id,
      business: businessId,
    });

    if (!entry) {
      return res.status(404).json({ message: "Entrada no encontrada" });
    }

    // Validar proveedor si se proporciona
    if (providerId) {
      const provider = await Provider.findOne({
        _id: providerId,
        business: businessId,
      });
      if (!provider) {
        return res.status(404).json({ message: "Proveedor no encontrado" });
      }
      entry.provider = providerId;
    } else if (providerId === null || providerId === "") {
      entry.provider = null;
    }

    if (notes !== undefined) {
      entry.notes = notes;
    }

    await entry.save();

    const updatedEntry = await InventoryEntry.findById(entry._id)
      .populate("product", "name")
      .populate("branch", "name")
      .populate("provider", "name")
      .populate("user", "name email")
      .lean();

    res.json({ entry: updatedEntry });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Eliminar una entrada de inventario (borrado lógico)
 * Revierte el stock que se agregó con esta entrada
 */
export const deleteInventoryEntry = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { id } = req.params;

    const entry = await InventoryEntry.findOne({
      _id: id,
      business: businessId,
    });

    if (!entry) {
      return res.status(404).json({ message: "Entrada no encontrada" });
    }

    // Obtener el producto para revertir el stock
    const product = await Product.findById(entry.product);
    if (!product) {
      return res
        .status(404)
        .json({ message: "Producto no encontrado para revertir stock" });
    }

    // === LÓGICA DE REVERSIÓN DE COSTO PROMEDIO ===
    // 1. Revertir valor total del inventario
    // TotalValue actual - (Costo Unitario de la entrada * Cantidad de la entrada)
    // O usar entry.totalCost si se guardó confiablemente.
    const entryTotalCost =
      entry.totalCost || entry.quantity * (entry.unitCost || 0);

    const currentTotalValue = product.totalInventoryValue || 0;
    const currentTotalStock = product.totalStock || 0;

    let newTotalValue = currentTotalValue - entryTotalCost;
    let newTotalStock = currentTotalStock - qty;

    // Protecciones contra valores negativos
    if (newTotalValue < 0) newTotalValue = 0;
    if (newTotalStock < 0) newTotalStock = 0;

    // 2. Recalcular promedio
    let newAverageCost = product.averageCost; // mantener si algo falla

    if (newTotalStock > 0) {
      newAverageCost = newTotalValue / newTotalStock;
    } else {
      // Si el stock vuelve a 0, ¿qué costo ponemos?
      // Opción A: Mantener el último promedio conocido (no hacer nada)
      // Opción B: Resetear al precio de compra base
      // Preferimos Opción B para evitar "costos fantasma"
      newAverageCost = product.purchasePrice || 0;
      newTotalValue = 0; // asegurar coherencia
    }

    // Actualizar producto
    product.totalStock = newTotalStock;
    product.totalInventoryValue = newTotalValue;
    product.averageCost = newAverageCost;

    // Revertir el stock según el destino original
    if (entry.destination === "branch" && entry.branch) {
      // Reducir stock de la sede
      await BranchStock.findOneAndUpdate(
        { business: businessId, branch: entry.branch, product: product._id },
        { $inc: { quantity: -qty } },
      );
    } else {
      // Reducir stock de bodega
      product.warehouseStock = Math.max(0, (product.warehouseStock || 0) - qty);
    }

    await product.save({ validateBeforeSave: false });

    // Eliminar la entrada
    await InventoryEntry.findByIdAndDelete(entry._id);

    res.json({
      message: "Entrada eliminada y stock revertido correctamente",
      revertedQuantity: qty,
      destination: entry.destination,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
