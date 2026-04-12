import dotenv from "dotenv";
import mongoose from "mongoose";
import Membership from "../src/infrastructure/database/models/Membership.js";
import ProfitHistory from "../src/infrastructure/database/models/ProfitHistory.js";
import Sale from "../src/infrastructure/database/models/Sale.js";

dotenv.config();

const args = process.argv.slice(2);

const hasFlag = (flag) => args.includes(flag);
const getArgValue = (flag) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  const next = args[idx + 1];
  if (!next || next.startsWith("--")) return null;
  return next;
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const isDifferent = (a, b, epsilon = 0.01) => Math.abs(a - b) > epsilon;

const buildDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return null;

  const range = {};

  if (startDate) {
    const start = new Date(startDate);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      range.$gte = start;
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
  }

  return Object.keys(range).length > 0 ? range : null;
};

const projection = {
  _id: 1,
  business: 1,
  saleId: 1,
  saleDate: 1,
  isPromotion: 1,
  employee: 1,
  quantity: 1,
  salePrice: 1,
  purchasePrice: 1,
  averageCostAtSale: 1,
  employeePrice: 1,
  employeeProfitPercentage: 1,
  commissionBonus: 1,
  commissionBonusAmount: 1,
  employeeProfit: 1,
  adminProfit: 1,
  totalProfit: 1,
  totalGroupProfit: 1,
  netProfit: 1,
  discount: 1,
  shippingCost: 1,
  totalAdditionalCosts: 1,
  additionalCosts: 1,
  profitabilityPercentage: 1,
  costPercentage: 1,
  paymentStatus: 1,
};

const getBusinessAdminMap = async (businessIds) => {
  if (!businessIds.length) return new Map();

  const adminMemberships = await Membership.find({
    business: { $in: businessIds.map((id) => new mongoose.Types.ObjectId(id)) },
    role: "admin",
    status: "active",
  })
    .select("business user")
    .lean();

  return new Map(
    adminMemberships.map((m) => [
      String(m.business),
      m.user ? String(m.user) : null,
    ]),
  );
};

