import mongoose from "mongoose";

const tierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    minPoints: {
      type: Number,
      required: true,
      min: 0,
    },
    bonusPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 20,
    },
  },
  { _id: false },
);

const productMultiplierSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    multiplier: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 10,
    },
  },
  { _id: false },
);

const gamificationConfigSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },

    // Ratio de conversión: cuánto dinero = 1 punto
    pointsRatio: {
      amountPerPoint: {
        type: Number,
        default: 1000,
        min: 1,
      },
      currency: {
        type: String,
        default: "COP",
        trim: true,
      },
    },

    // Ciclo de evaluación
    cycle: {
      duration: {
        type: String,
        enum: ["weekly", "biweekly", "monthly"],
        default: "biweekly",
      },
      currentPeriodStart: {
        type: Date,
        default: null,
      },
      currentPeriodEnd: {
        type: Date,
        default: null,
      },
    },

    // Tiers de bonificación escalonada
    tiers: {
      type: [tierSchema],
      default: [
        { name: "Bronce", minPoints: 25000, bonusPercentage: 1 },
        { name: "Plata", minPoints: 50000, bonusPercentage: 3 },
        { name: "Oro", minPoints: 100000, bonusPercentage: 5 },
      ],
    },

    // Multiplicadores específicos por producto (override al campo en Product)
    productMultipliers: {
      type: [productMultiplierSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const GamificationConfig =
  mongoose.models.GamificationConfig ||
  mongoose.model("GamificationConfig", gamificationConfigSchema);

export default GamificationConfig;
