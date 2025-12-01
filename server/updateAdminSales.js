import mongoose from "mongoose";
import dotenv from "dotenv";
import Sale from "./models/Sale.js";

dotenv.config();

const updateAdminSales = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    // Actualizar todas las ventas admin (distributor = null) que están pendientes
    const result = await Sale.updateMany(
      {
        distributor: null,
        paymentStatus: "pendiente"
      },
      {
        $set: {
          paymentStatus: "confirmado",
          paymentConfirmedAt: new Date()
        }
      }
    );

    console.log(`✅ ${result.modifiedCount} ventas admin actualizadas a confirmadas`);

    // Mostrar resumen de ventas admin
    const adminSales = await Sale.find({ distributor: null });
    console.log(`\n📊 Total de ventas admin: ${adminSales.length}`);
    
    const confirmed = adminSales.filter(s => s.paymentStatus === "confirmado").length;
    const pending = adminSales.filter(s => s.paymentStatus === "pendiente").length;
    
    console.log(`✅ Confirmadas: ${confirmed}`);
    console.log(`⏳ Pendientes: ${pending}`);

    mongoose.disconnect();
    console.log("\n✅ Script completado");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

updateAdminSales();
