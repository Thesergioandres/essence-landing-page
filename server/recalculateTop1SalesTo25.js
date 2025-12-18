import dotenv from "dotenv";
import mongoose from "mongoose";
import GamificationConfig from "./models/GamificationConfig.js";
import Sale from "./models/Sale.js";

dotenv.config();

const DAY_MS = 24 * 60 * 60 * 1000;

const parseArgs = (argv) => {
  const args = {
    apply: false,
    from: null,
    to: null,
    distributorId: null,
    limit: null,
  };

  for (const raw of argv) {
    if (raw === "--apply") args.apply = true;
    else if (raw.startsWith("--from=")) args.from = raw.split("=")[1] || null;
    else if (raw.startsWith("--to=")) args.to = raw.split("=")[1] || null;
    else if (raw.startsWith("--distributor="))
      args.distributorId = raw.split("=")[1] || null;
    else if (raw.startsWith("--limit=")) {
      const v = Number(raw.split("=")[1]);
      args.limit = Number.isFinite(v) ? v : null;
    } else if (raw === "--help" || raw === "-h") args.help = true;
  }

  return args;
};

const parseDateOnly = (value, endOfDay = false) => {
  if (!value) return null;
  // Espera YYYY-MM-DD
  const [y, m, d] = value.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  if (endOfDay) return new Date(y, m - 1, d, 23, 59, 59, 999);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const getPeriodRangeForDate = (config, date) => {
  const evaluationPeriod = config?.evaluationPeriod || "monthly";

  if (evaluationPeriod === "monthly") {
    const startDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      1,
      0,
      0,
      0,
      0
    );
    const endDate = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    return { startDate, endDate, key: `monthly:${startDate.toISOString()}` };
  }

  if (evaluationPeriod === "weekly") {
    // Igual que el backend: semanas empezando en domingo
    const dayOfWeek = date.getDay();
    const startDate = new Date(date);
    startDate.setDate(date.getDate() - dayOfWeek);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate, key: `weekly:${startDate.toISOString()}` };
  }

  if (evaluationPeriod === "biweekly") {
    const anchor = config?.currentPeriodStart
      ? new Date(config.currentPeriodStart)
      : new Date(date);
    const periodMs = 15 * DAY_MS;
    const diffMs = date.getTime() - anchor.getTime();

    // floor funciona también con negativos (períodos hacia atrás)
    const k = Math.floor(diffMs / periodMs);
    const startDate = new Date(anchor.getTime() + k * periodMs);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate.getTime() + 15 * DAY_MS - 1);

    return { startDate, endDate, key: `biweekly:${startDate.toISOString()}` };
  }

  // fallback
  const startDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
    0,
    0,
    0,
    0
  );
  const endDate = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  return { startDate, endDate, key: `default:${startDate.toISOString()}` };
};

