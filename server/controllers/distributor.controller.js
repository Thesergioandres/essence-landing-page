import bcrypt from "bcryptjs";
import DistributorStock from "../models/DistributorStock.js";
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
        .select("-password")
        .populate("assignedProducts", "name image")
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter)
    ]);

    // Agregar estadísticas de cada distribuidor
    const distributorsWithStats = await Promise.all(
      distributors.map(async (distributor) => {
        // Stock total del distribuidor
        const stock = await DistributorStock.find({
          distributor: distributor._id,
        }).lean();
        const totalStock = stock.reduce((sum, item) => sum + item.quantity, 0);

        // Ventas totales
        const sales = await Sale.find({ distributor: distributor._id }).lean();
        const totalSales = sales.length;
        const totalProfit = sales.reduce(
          (sum, sale) => sum + sale.distributorProfit,
          0
        );

        return {
          ...distributor,
          stats: {
            totalStock,
            totalSales,
            totalProfit,
            assignedProductsCount: distributor.assignedProducts?.length || 0,
          },
        };
      })
    );

    res.json({
      data: distributorsWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum)
      }
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
      .populate("assignedProducts", "name image purchasePrice distributorPrice");

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

    // Verificar si tiene stock asignado
    const hasStock = await DistributorStock.findOne({
      distributor: distributor._id,
      quantity: { $gt: 0 },
    });

    if (hasStock) {
      return res.status(400).json({
        message:
          "No se puede eliminar un distribuidor con stock asignado. Retira el stock primero.",
      });
    }

    await distributor.deleteOne();

    res.json({ message: "Distribuidor eliminado correctamente" });
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
      message: `Distribuidor ${distributor.active ? "activado" : "desactivado"} correctamente`,
      active: distributor.active,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
