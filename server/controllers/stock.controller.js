import DistributorStock from "../models/DistributorStock.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

// @desc    Asignar stock a un distribuidor
// @route   POST /api/stock/assign
// @access  Private/Admin
export const assignStockToDistributor = async (req, res) => {
  try {
    const { distributorId, productId, quantity } = req.body;

    // Validar que sea distribuidor
    const distributor = await User.findById(distributorId);
    if (!distributor || distributor.role !== "distribuidor") {
      return res.status(400).json({ message: "Usuario no es distribuidor" });
    }

    // Verificar stock en bodega
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    if (product.warehouseStock < quantity) {
      return res.status(400).json({
        message: `Stock insuficiente en bodega. Disponible: ${product.warehouseStock}`,
      });
    }

    // Buscar o crear registro de stock del distribuidor
    let distributorStock = await DistributorStock.findOne({
      distributor: distributorId,
      product: productId,
    });

    if (distributorStock) {
      distributorStock.quantity += quantity;
      await distributorStock.save();
    } else {
      distributorStock = await DistributorStock.create({
        distributor: distributorId,
        product: productId,
        quantity,
      });
    }

    // Descontar de bodega
    product.warehouseStock -= quantity;
    await product.save();

    // Asignar producto al distribuidor si no lo tiene
    if (!distributor.assignedProducts.includes(productId)) {
      distributor.assignedProducts.push(productId);
      await distributor.save();
    }

    res.json({
      message: "Stock asignado correctamente",
      distributorStock: await distributorStock.populate([
        { path: "distributor", select: "name email" },
        { path: "product", select: "name" },
      ]),
      warehouseStock: product.warehouseStock,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Retirar stock de un distribuidor
// @route   POST /api/stock/withdraw
// @access  Private/Admin
export const withdrawStockFromDistributor = async (req, res) => {
  try {
    const { distributorId, productId, quantity } = req.body;

    const distributorStock = await DistributorStock.findOne({
      distributor: distributorId,
      product: productId,
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

    // Descontar del distribuidor
    distributorStock.quantity -= quantity;
    await distributorStock.save();

    // Devolver a bodega
    const product = await Product.findById(productId);
    product.warehouseStock += quantity;
    await product.save();

    res.json({
      message: "Stock retirado correctamente",
      distributorStock: await distributorStock.populate([
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
    let { distributorId } = req.params;

    // Si es "me", usar el ID del usuario autenticado
    if (distributorId === "me") {
      distributorId = req.user._id;
    }

    // Verificar permisos: admin puede ver cualquiera, distribuidor solo el suyo
    if (req.user.role !== "admin" && req.user._id.toString() !== distributorId.toString()) {
      return res.status(403).json({ 
        message: "No tienes permiso para ver este inventario" 
      });
    }

    const stock = await DistributorStock.find({
      distributor: distributorId,
    })
      .populate("product", "name image purchasePrice distributorPrice clientPrice")
      .populate("distributor", "name email");

    // Agregar alertas de stock bajo
    const stockWithAlerts = stock.map((item) => ({
      ...item.toObject(),
      isLowStock: item.quantity <= item.lowStockAlert,
    }));

    res.json(stockWithAlerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener todo el stock de todos los distribuidores
// @route   GET /api/stock/all
// @access  Private/Admin
export const getAllDistributorsStock = async (req, res) => {
  try {
    const stock = await DistributorStock.find()
      .populate("product", "name image warehouseStock totalStock")
      .populate("distributor", "name email active");

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
    // Productos con stock bajo en bodega
    const lowWarehouseStock = await Product.find({
      warehouseStock: { $lte: 10 },
    }).select("name warehouseStock lowStockAlert");

    // Distribuidores con stock bajo
    const lowDistributorStock = await DistributorStock.find()
      .populate("product", "name")
      .populate("distributor", "name email");

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
