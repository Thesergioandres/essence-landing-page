import mongoose from "mongoose";
import { invalidateCache } from "../middleware/cache.middleware.js";
import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import Credit from "../models/Credit.js";
import Customer from "../models/Customer.js";
import DeliveryMethod from "../models/DeliveryMethod.js";
import DistributorStock from "../models/DistributorStock.js";
import PaymentMethod from "../models/PaymentMethod.js";
import Product from "../models/Product.js";
import ProfitHistory from "../models/ProfitHistory.js";
import Sale from "../models/Sale.js";
import SpecialSale from "../models/SpecialSale.js";
import User from "../models/User.js";
import AuditService from "../services/audit.service.js";
import { accumulatePoints } from "../services/customerPoints.service.js";
import NotificationService from "../services/notification.service.js";
import {
  recalculateUserBalance,
  recordSaleProfit,
} from "../services/profitHistory.service.js";
import { getDistributorCommissionInfo } from "../utils/distributorPricing.js";

const resolveBusinessId = (req) =>
  req?.businessId || req?.headers?.["x-business-id"] || req?.query?.businessId;

const ensureBranch = async (businessId, branchId) => {
  if (!branchId) return null;
  const branch = await Branch.findOne({
    _id: branchId,
    business: businessId,
  });
  if (!branch) throw new Error("Sede inválida para este negocio");
  return branch;
};

const resolveCustomerForSale = async (businessId, customerId) => {
  if (!customerId) return { customerDoc: null, customerData: {} };
  const customer = await Customer.findOne({
    _id: customerId,
    business: businessId,
  });
  if (!customer) {
    const error = new Error("Cliente no encontrado");
    error.statusCode = 400;
    throw error;
  }

  return {
    customerDoc: customer,
    customerData: {
      customer: customer._id,
      customerSegment: customer.segment,
      customerSegments: Array.isArray(customer.segments)
        ? customer.segments
        : [],
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
    },
  };
};

const applyCustomerTotals = async ({
  customerId,
  businessId,
  amount,
  direction = 1,
  saleDate,
  saleId,
  requestId,
}) => {
  if (!customerId) return;
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return;

  const update = {
    $inc: {
      totalSpend: numericAmount * direction,
      ordersCount: direction,
    },
  };

  if (direction > 0) {
    update.$set = { lastPurchaseAt: saleDate || new Date() };
  }

  await Customer.findOneAndUpdate(
    { _id: customerId, business: businessId },
    update,
    { new: false }
  );

  // Acumular puntos solo en ventas nuevas (direction > 0)
  if (direction > 0 && saleId) {
    try {
      await accumulatePoints(customerId, numericAmount, saleId, requestId);
    } catch (pointsError) {
      // No bloquear la venta si falla la acumulación de puntos
      console.error("Error acumulando puntos:", pointsError?.message);
    }
  }
};

// Normaliza una fecha (YYYY-MM-DD) a inicio de día en Colombia (05:00 UTC)
const toColombiaStartOfDay = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      5,
      0,
      0,
      0
    )
  );
};

