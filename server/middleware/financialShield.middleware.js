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

      const sanitizedPayload = sanitizeFinancialCostFieldsToNull(payload);
      return originalJson(sanitizedPayload);
    } catch {
      return originalJson(payload);
    }
  };

  next();
};
