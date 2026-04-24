import mongoose from "mongoose";

const pointsEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["earned", "reverted", "reset", "adjustment"],
      required: true,
    },
    points: {
      type: Number,
      required: true,
    },
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      default: null,
    },
    saleGroupId: {
      type: String,
      default: null,
    },
    productName: {
      type: String,
      trim: true,
      default: null,
    },
    multiplier: {
      type: Number,
      default: 1,
    },
    saleAmount: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const employeePointsSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },

    // Saldo del periodo actual
    currentPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Histórico de transacciones de puntos
    history: {
      type: [pointsEntrySchema],
      default: [],
    },

    // Tier calculado (snapshot para queries rápidas)
    currentTier: {
      name: { type: String, default: null },
      bonusPercentage: { type: Number, default: 0 },
    },

    lastPointsEarnedAt: {
      type: Date,
      default: null,
    },
    periodResetAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Unique constraint: un registro por empleado-negocio
employeePointsSchema.index({ employee: 1, business: 1 }, { unique: true });

// Ranking query: top empleados por puntos dentro de un negocio
employeePointsSchema.index({ business: 1, currentPoints: -1 });

const EmployeePoints =
  mongoose.models.EmployeePoints ||
  mongoose.model("EmployeePoints", employeePointsSchema);

export default EmployeePoints;
