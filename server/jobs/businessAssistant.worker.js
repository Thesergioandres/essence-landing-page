import { Worker } from "bullmq";
import { getRedisClient } from "../config/redis.js";
import { generateBusinessAssistantRecommendations } from "../controllers/businessAssistant.controller.js";

let worker;

const getConnection = () => {
  if (!process.env.REDIS_URL) return null;
  return process.env.REDIS_URL;
};

export const startBusinessAssistantWorker = () => {
  if (worker) return worker;

  const connection = getConnection();
  if (!connection) return null;

  worker = new Worker(
    "business-assistant",
    async (job) => {
      const { params } = job.data || {};
      const result = await generateBusinessAssistantRecommendations({
        ...params,
        redis: getRedisClient(),
        // no cache within job unless explicitly requested; jobs are already async
        bypassCache: true,
      });
      return result;
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error("❌ BusinessAssistant job failed", job?.id, err?.message);
  });

  worker.on("completed", (job) => {
    console.log("✅ BusinessAssistant job completed", job?.id);
  });

  return worker;
};
