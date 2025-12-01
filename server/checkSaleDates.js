import mongoose from "mongoose";
import Sale from "./models/Sale.js";
import dotenv from "dotenv";

dotenv.config();

const checkSaleDates = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    const sales = await Sale.find({ paymentStatus: "confirmado" })
      .sort({ saleDate: 1 })
      .limit(5);

    console.log("Primeras 5 ventas (para revisar formato de fecha):\n");
    sales.forEach((s) => {
      console.log("Sale ID:", s._id);
      console.log("  saleDate (raw):", s.saleDate);
      console.log("  saleDate (ISO):", s.saleDate.toISOString());
      console.log("  saleDate (local CO):", s.saleDate.toLocaleString("es-CO"));
      console.log("  Timestamp:", s.saleDate.getTime());
      console.log("");
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkSaleDates();
