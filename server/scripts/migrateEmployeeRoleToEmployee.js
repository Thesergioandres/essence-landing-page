import dotenv from "dotenv";
import mongoose from "mongoose";
import Membership from "../src/infrastructure/database/models/Membership.js";
import User from "../src/infrastructure/database/models/User.js";

dotenv.config();

const LEGACY_ROLES = ["empleado", "employee"];

const resolveMongoUri = () =>
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGO_PUBLIC_URL ||
  process.env.MONGO_URL ||
  process.env.MONGO_URI_DEV;

const resolveDbName = (mongoUri) => {
  const explicitDbName =
    process.env.MONGO_DB_NAME || process.env.MONGODB_DB_NAME;

  if (explicitDbName) {
    return explicitDbName;
  }

  try {
    const parsed = new URL(mongoUri);
    const dbNameFromPath = (parsed.pathname || "").replace(/^\/+/, "");
    if (dbNameFromPath) {
      return dbNameFromPath;
    }
  } catch {
    // noop
  }

  return process.env.NODE_ENV === "test" ? "essence_test" : "essence";
};

const run = async () => {
  const mongoUri = resolveMongoUri();

  if (!mongoUri) {
    console.error("Missing MongoDB URI (MONGODB_URI/MONGO_URI/MONGO_URI_DEV)");
    process.exit(1);
  }

  const dbName = resolveDbName(mongoUri);
  await mongoose.connect(mongoUri, { dbName });
  console.log(`Connected to database: ${dbName}`);

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
