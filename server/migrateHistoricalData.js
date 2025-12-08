import mongoose from "mongoose";
import Sale from "./models/Sale.js";
import SpecialSale from "./models/SpecialSale.js";
import ProfitHistory from "./models/ProfitHistory.js";
import User from "./models/User.js";
import Product from "./models/Product.js";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB conectado");
  } catch (error) {
    console.error("❌ Error conectando MongoDB:", error);
    process.exit(1);
  }
};

const migrateHistoricalData = async () => {
  try {
    await connectDB();

    console.log("\n🔄 Iniciando migración de historial de ganancias...\n");

    // Limpiar historial existente para evitar duplicados
    await ProfitHistory.deleteMany({});
    console.log("🗑️  Historial existente limpiado\n");

    // Obtener admin user
    const admin = await User.findOne({ role: "admin" });
    if (!admin) {
      console.error("❌ No se encontró usuario admin");
      process.exit(1);
    }

    // PARTE 1: Migrar ventas normales
    console.log("📊 Procesando ventas normales...");
    const sales = await Sale.find({})
      .populate("distributor", "name")
      .populate("product", "name")
      .sort({ saleDate: 1 }); // Ordenar cronológicamente para calcular balances correctos

    let processedNormal = 0;
    let errorNormal = 0;

    for (const sale of sales) {
      try {
        const historyEntries = [];

        // Entrada para el distribuidor (si no es venta admin)
        if (sale.distributor && sale.distributorProfit > 0) {
          const previousBalance = await ProfitHistory.aggregate([
            { $match: { user: sale.distributor._id } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ]);

          const balanceAfter =
            (previousBalance[0]?.total || 0) + sale.distributorProfit;

          historyEntries.push({
            user: sale.distributor._id,
            type: "venta_normal",
            amount: sale.distributorProfit,
            sale: sale._id,
            product: sale.product._id,
            description: `Venta ${sale.saleId || "sin ID"}: ${
              sale.product.name
            } (x${sale.quantity})`,
            date: sale.saleDate,
            balanceAfter,
            metadata: {
              saleId: sale.saleId,
              quantity: sale.quantity,
              salePrice: sale.salePrice,
              commissionBonus: sale.commissionBonus || 0,
            },
          });
        }

        // Entrada para el admin
        if (sale.adminProfit > 0) {
          const previousBalance = await ProfitHistory.aggregate([
            { $match: { user: admin._id } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ]);

          const balanceAfter =
            (previousBalance[0]?.total || 0) + sale.adminProfit;

          historyEntries.push({
            user: admin._id,
            type: "venta_normal",
            amount: sale.adminProfit,
            sale: sale._id,
            product: sale.product._id,
            description: `Venta ${sale.saleId || "sin ID"}: ${
              sale.product.name
            } (x${sale.quantity}) - Ganancia Admin`,
            date: sale.saleDate,
            balanceAfter,
            metadata: {
              saleId: sale.saleId,
              quantity: sale.quantity,
              salePrice: sale.salePrice,
              distributorName: sale.distributor?.name || "Admin",
            },
          });
        }

        // Insertar todas las entradas
        if (historyEntries.length > 0) {
          await ProfitHistory.insertMany(historyEntries);
          processedNormal++;
        }
      } catch (error) {
        console.error(
          `Error procesando venta ${sale.saleId || sale._id}:`,
          error.message
        );
        errorNormal++;
      }
    }

    console.log(
      `✅ Ventas normales procesadas: ${processedNormal} (${errorNormal} errores)\n`
    );

    // PARTE 2: Migrar ventas especiales
    console.log("🌟 Procesando ventas especiales...");
    const specialSales = await SpecialSale.find({})
      .populate("product.productId", "name")
      .sort({ saleDate: 1 }); // Ordenar cronológicamente

    let processedSpecial = 0;
    let errorSpecial = 0;

    for (const specialSale of specialSales) {
      try {
        const historyEntries = [];

        for (const dist of specialSale.distribution) {
          // Buscar usuario por nombre
          const user = await User.findOne({
            name: { $regex: new RegExp(`^${dist.name}$`, "i") },
          });

          if (!user) {
            console.warn(
              `⚠️  Usuario "${dist.name}" no encontrado para venta especial ${
                specialSale.saleId || specialSale._id
              }`
            );
            continue;
          }

          // Calcular balance
          const previousBalance = await ProfitHistory.aggregate([
            { $match: { user: user._id } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ]);

          const balanceAfter = (previousBalance[0]?.total || 0) + dist.amount;

          historyEntries.push({
            user: user._id,
            type: "venta_especial",
            amount: dist.amount,
            specialSale: specialSale._id,
            product: specialSale.product.productId,
            description: `Venta Especial ${specialSale.saleId || "sin ID"}: ${
              specialSale.product.name
            } (x${specialSale.quantity})${
              dist.notes ? ` - ${dist.notes}` : ""
            }`,
            date: specialSale.saleDate,
            balanceAfter,
            metadata: {
              saleId: specialSale.saleId,
              eventName: specialSale.eventName,
              quantity: specialSale.quantity,
              specialPrice: specialSale.specialPrice,
              percentage: dist.percentage,
              notes: dist.notes,
            },
          });
        }

        // Insertar todas las entradas
        if (historyEntries.length > 0) {
          await ProfitHistory.insertMany(historyEntries);
          processedSpecial++;
        }
      } catch (error) {
        console.error(
          `Error procesando venta especial ${
            specialSale.saleId || specialSale._id
          }:`,
          error.message
        );
        errorSpecial++;
      }
    }

    console.log(
      `✅ Ventas especiales procesadas: ${processedSpecial} (${errorSpecial} errores)\n`
    );

    // RESUMEN FINAL
    console.log("=" .repeat(60));
    console.log("📊 RESUMEN DE MIGRACIÓN");
    console.log("=" .repeat(60));

    const totalEntries = await ProfitHistory.countDocuments();
    console.log(`\nTotal de entradas creadas: ${totalEntries}`);

    // Balance por usuario
    const balances = await ProfitHistory.aggregate([
      {
        $group: {
          _id: "$user",
          totalBalance: { $sum: "$amount" },
          normalSales: {
            $sum: { $cond: [{ $eq: ["$type", "venta_normal"] }, "$amount", 0] },
          },
          specialSales: {
            $sum: {
              $cond: [{ $eq: ["$type", "venta_especial"] }, "$amount", 0],
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $sort: { totalBalance: -1 } },
    ]);

    console.log("\n📊 BALANCES POR USUARIO:\n");
    for (const balance of balances) {
      console.log(`${balance.user.name}:`);
      console.log(`  Balance Total: $${balance.totalBalance.toLocaleString()}`);
      console.log(
        `  Ventas Normales: $${balance.normalSales.toLocaleString()}`
      );
      console.log(
        `  Ventas Especiales: $${balance.specialSales.toLocaleString()}`
      );
      console.log(`  Transacciones: ${balance.count}`);
      console.log("");
    }

    console.log("=" .repeat(60));
    console.log("✅ Migración completada exitosamente");
    console.log("=" .repeat(60));

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error en migración:", error);
    process.exit(1);
  }
};

migrateHistoricalData();
