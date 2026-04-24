/**
 * Gamification Consolidation Worker
 *
 * Runs every 12 hours. Checks all businesses with gamification enabled
 * and consolidates any period that has ended (creates PeriodWinner,
 * resets points, advances to next period).
 */

import { GamificationService } from "../src/domain/services/GamificationService.js";
import EmployeePoints from "../src/infrastructure/database/models/EmployeePoints.js";
import GamificationConfig from "../src/infrastructure/database/models/GamificationConfig.js";
import PeriodWinner from "../src/infrastructure/database/models/PeriodWinner.js";

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

async function consolidateExpiredPeriods() {
  const now = new Date();

  try {
    // Find all active gamification configs whose period has ended
    const expiredConfigs = await GamificationConfig.find({
      enabled: true,
      "cycle.currentPeriodEnd": { $lte: now },
    });

    if (expiredConfigs.length === 0) {
      return;
    }

    console.log(
      `🎮 [GAMIFICATION WORKER] Found ${expiredConfigs.length} expired periods to consolidate`,
    );

    for (const config of expiredConfigs) {
      try {
        await consolidatePeriod(config);
      } catch (err) {
        console.error(
          `🎮 [GAMIFICATION WORKER] Error consolidating business ${config.business}:`,
          err.message,
        );
      }
    }
  } catch (error) {
    console.error(
      "🎮 [GAMIFICATION WORKER] Global error:",
      error.message,
    );
  }
}

async function consolidatePeriod(config) {
  const businessId = config.business;

  // Get top performers
  const topEmployees = await EmployeePoints.find({ business: businessId })
    .sort({ currentPoints: -1 })
    .limit(10)
    .populate("employee", "name email")
    .lean();

  if (topEmployees.length === 0) {
    // No employees with points, just advance the period
    const { start, end } = GamificationService.computeNextPeriod(
      config.cycle?.duration || "biweekly",
      config.cycle?.currentPeriodEnd || new Date(),
    );
    config.cycle.currentPeriodStart = start;
    config.cycle.currentPeriodEnd = end;
    await config.save();

    console.log(
      `🎮 [GAMIFICATION WORKER] Business ${businessId}: No points, advanced period to ${end.toISOString()}`,
    );
    return;
  }

  const winner = topEmployees[0];
  const totalPointsForPeriod = topEmployees.reduce(
    (sum, emp) => sum + (emp.currentPoints || 0),
    0,
  );

  // Create PeriodWinner
  await PeriodWinner.create({
    periodType: config.cycle?.duration || "biweekly",
    business: businessId,
    startDate: config.cycle?.currentPeriodStart || new Date(),
    endDate: config.cycle?.currentPeriodEnd || new Date(),
    winner: winner.employee?._id || winner.employee,
    winnerName: winner.employee?.name || "Empleado",
    winnerEmail: winner.employee?.email || "",
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    salesCount: 0,
    bonusAmount: 0,
    totalPointsForPeriod,
    topPerformers: topEmployees.slice(0, 3).map((emp, idx) => {
      const tierResult = GamificationService.resolveTier(
        emp.currentPoints,
        config.tiers,
      );
      return {
        employee: emp.employee?._id || emp.employee,
        position: idx + 1,
        totalRevenue: 0,
        salesCount: 0,
        bonus: 0,
        totalPoints: emp.currentPoints,
        tierReached: tierResult.tier?.name || "Sin tier",
      };
    }),
    notes: "Consolidación automática por worker",
  });

  // Reset all employee points for this business
  await EmployeePoints.updateMany(
    { business: businessId },
    {
      $set: {
        currentPoints: 0,
        currentTier: { name: null, bonusPercentage: 0 },
        periodResetAt: new Date(),
      },
      $push: {
        history: {
          $each: [
            {
              type: "reset",
              points: 0,
              description: `Periodo consolidado automáticamente. Ganador: ${winner.employee?.name || "N/A"}`,
              createdAt: new Date(),
            },
          ],
          $slice: -500,
        },
      },
    },
  );

  // Advance to next period
  const { start, end } = GamificationService.computeNextPeriod(
    config.cycle?.duration || "biweekly",
    config.cycle?.currentPeriodEnd || new Date(),
  );
  config.cycle.currentPeriodStart = start;
  config.cycle.currentPeriodEnd = end;
  await config.save();

  console.log(
    `🎮 [GAMIFICATION WORKER] Business ${businessId}: Consolidated period. Winner: ${winner.employee?.name}. Next period ends ${end.toISOString()}`,
  );
}

export function startGamificationWorker() {
  // Initial run after 30s delay (let DB connections stabilize)
  setTimeout(() => {
    consolidateExpiredPeriods();
  }, 30_000);

  // Then every 12 hours
  setInterval(consolidateExpiredPeriods, TWELVE_HOURS_MS);

  console.log("🎮 [GAMIFICATION WORKER] Started (interval: 12h)");
}
