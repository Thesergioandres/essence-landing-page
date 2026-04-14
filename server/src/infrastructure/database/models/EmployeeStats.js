import mongoose from "mongoose";

const employeeStatsSchema = new mongoose.Schema(
  {
    employee: {
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
          enum: [
            "sales_target",
            "product_bonus",
            "top_performer",
            "streak",
            "custom",
          ],
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
      default: "Novato",
    },
    currentLevelId: {
      type: Number,
      default: 1,
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

    // Estadísticas de créditos
    totalCreditsGenerated: {
      type: Number,
      default: 0,
    },
    totalCreditsAmount: {
      type: Number,
      default: 0,
    },
    creditsCollected: {
      type: Number,
      default: 0,
    },
    creditsPending: {
      type: Number,
      default: 0,
    },
    creditsOverdue: {
      type: Number,
      default: 0,
    },

    // Estadísticas de promociones
    promotionsUsed: {
      type: Number,
      default: 0,
    },
    promotionsValue: {
      type: Number,
      default: 0,
    },

    // Última actualización
    lastSaleDate: Date,
    lastBonusDate: Date,
    lastCreditDate: Date,
  },
  {
    timestamps: true,
  },
);

// Índices
employeeStatsSchema.index({ totalPoints: -1 });
employeeStatsSchema.index({ totalRevenue: -1 });
employeeStatsSchema.index({ employee: 1 }, { unique: true });

const EmployeeStats = mongoose.model(
  "EmployeeStats",
  employeeStatsSchema,
);

export default EmployeeStats;
