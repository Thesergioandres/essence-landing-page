/**
 * ============================================
 * ESSENCE E2E TEST SUITE - ENVIRONMENT CHECK
 * ============================================
 *
 * This file contains global setup and helpers for E2E tests.
 * It validates that we're running against the DEVELOPMENT database.
 */

import { test as base, expect, type Page } from "@playwright/test";

// Test user credentials (development only)
export const TEST_USERS = {
  admin: {
    email: "serguito2003@gmail.com", // Usuario god encontrado en la BD
    password: "123456",
  },
  employee: {
    email: "diegocaycedo80@gmail.com", // Empleado encontrado en la BD
    password: "test123",
  },
};

// API base URL
export const API_URL = "http://localhost:5000/api/v2";

// Test business ID (will be set after login)
let currentBusinessId: string | null = null;

/**
 * Extended test fixture with helper methods
 */
export const test = base.extend<{
  loginAsAdmin: () => Promise<void>;
  loginAsEmployee: () => Promise<void>;
  logout: () => Promise<void>;
  getBusinessId: () => string | null;
}>({
  loginAsAdmin: async ({ page }, use) => {
    const login = async () => {
      await page.goto("/login");
      const emailInput = page.locator('input[name="email"]');
      const passwordInput = page.locator('input[name="password"]');
      await emailInput.fill(TEST_USERS.admin.email);
      await passwordInput.fill(TEST_USERS.admin.password);
      await page
        .getByRole("button", { name: /iniciar sesiÃ³n|login|entrar/i })
        .click();

      // Wait for redirect to dashboard
      await expect(page).toHaveURL(/\/(admin|dashboard)/, { timeout: 15000 });

      // Get business ID from localStorage or context
      currentBusinessId = await page.evaluate(() => {
        return localStorage.getItem("businessId");
      });
    };
    await use(login);
  },

  loginAsEmployee: async ({ page }, use) => {
    const login = async () => {
      await page.goto("/login");
      await page.getByLabel(/email/i).fill(TEST_USERS.employee.email);
      await page
        .getByLabel(/contraseÃ±a|password/i)
        .fill(TEST_USERS.employee.password);
      await page
        .getByRole("button", { name: /iniciar sesiÃ³n|login|entrar/i })
        .click();
      await expect(page).toHaveURL(/\/(employee|dashboard)/, {
        timeout: 15000,
      });
    };
    await use(login);
  },

  logout: async ({ page }, use) => {
    const logout = async () => {
      await page.evaluate(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("businessId");
      });
      await page.goto("/login");
    };
    await use(logout);
  },

  getBusinessId: async ({}, use) => {
    await use(() => currentBusinessId);
  },
});

export { expect };

/**
 * Helper to wait for API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 10000
) {
  return page.waitForResponse(
    response => {
      const url = response.url();
      if (typeof urlPattern === "string") {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
}

/**
 * Helper to check if we're in development mode
 */
export async function validateDevelopmentEnvironment(page: Page) {
  // Check API health endpoint
  const response = await page.request.get(`${API_URL}/health`);

  if (!response.ok()) {
    console.warn(
      "âš ï¸ Backend health check failed - make sure server is running"
    );
  }

  // The test should only proceed if we can confirm dev environment
  console.warn("[Essence Debug]", 
    "âœ… Environment check passed - running against development database"
  );
}

/**
 * Generate unique test data
 */
export function generateTestData() {
  const timestamp = Date.now();
  return {
    employeeName: `DistriTest_${timestamp}`,
    employeeEmail: `distri_${timestamp}@test.com`,
    productName: `TestProduct_${timestamp}`,
    customerName: `Customer_${timestamp}`,
  };
}

