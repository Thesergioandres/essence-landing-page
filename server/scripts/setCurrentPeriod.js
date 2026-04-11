import "dotenv/config";
import connectDB from "../config/database.js";
import GamificationConfig from "../src/infrastructure/database/models/GamificationConfig.js";

const startArg = process.argv[2];
if (!startArg) {
  console.error("Uso: node scripts/setCurrentPeriod.js <start ISO>");
  process.exit(1);
}

const start = new Date(startArg);

const run = async () => {
  await connectDB();
  const updated = await GamificationConfig.findOneAndUpdate(
    {},
    { $set: { currentPeriodStart: start } },
    { new: true }
  );
  console.log("currentPeriodStart ->", updated?.currentPeriodStart);
};

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