const buildSaleUpdates = (sale) => {
  const quantity = Math.max(0, toNumber(sale.quantity, 0));
  const salePrice = Math.max(0, toNumber(sale.salePrice, 0));
  const saleAmount = salePrice * quantity;
  const costBasis = Math.max(
    0,
    toNumber(sale.averageCostAtSale, toNumber(sale.purchasePrice, 0)),
  );

  const totalAdditionalCostsFromArray = Array.isArray(sale.additionalCosts)
    ? sale.additionalCosts.reduce(
        (sum, cost) => sum + Math.max(0, toNumber(cost?.amount, 0)),
        0,
      )
    : 0;

  const totalAdditionalCosts =
    sale.totalAdditionalCosts !== null &&
    sale.totalAdditionalCosts !== undefined
      ? Math.max(0, toNumber(sale.totalAdditionalCosts, 0))
      : totalAdditionalCostsFromArray;

  const discount = Math.max(0, toNumber(sale.discount, 0));
  const shippingCost = Math.max(0, toNumber(sale.shippingCost, 0));
  const isEmployeeSale = Boolean(sale.employee);

  const rawPct = toNumber(sale.employeeProfitPercentage, 20);
  const cappedPct = isEmployeeSale ? clamp(rawPct, 0, 95) : 0;

  let employeePrice = toNumber(sale.employeePrice, salePrice);

  if (isEmployeeSale) {
    if (sale.isPromotion) {
      if (employeePrice <= 0) {
        employeePrice = salePrice * ((100 - cappedPct) / 100);
      }
    } else {
      employeePrice = salePrice * ((100 - cappedPct) / 100);
    }
  } else {
    employeePrice = salePrice;
  }

  const employeeProfit = isEmployeeSale
    ? (salePrice - employeePrice) * quantity
    : 0;

  const adminProfit = saleAmount - costBasis * quantity - employeeProfit;
  const totalProfit = adminProfit + employeeProfit;
  const netProfit =
    adminProfit - totalAdditionalCosts - shippingCost - discount;

  const profitabilityPercentage =
    saleAmount > 0 ? (netProfit / saleAmount) * 100 : 0;
  const costPercentage = salePrice > 0 ? (costBasis / salePrice) * 100 : 0;

  const commissionBonus = isEmployeeSale
    ? clamp(toNumber(sale.commissionBonus, 0), 0, cappedPct)
    : 0;

  const commissionBonusAmount = isEmployeeSale
    ? (saleAmount * commissionBonus) / 100
    : 0;

  const updates = {
    employeeProfitPercentage: round2(cappedPct),
    employeePrice: round2(employeePrice),
    employeeProfit: round2(employeeProfit),
    adminProfit: round2(adminProfit),
    totalProfit: round2(totalProfit),
    totalGroupProfit: round2(totalProfit),
    netProfit: round2(netProfit),
    commissionBonus: round2(commissionBonus),
    commissionBonusAmount: round2(commissionBonusAmount),
    totalAdditionalCosts: round2(totalAdditionalCosts),
    profitabilityPercentage: round2(profitabilityPercentage),
    costPercentage: round2(costPercentage),
  };

  const hasSaleChanges =
    isDifferent(
      toNumber(sale.employeeProfitPercentage, 0),
      updates.employeeProfitPercentage,
    ) ||
    isDifferent(toNumber(sale.employeePrice, 0), updates.employeePrice) ||
    isDifferent(
      toNumber(sale.employeeProfit, 0),
      updates.employeeProfit,
    ) ||
    isDifferent(toNumber(sale.adminProfit, 0), updates.adminProfit) ||
    isDifferent(toNumber(sale.totalProfit, 0), updates.totalProfit) ||
    isDifferent(toNumber(sale.totalGroupProfit, 0), updates.totalGroupProfit) ||
    isDifferent(toNumber(sale.netProfit, 0), updates.netProfit) ||
    isDifferent(toNumber(sale.commissionBonus, 0), updates.commissionBonus) ||
    isDifferent(
      toNumber(sale.commissionBonusAmount, 0),
      updates.commissionBonusAmount,
    ) ||
    isDifferent(
      toNumber(sale.totalAdditionalCosts, 0),
      updates.totalAdditionalCosts,
    ) ||
    isDifferent(
      toNumber(sale.profitabilityPercentage, 0),
      updates.profitabilityPercentage,
    ) ||
    isDifferent(toNumber(sale.costPercentage, 0), updates.costPercentage);

  return {
    hasSaleChanges,
    updates,
    isEmployeeSale,
    cappedPct,
    salePrice,
    quantity,
    employeeProfit,
    adminProfit,
  };
};

const processBatch = async ({ sales, apply, adminByBusiness, counters }) => {
  const saleOps = [];
  const profitOps = [];

  for (const sale of sales) {
    counters.processed += 1;
    const {
      hasSaleChanges,
      updates,
      isEmployeeSale,
      cappedPct,
      salePrice,
      quantity,
      employeeProfit,
      adminProfit,
    } = buildSaleUpdates(sale);

    if (hasSaleChanges) {
      counters.changedSales += 1;
      saleOps.push({
        updateOne: {
          filter: { _id: sale._id },
          update: { $set: updates },
        },
      });
    }

    if (sale.paymentStatus === "confirmado") {
      const adminUserId = adminByBusiness.get(String(sale.business));

      if (isEmployeeSale && sale.employee) {
        profitOps.push({
          updateMany: {
            filter: {
              sale: sale._id,
              user: sale.employee,
              type: "venta_normal",
            },
            update: {
              $set: {
                amount: round2(employeeProfit),
                "metadata.commission": round2(cappedPct),
                "metadata.salePrice": round2(salePrice),
                "metadata.quantity": quantity,
              },
            },
          },
        });
      }

      if (adminUserId) {
        profitOps.push({
          updateMany: {
            filter: {
              sale: sale._id,
              user: new mongoose.Types.ObjectId(adminUserId),
              type: "venta_normal",
            },
            update: {
              $set: {
                amount: round2(adminProfit),
                "metadata.salePrice": round2(salePrice),
                "metadata.quantity": quantity,
              },
            },
          },
        });
      }
    }
  }

  counters.profitOpsGenerated += profitOps.length;

  if (!apply) {
    return;
  }

  if (saleOps.length) {
    const saleResult = await Sale.bulkWrite(saleOps, { ordered: false });
    counters.salesModified += saleResult.modifiedCount || 0;
  }

  if (profitOps.length) {
    const profitResult = await ProfitHistory.bulkWrite(profitOps, {
      ordered: false,
    });
    counters.profitRowsModified += profitResult.modifiedCount || 0;
  }
};

