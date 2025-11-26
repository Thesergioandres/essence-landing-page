import dotenv from "dotenv";
import mongoose from "mongoose";
import AuditLog from "./models/AuditLog.js";
import Category from "./models/Category.js";
import DefectiveProduct from "./models/DefectiveProduct.js";
import DistributorStats from "./models/DistributorStats.js";
import DistributorStock from "./models/DistributorStock.js";
import GamificationConfig from "./models/GamificationConfig.js";
import PeriodWinner from "./models/PeriodWinner.js";
import Product from "./models/Product.js";
import Sale from "./models/Sale.js";
import User from "./models/User.js";

dotenv.config();

const cleanDatabase = async () => {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    console.log(
      "⚠️  ADVERTENCIA: Esto borrará TODOS los datos excepto el admin principal"
    );
    console.log("Admin que se conservará: serguito2003@gmail.com\n");

    // Contar datos actuales
    const counts = {
      users: await User.countDocuments(),
      products: await Product.countDocuments(),
      categories: await Category.countDocuments(),
      sales: await Sale.countDocuments(),
      stock: await DistributorStock.countDocuments(),
      defectiveProducts: await DefectiveProduct.countDocuments(),
      auditLogs: await AuditLog.countDocuments(),
      gamification: await GamificationConfig.countDocuments(),
      winners: await PeriodWinner.countDocuments(),
      stats: await DistributorStats.countDocuments(),
    };

    console.log("📊 Datos actuales en la base de datos:");
    console.log(`   - Usuarios: ${counts.users}`);
    console.log(`   - Productos: ${counts.products}`);
    console.log(`   - Categorías: ${counts.categories}`);
    console.log(`   - Ventas: ${counts.sales}`);
    console.log(`   - Stock distribuidor: ${counts.stock}`);
    console.log(`   - Productos defectuosos: ${counts.defectiveProducts}`);
    console.log(`   - Logs de auditoría: ${counts.auditLogs}`);
    console.log(`   - Configuración gamificación: ${counts.gamification}`);
    console.log(`   - Ganadores período: ${counts.winners}`);
    console.log(`   - Estadísticas: ${counts.stats}\n`);

    console.log("🗑️  Iniciando limpieza...\n");

    // Borrar todos los usuarios excepto el admin principal
    const deletedUsers = await User.deleteMany({
      email: { $ne: "serguito2003@gmail.com" },
    });
    console.log(`✅ Usuarios eliminados: ${deletedUsers.deletedCount}`);

    // Borrar productos
    const deletedProducts = await Product.deleteMany({});
    console.log(`✅ Productos eliminados: ${deletedProducts.deletedCount}`);

    // Borrar categorías
    const deletedCategories = await Category.deleteMany({});
    console.log(`✅ Categorías eliminadas: ${deletedCategories.deletedCount}`);

    // Borrar ventas
    const deletedSales = await Sale.deleteMany({});
    console.log(`✅ Ventas eliminadas: ${deletedSales.deletedCount}`);

    // Borrar stock
    const deletedStock = await DistributorStock.deleteMany({});
    console.log(`✅ Stock eliminado: ${deletedStock.deletedCount}`);

    // Borrar productos defectuosos
    const deletedDefective = await DefectiveProduct.deleteMany({});
    console.log(
      `✅ Productos defectuosos eliminados: ${deletedDefective.deletedCount}`
    );

    // Borrar logs de auditoría
    const deletedLogs = await AuditLog.deleteMany({});
    console.log(`✅ Logs de auditoría eliminados: ${deletedLogs.deletedCount}`);

    // Borrar gamificación
    const deletedGamification = await GamificationConfig.deleteMany({});
    console.log(
      `✅ Configuración gamificación eliminada: ${deletedGamification.deletedCount}`
    );

    // Borrar ganadores
    const deletedWinners = await PeriodWinner.deleteMany({});
    console.log(`✅ Ganadores eliminados: ${deletedWinners.deletedCount}`);

    // Borrar estadísticas
    const deletedStats = await DistributorStats.deleteMany({});
    console.log(`✅ Estadísticas eliminadas: ${deletedStats.deletedCount}`);

    console.log("\n🎉 ¡Base de datos limpiada exitosamente!");
    console.log("\n👤 Admin conservado:");
    const admin = await User.findOne({ email: "serguito2003@gmail.com" });
    if (admin) {
      console.log(`   - Nombre: ${admin.name}`);
      console.log(`   - Email: ${admin.email}`);
      console.log(`   - Rol: ${admin.role}`);
    }

    console.log("\n💡 Ahora puedes empezar a usar la aplicación desde cero");
    console.log(
      "   Puedes agregar productos, distribuidores y categorías desde el panel de admin\n"
    );

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

cleanDatabase();
