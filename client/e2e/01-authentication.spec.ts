/**
 * ============================================
 * TEST SUITE 1: AUTHENTICATION
 * ============================================
 *
 * Tests:
 * - Admin login flow
 * - Token persistence
 * - Redirect to dashboard
 * - Logout flow
 * - Invalid credentials handling
 */

import { expect, test } from "./fixtures";

test.describe("ðŸ” Authentication Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("should show login page", async ({ page }) => {
    await page.goto("/login");

    // Check login form elements exist
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /iniciar sesiÃ³n|login|entrar/i })
    ).toBeVisible();
  });

  test("should login as admin and redirect to dashboard", async ({
    page,
    loginAsAdmin,
  }) => {
    await loginAsAdmin();

    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/(admin|dashboard)/);

    // Check token exists in localStorage
    const token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).toBeTruthy();

    console.warn("[Essence Debug]", "âœ… Admin login successful");
  });

  test("should persist session across page reloads", async ({
    page,
    loginAsAdmin,
  }) => {
    await loginAsAdmin();

    // Reload the page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await expect(page).not.toHaveURL(/\/login/);

    console.warn("[Essence Debug]", "âœ… Session persistence works");
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[name="email"]').fill("invalid@test.com");
    await page.locator('input[name="password"]').fill("wrongpassword");
    await page
      .getByRole("button", { name: /iniciar sesiÃ³n|login|entrar/i })
      .click();

    // Wait for error message
    const errorMessage = page.getByText(
      /error|credenciales|invÃ¡lid|incorrect/i
    );
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);

    console.warn("[Essence Debug]", "âœ… Invalid credentials handled correctly");
  });

  test("should logout and redirect to login", async ({
    page,
    loginAsAdmin,
    logout,
  }) => {
    await loginAsAdmin();

    // Logout
    await logout();

    // Should be on login page
    await expect(page).toHaveURL(/\/login/);

    // Token should be cleared
    const token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).toBeFalsy();

    console.warn("[Essence Debug]", "âœ… Logout successful");
  });

  test("should protect admin routes from unauthenticated access", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

    console.warn("[Essence Debug]", "âœ… Route protection works");
  });
});

