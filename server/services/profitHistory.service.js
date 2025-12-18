import mongoose from "mongoose";
import ProfitHistory from "../models/ProfitHistory.js";

/**
 * Registra una entrada en el historial de ganancias
 * @param {Object} data - Datos del movimiento
 * @param {mongoose.Types.ObjectId} data.userId - ID del usuario
 * @param {String} data.type - Tipo de movimiento (venta_normal, venta_especial, ajuste, bonus)
 * @param {Number} data.amount - Monto de la ganancia
 * @param {String} data.description - Descripción del movimiento
 * @param {mongoose.Types.ObjectId} data.saleId - ID de la venta (opcional)
 * @param {mongoose.Types.ObjectId} data.specialSaleId - ID de la venta especial (opcional)
 * @param {mongoose.Types.ObjectId} data.productId - ID del producto (opcional)
 * @param {Object} data.metadata - Metadata adicional (opcional)
 */
export const recordProfitHistory = async (data) => {
  try {
    const {
      userId,
      type,
      amount,
      description,
      saleId,
      specialSaleId,
      productId,
      metadata = {},
      date,
    } = data;

    // Obtener balance actual del usuario
    const lastEntry = await ProfitHistory.findOne({ user: userId })
      .sort({ date: -1 })
      .lean();

    const currentBalance = lastEntry?.balanceAfter || 0;
    const newBalance = currentBalance + amount;

    // Crear entrada en el historial
    const entry = await ProfitHistory.create({
      user: userId,
      type,
      amount,
      description,
      sale: saleId,
      specialSale: specialSaleId,
      product: productId,
      balanceAfter: newBalance,
      metadata,
      date: date || new Date(),
    });

    return entry;
  } catch (error) {
    console.error("Error registrando historial de ganancia:", error);
    // No lanzar error para no interrumpir el flujo principal
    return null;
  }
};

/**
 * Registra ganancia de venta normal (distribuidor y admin)
 * @param {Object} sale - Documento de venta
 */
export const recordSaleProfit = async (sale) => {
  try {
    // Aceptar saleId (string/ObjectId) o documento
    let saleDoc = sale;
    if (typeof sale === "string" || sale instanceof mongoose.Types.ObjectId) {
      const Sale = mongoose.model("Sale");
      saleDoc = await Sale.findById(sale).lean();
      if (!saleDoc) {
        console.warn("Venta no encontrada para registrar ganancia:", sale);
        return;
      }
    }

    const metadata = {
      quantity: saleDoc.quantity,
      salePrice: saleDoc.salePrice,
      saleId: saleDoc.saleId,
    };

    // Registrar ganancia del distribuidor (si existe)
    if (saleDoc.distributor && saleDoc.distributorProfit > 0) {
      await recordProfitHistory({
        userId: saleDoc.distributor,
        type: "venta_normal",
        amount: saleDoc.distributorProfit,
        description: `Comisión por venta ${saleDoc.saleId}`,
        saleId: saleDoc._id,
        productId: saleDoc.product,
        metadata: {
          ...metadata,
          commission: saleDoc.distributorProfitPercentage,
          commissionBonus: saleDoc.commissionBonus,
        },
        date: saleDoc.saleDate,
      });
    }

    // Registrar ganancia del admin
    if (saleDoc.adminProfit > 0) {
      // Obtener ID del admin
      const User = mongoose.model("User");
      const admin = await User.findOne({ role: "admin" });

      if (admin) {
        await recordProfitHistory({
          userId: admin._id,
          type: "venta_normal",
          amount: saleDoc.adminProfit,
          description: saleDoc.distributor
            ? `Ganancia de venta ${saleDoc.saleId} (distribuidor)`
            : `Venta directa ${saleDoc.saleId}`,
          saleId: saleDoc._id,
          productId: saleDoc.product,
          metadata,
          date: saleDoc.saleDate,
        });
      }
    }
  } catch (error) {
    console.error("Error registrando ganancia de venta:", error);
  }
};

/**
 * Registra ganancia de venta especial (distribución múltiple)
 * @param {mongoose.Types.ObjectId|Object} specialSaleIdOrDoc - ID o documento de venta especial
 */
export const recordSpecialSaleProfit = async (specialSaleIdOrDoc) => {
  try {
    const SpecialSale = mongoose.model("SpecialSale");

    // Si es un ID, buscar el documento completo
    let specialSale;
    if (
      typeof specialSaleIdOrDoc === "string" ||
      specialSaleIdOrDoc instanceof mongoose.Types.ObjectId
    ) {
      specialSale = await SpecialSale.findById(specialSaleIdOrDoc);
      if (!specialSale) {
        console.error("Venta especial no encontrada:", specialSaleIdOrDoc);
        return;
      }
    } else {
      specialSale = specialSaleIdOrDoc;
    }

    const metadata = {
      quantity: specialSale.quantity,
      salePrice: specialSale.specialPrice,
      eventName: specialSale.eventName,
    };

    // Registrar ganancia para cada distribuidor en la distribución
    for (const dist of specialSale.distribution) {
      // Buscar usuario por nombre (puede mejorarse con ID directo)
      const User = mongoose.model("User");
      let user;

      const nameLower = dist.name?.toLowerCase() || "";

      if (nameLower.includes("admin")) {
        user = await User.findOne({ role: "admin" });
      } else {
        // Intentar buscar por nombre exacto o similar
        user = await User.findOne({
          name: { $regex: new RegExp(dist.name, "i") },
          role: "distribuidor",
        });
      }

      if (user && dist.amount > 0) {
        await recordProfitHistory({
          userId: user._id,
          type: "venta_especial",
          amount: dist.amount,
          description: `Venta especial: ${specialSale.product.name}${
            specialSale.eventName ? ` (${specialSale.eventName})` : ""
          }`,
          specialSaleId: specialSale._id,
          productId: specialSale.product.productId,
          metadata: {
            ...metadata,
            percentage: dist.percentage,
            distributionNotes: dist.notes,
          },
          date: specialSale.saleDate,
        });
      }
    }
  } catch (error) {
    console.error("Error registrando ganancia de venta especial:", error);
  }
};

/**
 * Recalcula el balance acumulado de un usuario
 * @param {mongoose.Types.ObjectId} userId - ID del usuario
 */
export const recalculateUserBalance = async (userId) => {
  try {
    const entries = await ProfitHistory.find({ user: userId })
      .sort({ date: 1 })
      .lean();

    let balance = 0;
    const updates = [];

    for (const entry of entries) {
      balance += entry.amount;

      if (entry.balanceAfter !== balance) {
        updates.push({
          updateOne: {
            filter: { _id: entry._id },
            update: { $set: { balanceAfter: balance } },
          },
        });
      }
    }

    if (updates.length > 0) {
      await ProfitHistory.bulkWrite(updates);
    }

    return balance;
  } catch (error) {
    console.error("Error recalculando balance:", error);
    throw error;
  }
};

export default {
  recordProfitHistory,
  recordSaleProfit,
  recordSpecialSaleProfit,
  recalculateUserBalance,
};
