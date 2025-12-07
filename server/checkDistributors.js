import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const checkDistributors = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    const distributors = await User.find({ role: "distribuidor" });
    
    console.log(`📦 DISTRIBUIDORES REGISTRADOS: ${distributors.length}\n`);
    
    distributors.forEach((dist, index) => {
      console.log(`${index + 1}. ${dist.name}`);
      console.log(`   Email: ${dist.email}`);
      console.log(`   ID: ${dist._id}`);
      console.log(`   Role: ${dist.role}`);
      console.log("");
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkDistributors();
