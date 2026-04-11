import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
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
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    quantity: {
      type: Number,
      default: null,
    },
    sourceType: {
      type: String,
      enum: ["warehouse", "branch", "distributor"],
      default: null,
    },
    sourceBranch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    sourceDistributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    operationId: {
      type: String,
      trim: true,
      index: true,
      default: null,
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
  },
);

expenseSchema.index({ expenseDate: -1 });
expenseSchema.index({ type: 1, expenseDate: -1 });
expenseSchema.index(
  { business: 1, operationId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { operationId: { $exists: true, $ne: null } },
  },
);

export default mongoose.models.Expense ||
  mongoose.model("Expense", expenseSchema);
