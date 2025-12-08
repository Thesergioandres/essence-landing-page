import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error);
    process.exit(1);
  }
};

const checkSpecialSalesHistory = async () => {
  try {
    await connectDB();

    const SpecialSale = mongoose.model("SpecialSale", new mongoose.Schema({}, { strict: false }));
    const ProfitHistory = mongoose.model("ProfitHistory", new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));

    console.log("\n📊 VERIFICANDO VENTAS ESPECIALES Y SU HISTORIAL\n");
    console.log("=".repeat(80));

    // 1. Contar ventas especiales totales
    const totalSpecialSales = await SpecialSale.countDocuments();
    console.log(`\n1️⃣ Total de ventas especiales en DB: ${totalSpecialSales}`);

    // 2. Listar todas las ventas especiales
    const specialSales = await SpecialSale.find().sort({ saleDate: -1 }).limit(20);
    console.log(`\n📋 Últimas 20 ventas especiales:`);
    for (const sale of specialSales) {
      console.log(`   - Fecha: ${sale.saleDate?.toISOString().split('T')[0]} | Producto: ${sale.product?.name || 'N/A'} | Cant: ${sale.quantity}`);
      console.log(`     Distribuciones:`);
      for (const dist of sale.distribution || []) {
        console.log(`       * ${dist.name}: $${dist.amount.toFixed(3)} (${dist.percentage}%)`);
      }
    }

    // 3. Verificar historial de ventas especiales
    const specialSaleHistory = await ProfitHistory.find({ type: "venta_especial" }).sort({ date: -1 }).limit(20);
    console.log(`\n💰 Historial de ganancias tipo "venta_especial": ${specialSaleHistory.length} entradas encontradas`);
    
    for (const entry of specialSaleHistory) {
      const user = await User.findById(entry.user);
      console.log(`   - ${entry.date?.toISOString().split('T')[0]} | ${user?.name || 'Usuario desconocido'} | $${entry.amount.toFixed(3)} | ${entry.description}`);
    }

    // 4. Buscar admin
    const admin = await User.findOne({ role: "admin" });
    console.log(`\n👤 Admin encontrado: ${admin?.name} (${admin?.email})`);

    // 5. Verificar historial del admin
    const adminHistory = await ProfitHistory.find({ user: admin._id }).sort({ date: -1 }).limit(20);
    console.log(`\n📈 Últimas 20 entradas de historial del admin:`);
    for (const entry of adminHistory) {
      console.log(`   - ${entry.date?.toISOString().split('T')[0]} | ${entry.type} | $${entry.amount.toFixed(3)} | ${entry.description}`);
    }

    // 6. Verificar tipos de entradas del admin
    const adminHistoryByType = await ProfitHistory.aggregate([
      { $match: { user: admin._id } },
      { $group: { _id: "$type", count: { $sum: 1 }, total: { $sum: "$amount" } } }
    ]);
    console.log(`\n📊 Resumen por tipo de ganancia del admin:`);
    for (const group of adminHistoryByType) {
      console.log(`   - ${group._id}: ${group.count} entradas, Total: $${group.total.toFixed(3)}`);
    }

    // 7. Buscar ventas especiales sin registrar en historial
    console.log(`\n🔍 Buscando ventas especiales sin historial...`);
    const specialSalesWithAdmin = specialSales.filter(sale => 
      sale.distribution?.some(d => d.name?.toLowerCase().includes("admin"))
    );
    console.log(`   Ventas especiales con distribución al admin: ${specialSalesWithAdmin.length}`);
    
    for (const sale of specialSalesWithAdmin) {
      const historyExists = await ProfitHistory.findOne({ specialSale: sale._id, user: admin._id });
      if (!historyExists) {
        console.log(`   ⚠️ SIN HISTORIAL: ${sale.saleDate?.toISOString().split('T')[0]} | ${sale.product?.name}`);
        const adminDist = sale.distribution.find(d => d.name?.toLowerCase().includes("admin"));
        if (adminDist) {
          console.log(`      Monto que debería tener: $${adminDist.amount.toFixed(3)}`);
        }
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ Verificación completada\n");

  } catch (error) {
    console.error("❌ Error en verificación:", error);
  } finally {
    await mongoose.disconnect();
  }
};

checkSpecialSalesHistory();
