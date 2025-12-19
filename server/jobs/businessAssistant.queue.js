import { Queue, QueueEvents } from "bullmq";

let queue;
let queueEvents;

const getConnection = () => {
  if (!process.env.REDIS_URL) return null;
  return process.env.REDIS_URL;
};

export const getBusinessAssistantQueue = () => {
  if (queue) return queue;
  const connection = getConnection();
  if (!connection) return null;

  queue = new Queue("business-assistant", {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 1000 },
    },
  });

  return queue;
};

export const getBusinessAssistantQueueEvents = () => {
  if (queueEvents) return queueEvents;
  const connection = getConnection();
  if (!connection) return null;

  queueEvents = new QueueEvents("business-assistant", { connection });
  return queueEvents;
};
