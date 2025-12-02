// @desc    Eliminar una venta (admin)
// @route   DELETE /api/sales/:id
// @access  Private/Admin
export const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    // Restaurar stock del producto
    const product = await Product.findById(sale.product);
    if (product) {
      product.totalStock += sale.quantity;
      await product.save();
    }

    // Eliminar la venta
    await sale.deleteOne();

    res.json({ message: "Venta eliminada y stock restaurado" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Actualizar ventas admin pendientes a confirmadas (temporal)
// @route   POST /api/sales/fix-admin-sales
// @access  Private/Admin
export const fixAdminSales = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    
    // Obtener todas las ventas admin
    const adminSales = await Sale.find({ distributor: null });
    
    let updated = 0;
    let datesUpdated = 0;
    
    // Actualizar cada venta para recalcular ganancias
    for (const sale of adminSales) {
      let needsUpdate = false;
      
      // Actualizar estado de pago si está pendiente
      if (sale.paymentStatus === "pendiente") {
        sale.paymentStatus = "confirmado";
        sale.paymentConfirmedAt = new Date();
        sale.paymentConfirmedBy = req.user.id;
        needsUpdate = true;
      }
      
      // Solo actualizar fechas si la venta es del mes anterior inmediato
      // NO tocar ventas de meses más antiguos (histórico)
      const saleDate = new Date(sale.saleDate);
      if (saleDate >= startOfLastMonth && saleDate <= endOfLastMonth) {
        // La venta es del mes anterior, moverla al mes actual
        const saleDay = saleDate.getDate();
        const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dayToUse = Math.min(saleDay, daysInCurrentMonth);
        
        sale.saleDate = new Date(now.getFullYear(), now.getMonth(), dayToUse);
        needsUpdate = true;
        datesUpdated++;
      }
      
      // Recalcular ganancias (el pre-save hook lo hará automáticamente)
      if (needsUpdate || sale.distributorProfit !== 0 || sale.totalProfit !== sale.adminProfit) {
        await sale.save(); // Esto ejecuta el pre-save hook que recalcula ganancias
        updated++;
      }
    }

    // Obtener resumen actualizado
    const confirmedSales = await Sale.find({ 
      distributor: null, 
      paymentStatus: "confirmado",
      saleDate: { $gte: startOfMonth }
    });
    const pendingSales = await Sale.find({ distributor: null, paymentStatus: "pendiente" });

    res.json({
      message: `✅ ${updated} ventas admin actualizadas`,
      totalAdminSales: adminSales.length,
      confirmed: confirmedSales.length,
      pending: pendingSales.length,
      updated: updated,
      datesUpdated: datesUpdated,
      note: datesUpdated > 0 
        ? `Ganancias recalculadas y ${datesUpdated} ventas del mes anterior movidas al mes actual` 
        : "Ganancias recalculadas correctamente"
    });
  } catch (error) {
    console.error("Error en fixAdminSales:", error);
    res.status(500).json({ message: error.message });
  }
};
// @desc    Registrar una venta como administrador (stock general)
// @route   POST /api/sales/admin
// @access  Private/Admin
export const registerAdminSale = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      salePrice,
      notes,
      saleDate,
      paymentProof,
      paymentProofMimeType,
    } = req.body;

    // Validar producto
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    // Validar stock general
    if (product.totalStock < quantity) {
      return res.status(400).json({ message: `Stock insuficiente. Disponible: ${product.totalStock}` });
    }

    // Crear la venta (sin distribuidor)
    const saleData = {
      distributor: null,
      product: productId,
      quantity,
      purchasePrice: product.purchasePrice,
      distributorPrice: product.distributorPrice,
      salePrice,
      notes,
      saleDate,
      paymentProof,
      paymentProofMimeType: paymentProof ? (paymentProofMimeType || "image/jpeg") : undefined,
      paymentStatus: "confirmado", // Las ventas admin están confirmadas automáticamente
      paymentConfirmedAt: new Date(),
      paymentConfirmedBy: req.user.id,
    };

    const sale = await Sale.create(saleData);

    // Descontar del stock total del producto
    product.totalStock -= quantity;
    await product.save();

    const populatedSale = await Sale.findById(sale._id)
      .populate("product", "name image");

    res.status(201).json({
      message: "Venta registrada exitosamente (admin)",
      sale: populatedSale,
      remainingStock: product.totalStock,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
import DistributorStock from "../models/DistributorStock.js";
import GamificationConfig from "../models/GamificationConfig.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import { invalidateCache } from "../middleware/cache.middleware.js";

// Función auxiliar para obtener bonus de comisión por ranking
const getCommissionBonus = async (distributorId) => {
  try {
    const config = await GamificationConfig.findOne();
    if (!config) return 0;

    const now = new Date();
    let startDate = config.currentPeriodStart || now;
    let endDate = new Date(startDate);

    if (config.evaluationPeriod === "biweekly") {
      endDate.setDate(endDate.getDate() + 15);
    } else if (config.evaluationPeriod === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (config.evaluationPeriod === "weekly") {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    }

    const rankings = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startDate, $lte: endDate },
          paymentStatus: "confirmado",
        },
      },
      {
        $group: {
          _id: "$distributor",
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    const position =
      rankings.findIndex((r) => r._id.toString() === distributorId.toString()) +
      1;

    if (position === 1) return config.top1CommissionBonus || 0;
    if (position === 2) return config.top2CommissionBonus || 0;
    if (position === 3) return config.top3CommissionBonus || 0;

    return 0;
  } catch (error) {
    console.error("Error calculando bonus de comisión:", error);
    return 0;
  }
};

// @desc    Registrar una venta (distribuidor)
// @route   POST /api/sales
// @access  Private/Distribuidor
export const registerSale = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      salePrice,
      notes,
      paymentProof,
      paymentProofMimeType,
    } = req.body;
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

    // Obtener precios del producto
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    // Obtener bonus de comisión por ranking
    const commissionBonus = await getCommissionBonus(distributorId);

    // Crear la venta
    const saleData = {
      distributor: distributorId,
      product: productId,
      quantity,
      purchasePrice: product.purchasePrice,
      distributorPrice: product.distributorPrice,
      salePrice,
      notes,
      commissionBonus,
    };

    // Agregar comprobante de pago si se proporcionó
    if (paymentProof) {
      saleData.paymentProof = paymentProof;
      saleData.paymentProofMimeType = paymentProofMimeType || "image/jpeg";
    }

    const sale = await Sale.create(saleData);

    // Descontar del stock del distribuidor
    distributorStock.quantity -= quantity;
    await distributorStock.save();

    // Descontar del stock total del producto
    product.totalStock -= quantity;
    await product.save();

    const populatedSale = await Sale.findById(sale._id)
      .populate("product", "name image")
      .populate("distributor", "name email");

    // Invalidar caché de analytics y gamificación
    await invalidateCache('cache:analytics:*');
    await invalidateCache('cache:gamification:*');

    res.status(201).json({
      message: "Venta registrada exitosamente",
      sale: populatedSale,
      remainingStock: distributorStock.quantity,
      commissionBonus: commissionBonus > 0 ? `+${commissionBonus}%` : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener ventas de un distribuidor
// @route   GET /api/sales/distributor/:distributorId?
// @access  Private
export const getDistributorSales = async (req, res) => {
  try {
    const distributorId = req.params.distributorId || req.user.id;

    // Si no es admin y está consultando otro distribuidor, denegar
    if (req.user.role !== "admin" && distributorId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "No puedes ver ventas de otros distribuidores" });
    }

    const { startDate, endDate, productId } = req.query;

    const filter = { distributor: distributorId };

    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    if (productId) filter.product = productId;

    const sales = await Sale.find(filter)
      .populate("product", "name image")
      .populate("distributor", "name email")
      .sort({ saleDate: -1 });

    // Calcular totales
    const totalSales = sales.length;
    const totalQuantity = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const totalDistributorProfit = sales.reduce(
      (sum, sale) => sum + sale.distributorProfit,
      0
    );
    const totalAdminProfit = sales.reduce(
      (sum, sale) => sum + sale.adminProfit,
      0
    );
    const totalRevenue = sales.reduce(
      (sum, sale) => sum + sale.salePrice * sale.quantity,
      0
    );

    res.json({
      sales,
      stats: {
        totalSales,
        totalQuantity,
        totalDistributorProfit,
        totalAdminProfit,
        totalRevenue,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener todas las ventas
// @route   GET /api/sales
// @access  Private/Admin
export const getAllSales = async (req, res) => {
  try {
    const { startDate, endDate, distributorId, productId, page = 1, limit = 50 } = req.query;

    const filter = {};

    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    if (distributorId) filter.distributor = distributorId;
    if (productId) filter.product = productId;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [sales, total] = await Promise.all([
      Sale.find(filter)
        .populate("product", "name image")
        .populate("distributor", "name email")
        .sort({ saleDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Sale.countDocuments(filter)
    ]);

    // Calcular totales usando agregación (más eficiente)
    const stats = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalDistributorProfit: { $sum: "$distributorProfit" },
          totalAdminProfit: { $sum: "$adminProfit" },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } }
        }
      }
    ]);

    const summary = stats[0] || {
      totalSales: 0,
      totalQuantity: 0,
      totalDistributorProfit: 0,
      totalAdminProfit: 0,
      totalRevenue: 0
    };

    res.json({
      sales,
      stats: summary,
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

// @desc    Obtener reporte de ventas por producto
// @route   GET /api/sales/report/by-product
// @access  Private/Admin
export const getSalesByProduct = async (req, res) => {
  try {
    const salesByProduct = await Sale.aggregate([
      {
        $group: {
          _id: "$product",
          totalQuantity: { $sum: "$quantity" },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalAdminProfit: { $sum: "$adminProfit" },
          totalDistributorProfit: { $sum: "$distributorProfit" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          productName: "$product.name",
          productImage: "$product.image",
          totalQuantity: 1,
          totalSales: 1,
          totalRevenue: 1,
          totalAdminProfit: 1,
          totalDistributorProfit: 1,
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    res.json(salesByProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener reporte de ventas por distribuidor
// @route   GET /api/sales/report/by-distributor
// @access  Private/Admin
export const getSalesByDistributor = async (req, res) => {
  try {
    const salesByDistributor = await Sale.aggregate([
      {
        $group: {
          _id: "$distributor",
          totalQuantity: { $sum: "$quantity" },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalAdminProfit: { $sum: "$adminProfit" },
          totalDistributorProfit: { $sum: "$distributorProfit" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "distributor",
        },
      },
      { $unwind: "$distributor" },
      {
        $project: {
          distributorName: "$distributor.name",
          distributorEmail: "$distributor.email",
          totalQuantity: 1,
          totalSales: 1,
          totalRevenue: 1,
          totalAdminProfit: 1,
          totalDistributorProfit: 1,
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    res.json(salesByDistributor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Confirmar pago de una venta
// @route   PUT /api/sales/:id/confirm-payment
// @access  Private/Admin
export const confirmPayment = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    if (sale.paymentStatus === "confirmado") {
      return res.status(400).json({ message: "El pago ya está confirmado" });
    }

    sale.paymentStatus = "confirmado";
    sale.paymentConfirmedAt = Date.now();
    sale.paymentConfirmedBy = req.user._id;

    await sale.save();

    const populatedSale = await Sale.findById(sale._id)
      .populate("product", "name image")
      .populate("distributor", "name email")
      .populate("paymentConfirmedBy", "name email");

    res.json({
      message: "Pago confirmado exitosamente",
      sale: populatedSale,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
