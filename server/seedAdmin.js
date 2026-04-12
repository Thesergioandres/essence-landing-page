import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./src/infrastructure/database/models/User.js";

dotenv.config();

const createAdminUser = async () => {
  try {
    // Conectar a MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.warn("[Essence Debug]", "âœ… Conectado a MongoDB");

    // Verificar si el usuario ya existe
    const userExists = await User.findOne({ email: "serguito2003@gmail.com" });

    if (userExists) {
      console.warn("[Essence Debug]", "âš ï¸  El usuario ya existe");
      await mongoose.connection.close();
      return;
    }

    // Hash de la contraseÃ±a
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("Serra_1707", salt);

    // Crear usuario administrador
    const adminUser = await User.create({
      name: "Administrador",
      email: "serguito2003@gmail.com",
      password: hashedPassword,
      role: "admin",
    });

    console.warn("[Essence Debug]", "âœ… Usuario administrador creado exitosamente:");
    console.warn("[Essence Debug]", {
      id: adminUser._id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
    });

    await mongoose.connection.close();
    console.warn("[Essence Debug]", "âœ… ConexiÃ³n cerrada");
  } catch (error) {
    console.error("âŒ Error:", error.message);
    process.exit(1);
  }
};

createAdminUser();

