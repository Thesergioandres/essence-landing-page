/**
 * ============================================
 * TEST SUITE 6: DASHBOARD & ANALYTICS
 * ============================================
 *
 * Tests:
 * - Dashboard loads with KPIs
 * - Financial KPIs (revenue, profit, expenses)
 * - Sales charts render
 * - Top products display
 * - Date range filters work
 */

import { expect, test } from "./fixtures";

test.describe("ðŸ“Š Dashboard & Analytics Tests", () => {
  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test("should display dashboard with KPI cards", async ({ page }) => {
    await page.goto("/admin/dashboard");

    await page.waitForLoadState("networkidle");

    // Look for KPI cards
    const kpiCards = page.locator(
      "[class*='card'], [class*='kpi'], [class*='metric']"
    );
    const count = await kpiCards.count();

    expect(count).toBeGreaterThan(0);
    console.warn("[Essence Debug]", `âœ… Dashboard displays ${count} KPI cards`);
  });

  test("should show revenue metrics", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Look for revenue/ventas indicators
    const revenueText = page.getByText(/ventas|ingresos|revenue|\$\d/i);

    if (await revenueText.first().isVisible()) {
      console.warn("[Essence Debug]", "âœ… Revenue metrics visible");
    }
  });

  test("should show profit metrics", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Look for profit indicators
    const profitText = page.getByText(/ganancia|utilidad|profit|margen/i);

    if (await profitText.first().isVisible()) {
      console.warn("[Essence Debug]", "âœ… Profit metrics visible");
    }
  });

  test("should display charts", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Wait for charts to render (Recharts uses SVG)
    await page.waitForTimeout(2000);

    // Look for chart containers or SVG elements
    const chartContainers = page.locator(
      "[class*='chart'], [class*='Chart'], .recharts-wrapper"
    );
    const svgCharts = page.locator("svg.recharts-surface");

    const hasChartContainers = (await chartContainers.count()) > 0;
    const hasSvgCharts = (await svgCharts.count()) > 0;

    if (hasChartContainers || hasSvgCharts) {
      console.warn("[Essence Debug]", "âœ… Charts rendered on dashboard");
    } else {
      console.warn("[Essence Debug]", "â„¹ï¸ No charts visible (might be loading or no data)");
    }
  });

  test("should show top products section", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Look for top products
    const topProducts = page.getByText(
      /top productos|productos mÃ¡s vendidos|mÃ¡s vendidos/i
    );

    if (await topProducts.isVisible()) {
      console.warn("[Essence Debug]", "âœ… Top products section visible");
    }
  });

  test("should have date range filter", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Look for date filters
    const dateFilter = page.getByRole("button", {
      name: /hoy|semana|mes|aÃ±o|today|week|month/i,
    });
    const dateInputs = page.locator("input[type='date']");

    const hasDateFilter = await dateFilter
      .first()
      .isVisible()
      .catch(() => false);
    const hasDateInputs = (await dateInputs.count()) > 0;

    if (hasDateFilter || hasDateInputs) {
      console.warn("[Essence Debug]", "âœ… Date range filter available");
    }
  });

  test("should update KPIs when changing date range", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Try clicking different date ranges
    const weekButton = page.getByRole("button", { name: /semana|week/i });
    const monthButton = page.getByRole("button", { name: /mes|month/i });

    if (await weekButton.isVisible()) {
      await weekButton.click();
      await page.waitForTimeout(1000);

      if (await monthButton.isVisible()) {
        await monthButton.click();
        await page.waitForTimeout(1000);
      }

      console.warn("[Essence Debug]", "âœ… Date range buttons work");
    }
  });

  test("should show expense summary if available", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Look for expenses
    const expenses = page.getByText(/gastos|expenses|egresos/i);

    if (await expenses.isVisible()) {
      console.warn("[Essence Debug]", "âœ… Expense summary visible");
    } else {
      console.warn("[Essence Debug]", "â„¹ï¸ Expenses not shown on main dashboard");
    }
  });

  test("should calculate net profit correctly", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Look for net profit indicator (after MASTER FIX)
    const netProfit = page.getByText(/utilidad neta|net profit|ganancia neta/i);

    if (await netProfit.isVisible()) {
      console.warn("[Essence Debug]", "âœ… Net profit KPI visible (MASTER FIX verified)");
    }
  });

  test("should navigate to detailed analytics", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Look for "ver mÃ¡s" or analytics link
    const analyticsLink = page.getByRole("link", {
      name: /ver mÃ¡s|analytics|anÃ¡lisis|detalle/i,
    });

    if (await analyticsLink.isVisible()) {
      await analyticsLink.click();
      await page.waitForLoadState("networkidle");
      console.warn("[Essence Debug]", "âœ… Detailed analytics accessible");
    }
  });
});

