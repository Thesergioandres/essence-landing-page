import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import Sale from "../../src/infrastructure/database/models/Sale.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};

const debugSale = async () => {
  await connectDB();

  // Find ALL sales with VTA-2026-0001
  const sales = await Sale.find({ saleId: "VTA-2026-0001" }).lean();

  console.log(`Found ${sales.length} sales with ID VTA-2026-0001`);

  for (const sale of sales) {
    console.log("--------------------------------------------------");
    console.log("ID:", sale._id);
    console.log("Business:", sale.business);
    console.log("salePrice:", sale.salePrice);

    if (sale.salePrice !== 20000) {
      console.log("Skipping (Price mismatch)...");
      continue;
    }

    console.log("quantity:", sale.quantity);
    console.log("distributorProfit:", sale.distributorProfit);
    console.log("purchasePrice:", sale.purchasePrice);
    console.log("averageCostAtSale:", sale.averageCostAtSale);
    console.log("shippingCost:", sale.shippingCost);
    console.log("totalAdditionalCosts:", sale.totalAdditionalCosts);
    console.log("discount:", sale.discount);
    console.log("adminProfit (DB):", sale.adminProfit);
    console.log("netProfit (DB):", sale.netProfit);

    const grossRevenue =
      sale.salePrice * sale.quantity - (sale.distributorProfit || 0);
    let unitCost = sale.averageCostAtSale || sale.purchasePrice || 0;
    const productCost = unitCost * sale.quantity;

    let shipping = sale.shippingCost || 0;
    console.log(`Original Shipping: ${shipping}`);

    if (shipping > 710 && shipping < 720) {
      console.log("Sanitization WOULD trigger (shipping = 0)");
      shipping = 0;
    } else {
      console.log("Sanitization WOULD NOT trigger");
    }

    const extras = sale.totalAdditionalCosts || 0;
    const discount = sale.discount || 0;

    const realNetProfit =
      grossRevenue - productCost - shipping - discount - extras;
    console.log("Calculated realNetProfit:", realNetProfit);
  }

  process.exit(0);
};

debugSale();
