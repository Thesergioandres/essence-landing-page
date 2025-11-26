import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./models/User.js";

dotenv.config();

const createNewAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    // Verificar si el usuario ya existe
    const userExists = await User.findOne({ email: "lauradaniela@gmail.com" });

    if (userExists) {
      console.log("⚠️  El usuario ya existe");
      await mongoose.connection.close();
      return;
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("nani123", salt);

    // Crear usuario administrador
    const adminUser = await User.create({
      name: "Laura Daniela",
      email: "lauradaniela@gmail.com",
      password: hashedPassword,
      role: "admin",
    });

    console.log("✅ Usuario administrador creado exitosamente:");
    console.log({
      id: adminUser._id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
    });

    await mongoose.connection.close();
    console.log("✅ Conexión cerrada");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

createNewAdmin();
