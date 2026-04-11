require("dotenv").config();
const mongoose = require("mongoose");
const connectDB =
  require("../config/database.js").default || require("../config/database.js");
const GamificationConfig =
  require("../src/infrastructure/database/models/GamificationConfig.js").default ||
  require("../src/infrastructure/database/models/GamificationConfig.js");

const startArg = process.argv[2];
if (!startArg) {
  console.error("Uso: node scripts/setCurrentPeriod.cjs <start ISO>");
  process.exit(1);
}

const start = new Date(startArg);

(async () => {
  await connectDB();
  const updated = await GamificationConfig.findOneAndUpdate(
    {},
    { $set: { currentPeriodStart: start } },
    { new: true }
  );
  console.log("currentPeriodStart ->", updated && updated.currentPeriodStart);
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
