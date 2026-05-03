/**
 * Utility to wrap React.lazy with a retry mechanism.
 * Useful for handling "Failed to fetch dynamically imported module" errors
 * which occur when a new version of the app is deployed and old chunks are missing.
 */
import { lazy, type ComponentType } from "react";

export function lazyRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  name?: string
) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.error(`[LazyRetry] Failed to load component: ${name || "unknown"}`, error);
      
      // Check if it's a chunk load error
      const isChunkError = 
        error instanceof Error && 
        (error.message.includes("Failed to fetch dynamically imported module") ||
         error.message.includes("Loading chunk") ||
         error.message.includes("chunk load"));

      if (isChunkError) {
        // If we haven't reloaded yet for this specific build/session, force a reload
        const sessionKey = "chunk_error_reloaded";
        const hasReloaded = sessionStorage.getItem(sessionKey);
        
        if (!hasReloaded) {
          sessionStorage.setItem(sessionKey, "true");
          window.location.reload();
          // Return a dummy promise that never resolves while the page is reloading
          return new Promise<{ default: T }>(() => {});
        }
      }

      throw error;
    }
  });
}
