import mongoose from "mongoose";
import DistributorStats from "../models/DistributorStats.js";

// Helper para actualizar estadísticas del distribuidor
const updateDistributorStats = async (distributorId, sale) => {
  try {
    if (!distributorId) return;

    // Calcular ganancia del distribuidor
    // Usamos el campo guardado si existe, o calculamos backup
    const profit = sale.distributorProfit || 0;
    const revenue = (sale.salePrice || 0) * (sale.quantity || 1);

    await DistributorStats.findOneAndUpdate(
      { distributor: distributorId },
      {
        $inc: {
          totalSales: 1,
          totalRevenue: revenue,
          totalProfit: profit,
        },
        $set: { lastSaleDate: new Date() },
      },
      { upsert: true },
    );
  } catch (error) {
    console.error("Error actualizando estadísticas del distribuidor:", error);
    // No bloqueamos la respuesta si falla esto
  }
};

import { invalidateCache } from "../middleware/cache.middleware.js";
import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import Credit from "../models/Credit.js";
import Customer from "../models/Customer.js";
import DefectiveProduct from "../models/DefectiveProduct.js";
import DeliveryMethod from "../models/DeliveryMethod.js";
import DistributorStock from "../models/DistributorStock.js";
import PaymentMethod from "../models/PaymentMethod.js";
import ProfitHistory from "../models/ProfitHistory.js";
import Promotion from "../models/Promotion.js"; // ⭐ Importar modelo de Promoción
import SpecialSale from "../models/SpecialSale.js";
import AuditService from "../services/audit.service.js";
import { accumulatePoints } from "../services/customerPoints.service.js";
import NotificationService from "../services/notification.service.js";
import {
  recalculateUserBalance,
  recordSaleProfit,
} from "../services/profitHistory.service.js";
import Product from "../src/infrastructure/database/models/Product.js";
import Sale from "../src/infrastructure/database/models/Sale.js";
import User from "../src/infrastructure/database/models/User.js";
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
    { new: false },
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
      0,
    ),
  );
};

// ==================== PROMOTION STOCK HELPERS ====================

/**
 * Deduct stock for each component of a promotion (bundle/combo)
 * @param {string} promotionId - Promotion ObjectId
 * @param {number} quantity - Number of promotion units sold
 * @param {string} businessId - Business ObjectId
 * @returns {Promise<{success: boolean, deductedItems: Array, error?: string}>}
 */
const deductPromotionComponentStock = async (
  promotionId,
  quantity,
  businessId,
  branchId = null, // ⭐ Soporte para sedes
) => {
  const promotion = await Promotion.findOne({
    _id: promotionId,
    business: businessId,
    status: "active",
  }).populate("comboItems.product");

  if (!promotion) {
    return { success: false, error: "Promoción no encontrada o inactiva" };
  }

  if (!promotion.comboItems || promotion.comboItems.length === 0) {
    return {
      success: false,
      error: "La promoción no tiene productos definidos",
    };
  }

  const deductedItems = [];

  // Calculate aggregation cost
  let totalPromotionCost = 0;

  // Validate stock using appropriate source
  for (const item of promotion.comboItems) {
    const product = item.product;
    const requiredQty = (item.quantity || 1) * quantity;
    const unitCost = product.averageCost || product.purchasePrice || 0;
    totalPromotionCost += unitCost * (item.quantity || 1); // Costo unitario del combo

    if (!product) {
      return { success: false, error: `Producto componente no encontrado` };
    }

    if (branchId) {
      // Validate Branch Stock
      const stockItem = await BranchStock.findOne({
        branch: branchId,
        product: product._id,
      });
      const available = stockItem ? stockItem.quantity : 0;
      if (available < requiredQty) {
        return {
          success: false,
          error: `Stock insuficiente de "${product.name}" en sede. Req: ${requiredQty}`,
        };
      }
    } else {
      // Validate Warehouse Stock
      const availableStock = product.warehouseStock || 0;
      if (availableStock < requiredQty) {
        return {
          success: false,
          error: `Stock insuficiente de "${product.name}". Disponible: ${availableStock}, Requerido: ${requiredQty}`,
        };
      }
    }
  }

  // Deduct stock atomically for each component
  for (const item of promotion.comboItems) {
    const product = item.product;
    const deductQty = (item.quantity || 1) * quantity;
    const avgCost = product.averageCost || product.purchasePrice || 0;
    const inventoryValueReduction = deductQty * avgCost;

    if (branchId) {
      // Deduct from Branch
      await BranchStock.findOneAndUpdate(
        { branch: branchId, product: product._id },
        { $inc: { quantity: -deductQty } },
      );
      // Note: Inventory Value usually tracked globally or via product decrements only if warehouse.
      // For branch sales, we just reduce quantity. The value was transferred when moving to branch.
    } else {
      // Deduct from Warehouse
      const updateResult = await Product.findOneAndUpdate(
        {
          _id: product._id,
          business: businessId,
          warehouseStock: { $gte: deductQty },
        },
        {
          $inc: {
            warehouseStock: -deductQty,
            totalStock: -deductQty,
            totalInventoryValue: -inventoryValueReduction,
          },
        },
        { new: true },
      );
      if (!updateResult) {
        // Should rollback or fail
        // For simplicity, we assume validation above caught most cases, but race conditions exist.
      }
    }

    deductedItems.push({
      product: product._id,
      quantity: deductQty,
      cost: avgCost,
    });
  }

  // Update promotion usage metrics
  await Promotion.findByIdAndUpdate(promotionId, {
    $inc: {
      usageCount: quantity,
      totalUnitsSold: quantity,
    },
    $set: { lastUsedAt: new Date() },
  });

  return { success: true, deductedItems, totalPromotionCost };
};

/**
 * Restore stock for each component of a promotion (on sale deletion)
 * @param {string} promotionId - Promotion ObjectId
 * @param {number} quantity - Number of promotion units to restore
 * @param {string} businessId - Business ObjectId
 * @returns {Promise<{success: boolean, restoredItems: Array}>}
 */
