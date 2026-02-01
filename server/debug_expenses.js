import dotenv from "dotenv";
import mongoose from "mongoose";
import DefectiveProduct from "./models/DefectiveProduct.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const run = async () => {
  await connectDB();

  console.log("Querying DefectiveProducts...");

  // Query from controller
  const all = await DefectiveProduct.find({});
  console.log(`Total records: ${all.length}`);

  const confirmed = await DefectiveProduct.find({ status: "confirmado" });
  console.log(`Confirmed records: ${confirmed.length}`);

  // Check specific query params
  const filter = { status: "confirmado", lossAmount: { $gt: 0 } };
  const withLoss = await DefectiveProduct.find(filter);
  console.log(`Confirmed with Loss > 0: ${withLoss.length}`);

  console.log("Checking samples...");
  if (confirmed.length > 0) {
    console.log("Sample confirmed:", JSON.stringify(confirmed[0], null, 2));
  }

  process.exit();
};

run();
