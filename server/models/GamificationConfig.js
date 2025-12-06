import mongoose from "mongoose";

const gamificationConfigSchema = new mongoose.Schema(
  {
    // Configuración del periodo de evaluación
    evaluationPeriod: {
      type: String,
      enum: ["daily", "weekly", "biweekly", "monthly", "custom"],
      default: "weekly", // Periodo semanal para rankings
    },
    customPeriodDays: {
      type: Number,
      default: 15,
      min: 1,
    },

    // Auto-evaluación
    autoEvaluate: {
      type: Boolean,
      default: true,
    },
    currentPeriodStart: {
      type: Date,
      default: Date.now,
    },

    // Configuración de bonos
    topPerformerBonus: {
      type: Number,
      default: 50000,
      min: 0,
    },
    secondPlaceBonus: {
      type: Number,
      default: 0,
      min: 0,
    },
    thirdPlaceBonus: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Comisiones variables por ranking (top 3 ganan más)
    top1CommissionBonus: {
      type: Number,
      default: 5, // +5% adicional
      min: 0,
    },
    top2CommissionBonus: {
      type: Number,
      default: 3, // +3% adicional
      min: 0,
    },
    top3CommissionBonus: {
      type: Number,
      default: 1, // +1% adicional
      min: 0,
    },

    // Requisito mínimo para acceder al ranking
    minAdminProfitForRanking: {
      type: Number,
      default: 100000, // $100,000 COP mínimo en ganancia para el admin
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

const GamificationConfig = mongoose.model(
  "GamificationConfig",
  gamificationConfigSchema
);

export default GamificationConfig;
