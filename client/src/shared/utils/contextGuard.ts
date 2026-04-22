/**
 * Context Guard Utility
 * Helps services identify if the required context (auth token & businessId) 
 * is initialized before making API calls.
 */

export const isContextReady = (): boolean => {
  const token = localStorage.getItem("token");
  const businessId = localStorage.getItem("businessId");
  
  // Some routes might allow calls without businessId, 
  // but for guarded features (inventory, sales), both are usually required.
  return Boolean(token && businessId && businessId !== "null" && businessId !== "undefined");
};

/**
 * Returns a default empty response for services when context is not ready.
 * This prevents the API from throwing "No Business Context Selected" errors.
 */
export const getEmptyReadyState = <T>(defaultValue: T): T => {
  return defaultValue;
};