const restorePromotionComponentStock = async (
  promotionId,
  quantity,
  businessId,
  context = {}, // { distributorId, branchId, isWarehouseSale }
) => {
  const promotion =
    await Promotion.findById(promotionId).populate("comboItems.product");

  if (!promotion || !promotion.comboItems) {
    return { success: false, restoredItems: [] };
  }

  const { distributorId, branchId, isWarehouseSale } = context;
  const restoredItems = [];

  const DistributorStock = (await import("../models/DistributorStock.js"))
    .default;

  for (const item of promotion.comboItems) {
    const product = item.product;
    if (!product) continue;

    const restoreQty = (item.quantity || 1) * quantity;
    const avgCost = product.averageCost || product.purchasePrice || 0;

    // 1. Restaurar según contexto
    if (distributorId) {
      // Restaurar a stock del distribuidor
      await DistributorStock.findOneAndUpdate(
        {
          distributor: distributorId,
          product: product._id,
          business: businessId,
        },
        { $inc: { quantity: restoreQty } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } else if (branchId && !isWarehouseSale) {
      // Restaurar a stock de sede (BranchStock)
      await BranchStock.findOneAndUpdate(
        { business: businessId, branch: branchId, product: product._id },
        { $inc: { quantity: restoreQty } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } else {
      // Restaurar a Bodega Central (Product.warehouseStock)
      const inventoryValueRestore = restoreQty * avgCost;
      await Product.findByIdAndUpdate(product._id, {
        $inc: {
          warehouseStock: restoreQty,
          totalStock: restoreQty,
          totalInventoryValue: inventoryValueRestore,
        },
      });
    }

    restoredItems.push({
      productId: product._id,
      productName: product.name,
      quantity: restoreQty,
    });
  }

  // Update promotion metrics
  await Promotion.findByIdAndUpdate(promotionId, {
    $inc: {
      usageCount: -quantity,
      totalUnitsSold: -quantity,
    },
  });

  return { success: true, restoredItems };
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

    // Identificar si es Producto o Promoción
    let product = await Product.findById(sale.product);
    let isPromotion = false;

    if (!product) {
      const promotion = await Promotion.findById(sale.product);
      if (promotion) {
        isPromotion = true;
        product = { _id: promotion._id, name: promotion.name }; // Mock for logging
      }
    }

    const restoreQuantity = sale.quantity ?? 0;

    // Usuarios involucrados para recalcular profit
    const adminUser = await User.findOne({
      role: { $in: ["admin", "super_admin"] },
    });
    const profitUsers = [
      sale.distributor?.toString(),
      adminUser?._id?.toString(),
    ].filter(Boolean);

    // Contexto de Bodega
    let isWarehouseSale = false;
    if (sale.branch) {
      const branch = await Branch.findById(sale.branch);
      isWarehouseSale = branch?.isWarehouse === true;
    }

    // === RESTAURACIÓN DE INVENTARIO ===
    if (restoreQuantity > 0) {
      if (isPromotion) {
        // 🎁 Restaurar Despiece de Promoción
        await restorePromotionComponentStock(
          sale.product,
          restoreQuantity,
          String(sale.business || businessId),
          {
            distributorId: sale.distributor,
            branchId: sale.branch,
            isWarehouseSale,
          },
        );
      } else if (product) {
        // 📦 Restaurar Producto Simple
        // 1. Contexto: Sede Normal (BranchStock)
        if (sale.branch && !isWarehouseSale) {
          await BranchStock.findOneAndUpdate(
            {
              business: sale.business,
              branch: sale.branch,
              product: sale.product,
            },
            { $inc: { quantity: restoreQuantity } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        }
        // 2. Contexto: Distribuidor (DistributorStock)
        else if (sale.distributor) {
          const DistributorStock = (
            await import("../models/DistributorStock.js")
          ).default;
          await DistributorStock.findOneAndUpdate(
            { distributor: sale.distributor, product: sale.product },
            { $inc: { quantity: restoreQuantity } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        }
        // 3. Contexto: Bodega Central (Product.warehouseStock)
        // (Venta de bodega o venta admin sin sede)
        else {
          const inc = {
            totalStock: restoreQuantity,
            warehouseStock: restoreQuantity,
          };
          const costAtSale = sale.averageCostAtSale || sale.purchasePrice || 0;
          inc.totalInventoryValue = restoreQuantity * costAtSale;

          await Product.findByIdAndUpdate(sale.product, { $inc: inc });
        }
      }
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
          "Error recalculando balance:",
          userId,
          balanceError?.message,
        );
      }
    }

    // Invalidar caché
    await invalidateCache("cache:analytics:*");
    await invalidateCache("cache:gamification:*");
    await invalidateCache("cache:sales:*");
    await invalidateCache("cache:distributors:*");

    // Ajustar deuda de cliente (Créditos)
    const saleAmount = Number(sale.salePrice || 0) * Number(sale.quantity || 0);
    await applyCustomerTotals({
      customerId: sale.customer,
      businessId: sale.business || businessId,
      amount: saleAmount,
      direction: -1,
    });

    const deletedCredit = await Credit.findOneAndDelete({
      sale: sale._id,
      business: sale.business || businessId,
    });

    if (deletedCredit && deletedCredit.customer) {
      await Customer.findByIdAndUpdate(deletedCredit.customer, {
        $inc: { totalDebt: -deletedCredit.remainingAmount },
      });
    }

    // Eliminar garantías asociadas (DefectiveProduct)
    let deletedWarranties = 0;
    const saleGroupId = sale.saleGroupId || sale._id.toString();
    const warranties = await DefectiveProduct.find({
      saleGroupId: saleGroupId,
      origin: "order",
      business: sale.business || businessId,
    });

    for (const warranty of warranties) {
      // Restaurar stock (garantías siempre restauran a bodega o según contexto?)
      // Asumiremos restauración a Bodega Central para garantías de ventas borradas.
      // Ojo: Si la garantía salió de la venta, y la venta se borra, el stock YA se restauró arriba.
      // NO. DefectiveProduct = Producto dañado sacado de stock?
      // "origin: order": El cliente devolvió producto dañado.
      // Si borramos la venta, "eliminamos el hecho de que devolvió producto dañado"?
      // Mas bien, la venta nunca existió.
      // Si la garantía se registró, debe ser borrada.
      // ¿Y el stock del producto dañado? Se elimina de "Defective Products"?
      // ¿Se devuelve a Stock "Bueno"? No, estaba dañado.
      // Simplemente borramos el registro de garantía.

      await warranty.deleteOne();
      deletedWarranties++;
    }

    await sale.deleteOne();

    res.json({
      message: "Venta eliminada y stock restaurado",
      restoredFromPromotion: isPromotion,
      creditDeleted: !!deletedCredit,
      warrantiesDeleted: deletedWarranties,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Eliminar un grupo de ventas por saleGroupId
// @route   DELETE /api/sales/group/:saleGroupId
// @access  Private/Admin
export const deleteSaleGroup = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest =
      process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID;
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { saleGroupId } = req.params;
    if (!saleGroupId) {
      return res
        .status(400)
        .json({ message: "Se requiere el saleGroupId del grupo" });
    }

    // Buscar todas las ventas del grupo
    const saleFilter = businessId
      ? { saleGroupId, business: businessId }
      : { saleGroupId };

    const salesToDelete = await Sale.find(saleFilter);
    if (salesToDelete.length === 0) {
      return res
        .status(404)
        .json({ message: "No se encontraron ventas en este grupo" });
    }

    let deletedSales = 0;
    let deletedCredits = 0;
    let deletedWarranties = 0;
    let stockRestored = 0;

    // Primero eliminar garantías asociadas al grupo
    const warranties = await DefectiveProduct.find({
      saleGroupId,
      origin: "order",
      ...(businessId ? { business: businessId } : {}),
    });

    for (const warranty of warranties) {
      const warrantyProduct = await Product.findById(warranty.product);
      if (warrantyProduct) {
        const avgCost =
          warrantyProduct.averageCost || warrantyProduct.purchasePrice || 0;
        const invRestore = warranty.quantity * avgCost;

        await Product.findByIdAndUpdate(warranty.product, {
          $inc: {
            warehouseStock: warranty.quantity,
            totalStock: warranty.quantity,
            totalInventoryValue: invRestore,
          },
        });
        stockRestored += warranty.quantity;
      }
      await warranty.deleteOne();
      deletedWarranties++;
    }

    // Procesar cada venta del grupo
    for (const sale of salesToDelete) {
      const product = await Product.findById(sale.product);
      const restoreQuantity = sale.quantity ?? 0;

      // Verificar si la venta fue de bodega
      let isWarehouseSale = false;
      if (sale.branch) {
        const branch = await Branch.findById(sale.branch);
        isWarehouseSale = branch?.isWarehouse === true;
      }

      // Restaurar stock según origen
      if (sale.branch && !isWarehouseSale) {
        await BranchStock.findOneAndUpdate(
          {
            business: sale.business,
            branch: sale.branch,
            product: sale.product,
          },
          { $inc: { quantity: restoreQuantity } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      } else if (sale.distributor) {
        await DistributorStock.findOneAndUpdate(
          { distributor: sale.distributor, product: sale.product },
          { $inc: { quantity: restoreQuantity } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      }

      // Actualizar stock total del producto
      if (restoreQuantity && product) {
        const inc = { totalStock: restoreQuantity };
        if (isWarehouseSale || (!sale.branch && !sale.distributor)) {
          inc.warehouseStock = restoreQuantity;
        }
        const costAtSale = sale.averageCostAtSale || sale.purchasePrice;
        inc.totalInventoryValue = restoreQuantity * costAtSale;
        await Product.findByIdAndUpdate(sale.product, { $inc: inc });
        stockRestored += restoreQuantity;
      }

      // Eliminar historial de ganancias
      await ProfitHistory.deleteMany({
        sale: sale._id,
        ...(businessId ? { business: businessId } : {}),
      });

      // Ajustar métricas de cliente
      const saleAmount =
        Number(sale.salePrice || 0) * Number(sale.quantity || 0);
      await applyCustomerTotals({
        customerId: sale.customer,
        businessId: sale.business || businessId,
        amount: saleAmount,
        direction: -1,
      });

      // Eliminar crédito asociado
      const deletedCredit = await Credit.findOneAndDelete({
        sale: sale._id,
        business: sale.business || businessId,
      });

      if (deletedCredit) {
        deletedCredits++;
        if (deletedCredit.customer) {
          await Customer.findByIdAndUpdate(deletedCredit.customer, {
            $inc: { totalDebt: -deletedCredit.remainingAmount },
          });
        }
      }

      await sale.deleteOne();
      deletedSales++;
    }

    // Invalidar caché
    await invalidateCache("cache:analytics:*");
    await invalidateCache("cache:gamification:*");
    await invalidateCache("cache:sales:*");
    await invalidateCache("cache:distributors:*");
    await invalidateCache("cache:businessAssistant:*");

    res.json({
      message: `Grupo de ventas eliminado: ${deletedSales} ventas, ${deletedWarranties} garantías`,
      deletedSales,
      deletedCredits,
      deletedWarranties,
      stockRestored,
    });
  } catch (error) {
    console.error("Error eliminando grupo de ventas:", error);
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
      59,
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
          0,
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
// Helper to deduct stock from Distributor for a Promotion Sale
const deductDistributorPromotionStock = async (
  distributorId,
  promotionId,
  quantity,
  businessId,
) => {
  const promotion = await Promotion.findOne({
    _id: promotionId,
    business: businessId,
  }).populate("comboItems.product");
  if (!promotion) return { success: false, error: "Promoción no encontrada" };

  const DistributorStock = (await import("../models/DistributorStock.js"))
    .default;
  const deductedItems = [];

  // Validate ALL items first
  for (const item of promotion.comboItems) {
    if (!item.product) continue; // Skip if product reference is broken

    const requiredQty = (item.quantity || 1) * quantity;
    const distStock = await DistributorStock.findOne({
      distributor: distributorId,
      product: item.product._id,
      business: businessId,
    });

    if (!distStock || distStock.quantity < requiredQty) {
      return {
        success: false,
        error: `Stock insuficiente de componente: ${item.product.name} (Req: ${requiredQty}, Disp: ${distStock?.quantity || 0})`,
      };
    }
  }

  // Deduct
  for (const item of promotion.comboItems) {
    if (!item.product) continue; // Skip if product reference is broken

    const deductQty = (item.quantity || 1) * quantity;
    await DistributorStock.findOneAndUpdate(
      {
        distributor: distributorId,
        product: item.product._id,
        business: businessId,
      },
      { $inc: { quantity: -deductQty } },
    );
    deductedItems.push({ product: item.product._id, quantity: deductQty });
  }

  return { success: true, deductedItems };
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
      warranties, // ⭐ Productos en garantía
      saleGroupId, // ⭐ ID de grupo para agrupar ventas del mismo carrito
    } = req.body;

    const normalizedSaleDate = toColombiaStartOfDay(saleDate);

    if (!productId || !quantity || !salePrice) {
      console.warn(
        `[${reqId}] ÔØî Campos faltantes - productId: ${productId}, quantity: ${quantity}, salePrice: ${salePrice}`,
      );
      return res.status(400).json({
        message: "Campos obligatorios: productId, quantity, salePrice",
      });
    }

    // Validar producto o PROMOCIÓN
    console.log(`[${reqId}] 🔍 Buscando producto o promoción:`, productId);
    let product = await Product.findOne({
      _id: productId,
      business: businessId,
    });

    let isPromotion = false;
    let promotionDoc = null;
    let promotionCost = 0;

    if (!product) {
      // Buscar en Promociones
      promotionDoc = await Promotion.findOne({
        _id: productId,
        business: businessId,
      }).populate("comboItems.product");
      if (promotionDoc) {
        isPromotion = true;
        // Calcular costo real del bundle
        promotionCost = promotionDoc.comboItems.reduce((sum, item) => {
          const p = item.product;
          const cost = p ? p.averageCost || p.purchasePrice || 0 : 0;
          return sum + cost * item.quantity;
        }, 0);

        // Crear objeto "producto" virtual para compatibilidad
        product = {
          _id: promotionDoc._id,
          name: `📦 ${promotionDoc.name}`,
          purchasePrice: promotionCost, // Costo real
          averageCost: promotionCost,
          distributorPrice: promotionDoc.distributorPrice,
          clientPrice: promotionDoc.promotionPrice,
          warehouseStock: 9999, // Stock virtual, se valida por componentes
        };
        console.log(
          `[${reqId}] ✅ Es una PROMOCIÓN:`,
          promotionDoc.name,
          "Costo:",
          promotionCost,
        );
      } else {
        console.warn(`[${reqId}] ❌ Producto/Promo no encontrado:`, productId);
        return res.status(404).json({ message: "Producto no encontrado" });
      }
    } else {
      console.log(`[${reqId}] ✅ Producto encontrado:`, product.name);
    }

    // Resolver sede (si se envía) y validar stock según el caso
    console.log(`[${reqId}] Validando stock...`);
    let branch = null;
    let branchStock = null;
    let isWarehouseSale = false;

    if (branchId) {
      // Si hay sede, verificar si es bodega o sede normal
      branch = await ensureBranch(businessId, branchId);
      isWarehouseSale = branch.isWarehouse;

      if (!isWarehouseSale && !isPromotion) {
        // Cargar stock de sede solo si no es promo (promo se valida diferente)
        branchStock = await BranchStock.findOne({
          business: businessId,
          branch: branch._id,
          product: productId,
        });
      }
    } else {
      // Sin sede explícita => Bodega
      isWarehouseSale = true;
    }

    // Validación de stock normal (No promo) -- Mantenemos lógica existente simplificada
    if (!isPromotion) {
      if (branchId) {
        branch = await ensureBranch(businessId, branchId);
        if (branch.isWarehouse) {
          isWarehouseSale = true;
          if ((product.warehouseStock || 0) < quantity) {
            return res
              .status(400)
              .json({ message: "Stock insuficiente en bodega" });
          }
        } else {
          branchStock = await BranchStock.findOne({
            branch: branchId,
            product: product._id,
          });
          if (!branchStock || branchStock.quantity < quantity) {
            return res
              .status(400)
              .json({ message: "Stock insuficiente en sede" });
          }
        }
      } else {
        // Default bodega
        if ((product.warehouseStock || 0) < quantity) {
          return res
            .status(400)
            .json({ message: "Stock insuficiente en bodega" });
        }
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

    // Lógica inteligente de fecha:
    // Si la fecha enviada es "hoy", usamos la hora actual para precisión.
    // Si es otra fecha (retroactiva), usamos el inicio del día (00:00).
    let finalSaleDate = new Date();

    if (saleDate) {
      if (saleDate.includes("T")) {
        // Fecha con hora explícita (ISO), usar tal cual
        finalSaleDate = new Date(saleDate);
      } else {
        // Fecha YYYY-MM-DD
        const inputDate = new Date(saleDate); // Esto suele ser UTC 00:00
        const now = new Date();

        // Verificar si es "hoy" comparando fechas en string local/ISO sencillo
        // O usando la utility toColombiaStartOfDay para ver si caen en el mismo día
        const startOfToday = toColombiaStartOfDay(new Date());
        const startOfInput = toColombiaStartOfDay(new Date(saleDate));

        if (startOfInput.getTime() === startOfToday.getTime()) {
          finalSaleDate = now; // Es hoy -> hora actual
        } else {
          finalSaleDate = startOfInput; // Otro día -> 00:00
        }
      }
    } else {
      // Si no envía fecha, usar ahora (con corrección de zona horaria si fuera necesario, pero new Date en server suele estar ok o UTC)
      finalSaleDate = toColombiaStartOfDay(new Date()); // O new Date() si queremos hora. Usemos new Date() para consistencia
      finalSaleDate = new Date();
    }

    const saleData = {
      business: businessId,
      branch: branch?._id,
      distributor: null,
      createdBy: req.user?.id || req.user?.userId, // Usuario que registró la venta
      product: productId,
      quantity,
      purchasePrice: product.purchasePrice || promotionCost,
      averageCostAtSale: isPromotion
        ? promotionCost
        : product.averageCost || product.purchasePrice, // ⭐ Costo Real
      distributorPrice: product.distributorPrice,
      salePrice,
      notes,
      saleDate: finalSaleDate,
      saleGroupId: req.body.saleGroupId || null, // ⭐ Campo para agrupar ventas del mismo carrito
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
      paymentMethod: paymentMethodId || null, // Corregido: usar ID directo
      paymentMethodCode: paymentType || "cash",
      isCredit,
      // Método de entrega
      deliveryMethod: deliveryMethodId || null,
      deliveryMethodCode: deliveryMethodDoc?.code || null,
      shippingCost: shippingCost || deliveryMethodDoc?.defaultCost || 0,
      deliveryAddress: deliveryAddress || null,
      // Costos adicionales y descuento
      additionalCosts: additionalCosts || [],
      discount: discount || 0,
    };

    // ⭐ Categoría para Analytics
    if (isPromotion) {
      // Podríamos agregar un campo virtual o usar category lookup si existiera en Sale schema
      // Pero Sale schema no tiene 'category' explícito, lo saca del producto al popular.
      // Si referenciamos una Promoción, al popular 'product', obtendremos null si no está en Product collection.
      // Solución: Crear Sales híbridas o asegurar que Promotion tenga category?
      // El usuario pidió: "Asegúrate de que las Promociones tengan una category por defecto... al guardarse en la venta"
      // Pero Sale schema no tiene field category. Analytics hace lookup.
      // Analytics probablemente hace `Sale.populate('product')`.
      // Si `product` es Promo, fallará.
      // Dejaremos esto así por ahora y confiaremos en que el costo sí se guarda.
    }

    // Cliente asociado (opcional)
    const { customerDoc, customerData } = await resolveCustomerForSale(
      businessId,
      customerId,
    );
    Object.assign(saleData, customerData);
    console.log(`[${reqId}] Sale data:`, saleData);

    const sale = await Sale.create(saleData);
    console.log(`[${reqId}] ✅ Venta creada:`, sale._id);

    // 🔒 Descontar stock
    if (isPromotion) {
      // Descontar componentes (soporta Bodega o Sede)
      console.log(`[${reqId}] Descontando componentes de promoción...`);
      const deductResult = await deductPromotionComponentStock(
        productId,
        quantity,
        businessId,
        !isWarehouseSale ? branchId : null,
      );
      if (!deductResult.success) {
        await Sale.findByIdAndDelete(sale._id);
        return res.status(400).json({ message: deductResult.error });
      }
    } else {
      // Descuento normal de producto
      const inventoryValueReduction = quantity * saleData.averageCostAtSale;
      if (isWarehouseSale) {
        const updateResult = await Product.findOneAndUpdate(
          {
            _id: productId,
            business: businessId,
            warehouseStock: { $gte: quantity },
          },
          {
            $inc: {
              warehouseStock: -quantity,
              totalStock: -quantity,
              totalInventoryValue: -inventoryValueReduction,
            },
          },
          { new: true },
        );
        if (!updateResult) {
          await Sale.findByIdAndDelete(sale._id);
          return res
            .status(400)
            .json({ message: "Stock insuficiente en bodega (race condition)" });
        }
      } else if (branchStock) {
        const branchUpdate = await BranchStock.findOneAndUpdate(
          { _id: branchStock._id, quantity: { $gte: quantity } },
          { $inc: { quantity: -quantity } },
          { new: true },
        );
        if (!branchUpdate) {
          await Sale.findByIdAndDelete(sale._id);
          return res
            .status(400)
            .json({ message: "Stock insuficiente en sede (race condition)" });
        }
        // También actualizar totalStock del producto
        await Product.findByIdAndUpdate(productId, {
          $inc: {
            totalStock: -quantity,
            totalInventoryValue: -inventoryValueReduction,
          },
        });
      }
    }

    console.log(`[${reqId}] Ô£à Stock actualizado correctamente`);

    console.log(`[${reqId}] ­ƒöä Obteniendo venta con populate...`);
    const populatedSale = await Sale.findById(sale._id).populate(
      "product",
      "name image",
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
        historyError?.message,
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
              cost: Number(product.averageCost || product.purchasePrice || 0),
              image:
                typeof product.image === "string"
                  ? product.image
                  : product.image?.secure_url || null,
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

    // ⭐ Procesar garantías (productos defectuosos asociados a este pedido)
    let createdWarranties = [];
    if (Array.isArray(warranties) && warranties.length > 0) {
      console.log(
        `[${reqId}] 🛡️ Procesando ${warranties.length} productos en garantía...`,
      );

      for (const warranty of warranties) {
        const warrantyProduct = await Product.findOne({
          _id: warranty.productId,
          business: businessId,
        });

        if (!warrantyProduct) {
          console.warn(
            `[${reqId}] ⚠️ Producto de garantía no encontrado:`,
            warranty.productId,
          );
          continue;
        }

        // Validar stock disponible en bodega
        if (warrantyProduct.warehouseStock < warranty.quantity) {
          console.warn(
            `[${reqId}] ⚠️ Stock insuficiente para garantía de ${warrantyProduct.name}`,
          );
          continue;
        }

        // Calcular pérdida basada en hasWarranty
        const purchasePrice = warrantyProduct.purchasePrice || 0;
        const lossAmount = warranty.hasWarranty
          ? 0
          : purchasePrice * warranty.quantity;

        // Crear registro de producto defectuoso
        const defective = await DefectiveProduct.create({
          business: businessId,
          distributor: null, // Venta admin
          product: warranty.productId,
          branch: branch?._id || null,
          quantity: warranty.quantity,
          reason: warranty.hasWarranty
            ? "Garantía - Reposición proveedor"
            : "Garantía - Pérdida sin reposición",
          hasWarranty: warranty.hasWarranty,
          warrantyStatus: warranty.hasWarranty ? "pending" : "not_applicable",
          lossAmount,
          stockOrigin: "warehouse",
          saleGroupId: saleData.saleGroupId || sale._id.toString(),
          origin: "order",
          status: "confirmado", // Confirmar automáticamente
          confirmedAt: new Date(),
          confirmedBy: req.user?.id || req.user?.userId,
        });

        // Descontar stock de bodega
        const avgCost = warrantyProduct.averageCost || purchasePrice;
        const invReduction = warranty.quantity * avgCost;

        await Product.findByIdAndUpdate(warranty.productId, {
          $inc: {
            warehouseStock: -warranty.quantity,
            totalStock: -warranty.quantity,
            totalInventoryValue: -invReduction,
          },
        });

        createdWarranties.push(defective);
        console.log(
          `[${reqId}] 🛡️ Garantía creada para ${warrantyProduct.name}: ${defective._id}`,
        );
      }
    }

    console.log(`[${reqId}] ✅ registerAdminSale SUCCESS`);

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
      warranties:
        createdWarranties.length > 0
          ? createdWarranties.map((w) => ({
              _id: w._id,
              product: w.product,
              quantity: w.quantity,
              hasWarranty: w.hasWarranty,
              lossAmount: w.lossAmount,
            }))
          : [],
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
    let isPromotion = false;
    let promotionDoc = null;

    // Check if it's a Promotion
    // Note: DistributorStock normally doesn't hold 'Promotion' items, only 'Products'.
    // If productId is a Promotion, we must validate COMPONENT stock in DistributorStock.
    // We try Product first, if not found, try Promotion.

    let product = await Product.findOne({
      _id: productId,
      business: businessId,
    });
    if (!product) {
      promotionDoc = await Promotion.findOne({
        _id: productId,
        business: businessId,
      }).populate("comboItems.product");
      if (promotionDoc) {
        isPromotion = true;

        // Calcular Costo Real del Admin (Suma de los costos de componentes)
        const promotionCost = promotionDoc.comboItems.reduce((sum, item) => {
          const p = item.product;
          const cost = p ? p.averageCost || p.purchasePrice || 0 : 0;
          return sum + cost * item.quantity;
        }, 0);

        // Construct virtual product
        product = {
          _id: promotionDoc._id,
          name: `📦 ${promotionDoc.name}`,
          purchasePrice: promotionCost, // ⭐ IMPORTANTE: Costo real para el Admin
          distributorPrice: promotionDoc.distributorPrice, // Precio al que se vendió al dist
          averageCost: promotionCost,
        };
      } else {
        return res
          .status(404)
          .json({ message: "Producto o Promoción no encontrada" });
      }
    }

    if (usesBranchStock) {
      branch = await ensureBranch(businessId, branchId);
      // Branch sales logic (assuming standard BranchStock logic even for Distributors if enabled)
    } else {
      // Venta con stock propio del distribuidor
      if (isPromotion) {
        // Validar stock antes de intentar descontar
        // Nota: deductDistributorPromotionStock realiza el descuento.
        // Aquí solo validamos existencia.
        const DistributorStock = (await import("../models/DistributorStock.js"))
          .default;
        for (const item of promotionDoc.comboItems || []) {
          // Safety Check: if product reference is broken
          if (!item.product) continue;

          const ds = await DistributorStock.findOne({
            distributor: distributorId,
            product: item.product._id,
          });
          // HOTFIX: Null check for stock record
          const currentStock = ds ? ds.quantity : 0;

          if (currentStock < (item.quantity || 1) * quantity) {
            return res.status(400).json({
              message: `Stock insuficiente de componente ${item.product.name} (Pack). Tienes ${currentStock}, necesitas ${(item.quantity || 1) * quantity}`,
            });
          }
        }
      } else {
        // Normal Product
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
    }

    // Obtener precios del producto
    // Verify product/promotion
    // Already did findOne above.
    // Ensure product is set.

    const { customerDoc, customerData } = await resolveCustomerForSale(
      businessId,
      customerId,
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
      businessId,
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
      productName: product.name, // 📸 Snapshot
      quantity,
      purchasePrice: product.purchasePrice || 0,
      averageCostAtSale, // Guardar costo promedio para cálculo de ganancias
      distributorPrice: product.distributorPrice || 0, // Fallback safe to avoid Validation Error
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

      // 🔒 Descontar stock de forma ATÓMICA para evitar condiciones de carrera
      const branchUpdateResult = await BranchStock.findOneAndUpdate(
        {
          _id: branchStock._id,
          quantity: { $gte: quantity },
        },
        { $inc: { quantity: -quantity } },
        { new: true },
      );

      if (!branchUpdateResult) {
        // Si falla la actualización atómica, eliminar la venta y devolver error
        await Sale.findByIdAndDelete(sale._id);
        console.error(
          `[ATOMIC STOCK ERROR] Stock concurrente falló para producto ${productId}, branchStock ${branchStock._id}, cantidad requerida: ${quantity}, stock disponible al momento de validación: ${branchStock.quantity}`,
        );
        return res.status(400).json({
          message: `Stock insuficiente en la sede. Disponible: ${branchStock.quantity}`,
        });
      }

      // Actualizar totalStock y totalInventoryValue del producto de forma atómica
      const inventoryValueReduction = quantity * averageCostAtSale;
      await Product.findByIdAndUpdate(productId, {
        $inc: {
          totalStock: -quantity,
          totalInventoryValue: -inventoryValueReduction,
        },
      });

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
          historyError,
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
        remainingStock: branchUpdateResult.quantity,
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

      // Actualizar estadísticas del distribuidor
      await updateDistributorStats(distributorId, sale);

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
      if (
        branchUpdateResult.quantity <= 10 &&
        branchUpdateResult.quantity > 0
      ) {
        void NotificationService.notifyLowStock({
          businessId,
          productId: product._id,
          productName: product.name,
          currentStock: branchUpdateResult.quantity,
          threshold: 10,
          requestId: req.reqId,
        });
      }
      return;
    }

    // Venta con stock del distribuidor
    const sale = await Sale.create(saleData);

    if (isPromotion) {
      // Descontar componentes de la promoción
      const deductRes = await deductDistributorPromotionStock(
        distributorId,
        productId,
        quantity,
        businessId,
      );
      if (!deductRes.success) {
        await Sale.findByIdAndDelete(sale._id);
        return res.status(400).json({ message: deductRes.error });
      }
    } else {
      // Descuento normal de producto
      distributorStock.quantity -= quantity;
      await distributorStock.save();

      product.totalStock -= quantity;
      // Actualizar valor total del inventario
      const inventoryValueReduction = quantity * averageCostAtSale;
      product.totalInventoryValue = Math.max(
        (product.totalInventoryValue || 0) - inventoryValueReduction,
        0,
      );
      await product.save();
    }

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
              cost: Number(product.averageCost || product.purchasePrice || 0),
              image:
                typeof product.image === "string"
                  ? product.image
                  : product.image?.secure_url || null,
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

    // Actualizar estadísticas del distribuidor
    await updateDistributorStats(distributorId, sale);

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
    console.error("❌ Error en registerSale:", error);
    console.error("Stack:", error.stack);
    const status = error?.statusCode || 500;
    res.status(status).json({ message: error.message, stack: error.stack });
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

    // Si no es admin/super_admin/god y está consultando otro distribuidor, denegar
    const canViewAll = ["god", "super_admin", "admin"].includes(req.user.role);
    if (!canViewAll && distributorId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "No puedes ver ventas de otros distribuidores" });
    }

    const { startDate, endDate, productId } = req.query;

    // Convertir a ObjectId para asegurar coincidencia en agregaciones
    const distributorObjectId = new mongoose.Types.ObjectId(distributorId);
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const filter = {
      distributor: distributorObjectId,
      business: businessObjectId,
    };
    Object.assign(filter, branchFilter);

    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    if (productId) filter.product = new mongoose.Types.ObjectId(productId);

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
        "product distributor salePrice quantity saleDate distributorProfit adminProfit saleStatus paymentStatus isCredit creditId notes customer distributorProfitPercentage saleId",
      )
      .populate("product", "name image")
      .populate("distributor", "name email")
      .populate("customer", "name phone")
      .populate(
        "creditId",
        "originalAmount paidAmount remainingAmount status dueDate",
      )
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
      saleGroupId: 1,
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
      averageCostAtSale: 1,
      adminProfit: 1,
      distributorProfit: 1,
      totalProfit: 1,
      // Campos de costos adicionales y ganancia neta
      netProfit: 1,
      additionalCosts: 1,
      totalAdditionalCosts: 1,
      shippingCost: 1,
      discount: 1,
      actualPayment: 1,
      distributorProfitPercentage: 1,
      notes: 1,
      distributor: 1,
      createdBy: 1,
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
          // Removed standard populate to handle mixed Product/Promotion IDs
          .populate("distributor", "name email phone address")
          .populate("createdBy", "name email")
          .populate("branch", "name")
          .sort(sortOption)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Sale.countDocuments(filter),
      ]);

      // 🛠️ Manual Hydration: Fetch Products and Promotions in parallel
      // This fixes the issue where Promotions showed as "N/A" because they aren't in the Product collection
      const productIds = [
        ...new Set(foundSales.map((s) => s.product).filter(Boolean)),
      ];

      const [productsData, promotionsData] = await Promise.all([
        Product.find({ _id: { $in: productIds } })
          .select("name image description")
          .lean(),
        Promotion.find({ _id: { $in: productIds } })
          .select("name image description")
          .lean(),
      ]);

      const productMap = new Map();
      productsData.forEach((p) => productMap.set(p._id.toString(), p));
      promotionsData.forEach((p) =>
        productMap.set(p._id.toString(), { ...p, isPromotion: true }),
      );

      // Attach hydrated product/promotion data to sales and RECALCULATE ADMIN PROFIT
      sales = foundSales.map((sale) => {
        const productId = sale.product ? sale.product.toString() : null;
        const productOrPromo = productId
          ? productMap.get(productId) || null
          : null;

        // --- REAL NET PROFIT LOGIC (Requested by User) ---
        // 1. Gross Revenue (Price * Qty - Commission) | Using saved distributor stats or calc
        const grossRevenue =
          sale.salePrice * sale.quantity - (sale.distributorProfit || 0);

        // 2. Costs
        // FIX: The debugging showed that averageCostAtSale was 10714 (10k + 714 phantom shipping).
        // To fix the display, we must use purchasePrice (10000) if averageCostAtSale is inflated.
        // We prioritizing purchasePrice if it exists, as that seems to be the user's "Real Cost" anchor.
        let unitCost = sale.purchasePrice || sale.averageCostAtSale || 0;

        if (!unitCost && productOrPromo) {
          unitCost =
            productOrPromo.averageCost || productOrPromo.purchasePrice || 0;
        }
        const productCost = unitCost * sale.quantity;

        const shipping = sale.shippingCost || 0;
        const discount = sale.discount || 0;
        const extras = sale.totalAdditionalCosts || 0;

        // 3. Real Net Profit
        const realNetProfit =
          grossRevenue - productCost - shipping - discount - extras;

        return {
          ...sale,
          product: productOrPromo,
          // OVERWRITE adminProfit with Real Net Profit for display
          adminProfit: Math.round(realNetProfit),
          // Also overwrite netProfit to match, avoiding confusion ($9285 vs $6000)
          netProfit: Math.round(realNetProfit),
          // Keep original raw values accessible if needed under other keys?
          // User asked to "Ensure the adminProfit field uses this Strict Formula"
          originalAdminProfit: sale.adminProfit,
        };
      });

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
        }/${total} in ${Date.now() - tListStart}ms`,
      );
    }
    // Calcular estadísticas
    const canIncludeSpecials =
      includeSpecials &&
      (!paymentStatus || paymentStatus === "confirmado") &&
      !distributorId;

    const tAggStart = Date.now();

    // Agregación de ventas con lookup a créditos para determinar si las ganancias deben contar
    const salesAgg = await Sale.aggregate([
      {
        $match: {
          ...filter,
          business: new mongoose.Types.ObjectId(businessId),
        },
      },
      // Lookup para obtener información de crédito asociado
      {
        $lookup: {
          from: "credits",
          localField: "_id",
          foreignField: "sale",
          as: "creditInfo",
        },
      },
      {
        $addFields: {
          // Una venta a crédito tiene creditInfo con status diferente de "paid"
          hasPendingCredit: {
            $cond: {
              if: { $gt: [{ $size: "$creditInfo" }, 0] },
              then: {
                $ne: [{ $arrayElemAt: ["$creditInfo.status", 0] }, "paid"],
              },
              else: false,
            },
          },
          // Determinar si el crédito está pagado
          creditIsPaid: {
            $cond: {
              if: { $gt: [{ $size: "$creditInfo" }, 0] },
              then: {
                $eq: [{ $arrayElemAt: ["$creditInfo.status", 0] }, "paid"],
              },
              else: true, // Si no hay crédito, consideramos las ganancias válidas
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          // Contar órdenes únicas por saleGroupId (una venta puede tener múltiples productos)
          saleGroupIds: { $addToSet: { $ifNull: ["$saleGroupId", "$_id"] } },
          totalQuantity: { $sum: "$quantity" },
          // Ganancias de distribuidor: solo sumar si no hay crédito pendiente
          totalDistributorProfit: {
            $sum: {
              $cond: ["$creditIsPaid", "$distributorProfit", 0],
            },
          },
          // Ganancias de admin: solo sumar si no hay crédito pendiente
          totalAdminProfit: {
            $sum: {
              $cond: ["$creditIsPaid", "$adminProfit", 0],
            },
          },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          // Ingresos confirmados: solo ventas sin crédito pendiente
          confirmedRevenue: {
            $sum: {
              $cond: [
                "$creditIsPaid",
                { $multiply: ["$salePrice", "$quantity"] },
                0,
              ],
            },
          },
          confirmedSales: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "confirmado"] }, 1, 0] },
          },
          pendingSales: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "pendiente"] }, 1, 0] },
          },
          // Ganancia total: solo sumar si no hay crédito pendiente
          totalProfit: {
            $sum: {
              $cond: ["$creditIsPaid", "$totalProfit", 0],
            },
          },
          // NUEVAS MÉTRICAS: Para separar ganancias realizadas vs pendientes de crédito
          totalProfitFromCreditSales: {
            $sum: {
              $cond: [
                { $gt: [{ $size: "$creditInfo" }, 0] },
                "$totalProfit",
                0,
              ],
            },
          },
          realizedProfitFromCredits: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: [{ $size: "$creditInfo" }, 0] },
                    "$creditIsPaid",
                  ],
                },
                "$totalProfit",
                0,
              ],
            },
          },
          pendingProfitFromCredits: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: [{ $size: "$creditInfo" }, 0] },
                    { $not: "$creditIsPaid" },
                  ],
                },
                "$totalProfit",
                0,
              ],
            },
          },
          creditSalesCount: {
            $sum: {
              $cond: [{ $gt: [{ $size: "$creditInfo" }, 0] }, 1, 0],
            },
          },
          paidCreditSalesCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: [{ $size: "$creditInfo" }, 0] },
                    "$creditIsPaid",
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]).option(aggOptions);
    console.log(
      `[${req.reqId || "no-id"}] sales:stats aggregate in ${
        Date.now() - tAggStart
      }ms`,
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
      confirmedRevenue: 0,
      confirmedSales: 0,
      pendingSales: 0,
      totalProfit: 0,
      // Nuevas métricas de créditos
      creditSalesCount: 0,
      paidCreditSalesCount: 0,
      totalProfitFromCreditSales: 0,
      realizedProfitFromCredits: 0,
      pendingProfitFromCredits: 0,
      // Contar órdenes únicas (agrupadas por saleGroupId)
      totalOrders: salesStats?.saleGroupIds?.length || 0,
      ...(salesStats || {}),
    };

    // Eliminar el array de IDs ya que no se necesita en la respuesta
    delete stats.saleGroupIds;

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

    // === VALIDACIÓN DE CRÉDITO ===
    // Si es una venta a crédito, verificar que el crédito esté completamente pagado
    if (sale.paymentType === "credit" || sale.isCredit === true) {
      const Credit = (await import("../models/Credit.js")).default;
      const credit = await Credit.findOne({ sale: sale._id });

      if (credit && credit.status !== "paid") {
        return res.status(400).json({
          message:
            "No se puede confirmar una venta a crédito hasta que se pague completamente el fiado",
          creditStatus: credit.status,
          remainingAmount: credit.remainingAmount,
          suggestion:
            "Registre los pagos del crédito primero. La venta se confirmará automáticamente al completar el pago.",
        });
      }
    }

    // Marcar la venta como confirmada si aún está pendiente
    if (sale.paymentStatus !== "confirmado") {
      sale.paymentStatus = "confirmado";
      sale.isConfirmed = true;
      sale.paymentConfirmedAt = new Date();
      sale.confirmedAt = new Date();
      sale.paymentConfirmedBy = req.user?.id || req.user?._id || null;
      sale.confirmedBy = req.user?.id || req.user?._id || null;
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

// @desc    Obtener ventas optimizado (lectura rápida)
// @route   GET /api/sales/optimized
// @access  Private/Admin
export const getSalesOptimized = async (req, res) => {
  const reqId = Date.now();
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
      allTime,
    } = req.query;

    console.log(
      `[OPTIMIZED_DEBUG] BusinessId: ${businessId}, Query:`,
      req.query,
    );

    const filter = { business: businessId };

    if (req.query.branchId) {
      filter.branch = new mongoose.Types.ObjectId(req.query.branchId);
    }

    // Filtros de fecha optimizados
    const mustDefaultDateRange =
      !startDate && !endDate && String(allTime) !== "true";

    if (startDate || endDate || mustDefaultDateRange) {
      filter.saleDate = {};
      if (startDate) {
        filter.saleDate.$gte = new Date(startDate);
      } else if (mustDefaultDateRange) {
        // Últimos 30 días si no se especifica nada
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        filter.saleDate.$gte = thirtyDaysAgo;
      }
      if (endDate) {
        filter.saleDate.$lte = new Date(endDate);
      }
    }

    console.log(
      `[OPTIMIZED_DEBUG] Final Filter:`,
      JSON.stringify(filter, null, 2),
    );

    if (distributorId) filter.distributor = distributorId;
    if (productId) filter.product = productId;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // Ordenamiento
    let sortOption = { saleDate: -1 };
    if (sortBy === "date-asc") {
      sortOption = { saleDate: 1 };
    } else if (sortBy === "distributor") {
      sortOption = { "distributor.name": 1 };
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // 🚀 OPTIMIZACIÓN REALIZADA
    // 1. Proyección estricta (select)
    // 2. Populate solo con campos necesarios
    // 3. lean({ virtuals: true }) para evitar hidratación de documentos pero mantener getters
    const tStart = Date.now();

    const sales = await Sale.find(filter)
      .select(
        "saleId saleDate paymentStatus quantity salePrice totalProfit netProfit distributor product branch customer createdBy notes isCredit creditId",
      )
      .populate("product", "name image")
      .populate("distributor", "name email")
      .populate("branch", "name")
      .populate("customer", "name") // Solo nombre del cliente
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean({ virtuals: true });

    // También traemos el count para la paginación (optimizado con countDocuments)
    const total = await Sale.countDocuments(filter);

    const tEnd = Date.now();

    console.log(
      `[OPTIMIZED] Fetch sales: ${sales.length} items in ${tEnd - tStart}ms`,
    );

    res.json({
      sales,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      performance: {
        timeMs: tEnd - tStart,
        items: sales.length,
      },
    });
  } catch (error) {
    console.error("Error in getSalesOptimized:", error);
    res.status(500).json({ message: error.message });
  }
};
