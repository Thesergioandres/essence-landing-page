import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    // Campo actual (UI): tipo de gasto. Mantenemos compatibilidad con datos antiguos
    // que pudieron guardarse como `category`.
    type: {
      type: String,
      required: [true, "El tipo de gasto es obligatorio"],
      trim: true,
    },

    // Legacy (compatibilidad)
    category: {
      type: String,
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

expenseSchema.index({ expenseDate: -1 });
expenseSchema.index({ type: 1, expenseDate: -1 });

export default mongoose.model("Expense", expenseSchema);
