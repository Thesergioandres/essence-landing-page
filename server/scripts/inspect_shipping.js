import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import Sale from "../src/infrastructure/database/models/Sale.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server directory
dotenv.config({ path: path.join(__dirname, "../.env") });

const checkShipping = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    // Find confirmed sales
    const sales = await Sale.find({
      paymentStatus: "confirmado",
    }).select(
      "code saleDate shippingCost totalAdditionalCosts employeeProfit averageCostAtSale purchasePrice quantity salePrice",
    );

    console.log(`Found ${sales.length} confirmed sales.`);

    sales.forEach((s) => {
      console.log(
        `Sale ${s.code}:
            Price: ${s.salePrice}
            Qty: ${s.quantity}
            Cost (Avg): ${s.averageCostAtSale}
            Cost (Purch): ${s.purchasePrice}
            Comm: ${s.employeeProfit}
            Shipping: ${s.shippingCost}
            Additional: ${s.totalAdditionalCosts}
            -------------------`,
      );
    });

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

checkShipping();
