import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import Membership from "../src/infrastructure/database/models/Membership.js";
import PeriodWinner from "../src/infrastructure/database/models/PeriodWinner.js";

dotenv.config();

const main = async () => {
  await connectDB();

  const filter = { business: { $exists: false } };
  const legacyWinners = await PeriodWinner.find(filter);
  console.log(`Encontrados ${legacyWinners.length} ganadores sin business`);

  let updated = 0;
  for (const winner of legacyWinners) {
    let businessId = null;

    // Primero intentar con el ganador principal
    const winnerMembership = await Membership.findOne({
      user: winner.winner,
      status: "active",
    }).select("business");
    if (winnerMembership?.business) {
      businessId = winnerMembership.business;
    }

    // Si no hubo match, probar con los topPerformers
    if (!businessId && Array.isArray(winner.topPerformers)) {
      for (const performer of winner.topPerformers) {
        const m = await Membership.findOne({
          user: performer.employee,
          status: "active",
        }).select("business");
        if (m?.business) {
          businessId = m.business;
          break;
        }
      }
    }

    if (!businessId) {
      console.log(`No se pudo inferir negocio para winner ${winner._id}`);
      continue;
    }

    await PeriodWinner.updateOne(
      { _id: winner._id },
      { $set: { business: businessId } }
    );
    updated += 1;
    console.log(`Actualizado winner ${winner._id} -> business ${businessId}`);
  }

  console.log(`Actualizados ${updated} documentos`);
};

main()
  .catch((err) => {
    console.error("Error en backfill", err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
