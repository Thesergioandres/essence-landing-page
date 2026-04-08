import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Membership from "./models/Membership.js";
import User from "./src/infrastructure/database/models/User.js";

dotenv.config();

const seedGodUser = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const email = process.env.GOD_EMAIL || "god@example.com";
  const name = process.env.GOD_NAME || "God Admin";
  const rawPassword = process.env.GOD_PASSWORD || process.env.GOD_PASS;
  const businessId = process.env.GOD_BUSINESS_ID;

  if (!mongoUri) {
    console.error("❌ Falta MONGODB_URI/MONGO_URI en el entorno");
    process.exit(1);
  }

  if (!rawPassword) {
    console.error(
      "❌ Define GOD_PASSWORD (o GOD_PASS) para crear el usuario god"
    );
    process.exit(1);
  }

  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Conectado a MongoDB");

    const existing = await User.findOne({ email });
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash(rawPassword, salt);

    if (existing) {
      existing.name = name;
      existing.password = password;
      existing.role = "god";
      existing.status = "active";
      existing.active = true;
      await existing.save();
      console.log("ℹ️  Usuario actualizado a rol god:", {
        id: existing._id,
        email: existing.email,
        role: existing.role,
      });
    } else {
      const user = await User.create({
        name,
        email,
        password,
        role: "god",
        status: "active",
        active: true,
      });
      console.log("✅ Usuario god creado:", {
        id: user._id,
        email: user.email,
        role: user.role,
      });
    }

    if (businessId) {
      const userId = (
        existing?._id || (await User.findOne({ email }))?._id
      )?.toString();
      if (userId) {
        await Membership.updateOne(
          { user: userId, business: businessId },
          { $set: { role: "super_admin", status: "active" } },
          { upsert: true }
        );
        console.log("✅ Membership super_admin asegurada para el negocio:", {
          userId,
          businessId,
        });
      } else {
        console.warn("⚠️  No se pudo resolver userId para asignar membership");
      }
    }

    await mongoose.connection.close();
    console.log("✅ Conexión cerrada");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding usuario god:", error);
    process.exit(1);
  }
};

seedGodUser();
