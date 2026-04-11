import dotenv from "dotenv";
import mongoose from "mongoose";
import DistributorStats from "../src/infrastructure/database/models/DistributorStats.js";
import { userSchema } from "../src/infrastructure/database/models/User.js";

dotenv.config();

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI_DEV_LOCAL ||
  "mongodb://localhost:27017/essence_local";

async function main() {
  await mongoose.connect(MONGO_URI);

  if (!mongoose.modelNames().includes("User")) {
    mongoose.model("User", userSchema);
  }
  if (!mongoose.modelNames().includes("Product")) {
    mongoose.model("Product", productSchema);
  }

  const stats = await DistributorStats.find({}).populate("distributor");
  console.log("📊 Estados de Distribuidores:");
  stats.forEach((s) => {
    console.log(
      `👤 ${s.distributor?.name} (${s.distributor?.email}): ${s.totalPoints} puntos. Nivel: ${s.currentLevel}`,
    );
  });

  const saleSample = await mongoose
    .model("Sale")
    .findOne({ paymentStatus: "confirmado", distributor: { $ne: null } });
  console.log("🔍 Muestra de venta:", {
    id: saleSample?._id,
    points: saleSample?.gamificationPoints,
    applied: saleSample?.gamificationPointsApplied,
    amount: saleSample?.salePrice,
  });

  process.exit(0);
}

main().catch(console.error);
