import BranchStock from "../models/BranchStock.js";
import DefectiveProduct from "../models/DefectiveProduct.js";
import DistributorStock from "../models/DistributorStock.js";
import Product from "../models/Product.js";

// @desc    Reportar producto defectuoso (admin desde bodega)
// @route   POST /api/defective-products/admin
// @access  Private/Admin
export const reportDefectiveProductAdmin = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      reason,
      images,
      hasWarranty = false,
    } = req.body;
    const businessId = req.businessId;

    // Verificar que el producto exista y tenga stock en bodega
    const product = await Product.findOne({
      _id: productId,
      business: businessId,
    });

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    if (product.warehouseStock < quantity) {
      return res.status(400).json({
        message: `Stock insuficiente en bodega. Disponible: ${product.warehouseStock}`,
      });
    }

    // Calcular pérdida si no tiene garantía
    const lossAmount = hasWarranty
      ? 0
      : (product.purchasePrice || 0) * quantity;

    // Crear el reporte sin distribuidor (es del admin/bodega)
    const defectiveReport = await DefectiveProduct.create({
      distributor: null, // Admin no tiene distribuidor asociado
      product: productId,
      business: businessId,
      quantity,
      reason,
      images: images || [],
      hasWarranty,
      warrantyStatus: hasWarranty ? "pending" : "not_applicable",
      lossAmount,
      stockOrigin: "warehouse",
      status: "confirmado", // Los reportes del admin se autoconfirman
      confirmedAt: Date.now(),
      confirmedBy: req.user._id,
      adminNotes: hasWarranty
        ? "Reporte con garantía - pendiente reposición de stock"
        : "Reporte sin garantía - pérdida registrada",
    });

    // Descontar del stock de bodega y del stock total
    product.warehouseStock -= quantity;
    product.totalStock -= quantity;
    await product.save();

    const populatedReport = await DefectiveProduct.findById(defectiveReport._id)
      .populate("product", "name image purchasePrice")
      .populate("confirmedBy", "name email");

    res.status(201).json({
      message: hasWarranty
        ? "Producto defectuoso reportado. Pendiente reposición por garantía."
        : `Producto defectuoso reportado. Pérdida registrada: $${lossAmount.toLocaleString()}`,
      report: populatedReport,
      remainingStock: product.warehouseStock,
      lossAmount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reportar producto defectuoso (admin desde sede)
// @route   POST /api/defective-products/branch
// @access  Private/Admin
export const reportDefectiveProductBranch = async (req, res) => {
  try {
    const { branchId, productId, quantity, reason, images } = req.body;
    const businessId = req.businessId;

    if (!branchId) {
      return res.status(400).json({ message: "La sede es obligatoria" });
    }

    const branchStock = await BranchStock.findOne({
      branch: branchId,
      product: productId,
      business: businessId,
    });

    if (!branchStock) {
      return res
        .status(404)
        .json({ message: "El producto no existe en esta sede" });
    }

    if (branchStock.quantity < quantity) {
      return res.status(400).json({
        message: `Stock insuficiente en la sede. Disponible: ${branchStock.quantity}`,
      });
    }

    const defectiveReport = await DefectiveProduct.create({
      distributor: null,
      branch: branchId,
      product: productId,
      business: businessId,
      quantity,
      reason,
      images: images || [],
      status: "confirmado",
      confirmedAt: Date.now(),
      confirmedBy: req.user._id,
      adminNotes: "Reporte directo desde sede",
    });

    branchStock.quantity -= quantity;
    await branchStock.save();

    // Descontar del stock total del producto
    const product = await Product.findById(productId);
    if (product) {
      product.totalStock -= quantity;
      await product.save();
    }

    const populatedReport = await DefectiveProduct.findById(defectiveReport._id)
      .populate("product", "name image")
      .populate("branch", "name")
      .populate("confirmedBy", "name email");

    res.status(201).json({
      message: "Producto defectuoso reportado desde sede",
      report: populatedReport,
      remainingStock: branchStock.quantity,
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
    const businessId = req.businessId;

    // Verificar que el distribuidor tenga el producto
    const distributorStock = await DistributorStock.findOne({
      distributor: distributorId,
      product: productId,
      business: businessId,
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
      business: businessId,
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
      distributorId = req.user.userId || req.user.id;
    }

    // Verificar permisos
    const currentUserId = req.user.userId || req.user.id;
    if (req.user.role !== "admin" && currentUserId !== distributorId) {
      return res.status(403).json({
        message: "No puedes ver reportes de otros distribuidores",
      });
    }

    const { status } = req.query;
    const filter = { distributor: distributorId, business: req.businessId };

    if (status) filter.status = status;

    const reports = await DefectiveProduct.find(filter)
      .populate("product", "name image")
      .populate("distributor", "name email")
      .populate("branch", "name")
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
    const filter = { business: req.businessId };

    if (status) filter.status = status;
    if (distributorId) filter.distributor = distributorId;
    if (productId) filter.product = productId;

    const reports = await DefectiveProduct.find(filter)
      .populate("product", "name image")
      .populate("distributor", "name email")
      .populate("branch", "name")
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
    const report = await DefectiveProduct.findOne({
      _id: req.params.id,
      business: req.businessId,
    });

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

    // Descontar del stock total del producto (el stock ya se descontó del distribuidor al crear el reporte)
    const product = await Product.findById(report.product);
    if (product) {
      product.totalStock -= report.quantity;
      await product.save();
    }

    const populatedReport = await DefectiveProduct.findById(report._id)
      .populate("product", "name image")
      .populate("distributor", "name email")
      .populate("branch", "name")
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
    const report = await DefectiveProduct.findOne({
      _id: req.params.id,
      business: req.businessId,
    });

    if (!report) {
      return res.status(404).json({ message: "Reporte no encontrado" });
    }

    if (report.status === "confirmado") {
      return res
        .status(400)
        .json({ message: "No se puede rechazar un reporte confirmado" });
    }

    if (report.status === "rechazado") {
      return res
        .status(400)
        .json({ message: "Este reporte ya está rechazado" });
    }

    // Devolver el stock al distribuidor
    const distributorStock = await DistributorStock.findOne({
      distributor: report.distributor,
      product: report.product,
      business: report.business,
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
      .populate("branch", "name")
      .populate("confirmedBy", "name email");

    res.json({
      message: "Reporte rechazado. Stock devuelto al distribuidor",
      report: populatedReport,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Aprobar garantía y reponer stock
// @route   PUT /api/defective-products/:id/approve-warranty
// @access  Private/Admin
export const approveWarranty = async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const report = await DefectiveProduct.findOne({
      _id: req.params.id,
      business: req.businessId,
    });

    if (!report) {
      return res.status(404).json({ message: "Reporte no encontrado" });
    }

    if (!report.hasWarranty) {
      return res
        .status(400)
        .json({ message: "Este reporte no tiene garantía" });
    }

    if (report.warrantyStatus === "approved") {
      return res.status(400).json({ message: "La garantía ya fue aprobada" });
    }

    if (report.stockRestored) {
      return res.status(400).json({ message: "El stock ya fue repuesto" });
    }

    // Reponer stock según el origen
    const product = await Product.findById(report.product);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    // Siempre reponer a bodega (el proveedor envía reposición)
    product.warehouseStock = (product.warehouseStock || 0) + report.quantity;
    product.totalStock = (product.totalStock || 0) + report.quantity;
    await product.save();

    // Actualizar reporte
    report.warrantyStatus = "approved";
    report.stockRestored = true;
    report.stockRestoredAt = new Date();
    report.lossAmount = 0; // Sin pérdida porque hay garantía
    if (adminNotes) report.adminNotes = adminNotes;
    await report.save();

    const populatedReport = await DefectiveProduct.findById(report._id)
      .populate("product", "name image")
      .populate("distributor", "name email")
      .populate("branch", "name")
      .populate("confirmedBy", "name email");

    res.json({
      message: `Garantía aprobada. ${report.quantity} unidades repuestas a bodega.`,
      report: populatedReport,
      newStock: {
        warehouseStock: product.warehouseStock,
        totalStock: product.totalStock,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Rechazar garantía (registrar como pérdida)
// @route   PUT /api/defective-products/:id/reject-warranty
// @access  Private/Admin
export const rejectWarranty = async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const report = await DefectiveProduct.findOne({
      _id: req.params.id,
      business: req.businessId,
    }).populate("product", "purchasePrice");

    if (!report) {
      return res.status(404).json({ message: "Reporte no encontrado" });
    }

    if (!report.hasWarranty) {
      return res
        .status(400)
        .json({ message: "Este reporte no tiene garantía" });
    }

    if (report.warrantyStatus === "rejected") {
      return res.status(400).json({ message: "La garantía ya fue rechazada" });
    }

    // Calcular pérdida
    const lossAmount = (report.product?.purchasePrice || 0) * report.quantity;

    report.warrantyStatus = "rejected";
    report.lossAmount = lossAmount;
    if (adminNotes) report.adminNotes = adminNotes;
    await report.save();

    const populatedReport = await DefectiveProduct.findById(report._id)
      .populate("product", "name image purchasePrice")
      .populate("distributor", "name email")
      .populate("branch", "name")
      .populate("confirmedBy", "name email");

    res.json({
      message: `Garantía rechazada. Pérdida registrada: $${lossAmount.toLocaleString()}`,
      report: populatedReport,
      lossAmount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Eliminar reporte y restaurar stock
// @route   DELETE /api/defective-products/:id
// @access  Private/Admin
export const deleteDefectiveReport = async (req, res) => {
  try {
    const report = await DefectiveProduct.findOne({
      _id: req.params.id,
      business: req.businessId,
    });

    if (!report) {
      return res.status(404).json({ message: "Reporte no encontrado" });
    }

    const product = await Product.findById(report.product);

    // Restaurar stock según el origen y estado
    if (report.status === "confirmado" && !report.stockRestored) {
      // Si está confirmado, el stock ya fue descontado del total
      // Solo restauramos si no hay garantía aprobada (porque eso ya restauró)
      if (product) {
        product.totalStock = (product.totalStock || 0) + report.quantity;

        // Restaurar al origen correcto
        if (
          report.stockOrigin === "warehouse" ||
          (!report.distributor && !report.branch)
        ) {
          product.warehouseStock =
            (product.warehouseStock || 0) + report.quantity;
        } else if (report.branch) {
          await BranchStock.findOneAndUpdate(
            {
              business: report.business,
              branch: report.branch,
              product: report.product,
            },
            { $inc: { quantity: report.quantity } },
            { upsert: true, new: true }
          );
        } else if (report.distributor) {
          await DistributorStock.findOneAndUpdate(
            {
              business: report.business,
              distributor: report.distributor,
              product: report.product,
            },
            { $inc: { quantity: report.quantity } },
            { upsert: true, new: true }
          );
        }

        await product.save();
      }
    } else if (report.status === "pendiente" && report.distributor) {
      // Si está pendiente y es de distribuidor, restaurar a distribuidor
      await DistributorStock.findOneAndUpdate(
        {
          business: report.business,
          distributor: report.distributor,
          product: report.product,
        },
        { $inc: { quantity: report.quantity } },
        { upsert: true, new: true }
      );
    }

    await report.deleteOne();

    res.json({
      message: "Reporte eliminado y stock restaurado",
      restoredQuantity: report.quantity,
      restoredTo: report.stockOrigin || "original",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener estadísticas de defectuosos
// @route   GET /api/defective-products/stats
// @access  Private/Admin
export const getDefectiveStats = async (req, res) => {
  try {
    const businessId = req.businessId;

    const stats = await DefectiveProduct.aggregate([
      { $match: { business: businessId } },
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalLoss: { $sum: "$lossAmount" },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "pendiente"] }, 1, 0] },
          },
          confirmedCount: {
            $sum: { $cond: [{ $eq: ["$status", "confirmado"] }, 1, 0] },
          },
          withWarranty: {
            $sum: { $cond: ["$hasWarranty", 1, 0] },
          },
          warrantyPending: {
            $sum: { $cond: [{ $eq: ["$warrantyStatus", "pending"] }, 1, 0] },
          },
          warrantyApproved: {
            $sum: { $cond: [{ $eq: ["$warrantyStatus", "approved"] }, 1, 0] },
          },
          stockRestored: {
            $sum: { $cond: ["$stockRestored", "$quantity", 0] },
          },
        },
      },
    ]);

    res.json({
      stats: stats[0] || {
        totalReports: 0,
        totalQuantity: 0,
        totalLoss: 0,
        pendingCount: 0,
        confirmedCount: 0,
        withWarranty: 0,
        warrantyPending: 0,
        warrantyApproved: 0,
        stockRestored: 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
