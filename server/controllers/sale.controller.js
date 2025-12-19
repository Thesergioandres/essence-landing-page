import { invalidateCache } from "../middleware/cache.middleware.js";
import DistributorStock from "../models/DistributorStock.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import { recordSaleProfit } from "../services/profitHistory.service.js";
import { getDistributorCommissionInfo } from "../utils/distributorPricing.js";

// @desc    Eliminar una venta (admin)
// @route   DELETE /api/sales/:id
// @access  Private/Admin
export const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    // Si la venta pertenece a un distribuidor, restaurar su stock
    if (sale.distributor) {
      await DistributorStock.findOneAndUpdate(
        { distributor: sale.distributor, product: sale.product },
        { $inc: { quantity: sale.quantity } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Restaurar stock del producto
    const product = await Product.findById(sale.product);
    if (product) {
      product.totalStock += sale.quantity;
      await product.save();
    }

    // Invalidar caché (si está activo)
    await invalidateCache("cache:analytics:*");
    await invalidateCache("cache:gamification:*");
    await invalidateCache("cache:sales:*");
    await invalidateCache("cache:distributors:*");
    await invalidateCache("cache:businessAssistant:*");

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
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59
    );

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
        const daysInCurrentMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0
        ).getDate();
        const dayToUse = Math.min(saleDay, daysInCurrentMonth);

        sale.saleDate = new Date(now.getFullYear(), now.getMonth(), dayToUse);
        needsUpdate = true;
        datesUpdated++;
      }

      // Recalcular ganancias (el pre-save hook lo hará automáticamente)
      if (
        needsUpdate ||
        sale.distributorProfit !== 0 ||
        sale.totalProfit !== sale.adminProfit
      ) {
        await sale.save(); // Esto ejecuta el pre-save hook que recalcula ganancias
        updated++;
      }
    }

    // Obtener resumen actualizado
    const confirmedSales = await Sale.find({
      distributor: null,
      paymentStatus: "confirmado",
      saleDate: { $gte: startOfMonth },
    });
    const pendingSales = await Sale.find({
      distributor: null,
      paymentStatus: "pendiente",
    });

    res.json({
      message: `✅ ${updated} ventas admin actualizadas`,
      totalAdminSales: adminSales.length,
      confirmed: confirmedSales.length,
      pending: pendingSales.length,
      updated: updated,
      datesUpdated: datesUpdated,
      note:
        datesUpdated > 0
          ? `Ganancias recalculadas y ${datesUpdated} ventas del mes anterior movidas al mes actual`
          : "Ganancias recalculadas correctamente",
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
  const reqId = Date.now() + Math.random();
  try {
    console.log(`[${reqId}] 📝 registerAdminSale START`);
    console.log(`[${reqId}] User:`, req.user);
    console.log(`[${reqId}] Body:`, req.body);

    const {
      productId,
      quantity,
      salePrice,
      notes,
      saleDate,
      paymentProof,
      paymentProofMimeType,
    } = req.body;

    if (!productId || !quantity || !salePrice) {
      console.warn(
        `[${reqId}] ❌ Campos faltantes - productId: ${productId}, quantity: ${quantity}, salePrice: ${salePrice}`
      );
      return res.status(400).json({
        message: "Campos obligatorios: productId, quantity, salePrice",
      });
    }

    // Validar producto
    console.log(`[${reqId}] 🔍 Buscando producto:`, productId);
    const product = await Product.findById(productId);
    if (!product) {
      console.warn(`[${reqId}] ❌ Producto no encontrado:`, productId);
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    console.log(`[${reqId}] ✅ Producto encontrado:`, product.name);

    // Validar stock general
    if (product.totalStock < quantity) {
      console.warn(
        `[${reqId}] ❌ Stock insuficiente. Disponible: ${product.totalStock}, solicitado: ${quantity}`
      );
      return res.status(400).json({
        message: `Stock insuficiente. Disponible: ${product.totalStock}`,
      });
    }

    // Crear la venta (sin distribuidor)
    console.log(`[${reqId}] 💾 Creando venta...`);
    const saleData = {
      distributor: null,
      product: productId,
      quantity,
      purchasePrice: product.purchasePrice,
      distributorPrice: product.distributorPrice,
      salePrice,
      notes,
      saleDate: saleDate || new Date(),
      paymentProof,
      paymentProofMimeType: paymentProof
        ? paymentProofMimeType || "image/jpeg"
        : undefined,
      paymentStatus: "confirmado", // Las ventas admin están confirmadas automáticamente
      paymentConfirmedAt: new Date(),
      paymentConfirmedBy: req.user?.id || req.user?.userId,
      commissionBonus: 0, // Admin no tiene bonus
      distributorProfitPercentage: 0, // Admin no tiene porcentaje de ganancia
    };
    console.log(`[${reqId}] Sale data:`, saleData);

    const sale = await Sale.create(saleData);
    console.log(`[${reqId}] ✅ Venta creada:`, sale._id);

    // Descontar del stock total del producto
    console.log(`[${reqId}] 📦 Actualizando stock...`);
    product.totalStock -= quantity;
    await product.save();
    console.log(
      `[${reqId}] ✅ Stock actualizado. Nuevo stock:`,
      product.totalStock
    );

    console.log(`[${reqId}] 🔄 Obteniendo venta con populate...`);
    const populatedSale = await Sale.findById(sale._id).populate(
      "product",
      "name image"
    );
    console.log(`[${reqId}] ✅ Venta obtenida`);

    // Registrar en historial de ganancias (no bloquear si falla)
    try {
      console.log(`[${reqId}] 📊 Registrando ganancia...`);
      await recordSaleProfit(sale._id);
      console.log(`[${reqId}] ✅ Ganancia registrada`);
    } catch (historyError) {
      console.error(
        `[${reqId}] ⚠️ Error registrando historial de ganancias:`,
        historyError?.message
      );
      // Continuar sin bloquear la venta
    }

    console.log(`[${reqId}] ✅ registerAdminSale SUCCESS`);
    res.status(201).json({
      message: "Venta registrada exitosamente (admin)",
      sale: populatedSale,
      remainingStock: product.totalStock,
    });
  } catch (error) {
    console.error(`[${reqId}] ❌ FATAL ERROR:`, error?.message);
    console.error(`[${reqId}] Stack:`, error?.stack);
    res.status(500).json({
      message: error?.message || "Error interno al registrar venta",
      requestId: reqId,
      stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
    });
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

    // Validar que el producto tenga los campos necesarios
    if (!product.purchasePrice || !product.distributorPrice) {
      return res.status(400).json({
        message:
          "El producto no tiene configurados todos los precios necesarios",
        details: {
          purchasePrice: product.purchasePrice || "No configurado",
          distributorPrice: product.distributorPrice || "No configurado",
        },
      });
    }

    // Obtener el bonus/porcentaje del distribuidor según el ranking (misma lógica que usa el frontend)
    const commissionInfo = await getDistributorCommissionInfo(distributorId);
    const commissionBonus = commissionInfo.bonusCommission;
    const distributorProfitPercentage = commissionInfo.profitPercentage;

    // Generar saleId manualmente por seguridad
    const year = new Date().getFullYear();
    const saleCount = await Sale.countDocuments({
      saleId: { $regex: `^VTA-${year}-` },
    });
    const sequentialNumber = String(saleCount + 1).padStart(4, "0");
    const saleId = `VTA-${year}-${sequentialNumber}`;

    // Crear la venta
    const saleData = {
      saleId,
      distributor: distributorId,
      product: productId,
      quantity,
      purchasePrice: product.purchasePrice,
      distributorPrice: product.distributorPrice,
      salePrice,
      notes,
      commissionBonus,
      distributorProfitPercentage,
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
    await invalidateCache("cache:analytics:*");
    await invalidateCache("cache:gamification:*");
    await invalidateCache("cache:sales:*");
    await invalidateCache("cache:distributors:*");
    await invalidateCache("cache:businessAssistant:*");

    // Registrar en historial de ganancias (no bloquear si falla)
    try {
      await recordSaleProfit(sale._id);
    } catch (historyError) {
      console.error("Error registrando historial de ganancias:", historyError);
      // Continuar sin bloquear la venta
    }

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
    const {
      startDate,
      endDate,
      distributorId,
      productId,
      paymentStatus,
      sortBy,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) {
        filter.saleDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.saleDate.$lte = new Date(endDate);
      }
    }

    if (distributorId) filter.distributor = distributorId;
    if (productId) filter.product = productId;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // Determinar ordenamiento
    let sortOption = { saleDate: -1 }; // default: más reciente primero
    if (sortBy === "date-asc") {
      sortOption = { saleDate: 1 };
    } else if (sortBy === "distributor") {
      sortOption = { "distributor.name": 1 };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [sales, total] = await Promise.all([
      Sale.find(filter)
        .populate("product", "name image")
        .populate("distributor", "name email")
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Sale.countDocuments(filter),
    ]);

    // Calcular estadísticas
    const statsAgg = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalDistributorProfit: { $sum: "$distributorProfit" },
          totalAdminProfit: { $sum: "$adminProfit" },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          confirmedSales: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "confirmado"] }, 1, 0] },
          },
          pendingSales: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "pendiente"] }, 1, 0] },
          },
          totalProfit: {
            $sum: { $add: ["$distributorProfit", "$adminProfit"] },
          },
        },
      },
    ]);

    const stats = statsAgg[0] || {
      totalSales: 0,
      totalQuantity: 0,
      totalDistributorProfit: 0,
      totalAdminProfit: 0,
      totalRevenue: 0,
      confirmedSales: 0,
      pendingSales: 0,
      totalProfit: 0,
    };

    res.json({
      sales,
      stats,
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
      // PUT idempotente: si ya está confirmado, responder 200
      const populatedSale = await Sale.findById(sale._id)
        .populate("product", "name image")
        .populate("distributor", "name email")
        .populate("paymentConfirmedBy", "name email");

      await invalidateCache("cache:analytics:*");
      await invalidateCache("cache:gamification:*");
      await invalidateCache("cache:sales:*");
      await invalidateCache("cache:distributors:*");
      await invalidateCache("cache:businessAssistant:*");

      return res.json({
        message: "El pago ya estaba confirmado",
        sale: populatedSale,
      });
    }

    sale.paymentStatus = "confirmado";
    sale.paymentConfirmedAt = Date.now();
    sale.paymentConfirmedBy = req.user._id;

    await sale.save();

    // Invalidar caché (si está activo)
    await invalidateCache("cache:analytics:*");
    await invalidateCache("cache:gamification:*");
    await invalidateCache("cache:sales:*");
    await invalidateCache("cache:distributors:*");
    await invalidateCache("cache:businessAssistant:*");

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
