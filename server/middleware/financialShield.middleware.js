import { isEmployeeRole } from "../src/utils/roleAliases.js";
import {
  canCurrentRequestViewCosts,
  sanitizeFinancialCostFieldsToNull,
} from "../utils/financialPrivacy.js";

export const financialShield = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    try {
      if (!req.user || canCurrentRequestViewCosts(req)) {
        return originalJson(payload);
      }

      const requestPath = String(req.originalUrl || req.url || "");
      const effectiveRole = req.membership?.role || req.user?.role;
      const preserveEmployeeProfit =
        req.method === "GET" &&
        /^\/api\/v2\/sales\/employee(?:\/|\?|$)/.test(requestPath) &&
        isEmployeeRole(effectiveRole);

      const sanitizeOptions = preserveEmployeeProfit
        ? { preserveZeroFields: ["employeeProfit"] }
        : undefined;

      // Scrub global de costos y métricas financieras sensibles.
      const sanitizedPayload = sanitizeFinancialCostFieldsToNull(
        payload,
        new WeakSet(),
        sanitizeOptions,
      );
      return originalJson(sanitizedPayload);
    } catch {
      return originalJson(payload);
    }
  };

  next();
};
