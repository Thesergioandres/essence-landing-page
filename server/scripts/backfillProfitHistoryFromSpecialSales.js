import dotenv from "dotenv";
import mongoose from "mongoose";

import Membership from "../src/infrastructure/database/models/Membership.js";
import ProfitHistory from "../src/infrastructure/database/models/ProfitHistory.js";
import SpecialSale from "../src/infrastructure/database/models/SpecialSale.js";
import User from "../src/infrastructure/database/models/User.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

const toKey = (specialSaleId, userId) =>
  `${String(specialSaleId)}:${String(userId)}`;

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

async function buildUserMaps(businessIds) {
  const memberships = await Membership.find({
    business: { $in: businessIds },
    role: { $in: ["admin", "employee"] },
    status: "active",
  })
    .select("business user role")
    .lean();

  const userIds = [...new Set(memberships.map((m) => String(m.user)))];
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id name email")
    .lean();
  const usersById = new Map(users.map((u) => [String(u._id), u]));

  const adminByBusiness = new Map();
  const employeesByBusiness = new Map();

  for (const membership of memberships) {
    const businessId = String(membership.business);
    const userId = String(membership.user);
    const user = usersById.get(userId);

    if (membership.role === "admin" && userId) {
      adminByBusiness.set(businessId, userId);
    }

    if (membership.role === "employee" && user?.name) {
      const key = normalizeName(user.name);
      if (!employeesByBusiness.has(businessId)) {
        employeesByBusiness.set(businessId, new Map());
      }
      const map = employeesByBusiness.get(businessId);
      if (!map.has(key)) {
        map.set(key, userId);
      }
    }
  }

  return { adminByBusiness, employeesByBusiness };
}

async function main() {
  if (!mongoUri) {
    throw new Error("MONGODB_URI no está definida en el entorno");
  }

  await mongoose.connect(mongoUri);

  const [specialSales, existing] = await Promise.all([
    SpecialSale.find({ status: "active" })
      .select(
        "business product quantity specialPrice cost totalProfit distribution eventName saleDate",
      )
      .sort({ saleDate: 1 })
      .lean(),
    ProfitHistory.find({ type: "venta_especial", specialSale: { $ne: null } })
      .select("specialSale user")
      .lean(),
  ]);

  const businessIds = [...new Set(specialSales.map((s) => String(s.business)))];
  const { adminByBusiness, employeesByBusiness } =
    await buildUserMaps(businessIds);

  const existingKeys = new Set(
    existing.map((e) => toKey(e.specialSale, e.user)),
  );

  let created = 0;
  let skipped = 0;
  let unresolved = 0;
  let missingAdmin = 0;

  for (let i = 0; i < specialSales.length; i++) {
    const sale = specialSales[i];
    const businessId = String(sale.business);
    const distribution = Array.isArray(sale.distribution)
      ? sale.distribution
      : [];

    const totalProfit =
      typeof sale.totalProfit === "number"
        ? sale.totalProfit
        : sale.specialPrice * sale.quantity - sale.cost * sale.quantity;

    const distributionSum = distribution.reduce(
      (sum, dist) => sum + (Number(dist.amount) || 0),
      0,
    );
    const remainingProfit = Math.max(totalProfit - distributionSum, 0);

    const employeeMap = employeesByBusiness.get(businessId) || new Map();

    for (const dist of distribution) {
      const amount = Number(dist.amount) || 0;
      if (amount <= 0) continue;

      const nameKey = normalizeName(dist.name);
      const userId = employeeMap.get(nameKey);

      if (!userId) {
        unresolved++;
        continue;
      }

      const key = toKey(sale._id, userId);
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      await ProfitHistory.create({
        business: sale.business,
        user: userId,
        type: "venta_especial",
        amount,
        specialSale: sale._id,
        product: sale.product?.productId || undefined,
        description: sale.eventName
          ? `Comisión venta especial (${sale.eventName})`
          : `Comisión venta especial: ${sale.product?.name || ""}`,
        date: sale.saleDate || new Date(),
        metadata: {
          eventName: sale.eventName,
          quantity: sale.quantity,
          specialPrice: sale.specialPrice,
          cost: sale.cost,
          commission: amount,
          percentage: dist.percentage,
          specialSaleId: sale._id,
        },
      });

      existingKeys.add(key);
      created++;
    }

    if (remainingProfit > 0) {
      const adminUserId = adminByBusiness.get(businessId);
      if (!adminUserId) {
        missingAdmin++;
      } else {
        const key = toKey(sale._id, adminUserId);
        if (existingKeys.has(key)) {
          skipped++;
        } else {
          await ProfitHistory.create({
            business: sale.business,
            user: adminUserId,
            type: "venta_especial",
            amount: remainingProfit,
            specialSale: sale._id,
            product: sale.product?.productId || undefined,
            description: sale.eventName
              ? `Ganancia venta especial (${sale.eventName})`
              : `Ganancia venta especial: ${sale.product?.name || ""}`,
            date: sale.saleDate || new Date(),
            metadata: {
              eventName: sale.eventName,
              quantity: sale.quantity,
              specialPrice: sale.specialPrice,
              cost: sale.cost,
              specialSaleId: sale._id,
            },
          });
          existingKeys.add(key);
          created++;
        }
      }
    }

    if ((i + 1) % 200 === 0) {
      console.log(
        `Progreso: ${i + 1}/${specialSales.length} ventas especiales | created=${created} skipped=${skipped} unresolved=${unresolved}`,
      );
    }
  }

  console.log("\n✅ Backfill completado");
  console.log({
    scannedSpecialSales: specialSales.length,
    created,
    skipped,
    unresolved,
    missingAdmin,
  });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("❌ Backfill falló:", err?.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
