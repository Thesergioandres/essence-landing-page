/**
 * Context Guard Utility
 * Helps services identify if the required context (auth token & businessId) 
 * is initialized before making API calls.
 */

export const isContextReady = (): boolean => {
  let businessId = localStorage.getItem("businessId");
  
  if (!businessId || businessId === "null" || businessId === "undefined") {
    try {
      const userRaw = localStorage.getItem("user");
      if (userRaw) {
        const user = JSON.parse(userRaw);
        if (user && user.business) {
          const bId = typeof user.business === "object" ? user.business._id || user.business.id : user.business;
          if (bId) {
            businessId = String(bId);
            localStorage.setItem("businessId", businessId);
          }
        }
      }
    } catch {
      // ignore
    }
  }
  
  // Some routes allow calls without token (public storefront, catalog),
  // but they still require a valid businessId.
  const hasBusiness = Boolean(businessId && businessId !== "null" && businessId !== "undefined");
  
  // If we have a token, we MUST have a businessId too (standard guarded flow)
  // If we DON'T have a token, we only need businessId (public flow)
  return hasBusiness;
};

/**
 * Returns a default empty response for services when context is not ready.
 * This prevents the API from throwing "No Business Context Selected" errors.
 */
export const getEmptyReadyState = <T>(defaultValue: T): T => {
  return defaultValue;
};
