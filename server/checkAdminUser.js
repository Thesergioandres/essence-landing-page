import mongoose from "mongoose";
import User from "./models/User.js";
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

const checkAdminUser = async () => {
  try {
    await connectDB();

    console.log("\n" + "=".repeat(60));
    console.log("🔍 BÚSQUEDA DE USUARIO ADMINISTRADOR");
    console.log("=".repeat(60) + "\n");

    // Buscar todos los usuarios admin
    const admins = await User.find({ role: "admin" }).select("name email role active createdAt");

    if (admins.length === 0) {
      console.log("⚠️  No se encontraron usuarios administradores\n");
    } else {
      console.log(`✅ Se encontraron ${admins.length} administrador(es):\n`);
      
      for (const admin of admins) {
        console.log("👤 Usuario Administrador:");
        console.log(`   Nombre: ${admin.name}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   Estado: ${admin.active ? "Activo" : "Inactivo"}`);
        console.log(`   Creado: ${new Date(admin.createdAt).toLocaleDateString("es-CO")}`);
        console.log("");
      }
    }

    console.log("=".repeat(60));
    console.log("📝 NOTA: Por seguridad, las contraseñas están encriptadas");
    console.log("         y no se pueden mostrar en texto plano.");
    console.log("=".repeat(60) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
};

checkAdminUser();
