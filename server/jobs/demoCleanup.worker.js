import Business from "../models/Business.js";
import { TeardownDemoTenantUseCase } from "../src/application/use-cases/TeardownDemoTenantUseCase.js";

const DEFAULT_SWEEP_MS = 5 * 60 * 1000;

const normalizeSweepMs = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 60 * 1000) {
    return DEFAULT_SWEEP_MS;
  }

  return parsed;
};

let sweepInterval = null;
let runningSweep = false;

const teardownUseCase = new TeardownDemoTenantUseCase();

const sweepExpiredDemoBusinesses = async () => {
  if (runningSweep) {
    return;
  }

  runningSweep = true;

  try {
    const now = new Date();
    const expiredBusinesses = await Business.find({
      isDemo: true,
      demoExpiresAt: { $lte: now },
    })
      .select("_id name demoExpiresAt")
      .limit(30)
      .lean();

    if (expiredBusinesses.length === 0) {
      return;
    }

    for (const business of expiredBusinesses) {
      try {
        const result = await teardownUseCase.execute({
          businessId: String(business._id),
          reason: "ttl_expired",
          skipBusinessValidation: true,
        });

        console.log(
          `[DEMO TTL] Demo expirado limpiado: ${business.name} (${business._id}) -> ${JSON.stringify(result.deletedCounts)}`,
        );
      } catch (cleanupError) {
        console.error(
          `[DEMO TTL] Error limpiando negocio demo ${business._id}:`,
          cleanupError.message,
        );
      }
    }
  } catch (error) {
    console.error("[DEMO TTL] Error en barrido de expiracion demo:", error);
  } finally {
    runningSweep = false;
  }
};

export const startDemoCleanupWorker = () => {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (process.env.DEMO_SANDBOX_ENABLED === "false") {
    return;
  }

  if (sweepInterval) {
    return;
  }

  const sweepMs = normalizeSweepMs(process.env.DEMO_TTL_SWEEP_MS);

  sweepInterval = setInterval(() => {
    void sweepExpiredDemoBusinesses();
  }, sweepMs);

  setTimeout(() => {
    void sweepExpiredDemoBusinesses();
  }, 20 * 1000);

  console.log(
    `[DEMO TTL] Worker activo. Barrido cada ${Math.round(sweepMs / 1000)}s`,
  );
};

export const stopDemoCleanupWorker = () => {
  if (!sweepInterval) {
    return;
  }

  clearInterval(sweepInterval);
  sweepInterval = null;
};
