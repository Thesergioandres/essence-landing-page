import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const restoreStock = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const Product = mongoose.model(
      "Product",
      new mongoose.Schema({}, { strict: false })
    );

    await Product.findOneAndUpdate(
      { name: /mtrx 12000/i },
      { $inc: { warehouseStock: 2, totalStock: 2 } }
    );

    console.log("✅ Stock restaurado");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
};

restoreStock();
