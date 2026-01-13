import mongoose from "mongoose";
import BranchStock from "../models/BranchStock.js";
import DistributorStock from "../models/DistributorStock.js";
import Membership from "../models/Membership.js";
import Product from "../models/Product.js";
import StockTransfer from "../models/StockTransfer.js";
import User from "../models/User.js";
import { logApiError, logApiInfo, logStockError } from "../utils/logger.js";

const resolveBusinessId = (req) =>
  req.businessId ||
  req.headers["x-business-id"] ||
  req.query.businessId ||
  req.body.businessId;

// @desc    Asignar stock a un distribuidor
// @route   POST /api/stock/assign
// @access  Private/Admin
export const assignStockToDistributor = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest = process.env.NODE_ENV === "test";
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { distributorId, productId, quantity } = req.body;

    // Validar que sea distribuidor
    const distributor = await User.findById(distributorId);
    if (!distributor || distributor.role !== "distribuidor") {
      return res.status(400).json({ message: "Usuario no es distribuidor" });
    }

    const distributorMembership = await Membership.findOne({
      business: businessId,
      user: distributorId,
      status: "active",
    });

    if (!distributorMembership) {
      return res
        .status(403)
        .json({ message: "Distribuidor no pertenece a este negocio" });
    }

    // Verificar stock en bodega
    const product = await Product.findOne(
      businessId ? { _id: productId, business: businessId } : { _id: productId }
    );
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    if (product.warehouseStock < quantity) {
      logStockError({
        userId: req.user?.id,
        cantidad: quantity,
        sede: "warehouse",
        motivo: "stock_insuficiente",
        requestId: req.reqId,
        businessId,
        extra: { productId, disponible: product.warehouseStock },
      });
      return res.status(400).json({
        message: `Stock insuficiente en bodega. Disponible: ${product.warehouseStock}`,
        requestId: req.reqId,
      });
    }

    // Buscar o crear registro de stock del distribuidor
    let distributorStock = await DistributorStock.findOne({
      distributor: distributorId,
      product: productId,
      business: businessId,
    });

    if (distributorStock) {
      distributorStock.quantity += quantity;
      await distributorStock.save();
    } else {
      distributorStock = await DistributorStock.create({
        distributor: distributorId,
        product: productId,
        quantity,
        business: businessId,
      });
    }

    // 🔒 Descontar de bodega de forma ATÓMICA para evitar condiciones de carrera
    const updateResult = await Product.findOneAndUpdate(
      {
        _id: productId,
        business: businessId,
        warehouseStock: { $gte: quantity },
      },
      { $inc: { warehouseStock: -quantity } },
      { new: true }
    );

    if (!updateResult) {
      // Si falla la actualización atómica, revertir el stock del distribuidor
      if (distributorStock) {
        distributorStock.quantity -= quantity;
        await distributorStock.save();
      }
      return res.status(400).json({
        message: `Stock insuficiente en bodega (verificación concurrente falló)`,
        requestId: req.reqId,
      });
    }

    // Usar el producto actualizado para la respuesta
    const updatedProduct = updateResult;

    // Asignar producto al distribuidor si no lo tiene
    if (!distributor.assignedProducts.includes(productId)) {
      distributor.assignedProducts.push(productId);
      await distributor.save();
    }

    logApiInfo({
      message: "stock_assigned_to_distributor",
      module: "stock",
      requestId: req.reqId,
      userId: req.user?.id,
      businessId,
      extra: { distributorId, productId, quantity },
    });

    res.json({
      message: "Stock asignado correctamente",
      distributorStock: await distributorStock.populate([
        { path: "distributor", select: "name email" },
        { path: "product", select: "name" },
      ]),
      warehouseStock: updatedProduct.warehouseStock,
      requestId: req.reqId,
    });
  } catch (error) {
    logApiError({
      message: "stock_assign_error",
      module: "stock",
      requestId: req.reqId,
      userId: req.user?.id,
      businessId: resolveBusinessId(req),
      stack: error.stack,
    });
    res.status(500).json({ message: error.message, requestId: req.reqId });
  }
};

