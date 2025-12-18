import dotenv from "dotenv";
import mongoose from "mongoose";

import Sale from "../models/Sale.js";
import ProfitHistory from "../models/ProfitHistory.js";
import User from "../models/User.js";
import {
  recordProfitHistory,
  recalculateUserBalance,
} from "../services/profitHistory.service.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

const toKey = (saleId, userId) => `${String(saleId)}:${String(userId)}`;

async function main() {
  if (!mongoUri) {
    throw new Error("MONGODB_URI no está definida en el entorno");
  }

  await mongoose.connect(mongoUri);

  const adminUser = await User.findOne({ role: "admin" }).select("_id").lean();
  if (!adminUser?._id) {
    throw new Error("No se encontró usuario admin");
  }

  const [sales, existing] = await Promise.all([
    Sale.find({})
      .select(
        "_id saleId distributor product quantity salePrice saleDate distributorProfit adminProfit distributorProfitPercentage commissionBonus"
      )
      .sort({ saleDate: 1 })
      .lean(),
    ProfitHistory.find({ type: "venta_normal", sale: { $ne: null } })
      .select("sale user")
      .lean(),
  ]);

  const existingKeys = new Set(existing.map(e => toKey(e.sale, e.user)));
  const affectedUsers = new Set();

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < sales.length; i++) {
    const sale = sales[i];

    const desired = [];

    if (sale.distributor && sale.distributorProfit > 0) {
      desired.push({
        userId: sale.distributor,
        amount: sale.distributorProfit,
        description: `Comisión por venta ${sale.saleId}`,
        metadata: {
          quantity: sale.quantity,
          salePrice: sale.salePrice,
          saleId: sale.saleId,
          commission: sale.distributorProfitPercentage,
          commissionBonus: sale.commissionBonus,
        },
      });
    }

    if (sale.adminProfit > 0) {
      desired.push({
        userId: adminUser._id,
        amount: sale.adminProfit,
        description: sale.distributor
          ? `Ganancia de venta ${sale.saleId} (distribuidor)`
          : `Venta directa ${sale.saleId}`,
        metadata: {
          quantity: sale.quantity,
          salePrice: sale.salePrice,
          saleId: sale.saleId,
        },
      });
    }

    for (const entry of desired) {
      const key = toKey(sale._id, entry.userId);
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      await recordProfitHistory({
        userId: entry.userId,
        type: "venta_normal",
        amount: entry.amount,
        description: entry.description,
        saleId: sale._id,
        productId: sale.product,
        metadata: entry.metadata,
        date: sale.saleDate,
      });

      existingKeys.add(key);
      affectedUsers.add(String(entry.userId));
      created++;
    }

    if ((i + 1) % 250 === 0) {
      console.log(
        `Progreso: ${i + 1}/${sales.length} ventas procesadas | created=${created} skipped=${skipped}`
      );
    }
  }

  let usersUpdated = 0;
  for (const userId of affectedUsers) {
    await recalculateUserBalance(userId);
    usersUpdated++;
    if (usersUpdated % 25 === 0) {
      console.log(`Recalculando balances: ${usersUpdated}/${affectedUsers.size}`);
    }
  }

  console.log("\n✅ Backfill completado");
  console.log({ scannedSales: sales.length, created, skipped, usersUpdated });

  await mongoose.disconnect();
}

main().catch(async err => {
  console.error("❌ Backfill falló:", err?.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
