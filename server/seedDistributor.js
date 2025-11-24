import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "./models/User.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/essence";

const createDistributor = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    // Verificar si ya existe
    const existingDistributor = await User.findOne({ email: "distribuidor@test.com" });
    
    if (existingDistributor) {
      console.log("⚠️ El distribuidor ya existe");
      console.log({
        email: "distribuidor@test.com",
        password: "dist123",
        name: existingDistributor.name,
        role: existingDistributor.role
      });
      process.exit(0);
    }

    // Crear nuevo distribuidor
    const hashedPassword = await bcrypt.hash("dist123", 10);
    
    const distributor = await User.create({
      name: "Distribuidor de Prueba",
      email: "distribuidor@test.com",
      password: hashedPassword,
      role: "distribuidor",
      phone: "3001234567",
      address: "Calle 123 #45-67, Bogotá",
    });

    console.log("✅ Distribuidor creado exitosamente:");
    console.log({
      id: distributor._id,
      name: distribuidor.name,
      email: "distribuidor@test.com",
      password: "dist123",
      role: distributor.role,
    });
    
    console.log("\n📝 Usa estas credenciales para hacer login:");
    console.log("   Email: distribuidor@test.com");
    console.log("   Password: dist123");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("✅ Conexión cerrada");
    process.exit(0);
  }
};

createDistributor();
