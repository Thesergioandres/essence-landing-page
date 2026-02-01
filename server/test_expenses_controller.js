import dotenv from "dotenv";
import mongoose from "mongoose";
import { getExpenses } from "./controllers/expense.controller.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || process.env.MONGO_URI_DEV_LOCAL,
    );
    console.log("MongoDB Connected");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const mockRes = {
  status: (code) => ({
    json: (data) =>
      console.log(`Response ${code}:`, JSON.stringify(data, null, 2)),
  }),
  json: (data) => console.log("Response JSON:", JSON.stringify(data, null, 2)),
};

const mockReq = {
  businessId: "696008a0c2a1ce493840c032", // From Log 3907
  query: {
    startDate: "",
    endDate: "",
    type: "",
    category: "",
  },
  user: {
    role: "admin",
    id: "mock-user-id",
  },
};

const run = async () => {
  await connectDB();
  console.log("Calling getExpenses...");
  try {
    await getExpenses(mockReq, mockRes);
  } catch (error) {
    console.error("CRASH IN CONTROLLER:", error);
  }
  process.exit();
};

run();
