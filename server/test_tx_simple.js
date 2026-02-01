import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function testTransactions() {
  const mongoUri =
    process.env.MONGO_URI_DEV_LOCAL ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/essence_local";

  console.log("Connecting to: " + mongoUri);

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const session = await mongoose.startSession();
    console.log("Session started");

    try {
      session.startTransaction();
      console.log("Transaction started successfully");
      await session.abortTransaction();
      console.log("Transaction aborted successfully");
    } catch (txError) {
      console.log("TRANSACTION_ERROR: " + txError.message);
    } finally {
      session.endSession();
      console.log("Session ended");
    }
  } catch (error) {
    console.log("FATAL_ERROR: " + error.message);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected");
    process.exit(0);
  }
}

testTransactions();
