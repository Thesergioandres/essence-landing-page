import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import "../src/infrastructure/database/models/Product.js";
import "../models/Promotion.js";
import Sale from "../src/infrastructure/database/models/Sale.js";
import User from "../src/infrastructure/database/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return null;
  return next;
}

const email = getArgValue("--email") || "";
const limitArg = getArgValue("--limit");
const LIMIT = limitArg ? Number(limitArg) : 10;

async function connectDB() {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/essence";
  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");
}

async function main() {
  if (!email) {
    console.log("Missing --email");
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOne({ email: email.toLowerCase() }).lean();
  if (!user) {
    console.log("No user found for", email);
    await mongoose.disconnect();
    process.exit(0);
  }

  const sales = await Sale.find({ distributor: user._id })
    .sort({ saleDate: -1, createdAt: -1 })
    .limit(LIMIT)
    .populate("product", "name clientPrice suggestedPrice distributorPrice")
    .populate("promotion", "name distributorPrice promotionPrice")
    .lean();

  console.log("Found", sales.length, "sales for", email);

  for (const sale of sales) {
    console.log({
      id: sale._id?.toString(),
      saleDate: sale.saleDate,
      salePrice: sale.salePrice,
      distributorPrice: sale.distributorPrice,
      distributorProfitPercentage: sale.distributorProfitPercentage,
      distributorProfit: sale.distributorProfit,
      adminProfit: sale.adminProfit,
      netProfit: sale.netProfit,
      isPromotion: sale.isPromotion,
      promotion: sale.promotion
        ? {
            id: sale.promotion._id?.toString(),
            distributorPrice: sale.promotion.distributorPrice,
            promotionPrice: sale.promotion.promotionPrice,
          }
        : null,
      product: sale.product
        ? {
            name: sale.product.name,
            distributorPrice: sale.product.distributorPrice,
            clientPrice: sale.product.clientPrice,
            suggestedPrice: sale.product.suggestedPrice,
          }
        : null,
      saleGroupId: sale.saleGroupId,
      paymentStatus: sale.paymentStatus,
    });
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
