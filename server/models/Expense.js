import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: [true, "La categoría es obligatoria"],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "El monto es obligatorio"],
      min: [0, "El monto debe ser mayor o igual a 0"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    expenseDate: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Expense", expenseSchema);
