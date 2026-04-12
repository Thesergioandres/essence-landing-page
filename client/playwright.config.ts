import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// ES Module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from multiple .env files
// Priority: client/.env -> root/.env -> server/.env
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "server", ".env") });

// Log loaded API key status
console.warn("[Essence Debug]", 
  `ðŸ” GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "Loaded âœ…" : "Not found âŒ"}`
);

/**
 * Playwright Configuration for Essence E2E Tests
 * ===============================================
 *
 * IMPORTANT: These tests run against DEVELOPMENT database ONLY.
 * Before running, ensure:
 *   1. Frontend is running: npm run dev (port 5173)
 *   2. Backend is running: npm run server:v2 (port 5000)
 *   3. MongoDB local is running (port 27017)
 *   4. .env MONGO_URI points to localhost (essence_local)
 *   5. GEMINI_API_KEY is set in .env for AI-powered notes
 */

export default defineConfig({
  testDir: "./e2e",

  /* Run tests in parallel */
  fullyParallel: false, // Run sequentially for E2E (shared state)

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests for E2E due to shared state */
  workers: 1,

  /* Reporter to use */
  reporter: [
    ["html", { open: "never" }],
    ["list"],
    ["json", { outputFile: "e2e-results.json" }],
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL for frontend */
    baseURL: "http://localhost:3000",

    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video on failure */
    video: "retain-on-failure",

    /* Timeout for each action */
    actionTimeout: 10000,
  },

  /* Configure projects */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        // Mobile Chrome emulation
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-safari",
      use: {
        ...devices["iPhone 13"],
        // Additional mobile-specific settings
        isMobile: true,
        hasTouch: true,
        // Ensure viewport is properly set for responsive testing
        viewport: { width: 390, height: 844 },
      },
    },
  ],

  /* Global timeout */
  timeout: 60000,

  /* Expect timeout */
  expect: {
    timeout: 10000,
  },

  /* Web server configuration - can start dev server automatically */
  // Uncomment if you want Playwright to start the dev server
  // webServer: [
  //   {
  //     command: "npm run dev",
  //     url: "http://localhost:5173",
  //     reuseExistingServer: !process.env.CI,
  //   },
  // ],
});