const run = async () => {
  const apply = hasFlag("--apply");
  const businessId = getArgValue("--businessId");
  const startDate = getArgValue("--startDate");
  const endDate = getArgValue("--endDate");
  const limit = toNumber(getArgValue("--limit"), 0);
  const batchSize = clamp(toNumber(getArgValue("--batchSize"), 500), 50, 5000);

  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGO_URI_PROD ||
    process.env.MONGO_URI_DEV_LOCAL;

  if (!mongoUri) {
    throw new Error(
      "No se encontró MONGODB_URI/MONGO_URI en variables de entorno.",
    );
  }

  const query = {};

  if (businessId) {
    if (!mongoose.isValidObjectId(businessId)) {
      throw new Error("--businessId no es un ObjectId válido.");
    }
    query.business = new mongoose.Types.ObjectId(businessId);
  }

  const dateRange = buildDateRange(startDate, endDate);
  if (dateRange) {
    query.saleDate = dateRange;
  }

  console.log("=== Recalculate Sales Profits ===");
  console.log(`Modo: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log("Filtros:", {
    businessId: businessId || "ALL",
    startDate: startDate || null,
    endDate: endDate || null,
    limit: limit || null,
    batchSize,
  });

  await mongoose.connect(mongoUri);

  try {
    const totalSales = await Sale.countDocuments(query);
    if (!totalSales) {
      console.log("No se encontraron ventas para los filtros dados.");
      return;
    }

    const totalToProcess = limit > 0 ? Math.min(limit, totalSales) : totalSales;

    const businessIdsRaw = await Sale.distinct("business", query);
    const businessIds = businessIdsRaw.filter(Boolean).map((id) => String(id));

    const adminByBusiness = await getBusinessAdminMap(businessIds);

    const counters = {
      processed: 0,
      changedSales: 0,
      salesModified: 0,
      profitRowsModified: 0,
      profitOpsGenerated: 0,
      batches: 0,
    };

    let lastId = null;

    while (counters.processed < totalToProcess) {
      const remaining = totalToProcess - counters.processed;
      const currentBatchSize = Math.min(batchSize, remaining);

      const batchQuery = { ...query };
      if (lastId) {
        batchQuery._id = { $gt: lastId };
      }

      const salesBatch = await Sale.find(batchQuery)
        .select(projection)
        .sort({ _id: 1 })
        .limit(currentBatchSize)
        .lean();

      if (!salesBatch.length) {
        break;
      }

      counters.batches += 1;
      await processBatch({
        sales: salesBatch,
        apply,
        adminByBusiness,
        counters,
      });

      lastId = salesBatch[salesBatch.length - 1]._id;

      if (
        counters.batches % 10 === 0 ||
        counters.processed === totalToProcess
      ) {
        console.log(
          `[progreso] batches=${counters.batches} procesadas=${counters.processed}/${totalToProcess} cambios=${counters.changedSales}`,
        );
      }
    }

    console.log("\n=== Resumen ===");
    console.log(`Ventas analizadas: ${counters.processed}`);
    console.log(`Ventas con cambios detectados: ${counters.changedSales}`);
    console.log(
      `Operaciones ProfitHistory generadas: ${counters.profitOpsGenerated}`,
    );
    console.log(`Batches procesados: ${counters.batches}`);

    if (apply) {
      console.log(`Ventas actualizadas: ${counters.salesModified}`);
      console.log(
        `Filas ProfitHistory actualizadas: ${counters.profitRowsModified}`,
      );
    }

    if (!apply) {
      console.log("\nDry-run completado. No se aplicaron cambios.");
      console.log(
        "Para aplicar: node scripts/recalculateSalesProfits.js --apply [--businessId <id>] [--startDate YYYY-MM-DD] [--endDate YYYY-MM-DD] [--batchSize 500]",
      );
    } else {
      console.log("\n✅ Cambios aplicados.");
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("❌ Error en recalculateSalesProfits:", error);
  process.exit(1);
});
