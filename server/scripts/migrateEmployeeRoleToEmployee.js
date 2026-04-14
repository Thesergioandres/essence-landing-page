import dotenv from "dotenv";
import mongoose from "mongoose";
import Membership from "../src/infrastructure/database/models/Membership.js";
import User from "../src/infrastructure/database/models/User.js";

dotenv.config();

const LEGACY_ROLES = ["employee", "employee"];

const resolveMongoUri = () =>
  process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_DEV;

const run = async () => {
  const mongoUri = resolveMongoUri();

  if (!mongoUri) {
    console.error("Missing MongoDB URI (MONGODB_URI/MONGO_URI/MONGO_URI_DEV)");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  try {
    const [usersResult, membershipsResult] = await Promise.all([
      User.updateMany(
        { role: { $in: LEGACY_ROLES } },
        { $set: { role: "employee" } },
      ),
      Membership.updateMany(
        { role: { $in: LEGACY_ROLES } },
        { $set: { role: "employee" } },
      ),
    ]);

    const usersUpdated =
      usersResult?.modifiedCount || usersResult?.nModified || 0;
    const membershipsUpdated =
      membershipsResult?.modifiedCount || membershipsResult?.nModified || 0;

    console.log("Role migration completed successfully.");
    console.log(`Users updated: ${usersUpdated}`);
    console.log(`Memberships updated: ${membershipsUpdated}`);
  } finally {
    await mongoose.connection.close();
  }
};

run().catch(async (error) => {
  console.error("Role migration failed:", error);
  try {
    await mongoose.connection.close();
  } catch {
    // noop
  }
  process.exit(1);
});
