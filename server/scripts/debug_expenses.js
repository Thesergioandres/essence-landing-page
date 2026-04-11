import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import Expense from "../src/infrastructure/database/models/Expense.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const debugExpenses = async () => {
  await connectDB();

  try {
    console.log("Searching for 'Publicidad' expenses...");

    // Broad search for anything related to Publicidad
    const expenses = await Expense.find({
      $or: [
        { category: { $regex: "Publicidad", $options: "i" } },
        { description: { $regex: "Publicidad", $options: "i" } },
        { type: { $regex: "Publicidad", $options: "i" } },
      ],
    });

    console.log(`Found ${expenses.length} matches.`);
    expenses.forEach((e) => {
      console.log("------------------------------------------------");
      console.log(`ID: ${e._id}`);
      console.log(`Category: '${e.category}'`);
      console.log(`Type: '${e.type}'`);
      console.log(`Amount: ${e.amount}`);
      console.log(
        `Date: ${e.expenseDate} (ISO: ${e.expenseDate?.toISOString()})`,
      );
      console.log(`Business: ${e.business}`);
      console.log(`Description: ${e.description}`);
    });
  } catch (error) {
    console.error("Error searching expenses:", error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

debugExpenses();
