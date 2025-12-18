import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { invalidateCache } from "../middleware/cache.middleware.js";
import DistributorStock from "../models/DistributorStock.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import User from "../models/User.js";

// @desc    Crear distribuidor
// @route   POST /api/distributors
// @access  Private/Admin
export const createDistributor = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    // Verificar si el email ya existe
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "El email ya está registrado" });
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear distribuidor
    const distributor = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      role: "distribuidor",
      active: true,
    });

    res.status(201).json({
      _id: distributor._id,
      name: distributor.name,
      email: distributor.email,
      phone: distributor.phone,
      address: distributor.address,
      role: distributor.role,
      active: distributor.active,
    });

    await invalidateCache("cache:distributors:*");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener todos los distribuidores
// @route   GET /api/distributors
// @access  Private/Admin
export const getDistributors = async (req, res) => {
  try {
    const { active, page = 1, limit = 20 } = req.query;

    const filter = { role: "distribuidor" };
    if (active !== undefined) {
      filter.active = active === "true";
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [distributors, total] = await Promise.all([
      User.find(filter)
        // No necesitamos populate aquí; la UI usa solo stats + datos básicos.
        .select("name email phone address role active assignedProducts")
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    const distributorIds = distributors.map((d) => d._id);

    const objectIds = distributorIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    const [stockAgg, salesAgg] = await Promise.all([
      DistributorStock.aggregate([
        { $match: { distributor: { $in: objectIds } } },
        { $group: { _id: "$distributor", totalStock: { $sum: "$quantity" } } },
      ]),
      Sale.aggregate([
        { $match: { distributor: { $in: objectIds } } },
        {
          $group: {
            _id: "$distributor",
            totalSales: { $sum: 1 },
            totalProfit: { $sum: "$distributorProfit" },
          },
        },
      ]),
    ]);

    const stockByDistributor = new Map(
      stockAgg.map((s) => [String(s._id), Number(s.totalStock) || 0])
    );
    const salesByDistributor = new Map(
      salesAgg.map((s) => [
        String(s._id),
        {
          totalSales: Number(s.totalSales) || 0,
          totalProfit: Number(s.totalProfit) || 0,
        },
      ])
    );

    const distributorsWithStats = distributors.map((distributor) => {
      const salesStats = salesByDistributor.get(String(distributor._id)) || {
        totalSales: 0,
        totalProfit: 0,
      };

      return {
        ...distributor,
        stats: {
          totalStock: stockByDistributor.get(String(distributor._id)) || 0,
          totalSales: salesStats.totalSales,
          totalProfit: salesStats.totalProfit,
          assignedProductsCount: distributor.assignedProducts?.length || 0,
        },
      };
    });

    res.json({
      data: distributorsWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener un distribuidor por ID
// @route   GET /api/distributors/:id
// @access  Private/Admin
export const getDistributorById = async (req, res) => {
  try {
    const distributor = await User.findById(req.params.id)
      .select("-password")
      .populate(
        "assignedProducts",
        "name image purchasePrice distributorPrice"
      );

    if (!distributor || distributor.role !== "distribuidor") {
      return res.status(404).json({ message: "Distribuidor no encontrado" });
    }

    // Stock del distribuidor
    const stock = await DistributorStock.find({
      distributor: distributor._id,
    }).populate("product", "name image");

    // Ventas del distribuidor
    const sales = await Sale.find({ distributor: distributor._id })
      .populate("product", "name")
      .sort({ saleDate: -1 })
      .limit(10);

    // Estadísticas
    const allSales = await Sale.find({ distributor: distributor._id });
    const totalSales = allSales.length;
    const totalProfit = allSales.reduce(
      (sum, sale) => sum + sale.distributorProfit,
      0
    );
    const totalRevenue = allSales.reduce(
      (sum, sale) => sum + sale.salePrice * sale.quantity,
      0
    );

    res.json({
      distributor,
      stock,
      recentSales: sales,
      stats: {
        totalSales,
        totalProfit,
        totalRevenue,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Actualizar distribuidor
// @route   PUT /api/distributors/:id
// @access  Private/Admin
export const updateDistributor = async (req, res) => {
  try {
    const { name, email, phone, address, active } = req.body;

    const distributor = await User.findById(req.params.id);

    if (!distributor || distributor.role !== "distribuidor") {
      return res.status(404).json({ message: "Distribuidor no encontrado" });
    }

    // Verificar email único si se está cambiando
    if (email && email !== distributor.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: "El email ya está en uso" });
      }
      distributor.email = email;
    }

    if (name) distributor.name = name;
    if (phone !== undefined) distributor.phone = phone;
    if (address !== undefined) distributor.address = address;
    if (active !== undefined) distributor.active = active;

    await distributor.save();

    res.json({
      _id: distributor._id,
      name: distributor.name,
      email: distributor.email,
      phone: distributor.phone,
      address: distributor.address,
      role: distributor.role,
      active: distributor.active,
    });

    await invalidateCache("cache:distributors:*");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Eliminar distribuidor
// @route   DELETE /api/distributors/:id
// @access  Private/Admin
export const deleteDistributor = async (req, res) => {
  try {
    const distributor = await User.findById(req.params.id);

    if (!distributor || distributor.role !== "distribuidor") {
      return res.status(404).json({ message: "Distribuidor no encontrado" });
    }

    // Buscar todo el stock del distribuidor
    const distributorStocks = await DistributorStock.find({
      distributor: distributor._id,
    });

    let returnedProducts = 0;
    let totalQuantityReturned = 0;

    // Devolver el inventario al stock de bodega
    for (const stock of distributorStocks) {
      if (stock.quantity > 0) {
        const product = await Product.findById(stock.product);

        if (product) {
          // Devolver al stock de bodega
          product.warehouseStock += stock.quantity;
          product.totalStock += stock.quantity;
          await product.save();

          returnedProducts++;
          totalQuantityReturned += stock.quantity;
        }
      }

      // Eliminar el registro de stock del distribuidor
      await stock.deleteOne();
    }

    // Eliminar el distribuidor
    await distributor.deleteOne();

    res.json({
      message: "Distribuidor eliminado correctamente",
      inventoryReturned: {
        products: returnedProducts,
        totalQuantity: totalQuantityReturned,
      },
    });

    await invalidateCache("cache:distributors:*");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Activar/Desactivar distribuidor
// @route   PATCH /api/distributors/:id/toggle-active
// @access  Private/Admin
export const toggleDistributorActive = async (req, res) => {
  try {
    const distributor = await User.findById(req.params.id);

    if (!distributor || distributor.role !== "distribuidor") {
      return res.status(404).json({ message: "Distribuidor no encontrado" });
    }

    distributor.active = !distributor.active;
    await distributor.save();

    res.json({
      message: `Distribuidor ${
        distributor.active ? "activado" : "desactivado"
      } correctamente`,
      active: distributor.active,
    });

    await invalidateCache("cache:distributors:*");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
