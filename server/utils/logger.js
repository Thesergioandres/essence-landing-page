const colorize = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;

const baseLog = ({
  level = "info",
  prefix = "[API INFO]",
  message = "",
  module = "unknown",
  requestId,
  businessId,
  userId,
  stack,
  extra,
}) => {
  const payload = {
    module,
    requestId,
    businessId,
    userId,
    timestamp: new Date().toISOString(),
    ...(extra || {}),
  };

  if (stack) {
    payload.stack = stack;
  }

  const logMessage = `${prefix} ${message}`;

  if (level === "error") {
    console.error(colorize(logMessage), payload);
  } else if (level === "warn") {
    console.warn(yellow(`${prefix} ${message}`), payload);
  } else {
    console.warn("[Essence Debug]", `${prefix} ${message}`, payload);
  }
};

export const logApiInfo = (params) =>
  baseLog({ ...params, prefix: "[API INFO]", level: "info" });

export const logApiWarn = (params) =>
  baseLog({ ...params, prefix: "[API WARN]", level: "warn" });

export const logApiError = (params) =>
  baseLog({ ...params, prefix: "[API ERROR]", level: "error" });

export const logAuthError = (params) =>
  baseLog({ ...params, prefix: "[AUTH ERROR]", level: "error" });

// Worker logging functions
export const logWorkerJobStarted = (params) => {
  const { jobName, jobId, businessId, extra } = params;
  console.warn("[Essence Debug]", cyan(`[WORKER JOB STARTED] ${jobName}`), {
    jobId,
    businessId,
    timestamp: new Date().toISOString(),
    ...extra,
  });
};

export const logWorkerJobFinished = (params) => {
  const { jobName, jobId, businessId, success = true, extra } = params;
  console.warn("[Essence Debug]", green(`[WORKER JOB FINISHED] ${jobName}`), {
    jobId,
    businessId,
    success,
    timestamp: new Date().toISOString(),
    ...extra,
  });
};

export const logWorkerError = (params) => {
  const { jobName, jobId, businessId, message, stack, extra } = params;
  console.error(colorize(`[WORKER ERROR] ${jobName}: ${message}`), {
    jobId,
    businessId,
    stack,
    timestamp: new Date().toISOString(),
    ...extra,
  });
};

// Stock-specific logging
export const logStockError = (params) => {
  const { userId, cantidad, sede, motivo, requestId, businessId, extra } =
    params;
  console.error(colorize("[STOCK ERROR]"), {
    userId,
    cantidad,
    sede,
    motivo,
    requestId,
    businessId,
    timestamp: new Date().toISOString(),
    ...extra,
  });
};

// Fiado-specific logging
export const logFiadoInfo = (params) =>
  baseLog({ ...params, prefix: "[FIADO INFO]", level: "info" });

export const logFiadoWarn = (params) =>
  baseLog({ ...params, prefix: "[FIADO WARN]", level: "warn" });

export const logFiadoError = (params) =>
  baseLog({ ...params, prefix: "[FIADO ERROR]", level: "error" });