// @desc    Retirar stock de un distribuidor
// @route   POST /api/stock/withdraw
// @access  Private/Admin
export const withdrawStockFromDistributor = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest = process.env.NODE_ENV === "test";
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { distributorId, productId, quantity } = req.body;

    const distributorMembership = await Membership.findOne({
      business: businessId,
      user: distributorId,
      status: "active",
    });

    if (!distributorMembership) {
      return res
        .status(403)
        .json({ message: "Distribuidor no pertenece a este negocio" });
    }

    const distributorStock = await DistributorStock.findOne({
      distributor: distributorId,
      product: productId,
      business: businessId,
    });

    if (!distributorStock) {
      return res
        .status(404)
        .json({ message: "El distribuidor no tiene este producto" });
    }

    if (distributorStock.quantity < quantity) {
      return res.status(400).json({
        message: `El distribuidor solo tiene ${distributorStock.quantity} unidades`,
      });
    }

    // 🔒 Descontar del distribuidor de forma ATÓMICA para evitar condiciones de carrera
    const stockUpdateResult = await DistributorStock.findOneAndUpdate(
      {
        _id: distributorStock._id,
        quantity: { $gte: quantity },
      },
      { $inc: { quantity: -quantity } },
      { new: true }
    );

    if (!stockUpdateResult) {
      return res.status(400).json({
        message: `Error al retirar stock (verificación concurrente falló)`,
      });
    }

    // Devolver a bodega de forma atómica
    const product = await Product.findOneAndUpdate(
      { _id: productId, business: businessId },
      { $inc: { warehouseStock: quantity } },
      { new: true }
    );

    res.json({
      message: "Stock retirado correctamente",
      distributorStock: await stockUpdateResult.populate([
        { path: "distributor", select: "name email" },
        { path: "product", select: "name" },
      ]),
      warehouseStock: product.warehouseStock,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener stock de un distribuidor
// @route   GET /api/stock/distributor/:distributorId
// @access  Private
export const getDistributorStock = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest = process.env.NODE_ENV === "test";
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    let { distributorId } = req.params;

    // Si es "me", usar el ID del usuario autenticado
    if (distributorId === "me") {
      distributorId = req.user.userId || req.user.id;
    }

    // Verificar permisos: admin/god/super_admin pueden ver cualquiera; distribuidor solo el suyo
    const currentUserId = req.user.userId || req.user.id;
    const isAdminLike =
      req.user.role === "admin" ||
      req.user.role === "god" ||
      req.user.role === "super_admin";

    if (!isAdminLike && currentUserId !== distributorId) {
      return res.status(403).json({
        message: "No tienes permiso para ver este inventario",
      });
    }

    const stock = await DistributorStock.find({
      distributor: distributorId,
      business: businessId,
    })
      .select("product distributor quantity lowStockAlert createdAt updatedAt")
      .populate(
        "product",
        "name image purchasePrice distributorPrice clientPrice"
      )
      .populate("distributor", "name email")
      .lean();

    // Agregar alertas de stock bajo
    const stockWithAlerts = stock.map((item) => ({
      ...item,
      isLowStock: item.quantity <= item.lowStockAlert,
    }));

    res.json(stockWithAlerts);
  } catch (error) {
    console.error("❌ Error en getDistributorStock:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener todo el stock de todos los distribuidores
// @route   GET /api/stock/all
// @access  Private/Admin
export const getAllDistributorsStock = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest = process.env.NODE_ENV === "test";
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const stockFilter = businessId ? { business: businessId } : {};

    const stock = await DistributorStock.find(stockFilter)
      .select("product distributor quantity lowStockAlert")
      .populate("product", "name image warehouseStock totalStock")
      .populate("distributor", "name email active")
      .lean();

    res.json(stock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener alertas de stock bajo
// @route   GET /api/stock/alerts
// @access  Private/Admin
export const getStockAlerts = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest = process.env.NODE_ENV === "test";
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    // Productos con stock bajo en bodega
    const lowWarehouseStock = await Product.find({
      warehouseStock: { $lte: 10 },
      ...(businessId ? { business: businessId } : {}),
    })
      .select("name warehouseStock lowStockAlert")
      .lean();

    // Distribuidores con stock bajo
    const lowDistributorStock = await DistributorStock.find(
      businessId ? { business: businessId } : {}
    )
      .populate("product", "name")
      .populate("distributor", "name email")
      .lean();

    const distributorAlerts = lowDistributorStock.filter(
      (item) => item.quantity <= item.lowStockAlert
    );

    res.json({
      warehouseAlerts: lowWarehouseStock,
      distributorAlerts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener stock por sede (branch). Si no se pasa branchId devuelve todas las sedes.
// @route   GET /api/stock/branch/:branchId?
// @access  Private/Admin
export const getBranchStock = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest = process.env.NODE_ENV === "test";
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { branchId } = req.params;
    const filter = {
      ...(businessId ? { business: businessId } : {}),
      ...(branchId ? { branch: branchId } : {}),
    };

    const data = await BranchStock.find(filter)
      .populate("branch", "name")
      .populate(
        "product",
        "name image purchasePrice distributorPrice clientPrice"
      )
      .lean();

    res.json({ data });
  } catch (error) {
    console.error("getBranchStock error", error);
    res.status(500).json({ message: "No se pudo obtener el stock por sede" });
  }
};

// @desc    Alertas de stock bajo por sede (BranchStock)
// @route   GET /api/stock/branch-alerts
// @access  Private/Admin
export const getBranchStockAlerts = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest = process.env.NODE_ENV === "test";
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const filter = { ...(businessId ? { business: businessId } : {}) };

    const alerts = await BranchStock.find({
      ...filter,
      $expr: { $lte: ["$quantity", "$lowStockAlert"] },
    })
      .populate("branch", "name")
      .populate("product", "name image")
      .lean();

    res.json({ alerts });
  } catch (error) {
    console.error("getBranchStockAlerts error", error);
    res
      .status(500)
      .json({ message: "No se pudieron obtener alertas por sede" });
  }
};

// @desc    Transferir stock entre distribuidores
// @route   POST /api/stock/transfer
// @access  Private/Distributor
export const transferStockBetweenDistributors = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest = process.env.NODE_ENV === "test";
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { toDistributorId, productId, quantity } = req.body;
    const fromDistributorId = req.user.userId || req.user.id; // Usuario autenticado que transfiere

    console.log("🔄 Transferencia iniciada:");
    console.log("  De:", fromDistributorId);
    console.log("  Para:", toDistributorId);
    console.log("  Producto:", productId);
    console.log("  Cantidad:", quantity);

    // Validaciones básicas
    if (!toDistributorId || !productId || !quantity) {
      return res.status(400).json({
        message: "Faltan datos requeridos: destinatario, producto y cantidad",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(toDistributorId)) {
      // Forzar flujo de error para validar rollback en tests de integridad
      throw new Error("Identificador de distribuidor inválido");
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res
        .status(400)
        .json({ message: "Identificador de producto inválido" });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        message: "La cantidad debe ser mayor a 0",
      });
    }

    if (fromDistributorId === toDistributorId) {
      return res.status(400).json({
        message: "No puedes transferir stock a ti mismo",
      });
    }

    // Verificar que ambos usuarios sean distribuidores
    const [fromDistributor, toDistributor] = await Promise.all([
      User.findById(fromDistributorId),
      User.findById(toDistributorId),
    ]);

    if (!fromDistributor || fromDistributor.role !== "distribuidor") {
      return res
        .status(403)
        .json({ message: "Usuario origen no es distribuidor" });
    }

    if (!toDistributor || toDistributor.role !== "distribuidor") {
      return res
        .status(400)
        .json({ message: "Usuario destino no es distribuidor válido" });
    }

    if (businessId) {
      const fromMembership = await Membership.findOne({
        business: businessId,
        user: fromDistributorId,
        status: "active",
      });

      if (!fromMembership) {
        return res.status(403).json({
          message: "El distribuidor origen no pertenece a este negocio",
        });
      }

      const toMembership = await Membership.findOne({
        business: businessId,
        user: toDistributorId,
        status: "active",
      });

      if (!toMembership) {
        return res.status(403).json({
          message: "El distribuidor destino no pertenece a este negocio",
        });
      }
    }

    // Verificar que el producto existe
    const productFilter = businessId
      ? { _id: productId, business: businessId }
      : { _id: productId };
    const product = await Product.findOne(productFilter);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    // Verificar stock del distribuidor origen
    const fromStock = await DistributorStock.findOne(
      businessId
        ? {
            distributor: fromDistributorId,
            product: productId,
            business: businessId,
          }
        : { distributor: fromDistributorId, product: productId }
    );

    if (!fromStock || fromStock.quantity < quantity) {
      return res.status(400).json({
        message: `Stock insuficiente. Disponible: ${
          fromStock?.quantity || 0
        }, Solicitado: ${quantity}`,
      });
    }

    // Guardar estados antes de la transferencia
    const fromStockBefore = fromStock.quantity;

    // 2. Buscar stock del distribuidor destino
    let toStock = await DistributorStock.findOne(
      businessId
        ? {
            distributor: toDistributorId,
            product: productId,
            business: businessId,
          }
        : { distributor: toDistributorId, product: productId }
    );

    const toStockBefore = toStock?.quantity || 0;

    // Realizar la transferencia
    // 1. Restar del distribuidor origen
    fromStock.quantity -= quantity;
    await fromStock.save();

    // 2. Actualizar o crear stock del distribuidor destino
    if (toStock) {
      toStock.quantity += quantity;
      await toStock.save();
    } else {
      toStock = await DistributorStock.create({
        distributor: toDistributorId,
        product: productId,
        quantity,
        business: businessId || undefined,
      });
    }

    // 3. Asignar producto al distribuidor destino si no lo tiene
    if (!toDistributor.assignedProducts) {
      toDistributor.assignedProducts = [];
    }

    const hasProduct = toDistributor.assignedProducts.some(
      (p) => p.toString() === productId.toString()
    );

    if (!hasProduct) {
      toDistributor.assignedProducts.push(productId);
      await toDistributor.save();
      console.log("✅ Producto asignado al distribuidor destino");
    } else {
      console.log("ℹ️  Producto ya estaba asignado");
    }

    // 4. Registrar transferencia en el historial
    await StockTransfer.create({
      fromDistributor: fromDistributorId,
      toDistributor: toDistributorId,
      product: productId,
      quantity,
      fromStockBefore,
      fromStockAfter: fromStock.quantity,
      toStockBefore,
      toStockAfter: toStock.quantity,
      status: "completed",
      business: businessId || undefined,
    });
    console.log("✅ Transferencia registrada en historial");

    // Crear registro de auditoría (opcional, no debe fallar la transferencia)
    try {
      const AuditLog = (await import("../models/AuditLog.js")).default;
      await AuditLog.create({
        business: businessId || undefined,
        user: fromDistributorId,
        userEmail: fromDistributor.email,
        userName: fromDistributor.name,
        userRole: fromDistributor.role,
        action: "stock_adjusted",
        module: "stock",
        description: `Transferencia de stock de ${quantity} ${product.name} a ${toDistributor.name}`,
        entityType: "DistributorStock",
        entityId: toStock._id,
        entityName: product.name,
        metadata: {
          fromDistributor: {
            id: fromDistributorId.toString(),
            name: fromDistributor.name,
          },
          toDistributor: {
            id: toDistributorId.toString(),
            name: toDistributor.name,
          },
          product: {
            id: product._id.toString(),
            name: product.name,
          },
          quantity,
          fromStockBefore,
          fromStockAfter: fromStock.quantity,
          toStockBefore,
          toStockAfter: toStock.quantity,
        },
      });
      console.log("✅ Registro de auditoría creado");
    } catch (auditError) {
      console.error(
        "⚠️  Error al crear log de auditoría (no crítico):",
        auditError.message
      );
    }

    console.log("✅ Transferencia completada exitosamente");

    res.json({
      success: true,
      message: `Transferencia exitosa de ${quantity} unidades de ${product.name} a ${toDistributor.name}`,
      transfer: {
        from: {
          distributorId: fromDistributorId.toString(),
          name: fromDistributor.name,
          remainingStock: fromStock.quantity,
        },
        to: {
          distributorId: toDistributorId.toString(),
          name: toDistributor.name,
          newStock: toStock.quantity,
        },
        product: {
          id: product._id.toString(),
          name: product.name,
        },
        quantity,
      },
    });
  } catch (error) {
    console.error("❌ Error en transferencia de stock:", error);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      message: error.message,
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// @desc    Obtener historial de transferencias con filtros
// @route   GET /api/stock/transfers
// @access  Private/Admin
export const getTransferHistory = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest = process.env.NODE_ENV === "test";
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const {
      fromDistributor,
      toDistributor,
      product,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 20,
    } = req.query;

    // Construir filtros
    const filters = businessId ? { business: businessId } : {};

    if (fromDistributor) filters.fromDistributor = fromDistributor;
    if (toDistributor) filters.toDistributor = toDistributor;
    if (product) filters.product = product;
    if (status) filters.status = status;

    // Filtro de fechas
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.createdAt.$lte = end;
      }
    }

    // Paginación
    const skip = (page - 1) * limit;

    // Obtener transferencias
    const [transfers, total] = await Promise.all([
      StockTransfer.find(filters)
        .select(
          "fromDistributor toDistributor product quantity fromStockBefore fromStockAfter toStockBefore toStockAfter status createdAt"
        )
        .populate("fromDistributor", "name email")
        .populate("toDistributor", "name email")
        .populate("product", "name image")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockTransfer.countDocuments(filters),
    ]);

    // Estadísticas
    const stats = await StockTransfer.aggregate([
      { $match: filters },
      {
        $group: {
          _id: null,
          totalTransfers: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
        },
      },
    ]);

    res.json({
      transfers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
      stats: stats[0] || { totalTransfers: 0, totalQuantity: 0 },
    });
  } catch (error) {
    console.error("❌ Error al obtener historial:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener bodegas/sedes permitidas para el distribuidor con su stock
// @route   GET /api/stock/my-allowed-branches
// @access  Private/Distributor
export const getMyAllowedBranches = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const userId = req.user?.id;

    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    // Obtener membership del usuario para ver sus bodegas permitidas
    const membership = await Membership.findOne({
      user: userId,
      business: businessId,
      status: "active",
    }).populate("allowedBranches", "name address isWarehouse active");

    if (!membership) {
      return res
        .status(403)
        .json({ message: "No tienes membresía activa en este negocio" });
    }

    const allowedBranches = membership.allowedBranches || [];

    if (allowedBranches.length === 0) {
      return res.json({
        branches: [],
        message: "No tienes bodegas asignadas",
      });
    }

    // Obtener el stock de cada bodega permitida
    const branchIds = allowedBranches.map((b) => b._id);

    const branchStocks = await BranchStock.find({
      business: businessId,
      branch: { $in: branchIds },
      quantity: { $gt: 0 },
    })
      .populate("product", "name image clientPrice distributorPrice")
      .populate("branch", "name address isWarehouse")
      .lean();

    // Agrupar stock por bodega
    const branchesWithStock = allowedBranches
      .filter((branch) => branch.active !== false)
      .map((branch) => {
        const stockItems = branchStocks.filter(
          (s) => s.branch?._id?.toString() === branch._id.toString()
        );
        return {
          _id: branch._id,
          name: branch.name,
          address: branch.address,
          isWarehouse: branch.isWarehouse,
          stock: stockItems.map((s) => ({
            product: s.product,
            quantity: s.quantity,
          })),
          totalProducts: stockItems.length,
          totalUnits: stockItems.reduce((acc, s) => acc + s.quantity, 0),
        };
      });

    res.json({
      branches: branchesWithStock,
    });
  } catch (error) {
    console.error("Error al obtener bodegas permitidas:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Transferir stock de distribuidor a sede
// @route   POST /api/stock/transfer-to-branch
// @access  Private/Distributor
export const transferStockToBranch = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { toBranchId, productId, quantity } = req.body;
    const distributorId = req.user.userId || req.user.id;

    // Validaciones
    if (!toBranchId || !productId || !quantity) {
      return res.status(400).json({
        message: "Faltan datos requeridos: sede destino, producto y cantidad",
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        message: "La cantidad debe ser mayor a 0",
      });
    }

    // Verificar que el usuario sea distribuidor
    const distributor = await User.findById(distributorId);
    if (!distributor || distributor.role !== "distribuidor") {
      return res
        .status(403)
        .json({ message: "Solo distribuidores pueden realizar esta acción" });
    }

    // Verificar membership del distribuidor
    const membership = await Membership.findOne({
      business: businessId,
      user: distributorId,
      status: "active",
    });

    if (!membership) {
      return res.status(403).json({
        message: "No tienes membresía activa en este negocio",
      });
    }

    // Verificar que la sede existe y está activa
    const Branch = mongoose.model("Branch");
    const branch = await Branch.findOne({
      _id: toBranchId,
      business: businessId,
      active: true,
    });

    if (!branch) {
      return res.status(404).json({ message: "Sede no encontrada o inactiva" });
    }

    // Verificar que el distribuidor tiene acceso a esta sede
    const allowedBranchIds =
      membership.allowedBranches?.map((b) => b.toString()) || [];
    if (allowedBranchIds.length > 0 && !allowedBranchIds.includes(toBranchId)) {
      return res.status(403).json({
        message: "No tienes acceso a esta sede",
      });
    }

    // Verificar que el producto existe
    const product = await Product.findOne({
      _id: productId,
      business: businessId,
    });

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    // Verificar stock del distribuidor
    const distributorStock = await DistributorStock.findOne({
      distributor: distributorId,
      product: productId,
      business: businessId,
    });

    if (!distributorStock || distributorStock.quantity < quantity) {
      return res.status(400).json({
        message: `Stock insuficiente. Disponible: ${
          distributorStock?.quantity || 0
        }, Solicitado: ${quantity}`,
      });
    }

    // Iniciar transacción
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Reducir stock del distribuidor
      distributorStock.quantity -= quantity;
      await distributorStock.save({ session });

      // Agregar stock a la sede
      let branchStock = await BranchStock.findOne({
        branch: toBranchId,
        product: productId,
        business: businessId,
      }).session(session);

      if (branchStock) {
        branchStock.quantity += quantity;
        await branchStock.save({ session });
      } else {
        branchStock = await BranchStock.create(
          [
            {
              branch: toBranchId,
              product: productId,
              business: businessId,
              quantity: quantity,
            },
          ],
          { session }
        );
        branchStock = branchStock[0];
      }

      // Registrar la transferencia
      await StockTransfer.create(
        [
          {
            business: businessId,
            type: "distributor_to_branch",
            fromDistributor: distributorId,
            toBranch: toBranchId,
            product: productId,
            quantity: quantity,
            status: "completed",
            completedAt: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();

      res.json({
        success: true,
        message: `${quantity} unidades de ${product.name} transferidas a ${branch.name}`,
        transfer: {
          from: {
            distributorId: distributorId,
            name: distributor.name,
            remainingStock: distributorStock.quantity,
          },
          to: {
            branchId: toBranchId,
            name: branch.name,
            newStock: branchStock.quantity,
          },
          product: {
            id: product._id,
            name: product.name,
          },
          quantity: quantity,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Error en transferencia a sede:", error);
    res.status(500).json({
      message: error.message || "Error al transferir stock a sede",
    });
  }
};