const getRankingMapForPeriod = async (startDate, endDate) => {
  const rankings = await Sale.aggregate([
    {
      $match: {
        distributor: { $exists: true, $ne: null },
        paymentStatus: "confirmado",
        saleDate: { $gte: startDate, $lte: endDate },
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

  const positionByDistributorId = new Map();
  rankings.forEach((row, idx) => {
    positionByDistributorId.set(row._id.toString(), idx + 1);
  });

  return {
    positionByDistributorId,
    totalDistributors: rankings.length,
  };
};

const expectedCommissionForPosition = (position) => {
  // Sistema requerido:
  // 1 => 25% (bonus 5), 2 => 23% (bonus 3), 3 => 21% (bonus 1), resto => 20% (bonus 0)
  if (position === 1) return { profitPercentage: 25, commissionBonus: 5 };
  if (position === 2) return { profitPercentage: 23, commissionBonus: 3 };
  if (position === 3) return { profitPercentage: 21, commissionBonus: 1 };
  return { profitPercentage: 20, commissionBonus: 0 };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      `\nUso:\n  node recalculateTop1SalesTo25.js [--apply] [--from=YYYY-MM-DD] [--to=YYYY-MM-DD] [--distributor=<id>] [--limit=N]\n\nPor defecto es DRY-RUN (no guarda). Con --apply sí actualiza.\n\nQué hace:\n- Recalcula el porcentaje esperado de ganancia del distribuidor por venta según el ranking del período (ventas confirmadas del período).\n- Aplica el sistema: Top1=25% (bonus 5), Top2=23% (bonus 3), Top3=21% (bonus 1), resto=20% (bonus 0).\n- Solo considera ventas de distribuidor cuyo distributorProfitPercentage actual esté en {20,21,23,25}.\n- Si el porcentaje/bonus guardado no coincide con el esperado, lo corrige (y al guardar recalcula profits vía hooks de Sale).\n`
    );
    process.exit(0);
  }

  const dryRun = !args.apply;

  if (!process.env.MONGODB_URI) {
    console.error("❌ Falta MONGODB_URI en el entorno (.env)");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Conectado a MongoDB");

  const config = await GamificationConfig.findOne();
  const evaluationPeriod = config?.evaluationPeriod || "monthly";
  console.log(`📌 Periodo de ranking usado: ${evaluationPeriod}`);

  const query = {
    distributor: { $exists: true, $ne: null },
    distributorProfitPercentage: { $in: [20, 21, 23, 25] },
  };

  const fromDate = parseDateOnly(args.from, false);
  const toDate = parseDateOnly(args.to, true);
  if (fromDate || toDate) {
    query.saleDate = {};
    if (fromDate) query.saleDate.$gte = fromDate;
    if (toDate) query.saleDate.$lte = toDate;
  }

  if (args.distributorId) {
    query.distributor = args.distributorId;
  }

  let cursor = Sale.find(query)
    .select(
      "saleId distributor saleDate createdAt salePrice quantity paymentStatus distributorProfitPercentage commissionBonus"
    )
    .sort({ saleDate: 1 });

  if (args.limit && args.limit > 0) cursor = cursor.limit(args.limit);

  const sales = await cursor;

  console.log("=");
  console.log(dryRun ? "👁️  DRY-RUN (no guarda)" : "🚀 APPLY (sí guarda)");
  console.log("=");
  console.log(`🔎 Candidatas (pct ∈ {20,21,23,25}): ${sales.length}`);

  const rankingCache = new Map(); // key -> { positionByDistributorId, totalDistributors }

  let scanned = 0;
  let shouldUpdate = 0;
  let updated = 0;
  const perDistributor = new Map();

  for (const sale of sales) {
    scanned++;

    const saleDate = sale.saleDate
      ? new Date(sale.saleDate)
      : sale.createdAt
      ? new Date(sale.createdAt)
      : null;
    if (!saleDate || Number.isNaN(saleDate.getTime())) continue;

    const { startDate, endDate, key } = getPeriodRangeForDate(config, saleDate);

    if (!rankingCache.has(key)) {
      const ranking = await getRankingMapForPeriod(startDate, endDate);
      rankingCache.set(key, ranking);
    }

    const { positionByDistributorId } = rankingCache.get(key);
    const distributorId = sale.distributor?.toString();
    const position = distributorId
      ? positionByDistributorId.get(distributorId) || null
      : null;

    const expected = expectedCommissionForPosition(position);

    const currentPct = Number(sale.distributorProfitPercentage);
    const currentBonus =
      typeof sale.commissionBonus === "number" ? sale.commissionBonus : 0;
    const needsUpdate =
      currentPct !== expected.profitPercentage ||
      currentBonus !== expected.commissionBonus;
    if (!needsUpdate) continue;

    shouldUpdate++;

    const distKey = distributorId;
    perDistributor.set(distKey, (perDistributor.get(distKey) || 0) + 1);

    console.log(
      `➡️  ${sale.saleId || sale._id.toString()} | ${saleDate
        .toISOString()
        .slice(0, 10)} | status=${
        sale.paymentStatus
      } | pos=${position} | ${currentPct}% (bonus ${currentBonus}) -> ${
        expected.profitPercentage
      }% (bonus ${expected.commissionBonus})`
    );

    if (!dryRun) {
      sale.commissionBonus = expected.commissionBonus;
      sale.distributorProfitPercentage = expected.profitPercentage;
      await sale.save(); // dispara pre-save para recalcular distributorPrice/adminProfit/distributorProfit
      updated++;
    }
  }

  console.log("\n=".repeat(1));
  console.log("📊 RESUMEN");
  console.log(`- Escaneadas: ${scanned}`);
  console.log(
    `- Para corregir (pct/bonus difiere del esperado): ${shouldUpdate}`
  );
  console.log(`- Actualizadas: ${updated}`);

  if (perDistributor.size > 0) {
    console.log("\n👥 Por distribuidor (ventas corregibles):");
    for (const [dist, count] of perDistributor.entries()) {
      console.log(`- ${dist}: ${count}`);
    }
  }

  if (dryRun) {
    console.log("\n⚠️  DRY-RUN: no se guardó nada.");
    console.log(
      "Para aplicar cambios: node recalculateTop1SalesTo25.js --apply"
    );
  }

  await mongoose.connection.close();
  console.log("\n✅ Conexión cerrada");
};

main().catch((err) => {
  console.error("❌ Error en script:", err);
  process.exit(1);
});
