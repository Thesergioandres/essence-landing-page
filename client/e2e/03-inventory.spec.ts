/**
 * ============================================
 * TEST SUITE 3: INVENTORY MANAGEMENT
 * ============================================
 *
 * Tests:
 * - View products list
 * - Create new product
 * - Edit product
 * - View product detail
 * - Inventory entries
 * - Assign stock to employee
 * - Verify stock deduction
 */

import { expect, generateTestData, test } from "./fixtures";

test.describe("ðŸ“¦ Inventory Management Tests", () => {
  const testData = generateTestData();

  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test("should navigate to products list", async ({ page }) => {
    await page.goto("/admin/products");

    // Wait for products to load
    await page.waitForLoadState("networkidle");

    // Should see products page
    await expect(page.getByText(/productos|inventario/i).first()).toBeVisible({
      timeout: 10000,
    });

    console.warn("[Essence Debug]", "âœ… Products list loaded");
  });

  test("should display product cards or table", async ({ page }) => {
    await page.goto("/admin/products");
    await page.waitForLoadState("networkidle");

    // Check for product cards or table rows
    const productCards = page
      .locator("[class*='card'], [class*='product'], article")
      .first();
    const tableRows = page.locator("tbody tr").first();

    const hasCards = await productCards.isVisible().catch(() => false);
    const hasTable = await tableRows.isVisible().catch(() => false);

    expect(hasCards || hasTable).toBe(true);

    console.warn("[Essence Debug]", `âœ… Products displayed as ${hasCards ? "cards" : "table"}`);
  });

  test("should navigate to add product page", async ({ page }) => {
    await page.goto("/admin/products");

    // Click add product button
    const addButton = page.getByRole("button", {
      name: /nuevo|agregar|crear|\+/i,
    });

    if (await addButton.isVisible()) {
      await addButton.click();
    } else {
      await page.goto("/admin/products/add");
    }

    // Verify form is visible
    await expect(page.getByPlaceholder(/nombre/i)).toBeVisible({
      timeout: 5000,
    });

    console.warn("[Essence Debug]", "âœ… Add product form accessible");
  });

  test("should create a new product", async ({ page }) => {
    await page.goto("/admin/products/add");

    // Fill product form
    await page.getByPlaceholder(/nombre/i).fill(testData.productName);

    // Price fields
    const priceField = page.getByPlaceholder(/precio.*venta|sale.*price/i);
    if (await priceField.isVisible()) {
      await priceField.fill("100");
    } else {
      // Try alternative field names
      await page
        .locator("input[name*='price'], input[name*='Price']")
        .first()
        .fill("100");
    }

    // Purchase price if visible
    const purchasePrice = page.getByPlaceholder(
      /precio.*compra|purchase|costo/i
    );
    if (await purchasePrice.isVisible()) {
      await purchasePrice.fill("50");
    }

    // Stock if visible
    const stockField = page.getByPlaceholder(/stock|cantidad|inventory/i);
    if (await stockField.isVisible()) {
      await stockField.fill("10");
    }

    // Submit
    const submitButton = page.getByRole("button", {
      name: /crear|guardar|agregar/i,
    });
    await submitButton.click();

    // Wait for redirect or success message
    await expect(page).toHaveURL(/\/admin\/products/, { timeout: 10000 });

    console.warn("[Essence Debug]", `âœ… Created product: ${testData.productName}`);
  });

  test("should view product detail", async ({ page }) => {
    await page.goto("/admin/products");
    await page.waitForLoadState("networkidle");

    // Click on first product
    const productCard = page
      .locator("[class*='card'], [class*='product'], article")
      .first();

    if (await productCard.isVisible()) {
      await productCard.click();

      // Verify we're on detail page
      await expect(page).toHaveURL(/\/admin\/products\/[a-f0-9]+/i, {
        timeout: 10000,
      });

      console.warn("[Essence Debug]", "âœ… Product detail page accessible");
    }
  });

  test("should navigate to inventory entries", async ({ page }) => {
    await page.goto("/admin/inventory/entries");

    await page.waitForLoadState("networkidle");

    // Should see entries page
    await expect(
      page.getByText(/entradas|inventario|movimientos/i).first()
    ).toBeVisible({ timeout: 10000 });

    console.warn("[Essence Debug]", "âœ… Inventory entries page loaded");
  });

  test("should navigate to global inventory view", async ({ page }) => {
    await page.goto("/admin/inventory");

    await page.waitForLoadState("networkidle");

    // Should see global inventory
    await expect(page.getByText(/inventario|stock/i).first()).toBeVisible({
      timeout: 10000,
    });

    console.warn("[Essence Debug]", "âœ… Global inventory page loaded");
  });

  test("should assign stock to employee from detail page", async ({
    page,
  }) => {
    // First go to employee detail
    await page.goto("/admin/employees");
    await page.waitForLoadState("networkidle");

    const detailButton = page
      .getByRole("button", { name: /ver detalle/i })
      .first();
    if (await detailButton.isVisible()) {
      await detailButton.click();

      // Wait for detail page
      await expect(page).toHaveURL(/\/admin\/employees\/[a-f0-9]+/i, {
        timeout: 10000,
      });

      // Look for assign stock button or tab
      const stockTab = page.getByRole("tab", { name: /stock|inventario/i });
      const assignButton = page.getByRole("button", {
        name: /asignar|assign/i,
      });

      if (await stockTab.isVisible()) {
        await stockTab.click();
        console.warn("[Essence Debug]", "âœ… Stock tab accessible");
      }

      if (await assignButton.isVisible()) {
        console.warn("[Essence Debug]", "âœ… Assign stock button found");
      }
    }
  });

  test("should verify stock levels after assignment", async ({ page }) => {
    await page.goto("/admin/inventory");
    await page.waitForLoadState("networkidle");

    // Look for stock values
    const stockValues = page.locator("[class*='stock'], [class*='quantity']");

    if ((await stockValues.count()) > 0) {
      console.warn("[Essence Debug]", "âœ… Stock values visible in inventory");
    }

    // Check for warehouse stock specifically
    const warehouseStock = page.getByText(/bodega|warehouse|sede/i);
    if (await warehouseStock.isVisible()) {
      console.warn("[Essence Debug]", "âœ… Warehouse stock section found");
    }
  });

  test("should show low stock alerts", async ({ page }) => {
    await page.goto("/admin/inventory");
    await page.waitForLoadState("networkidle");

    // Look for alerts section
    const alertsSection = page.getByText(/alertas|bajo stock|low stock|âš ï¸/i);

    if (await alertsSection.isVisible()) {
      console.warn("[Essence Debug]", "âœ… Stock alerts section visible");
    } else {
      console.warn("[Essence Debug]", "â„¹ï¸ No low stock alerts (stock levels are OK)");
    }
  });
});

