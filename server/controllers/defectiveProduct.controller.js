import DefectiveProduct from "../models/DefectiveProduct.js";
import DistributorStock from "../models/DistributorStock.js";
import Product from "../models/Product.js";

// @desc    Reportar producto defectuoso (admin desde bodega)
// @route   POST /api/defective-products/admin
// @access  Private/Admin
export const reportDefectiveProductAdmin = async (req, res) => {
  try {
    const { productId, quantity, reason, images } = req.body;

    // Verificar que el producto exista y tenga stock en bodega
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    if (product.warehouseStock < quantity) {
      return res.status(400).json({
        message: `Stock insuficiente en bodega. Disponible: ${product.warehouseStock}`,
      });
    }

    // Crear el reporte sin distribuidor (es del admin/bodega)
    const defectiveReport = await DefectiveProduct.create({
      distributor: null, // Admin no tiene distribuidor asociado
      product: productId,
      quantity,
      reason,
      images: images || [],
      status: "confirmado", // Los reportes del admin se autoconfirman
      confirmedAt: Date.now(),
      confirmedBy: req.user._id,
      adminNotes: "Reporte directo de administrador desde bodega",
    });

    // Descontar del stock de bodega
    product.warehouseStock -= quantity;
    await product.save();

    const populatedReport = await DefectiveProduct.findById(defectiveReport._id)
      .populate("product", "name image")
      .populate("confirmedBy", "name email");

    res.status(201).json({
      message: "Producto defectuoso reportado desde bodega",
      report: populatedReport,
      remainingStock: product.warehouseStock,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reportar producto defectuoso (distribuidor)
// @route   POST /api/defective-products
// @access  Private/Distribuidor
export const reportDefectiveProduct = async (req, res) => {
  try {
    const { productId, quantity, reason, images } = req.body;
    const distributorId = req.user.id;

    // Verificar que el distribuidor tenga el producto
    const distributorStock = await DistributorStock.findOne({
      distributor: distributorId,
      product: productId,
    });

    if (!distributorStock) {
      return res
        .status(400)
        .json({ message: "No tienes este producto asignado" });
    }

    if (distributorStock.quantity < quantity) {
      return res.status(400).json({
        message: `Stock insuficiente. Disponible: ${distributorStock.quantity}`,
      });
    }

    // Crear el reporte
    const defectiveReport = await DefectiveProduct.create({
      distributor: distributorId,
      product: productId,
      quantity,
      reason,
      images: images || [],
    });

    // Descontar del stock del distribuidor
    distributorStock.quantity -= quantity;
    await distributorStock.save();

    const populatedReport = await DefectiveProduct.findById(defectiveReport._id)
      .populate("product", "name image")
      .populate("distributor", "name email");

    res.status(201).json({
      message: "Reporte de producto defectuoso registrado",
      report: populatedReport,
      remainingStock: distributorStock.quantity,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener reportes de defectuosos de un distribuidor
// @route   GET /api/defective-products/distributor/:distributorId?
// @access  Private
export const getDistributorDefectiveReports = async (req, res) => {
  try {
    let distributorId = req.params.distributorId;

    // Si es "me", usar el ID del usuario autenticado
    if (distributorId === "me" || !distributorId) {
      distributorId = req.user._id;
    }

    // Verificar permisos
    if (
      req.user.role !== "admin" &&
      req.user._id.toString() !== distributorId.toString()
    ) {
      return res.status(403).json({
        message: "No puedes ver reportes de otros distribuidores",
      });
    }

    const { status } = req.query;
    const filter = { distributor: distributorId };

    if (status) filter.status = status;

    const reports = await DefectiveProduct.find(filter)
      .populate("product", "name image")
      .populate("distributor", "name email")
      .populate("confirmedBy", "name email")
      .sort({ reportDate: -1 });

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener todos los reportes de defectuosos
// @route   GET /api/defective-products
// @access  Private/Admin
export const getAllDefectiveReports = async (req, res) => {
  try {
    const { status, distributorId, productId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (distributorId) filter.distributor = distributorId;
    if (productId) filter.product = productId;

    const reports = await DefectiveProduct.find(filter)
      .populate("product", "name image")
      .populate("distributor", "name email")
      .populate("confirmedBy", "name email")
      .sort({ reportDate: -1 });

    // Calcular estadísticas
    const stats = {
      total: reports.length,
      pendiente: reports.filter((r) => r.status === "pendiente").length,
      confirmado: reports.filter((r) => r.status === "confirmado").length,
      rechazado: reports.filter((r) => r.status === "rechazado").length,
      totalQuantity: reports.reduce((sum, r) => sum + r.quantity, 0),
    };

    res.json({ reports, stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Confirmar recepción de producto defectuoso
// @route   PUT /api/defective-products/:id/confirm
// @access  Private/Admin
export const confirmDefectiveProduct = async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const report = await DefectiveProduct.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Reporte no encontrado" });
    }

    if (report.status === "confirmado") {
      return res
        .status(400)
        .json({ message: "Este reporte ya está confirmado" });
    }

    if (report.status === "rechazado") {
      return res
        .status(400)
        .json({ message: "Este reporte fue rechazado anteriormente" });
    }

    report.status = "confirmado";
    report.confirmedAt = Date.now();
    report.confirmedBy = req.user._id;
    if (adminNotes) report.adminNotes = adminNotes;

    await report.save();

    const populatedReport = await DefectiveProduct.findById(report._id)
      .populate("product", "name image")
      .populate("distributor", "name email")
      .populate("confirmedBy", "name email");

    res.json({
      message: "Recepción del producto defectuoso confirmada",
      report: populatedReport,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Rechazar reporte de producto defectuoso
// @route   PUT /api/defective-products/:id/reject
// @access  Private/Admin
export const rejectDefectiveProduct = async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const report = await DefectiveProduct.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Reporte no encontrado" });
    }

    if (report.status === "confirmado") {
      return res
        .status(400)
        .json({ message: "No se puede rechazar un reporte confirmado" });
    }

    if (report.status === "rechazado") {
      return res.status(400).json({ message: "Este reporte ya está rechazado" });
    }

    // Devolver el stock al distribuidor
    const distributorStock = await DistributorStock.findOne({
      distributor: report.distributor,
      product: report.product,
    });

    if (distributorStock) {
      distributorStock.quantity += report.quantity;
      await distributorStock.save();
    }

    report.status = "rechazado";
    report.confirmedAt = Date.now();
    report.confirmedBy = req.user._id;
    if (adminNotes) report.adminNotes = adminNotes;

    await report.save();

    const populatedReport = await DefectiveProduct.findById(report._id)
      .populate("product", "name image")
      .populate("distributor", "name email")
      .populate("confirmedBy", "name email");

    res.json({
      message: "Reporte rechazado. Stock devuelto al distribuidor",
      report: populatedReport,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
