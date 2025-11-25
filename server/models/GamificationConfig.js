import mongoose from "mongoose";

const gamificationConfigSchema = new mongoose.Schema(
  {
    // Configuración del periodo de evaluación
    evaluationPeriod: {
      type: String,
      enum: ["daily", "weekly", "biweekly", "monthly", "custom"],
      default: "monthly",
    },
    customPeriodDays: {
      type: Number,
      default: 30,
      min: 1,
    },

    // Configuración de bonos
    topPerformerBonus: {
      type: Number,
      default: 1000,
      min: 0,
    },
    secondPlaceBonus: {
      type: Number,
      default: 500,
      min: 0,
    },
    thirdPlaceBonus: {
      type: Number,
      default: 250,
      min: 0,
    },

    // Metas de ventas
    salesTargets: [
      {
        level: String, // "bronze", "silver", "gold", "platinum"
        minAmount: Number,
        bonus: Number,
        badge: String,
      },
    ],

    // Bonos por producto específico
    productBonuses: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        bonusPerUnit: Number,
        minQuantity: Number,
        description: String,
      },
    ],

    // Configuración de puntos
    pointsPerSale: {
      type: Number,
      default: 1,
    },
    pointsPerPeso: {
      type: Number,
      default: 0.1,
    },

    // Estado
    active: {
      type: Boolean,
      default: true,
    },

    // Última evaluación
    lastEvaluationDate: {
      type: Date,
    },
    nextEvaluationDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const GamificationConfig = mongoose.model("GamificationConfig", gamificationConfigSchema);

export default GamificationConfig;
