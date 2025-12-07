import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const createDistributors = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    // Verificar si ya existen
    const existingIzan = await User.findOne({ email: "izan@essence.com" });
    const existingDiego = await User.findOne({ email: "diego@essence.com" });

    if (existingIzan) {
      console.log("⚠️  IZAN ya existe");
      console.log(`   ID: ${existingIzan._id}`);
      console.log(`   Email: ${existingIzan.email}`);
    } else {
      const hashedPassword = await bcrypt.hash("izan123", 10);
      const izan = await User.create({
        name: "IZAN",
        email: "izan@essence.com",
        password: hashedPassword,
        role: "distribuidor"
      });
      console.log("✅ Usuario IZAN creado");
      console.log(`   ID: ${izan._id}`);
      console.log(`   Email: ${izan.email}`);
    }

    console.log("");

    if (existingDiego) {
      console.log("⚠️  Diego Gonzalez ya existe");
      console.log(`   ID: ${existingDiego._id}`);
      console.log(`   Email: ${existingDiego.email}`);
    } else {
      const hashedPassword = await bcrypt.hash("diego123", 10);
      const diego = await User.create({
        name: "Diego Gonzalez",
        email: "diego@essence.com",
        password: hashedPassword,
        role: "distribuidor"
      });
      console.log("✅ Usuario Diego Gonzalez creado");
      console.log(`   ID: ${diego._id}`);
      console.log(`   Email: ${diego.email}`);
    }

    console.log("\n📦 Distribuidores registrados:");
    const allDistributors = await User.find({ role: "distribuidor" });
    allDistributors.forEach(dist => {
      console.log(`  - ${dist.name} (${dist.email})`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

createDistributors();
