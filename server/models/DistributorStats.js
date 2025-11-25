import mongoose from "mongoose";

const distributorStatsSchema = new mongoose.Schema(
  {
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Puntos totales
    totalPoints: {
      type: Number,
      default: 0,
    },
    currentMonthPoints: {
      type: Number,
      default: 0,
    },

    // Estadísticas de ventas
    totalSales: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    totalProfit: {
      type: Number,
      default: 0,
    },

    // Bonos ganados
    totalBonusEarned: {
      type: Number,
      default: 0,
    },
    pendingBonuses: {
      type: Number,
      default: 0,
    },
    paidBonuses: {
      type: Number,
      default: 0,
    },

    // Logros y medallas
    achievements: [
      {
        type: {
          type: String,
          enum: ["sales_target", "product_bonus", "top_performer", "streak", "custom"],
        },
        name: String,
        description: String,
        badge: String,
        earnedAt: Date,
        value: Number,
      },
    ],

    // Nivel actual
    currentLevel: {
      type: String,
      enum: ["beginner", "bronze", "silver", "gold", "platinum", "diamond"],
      default: "beginner",
    },

    // Rachas
    currentStreak: {
      type: Number,
      default: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },

    // Victorias en periodo
    periodWins: {
      type: Number,
      default: 0,
    },
    topThreeFinishes: {
      type: Number,
      default: 0,
    },

    // Última actualización
    lastSaleDate: Date,
    lastBonusDate: Date,
  },
  {
    timestamps: true,
  }
);

// Índices
distributorStatsSchema.index({ totalPoints: -1 });
distributorStatsSchema.index({ totalRevenue: -1 });
distributorStatsSchema.index({ distributor: 1 }, { unique: true });

const DistributorStats = mongoose.model("DistributorStats", distributorStatsSchema);

export default DistributorStats;
