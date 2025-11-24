import mongoose from "mongoose";

const periodWinnerSchema = new mongoose.Schema(
  {
    // Periodo de evaluación
    periodType: {
      type: String,
      enum: ["daily", "weekly", "biweekly", "monthly", "custom"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },

    // Ganador
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    winnerName: String,
    winnerEmail: String,

    // Métricas del ganador
    totalSales: {
      type: Number,
      required: true,
    },
    totalRevenue: {
      type: Number,
      required: true,
    },
    totalProfit: {
      type: Number,
      required: true,
    },
    salesCount: {
      type: Number,
      required: true,
    },

    // Bono otorgado
    bonusAmount: {
      type: Number,
      required: true,
    },
    bonusPaid: {
      type: Boolean,
      default: false,
    },
    bonusPaidAt: Date,

    // Top 3
    topPerformers: [
      {
        distributor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        position: Number,
        totalRevenue: Number,
        salesCount: Number,
        bonus: Number,
      },
    ],

    // Notas adicionales
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Índices
periodWinnerSchema.index({ startDate: -1, endDate: -1 });
periodWinnerSchema.index({ winner: 1 });

const PeriodWinner = mongoose.model("PeriodWinner", periodWinnerSchema);

export default PeriodWinner;
