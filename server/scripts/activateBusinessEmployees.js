import mongoose from "mongoose";
import Membership from "../src/infrastructure/database/models/Membership.js";
import User from "../src/infrastructure/database/models/User.js";

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

const businessId = process.argv[2];
const expiresAt = process.argv[3] || "2026-12-31T00:00:00Z";

if (!businessId) {
  console.error(
    "Uso: node scripts/activateBusinessEmployees.js <businessId> [ISO_expiration]",
  );
  process.exit(1);
}

if (!uri) {
  console.error("Falta MONGODB_URI (o MONGO_URI) en variables de entorno");
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri);

  const memberships = await Membership.find({
    business: businessId,
    role: "employee",
  }).select("user status");

  if (!memberships.length) {
    console.log("Sin employees para ese businessId");
    await mongoose.disconnect();
    return;
  }

  const userIds = memberships.map((m) => m.user);

  const res = await User.updateMany(
    { _id: { $in: userIds } },
    {
      $set: {
        status: "active",
        active: true,
        subscriptionExpiresAt: new Date(expiresAt),
      },
    },
  );

  console.log(
    `Actualizados ${res.modifiedCount} usuarios (de ${userIds.length}) con status active y expiración ${expiresAt}`,
  );

  const updated = await User.find({ _id: { $in: userIds } })
    .select("name email status active subscriptionExpiresAt")
    .lean();

  console.log(JSON.stringify(updated, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