// @desc    Eliminar una venta (admin)
// @route   DELETE /api/sales/:id
// @access  Private/Admin
export const deleteSale = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest =
      process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID;
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const saleFilter = businessId
      ? { _id: req.params.id, business: businessId }
      : { _id: req.params.id };

    const sale = await Sale.findOne(saleFilter);
    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    const product = await Product.findById(sale.product);
    const restoreQuantity = sale.quantity ?? 0;
    const adminUser = await User.findOne({
      role: { $in: ["admin", "super_admin"] },
    });
    const profitUsers = [
      sale.distributor?.toString(),
      adminUser?._id?.toString(),
    ].filter(Boolean);

    // Restaurar stock según el origen de la venta
    if (sale.branch) {
      await BranchStock.findOneAndUpdate(
        { business: sale.business, branch: sale.branch, product: sale.product },
        { $inc: { quantity: restoreQuantity } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else if (sale.distributor) {
      await DistributorStock.findOneAndUpdate(
        { distributor: sale.distributor, product: sale.product },
        { $inc: { quantity: restoreQuantity } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Actualizar stock total del producto y totalInventoryValue
    if (restoreQuantity && product) {
      const inc = { totalStock: restoreQuantity };

      // Venta admin sin sede: devolver al almacén general
      if (!sale.branch && !sale.distributor) {
        inc.warehouseStock = restoreQuantity;
      }

      // Restaurar el valor del inventario usando el costo promedio al momento de la venta
      // Si no existe averageCostAtSale (ventas antiguas), usar purchasePrice
      const costAtSale = sale.averageCostAtSale || sale.purchasePrice;
      inc.totalInventoryValue = restoreQuantity * costAtSale;

      await Product.findByIdAndUpdate(sale.product, { $inc: inc });
    }

    // Eliminar entradas de ganancias asociadas a la venta y recalcular balances
    await ProfitHistory.deleteMany({
      sale: sale._id,
      ...(businessId ? { business: businessId } : {}),
    });
    for (const userId of profitUsers) {
      try {
        await recalculateUserBalance(userId, businessId);
      } catch (balanceError) {
        console.error(
          "Error recalculando balance para usuario",
          userId,
          balanceError?.message
        );
      }
    }

    // Invalidar cach├® (si est├í activo)
    await invalidateCache("cache:analytics:*");
    await invalidateCache("cache:gamification:*");
    await invalidateCache("cache:sales:*");
    await invalidateCache("cache:distributors:*");
    await invalidateCache("cache:businessAssistant:*");

    // Ajustar métricas de cliente si aplica
    const saleAmount = Number(sale.salePrice || 0) * Number(sale.quantity || 0);
    await applyCustomerTotals({
      customerId: sale.customer,
      businessId: sale.business || businessId,
      amount: saleAmount,
      direction: -1,
    });

    // Eliminar crédito asociado si existe
    const deletedCredit = await Credit.findOneAndDelete({
      sale: sale._id,
      business: sale.business || businessId,
    });

    if (deletedCredit && deletedCredit.customer) {
      // Actualizar la deuda del cliente
      await Customer.findByIdAndUpdate(deletedCredit.customer, {
        $inc: { totalDebt: -deletedCredit.remainingAmount },
      });
    }

    // Eliminar la venta
    await sale.deleteOne();

    res.json({
      message: "Venta eliminada y stock restaurado",
      creditDeleted: !!deletedCredit,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Actualizar ventas admin pendientes a confirmadas (temporal)
// @route   POST /api/sales/fix-admin-sales
// @access  Private/Admin
export const fixAdminSales = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

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
    const adminSales = await Sale.find({
      distributor: null,
      business: businessId,
    });

    let updated = 0;
    let datesUpdated = 0;

    // Actualizar cada venta para recalcular ganancias
    for (const sale of adminSales) {
      let needsUpdate = false;

      // Actualizar estado de pago si est├í pendiente
      if (sale.paymentStatus === "pendiente") {
        sale.paymentStatus = "confirmado";
        sale.paymentConfirmedAt = new Date();
        sale.paymentConfirmedBy = req.user.id;
        needsUpdate = true;
      }

      // Solo actualizar fechas si la venta es del mes anterior inmediato
      // NO tocar ventas de meses m├ís antiguos (hist├│rico)
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

      // Recalcular ganancias (el pre-save hook lo har├í autom├íticamente)
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
      business: businessId,
      paymentStatus: "confirmado",
      saleDate: { $gte: startOfMonth },
    });
    const pendingSales = await Sale.find({
      distributor: null,
      business: businessId,
      paymentStatus: "pendiente",
    });

    res.json({
      message: `Ô£à ${updated} ventas admin actualizadas`,
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
    console.log(`[${reqId}] ­ƒôØ registerAdminSale START`);
    console.log(`[${reqId}] User:`, req.user);
    console.log(`[${reqId}] Body:`, req.body);

    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const {
      productId,
      quantity,
      salePrice,
      notes,
      saleDate,
      paymentProof,
      paymentProofMimeType,
      branchId,
      customerId,
      paymentType,
      paymentMethodId,
      creditDueDate,
      initialPayment,
      deliveryMethodId,
      shippingCost,
      deliveryAddress,
      additionalCosts,
      discount,
    } = req.body;

    const normalizedSaleDate = toColombiaStartOfDay(saleDate);

    if (!productId || !quantity || !salePrice) {
      console.warn(
        `[${reqId}] ÔØî Campos faltantes - productId: ${productId}, quantity: ${quantity}, salePrice: ${salePrice}`
      );
      return res.status(400).json({
        message: "Campos obligatorios: productId, quantity, salePrice",
      });
    }

    // Validar producto
    console.log(`[${reqId}] ­ƒöì Buscando producto:`, productId);
    const product = await Product.findOne({
      _id: productId,
      business: businessId,
    });
    if (!product) {
      console.warn(`[${reqId}] ÔØî Producto no encontrado:`, productId);
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    console.log(`[${reqId}] Ô£à Producto encontrado:`, product.name);

    // Resolver sede (si se envía) y validar stock según el caso
    console.log(`[${reqId}] Validando stock...`);
    let branch = null;
    let branchStock = null;
    let isWarehouseSale = false;

    if (branchId) {
      // Si hay sede, verificar si es bodega o sede normal
      branch = await ensureBranch(businessId, branchId);

      if (branch.isWarehouse) {
        // Si es la sede "Bodega", validar stock en warehouseStock
        isWarehouseSale = true;
        const warehouseStock = product.warehouseStock || 0;
        if (warehouseStock < quantity) {
          console.warn(
            `[${reqId}] ÔØî Stock insuficiente en bodega. Disponible: ${warehouseStock}, solicitado: ${quantity}`
          );
          return res.status(400).json({
            message: `Stock insuficiente en bodega. Disponible: ${warehouseStock}`,
          });
        }
      } else {
        // Si es una sede normal, validar stock en BranchStock
        branchStock = await BranchStock.findOne({
          business: businessId,
          branch: branch._id,
          product: productId,
        });
        if (!branchStock || branchStock.quantity < quantity) {
          console.warn(
            `[${reqId}] ÔØî Stock insuficiente en sede. Disponible: ${
              branchStock?.quantity || 0
            }, solicitado: ${quantity}`
          );
          return res.status(400).json({
            message: `Stock insuficiente en la sede. Disponible: ${
              branchStock?.quantity || 0
            }`,
          });
        }
      }
    } else {
      // Si no hay sede, validar stock en bodega
      isWarehouseSale = true;
      const warehouseStock = product.warehouseStock || 0;
      if (warehouseStock < quantity) {
        console.warn(
          `[${reqId}] ÔØî Stock insuficiente en bodega. Disponible: ${warehouseStock}, solicitado: ${quantity}`
        );
        return res.status(400).json({
          message: `Stock insuficiente en bodega. Disponible: ${warehouseStock}`,
        });
      }
    }

    console.log(`[${reqId}] Ô£à Stock validado correctamente`);
    console.log(`[${reqId}] Creando venta...`);

    // Calcular el costo promedio al momento de la venta
    const averageCostAtSale = product.averageCost || product.purchasePrice;

    // Resolver método de pago si se envía
    let paymentMethodDoc = null;
    let isCredit = paymentType === "credit";
    if (paymentMethodId) {
      paymentMethodDoc = await PaymentMethod.findOne({
        _id: paymentMethodId,
        business: businessId,
        isActive: true,
      });
      if (paymentMethodDoc) {
        isCredit = paymentMethodDoc.isCredit;
      }
    }

    // Resolver método de entrega si se envía
    let deliveryMethodDoc = null;
    if (deliveryMethodId) {
      deliveryMethodDoc = await DeliveryMethod.findOne({
        _id: deliveryMethodId,
        business: businessId,
        isActive: true,
      });
    }

    const saleData = {
      business: businessId,
      branch: branch?._id,
      distributor: null,
      product: productId,
      quantity,
      purchasePrice: product.purchasePrice,
      averageCostAtSale, // Guardar costo promedio para cálculo de ganancias
      distributorPrice: product.distributorPrice,
      salePrice,
      notes,
      saleDate: normalizedSaleDate || toColombiaStartOfDay(new Date()),
      paymentProof,
      paymentProofMimeType: paymentProof
        ? paymentProofMimeType || "image/jpeg"
        : undefined,
      paymentStatus: "confirmado", // Las ventas admin están confirmadas automáticamente
      paymentConfirmedAt: new Date(),
      paymentConfirmedBy: req.user?.id || req.user?.userId,
      commissionBonus: 0, // Admin no tiene bonus
      distributorProfitPercentage: 0, // Admin no tiene porcentaje de ganancia
      // Método de pago personalizado
      paymentMethod: paymentMethodDoc?._id || null,
      paymentMethodCode:
        paymentMethodDoc?.code || (isCredit ? "credit" : "cash"),
      isCredit,
      // Método de entrega
      deliveryMethod: deliveryMethodDoc?._id || null,
      deliveryMethodCode: deliveryMethodDoc?.code || null,
      shippingCost: shippingCost || deliveryMethodDoc?.defaultCost || 0,
      deliveryAddress: deliveryAddress || null,
      // Costos adicionales y descuento
      additionalCosts: additionalCosts || [],
      discount: discount || 0,
    };

    // Cliente asociado (opcional)
    const { customerDoc, customerData } = await resolveCustomerForSale(
      businessId,
      customerId
    );
    Object.assign(saleData, customerData);
    console.log(`[${reqId}] Sale data:`, saleData);

    const sale = await Sale.create(saleData);
    console.log(`[${reqId}] Ô£à Venta creada:`, sale._id);

    // Descontar stock según el origen (bodega o sede)
    console.log(`[${reqId}] Actualizando stock...`);
    product.totalStock -= quantity;

    // Actualizar valor total del inventario (reducir por el costo promedio de las unidades vendidas)
    const inventoryValueReduction = quantity * averageCostAtSale;
    product.totalInventoryValue = Math.max(
      (product.totalInventoryValue || 0) - inventoryValueReduction,
      0
    );

    if (isWarehouseSale) {
      // Si es venta de bodega (sin sede o con sede isWarehouse), descontar de warehouseStock
      product.warehouseStock = Math.max(
        (product.warehouseStock || 0) - quantity,
        0
      );
      console.log(
        `[${reqId}] Ô£à Stock actualizado en bodega. Nuevo stock bodega:`,
        product.warehouseStock
      );
    } else if (branchStock) {
      // Si es venta de sede normal, descontar del stock de la sede
      branchStock.quantity -= quantity;
      await branchStock.save();
      console.log(
        `[${reqId}] Ô£à Stock actualizado en sede. Nuevo stock sede:`,
        branchStock.quantity
      );
    }

    await product.save();
    console.log(`[${reqId}] Ô£à Stock total actualizado:`, product.totalStock);

    console.log(`[${reqId}] ­ƒöä Obteniendo venta con populate...`);
    const populatedSale = await Sale.findById(sale._id).populate(
      "product",
      "name image"
    );
    console.log(`[${reqId}] Ô£à Venta obtenida`);

    // Registrar en historial de ganancias (no bloquear si falla)
    try {
      console.log(`[${reqId}] ­ƒôè Registrando ganancia...`);
      await recordSaleProfit(sale._id);
      console.log(`[${reqId}] Ô£à Ganancia registrada`);
    } catch (historyError) {
      console.error(
        `[${reqId}] ÔÜá´©Å Error registrando historial de ganancias:`,
        historyError?.message
      );
      // Continuar sin bloquear la venta
    }

    if (customerDoc) {
      const saleAmount = Number(sale.salePrice || 0) * Number(quantity || 0);
      await applyCustomerTotals({
        customerId: customerDoc._id,
        businessId,
        amount: saleAmount,
        direction: 1,
        saleDate: saleData.saleDate,
      });
    }

    // Crear crédito si es venta a crédito
    let credit = null;
    if (isCredit && customerDoc) {
      const totalAmount = Number(salePrice) * Number(quantity);
      const creditAmount = totalAmount - (Number(initialPayment) || 0);

      if (creditAmount > 0) {
        credit = await Credit.create({
          customer: customerDoc._id,
          business: businessId,
          sale: sale._id,
          branch: branch?._id,
          createdBy: req.user?.id || req.user?.userId,
          originalAmount: creditAmount,
          remainingAmount: creditAmount,
          paidAmount: Number(initialPayment) || 0,
          dueDate: creditDueDate ? new Date(creditDueDate) : null,
          description: notes || `Venta a crédito de ${product.name}`,
          items: [
            {
              product: product._id,
              productName: product.name,
              quantity: Number(quantity),
              unitPrice: Number(salePrice),
              subtotal: totalAmount,
            },
          ],
          status:
            Number(initialPayment) > 0 && Number(initialPayment) < totalAmount
              ? "partial"
              : "pending",
        });

        // Actualizar deuda del cliente
        await Customer.findByIdAndUpdate(customerDoc._id, {
          $inc: { totalDebt: creditAmount },
          $addToSet: { segments: "con_deuda" },
        });

        console.log(`[${reqId}] 💳 Crédito creado:`, credit._id);
      }
    }

    console.log(`[${reqId}] Ô£à registerAdminSale SUCCESS`);

    await AuditService.log({
      user: req.user,
      action: "sale_registered",
      module: "sales",
      description: `Venta admin registrada de ${quantity} ${product.name}`,
      entityType: "Sale",
      entityId: sale._id,
      entityName: product.name,
      newValues: sale,
      business: businessId,
      req,
      metadata: {
        quantity,
        salePrice,
        distributor: null,
        customer: customerDoc?._id,
      },
    });
    res.status(201).json({
      message: "Venta registrada exitosamente (admin)",
      sale: populatedSale,
      remainingStock: product.totalStock,
      credit: credit
        ? { _id: credit._id, remainingAmount: credit.remainingAmount }
        : null,
    });
  } catch (error) {
    console.error(`[${reqId}] ÔØî FATAL ERROR:`, error?.message);
    console.error(`[${reqId}] Stack:`, error?.stack);
    const status = error?.statusCode || 500;
    res.status(status).json({
      message: error?.message || "Error interno al registrar venta",
      requestId: reqId,
      stack:
        status === 500 && process.env.NODE_ENV === "development"
          ? error?.stack
          : undefined,
    });
  }
};

// @desc    Registrar una venta (distribuidor)
// @route   POST /api/sales
// @access  Private/Distribuidor
export const registerSale = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const {
      productId,
      quantity,
      salePrice,
      notes,
      paymentProof,
      paymentProofMimeType,
      saleDate,
      branchId,
      customerId,
      paymentType,
      paymentMethodId,
      creditDueDate,
      initialPayment,
      deliveryMethodId,
      shippingCost,
      deliveryAddress,
      additionalCosts,
      discount,
    } = req.body;
    const distributorId = req.user.id;
    const usesBranchStock = Boolean(branchId);

    const normalizedSaleDate = toColombiaStartOfDay(saleDate);

    let distributorStock = null;
    let branch = null;

    if (usesBranchStock) {
      branch = await ensureBranch(businessId, branchId);
    } else {
      // Venta con stock propio del distribuidor
      distributorStock = await DistributorStock.findOne({
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
    }

    // Obtener precios del producto
    const product = await Product.findOne({
      _id: productId,
      business: businessId,
    });
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const { customerDoc, customerData } = await resolveCustomerForSale(
      businessId,
      customerId
    );

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

    // Obtener el bonus/porcentaje del distribuidor seg├║n el ranking (misma l├│gica que usa el frontend)
    const commissionInfo = await getDistributorCommissionInfo(
      distributorId,
      businessId
    );
    const commissionBonus = commissionInfo.bonusCommission;
    const distributorProfitPercentage = commissionInfo.profitPercentage;

    // Generar saleId manualmente por seguridad
    const year = new Date().getFullYear();
    const saleCount = await Sale.countDocuments({
      business: businessId,
      saleId: { $regex: `^VTA-${year}-` },
    });
    const sequentialNumber = String(saleCount + 1).padStart(4, "0");
    const saleId = `VTA-${year}-${sequentialNumber}`;

    // Calcular el costo promedio al momento de la venta
    const averageCostAtSale = product.averageCost || product.purchasePrice;

    // Resolver método de pago si se envía
    let paymentMethodDoc = null;
    let isCredit = paymentType === "credit";
    if (paymentMethodId) {
      paymentMethodDoc = await PaymentMethod.findOne({
        _id: paymentMethodId,
        business: businessId,
        isActive: true,
      });
      if (paymentMethodDoc) {
        isCredit = paymentMethodDoc.isCredit;
      }
    }

    // Resolver método de entrega si se envía
    let deliveryMethodDoc = null;
    if (deliveryMethodId) {
      deliveryMethodDoc = await DeliveryMethod.findOne({
        _id: deliveryMethodId,
        business: businessId,
        isActive: true,
      });
    }

    // Crear la venta
    const saleData = {
      business: businessId,
      branch: branch?._id,
      saleId,
      distributor: distributorId,
      product: productId,
      quantity,
      purchasePrice: product.purchasePrice,
      averageCostAtSale, // Guardar costo promedio para cálculo de ganancias
      distributorPrice: product.distributorPrice,
      salePrice,
      notes,
      commissionBonus,
      distributorProfitPercentage,
      // Método de pago personalizado
      paymentMethod: paymentMethodDoc?._id || null,
      paymentMethodCode:
        paymentMethodDoc?.code || (isCredit ? "credit" : "cash"),
      isCredit,
      // Método de entrega
      deliveryMethod: deliveryMethodDoc?._id || null,
      deliveryMethodCode: deliveryMethodDoc?.code || null,
      shippingCost: shippingCost || deliveryMethodDoc?.defaultCost || 0,
      deliveryAddress: deliveryAddress || null,
      // Costos adicionales y descuento
      additionalCosts: additionalCosts || [],
      discount: discount || 0,
    };

    Object.assign(saleData, customerData);

    saleData.saleDate = normalizedSaleDate || toColombiaStartOfDay(new Date());

    // Agregar comprobante de pago si se proporcion├│
    if (paymentProof) {
      saleData.paymentProof = paymentProof;
      saleData.paymentProofMimeType = paymentProofMimeType || "image/jpeg";
    }

    if (normalizedSaleDate) {
      saleData.saleDate = normalizedSaleDate;
    }

    // Validar y ajustar stock seg fn origen
    if (usesBranchStock) {
      const branchStock = await BranchStock.findOne({
        business: businessId,
        branch: branch._id,
        product: productId,
      });
      if (!branchStock || branchStock.quantity < quantity) {
        return res.status(400).json({
          message: `Stock insuficiente en la sede. Disponible: ${
            branchStock?.quantity || 0
          }`,
        });
      }

      const sale = await Sale.create(saleData);

      branchStock.quantity -= quantity;
      await branchStock.save();

      product.totalStock -= quantity;
      // Actualizar valor total del inventario (reducir por el costo promedio de las unidades vendidas)
      const inventoryValueReduction = quantity * averageCostAtSale;
      product.totalInventoryValue = Math.max(
        (product.totalInventoryValue || 0) - inventoryValueReduction,
        0
      );
      await product.save();

      const populatedSale = await Sale.findById(sale._id)
        .populate("product", "name image")
        .populate("distributor", "name email");

      await invalidateCache("cache:analytics:*");
      await invalidateCache("cache:gamification:*");
      await invalidateCache("cache:sales:*");
      await invalidateCache("cache:distributors:*");
      await invalidateCache("cache:businessAssistant:*");

      try {
        await recordSaleProfit(sale._id);
      } catch (historyError) {
        console.error(
          "Error registrando historial de ganancias:",
          historyError
        );
      }

      if (customerDoc) {
        const saleAmount = Number(sale.salePrice || 0) * Number(quantity || 0);
        await applyCustomerTotals({
          customerId: customerDoc._id,
          businessId,
          amount: saleAmount,
          direction: 1,
          saleDate: saleData.saleDate,
          saleId: sale._id,
          requestId: req.reqId,
        });
      }

      // Crear crédito si es venta a crédito
      let credit = null;
      if (isCredit && customerDoc) {
        const totalAmount = Number(salePrice) * Number(quantity);
        const creditAmount = totalAmount - (Number(initialPayment) || 0);

        if (creditAmount > 0) {
          credit = await Credit.create({
            customer: customerDoc._id,
            business: businessId,
            sale: sale._id,
            branch: branch?._id,
            createdBy: distributorId,
            originalAmount: creditAmount,
            remainingAmount: creditAmount,
            paidAmount: Number(initialPayment) || 0,
            dueDate: creditDueDate ? new Date(creditDueDate) : null,
            description: notes || `Venta a crédito de ${product.name}`,
            items: [
              {
                product: product._id,
                productName: product.name,
                quantity: Number(quantity),
                unitPrice: Number(salePrice),
                subtotal: totalAmount,
              },
            ],
            status:
              Number(initialPayment) > 0 && Number(initialPayment) < totalAmount
                ? "partial"
                : "pending",
          });

          // Actualizar deuda del cliente
          await Customer.findByIdAndUpdate(customerDoc._id, {
            $inc: { totalDebt: creditAmount },
            $addToSet: { segments: "con_deuda" },
          });
        }
      }

      res.status(201).json({
        message: "Venta registrada exitosamente",
        sale: populatedSale,
        remainingStock: branchStock.quantity,
        commissionBonus: commissionBonus > 0 ? `+${commissionBonus}%` : null,
        credit: credit
          ? { _id: credit._id, remainingAmount: credit.remainingAmount }
          : null,
      });

      await AuditService.log({
        user: req.user,
        action: "sale_registered",
        module: "sales",
        description: `Venta registrada de ${quantity} ${product.name}`,
        entityType: "Sale",
        entityId: sale._id,
        entityName: product.name,
        newValues: sale,
        business: businessId,
        req,
        metadata: {
          quantity,
          salePrice,
          distributor: distributorId,
          branch: branch._id,
          origin: "branch_stock",
          customer: customerDoc?._id,
        },
      });

      // Notificar nueva venta
      void NotificationService.notifySaleCreated({
        businessId,
        saleId: sale._id,
        productName: product.name,
        quantity,
        salePrice,
        distributorName: req.user?.name,
        requestId: req.reqId,
      });

      // Verificar stock bajo
      if (branchStock.quantity <= 10 && branchStock.quantity > 0) {
        void NotificationService.notifyLowStock({
          businessId,
          productId: product._id,
          productName: product.name,
          currentStock: branchStock.quantity,
          threshold: 10,
          requestId: req.reqId,
        });
      }
      return;
    }

    // Venta con stock del distribuidor
    const sale = await Sale.create(saleData);

    distributorStock.quantity -= quantity;
    await distributorStock.save();

    product.totalStock -= quantity;
    // Actualizar valor total del inventario (reducir por el costo promedio de las unidades vendidas)
    const inventoryValueReduction = quantity * averageCostAtSale;
    product.totalInventoryValue = Math.max(
      (product.totalInventoryValue || 0) - inventoryValueReduction,
      0
    );
    await product.save();

    const populatedSale = await Sale.findById(sale._id)
      .populate("product", "name image")
      .populate("distributor", "name email");

    // Invalidar cach├® de analytics y gamificaci├│n
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

    if (customerDoc) {
      const saleAmount = Number(sale.salePrice || 0) * Number(quantity || 0);
      await applyCustomerTotals({
        customerId: customerDoc._id,
        businessId,
        amount: saleAmount,
        direction: 1,
        saleDate: saleData.saleDate,
        saleId: sale._id,
        requestId: req.reqId,
      });
    }

    // Crear crédito si es venta a crédito
    let credit = null;
    if (paymentType === "credit" && customerDoc) {
      const totalAmount = Number(salePrice) * Number(quantity);
      const creditAmount = totalAmount - (Number(initialPayment) || 0);

      if (creditAmount > 0) {
        credit = await Credit.create({
          customer: customerDoc._id,
          business: businessId,
          sale: sale._id,
          branch: branch?._id,
          createdBy: distributorId,
          originalAmount: creditAmount,
          remainingAmount: creditAmount,
          paidAmount: Number(initialPayment) || 0,
          dueDate: creditDueDate ? new Date(creditDueDate) : null,
          description: notes || `Venta a crédito de ${product.name}`,
          items: [
            {
              product: product._id,
              productName: product.name,
              quantity: Number(quantity),
              unitPrice: Number(salePrice),
              subtotal: totalAmount,
            },
          ],
          status:
            Number(initialPayment) > 0 && Number(initialPayment) < totalAmount
              ? "partial"
              : "pending",
        });

        // Actualizar deuda del cliente
        await Customer.findByIdAndUpdate(customerDoc._id, {
          $inc: { totalDebt: creditAmount },
          $addToSet: { segments: "con_deuda" },
        });
      }
    }

    res.status(201).json({
      message: "Venta registrada exitosamente",
      sale: populatedSale,
      remainingStock: distributorStock.quantity,
      commissionBonus: commissionBonus > 0 ? `+${commissionBonus}%` : null,
      credit: credit
        ? { _id: credit._id, remainingAmount: credit.remainingAmount }
        : null,
    });

    await AuditService.log({
      user: req.user,
      action: "sale_registered",
      module: "sales",
      description: `Venta registrada de ${quantity} ${product.name}`,
      entityType: "Sale",
      entityId: sale._id,
      entityName: product.name,
      newValues: sale,
      business: businessId,
      req,
      metadata: {
        quantity,
        salePrice,
        distributor: distributorId,
        customer: customerDoc?._id,
      },
    });

    // Notificar nueva venta
    void NotificationService.notifySaleCreated({
      businessId,
      saleId: sale._id,
      productName: product.name,
      quantity,
      salePrice,
      distributorName: req.user?.name,
      requestId: req.reqId,
    });

    // Verificar stock bajo del distribuidor
    if (distributorStock.quantity <= 10 && distributorStock.quantity > 0) {
      void NotificationService.notifyLowStock({
        businessId,
        productId: product._id,
        productName: product.name,
        currentStock: distributorStock.quantity,
        threshold: 10,
        requestId: req.reqId,
      });
    }
  } catch (error) {
    const status = error?.statusCode || 500;
    res.status(status).json({ message: error.message });
  }
};

// @desc    Obtener ventas de un distribuidor
// @route   GET /api/sales/distributor/:distributorId?
// @access  Private
export const getDistributorSales = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const distributorId = req.params.distributorId || req.user.id;
    const limitParam = parseInt(req.query.limit, 10);
    const statsOnly = String(req.query.statsOnly).toLowerCase() === "true";
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 200)
        : 50;
    const branchFilter = req.query.branchId
      ? { branch: new mongoose.Types.ObjectId(req.query.branchId) }
      : {};

    // Si no es admin y est├í consultando otro distribuidor, denegar
    if (req.user.role !== "admin" && distributorId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "No puedes ver ventas de otros distribuidores" });
    }

    const { startDate, endDate, productId } = req.query;

    const filter = { distributor: distributorId, business: businessId };
    Object.assign(filter, branchFilter);

    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    if (productId) filter.product = productId;

    // Totales vía agregación (evita cargar todas las ventas en memoria)
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
        },
      },
    ]);

    const stats = statsAgg[0] || {
      totalSales: 0,
      totalQuantity: 0,
      totalDistributorProfit: 0,
      totalAdminProfit: 0,
      totalRevenue: 0,
    };

    // Si solo se necesitan estadísticas, evitar traer las ventas
    if (statsOnly) {
      return res.json({ sales: [], stats });
    }

    const sales = await Sale.find(filter)
      .select(
        "product distributor salePrice quantity saleDate distributorProfit adminProfit saleStatus paymentStatus"
      )
      .populate("product", "name image")
      .populate("distributor", "name email")
      .sort({ saleDate: -1 })
      .limit(limit)
      .lean();

    res.json({
      sales,
      stats,
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
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const {
      startDate,
      endDate,
      distributorId,
      productId,
      paymentStatus,
      sortBy,
      page = 1,
      limit = 50,
      statsOnly,
      allTime,
    } = req.query;

    const filter = { business: businessId };

    if (req.query.branchId) {
      filter.branch = new mongoose.Types.ObjectId(req.query.branchId);
    }

    // Si no se envían fechas y no se pide explícitamente allTime, limitar a últimos 30 días para evitar scans enormes
    const mustDefaultDateRange =
      !startDate && !endDate && String(allTime) !== "true";
    if (startDate || endDate || mustDefaultDateRange) {
      filter.saleDate = {};
      if (startDate) {
        filter.saleDate.$gte = new Date(startDate);
      } else if (mustDefaultDateRange) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        filter.saleDate.$gte = thirtyDaysAgo;
      }
      if (endDate) {
        filter.saleDate.$lte = new Date(endDate);
      }
    }

    if (distributorId) filter.distributor = distributorId;
    if (productId) filter.product = productId;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // Determinar ordenamiento
    let sortOption = { saleDate: -1 };
    if (sortBy === "date-asc") {
      sortOption = { saleDate: 1 };
    } else if (sortBy === "distributor") {
      sortOption = { "distributor.name": 1 };
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const aggOptions = { allowDiskUse: true, maxTimeMS: 15000 };
    const includeSpecials =
      req.query.includeSpecials === undefined
        ? true
        : String(req.query.includeSpecials).toLowerCase() === "true";

    const shouldReturnList = String(statsOnly) !== "true";

    let sales = [];
    let total = 0;

    const projection = {
      saleId: 1,
      saleDate: 1,
      paymentStatus: 1,
      paymentConfirmedAt: 1,
      paymentConfirmedBy: 1,
      paymentProof: 1,
      paymentProofMimeType: 1,
      quantity: 1,
      salePrice: 1,
      purchasePrice: 1,
      distributorPrice: 1,
      adminProfit: 1,
      distributorProfit: 1,
      totalProfit: 1,
      distributorProfitPercentage: 1,
      notes: 1,
      distributor: 1,
      product: 1,
      branch: 1,
      customer: 1,
      customerName: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    if (shouldReturnList) {
      const tListStart = Date.now();
      const [foundSales, totalCount] = await Promise.all([
        Sale.find(filter, projection)
          .populate("product", "name image description")
          .populate("distributor", "name email phone address")
          .populate("branch", "name")
          .sort(sortOption)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Sale.countDocuments(filter),
      ]);

      sales = foundSales;
      total = totalCount;

      // Buscar créditos asociados a las ventas
      const saleIds = sales.map((s) => s._id);
      const credits = await Credit.find({ sale: { $in: saleIds } })
        .select("sale originalAmount paidAmount remainingAmount status dueDate")
        .lean();

      // Crear un mapa de créditos por saleId
      const creditMap = {};
      credits.forEach((credit) => {
        creditMap[credit.sale.toString()] = credit;
      });

      // Agregar información de crédito a cada venta
      sales = sales.map((sale) => ({
        ...sale,
        credit: creditMap[sale._id.toString()] || null,
      }));

      console.log(
        `[${req.reqId || "no-id"}] sales:list fetched ${
          sales.length
        }/${total} in ${Date.now() - tListStart}ms`
      );
    }
    // Calcular estadísticas
    const canIncludeSpecials =
      includeSpecials &&
      (!paymentStatus || paymentStatus === "confirmado") &&
      !distributorId;

    const tAggStart = Date.now();
    const salesAgg = await Sale.aggregate([
      {
        $match: {
          ...filter,
          business: new mongoose.Types.ObjectId(businessId),
        },
      },
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
          totalProfit: { $sum: "$totalProfit" },
        },
      },
    ]).option(aggOptions);
    console.log(
      `[${req.reqId || "no-id"}] sales:stats aggregate in ${
        Date.now() - tAggStart
      }ms`
    );
    const salesStats = salesAgg[0] || null;

    let specialStats = null;
    if (canIncludeSpecials) {
      const match = {
        status: "active",
        business: new mongoose.Types.ObjectId(businessId),
        ...(filter.saleDate ? { saleDate: filter.saleDate } : {}),
        ...(productId
          ? { "product.productId": new mongoose.Types.ObjectId(productId) }
          : {}),
      };

      const [agg] = await SpecialSale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalQuantity: { $sum: "$quantity" },
            totalDistributorProfit: { $sum: 0 },
            totalAdminProfit: { $sum: "$totalProfit" },
            totalRevenue: {
              $sum: { $multiply: ["$specialPrice", "$quantity"] },
            },
            confirmedSales: { $sum: 1 },
            pendingSales: { $sum: 0 },
            totalProfit: { $sum: "$totalProfit" },
          },
        },
      ]).option(aggOptions);
      specialStats = agg || null;
    }
    const stats = {
      totalSales: 0,
      totalQuantity: 0,
      totalDistributorProfit: 0,
      totalAdminProfit: 0,
      totalRevenue: 0,
      confirmedSales: 0,
      pendingSales: 0,
      totalProfit: 0,
      ...(salesStats || {}),
    };

    if (specialStats) {
      stats.totalSales += specialStats.totalSales || 0;
      stats.totalQuantity += specialStats.totalQuantity || 0;
      stats.totalDistributorProfit += specialStats.totalDistributorProfit || 0;
      stats.totalAdminProfit += specialStats.totalAdminProfit || 0;
      stats.totalRevenue += specialStats.totalRevenue || 0;
      stats.confirmedSales += specialStats.confirmedSales || 0;
      stats.pendingSales += specialStats.pendingSales || 0;
      stats.totalProfit += specialStats.totalProfit || 0;
    }

    // Si solo se necesitan estadísticas, evitar traer las ventas
    if (statsOnly) {
      return res.json({ sales: [], stats });
    }
    res.json({
      sales,
      stats,
      pagination: shouldReturnList
        ? {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
            hasMore: pageNum < Math.ceil(total / limitNum),
          }
        : null,
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
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const branchMatch = req.query.branchId
      ? { branch: new mongoose.Types.ObjectId(req.query.branchId) }
      : {};

    const salesByProduct = await Sale.aggregate([
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          ...branchMatch,
        },
      },
      {
        $project: {
          product: "$product",
          quantity: "$quantity",
          salePrice: "$salePrice",
          adminProfit: "$adminProfit",
          distributorProfit: "$distributorProfit",
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            {
              $match: {
                status: "active",
                business: new mongoose.Types.ObjectId(businessId),
                "product.productId": { $exists: true, $ne: null },
              },
            },
            {
              $project: {
                product: "$product.productId",
                quantity: "$quantity",
                salePrice: "$specialPrice",
                adminProfit: "$totalProfit",
                distributorProfit: 0,
              },
            },
          ],
        },
      },
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
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const branchMatch = req.query.branchId
      ? { branch: new mongoose.Types.ObjectId(req.query.branchId) }
      : {};

    const salesByDistributor = await Sale.aggregate([
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          ...branchMatch,
        },
      },
      {
        $project: {
          distributor: "$distributor",
          quantity: "$quantity",
          salePrice: "$salePrice",
          adminProfit: "$adminProfit",
          distributorProfit: "$distributorProfit",
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            {
              $match: {
                status: "active",
                business: new mongoose.Types.ObjectId(businessId),
              },
            },
            {
              $project: {
                distributor: null,
                quantity: "$quantity",
                salePrice: "$specialPrice",
                adminProfit: "$totalProfit",
                distributorProfit: 0,
              },
            },
          ],
        },
      },
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
      { $unwind: { path: "$distributor", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          distributorName: {
            $ifNull: ["$distributor.name", "Ventas administradas"],
          },
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
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const sale = await Sale.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    // Marcar la venta como confirmada si aún está pendiente
    if (sale.paymentStatus !== "confirmado") {
      sale.paymentStatus = "confirmado";
      sale.paymentConfirmedAt = new Date();
      sale.paymentConfirmedBy = req.user?.id || req.user?._id || null;
      await sale.save();
    }

    const filter = {};

    // Calcular estadísticas
    const statsAgg = await Sale.aggregate([
      {
        $match: {
          ...filter,
          business: new mongoose.Types.ObjectId(businessId),
        },
      },
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
          totalProfit: { $sum: "$totalProfit" },
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

    const populatedSale = await Sale.findOne({
      _id: sale._id,
      business: businessId,
    })
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
