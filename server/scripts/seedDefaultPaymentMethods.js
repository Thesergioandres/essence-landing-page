import dotenv from "dotenv";
import mongoose from "mongoose";
import Business from "../src/infrastructure/database/models/Business.js";
import PaymentMethod from "../src/infrastructure/database/models/PaymentMethod.js";

dotenv.config();

/**
 * Script to seed default payment methods (cash, credit, transfer, card)
 * for all businesses in the database.
 *
 * This ensures that the RegisterSaleUseCase can find payment methods
 * when receiving codes like "cash" instead of ObjectIds.
 */

async function seedDefaultPaymentMethods() {
  try {
    const mongoUri =
      process.env.MONGO_URI_DEV_LOCAL ||
      process.env.MONGODB_URI ||
      process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error(
        "No MongoDB URI found in environment variables. Check .env file.",
      );
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const businesses = await Business.find({});
    console.log(`📊 Found ${businesses.length} businesses`);

    const defaultMethods = [
      {
        code: "cash",
        name: "Efectivo",
        description: "Pago en efectivo",
        isCredit: false,
        requiresConfirmation: false,
        requiresProof: false,
        icon: "banknote",
        color: "#10b981",
        isActive: true,
      },
      {
        code: "transfer",
        name: "Transferencia",
        description: "Transferencia bancaria",
        isCredit: false,
        requiresConfirmation: true,
        requiresProof: true,
        icon: "arrow-right-left",
        color: "#3b82f6",
        isActive: true,
      },
      {
        code: "card",
        name: "Tarjeta",
        description: "Pago con tarjeta débito/crédito",
        isCredit: false,
        requiresConfirmation: false,
        requiresProof: false,
        icon: "credit-card",
        color: "#8b5cf6",
        isActive: true,
      },
      {
        code: "credit",
        name: "Crédito/Fiado",
        description: "Venta a crédito",
        isCredit: true,
        requiresConfirmation: false,
        requiresProof: false,
        icon: "timer",
        color: "#f59e0b",
        isActive: true,
      },
    ];

    let createdCount = 0;
    let skippedCount = 0;

    for (const business of businesses) {
      for (const method of defaultMethods) {
        const existing = await PaymentMethod.findOne({
          business: business._id,
          code: method.code,
        });

        if (!existing) {
          await PaymentMethod.create({
            business: business._id,
            ...method,
          });
          console.log(
            `✅ Created ${method.code} for business: ${business.name}`,
          );
          createdCount++;
        } else {
          skippedCount++;
        }
      }
    }

    console.log("\n📈 Summary:");
    console.log(`   - Created: ${createdCount} payment methods`);
    console.log(`   - Skipped (already exist): ${skippedCount}`);
    console.log("✅ Seed completed successfully");
  } catch (error) {
    console.error("❌ Error seeding payment methods:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

seedDefaultPaymentMethods();
