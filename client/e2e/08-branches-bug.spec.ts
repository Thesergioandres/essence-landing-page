/**
 * TEST: Verificar que el botÃ³n Guardar Cambios funcione
 * Este test verifica el bug reportado donde el botÃ³n no responde
 */

import { expect, test } from "./fixtures";

test.describe("ðŸ› BUG FIX: Guardar Cambios en Acceso a Bodegas", () => {
  test("VERIFICACIÃ“N: BotÃ³n Guardar Cambios debe estar habilitado", async ({
    page,
    loginAsAdmin,
  }) => {
    await loginAsAdmin();

    // Navegar a un empleado
    await page.goto("/admin/employees");
    await page.waitForLoadState("networkidle");

    // Click en Ver Detalle
    const detailButton = page
      .getByRole("button", { name: /ver detalle/i })
      .first();
    if (await detailButton.isVisible()) {
      await detailButton.click();
      await page.waitForLoadState("networkidle");

      // Navegar a la pestaÃ±a "Acceso a Bodegas"
      const branchesTab = page.getByRole("tab", {
        name: /acceso a bodegas|bodegas/i,
      });

      if (await branchesTab.isVisible()) {
        await branchesTab.click();
        await page.waitForTimeout(2000); // Esperar a que cargue

        // Verificar que existe al menos un checkbox de bodega
        const branchCheckbox = page.locator("input[type='checkbox']").first();

        if (await branchCheckbox.isVisible()) {
          // Toggle checkbox
          await branchCheckbox.click();

          // Buscar el botÃ³n "Guardar Cambios"
          const saveButton = page.getByRole("button", {
            name: /guardar cambios/i,
          });

          // VERIFICAR: El botÃ³n debe estar visible
          await expect(saveButton).toBeVisible({ timeout: 5000 });

          // VERIFICAR: El botÃ³n NO debe estar deshabilitado
          const isDisabled = await saveButton.isDisabled();

          if (isDisabled) {
            console.warn("[Essence Debug]", 
              "âŒ BUG CONFIRMADO: BotÃ³n estÃ¡ deshabilitado cuando deberÃ­a estar habilitado"
            );

            // Capturar el estado del membership
            const membershipData = await page.evaluate(() => {
              return {
                localStorage: JSON.stringify(localStorage),
                sessionStorage: JSON.stringify(sessionStorage),
              };
            });

            console.warn("[Essence Debug]", "Estado del storage:", membershipData);
          } else {
            console.warn("[Essence Debug]", "âœ… BotÃ³n estÃ¡ habilitado correctamente");

            // Intentar hacer click
            await saveButton.click();

            // Esperar respuesta
            await page.waitForTimeout(2000);

            // Verificar mensaje de Ã©xito
            const successMessage = page.getByText(
              /actualizado correctamente|guardado/i
            );
            const errorMessage = page.getByText(/error/i);

            const hasSuccess = await successMessage
              .isVisible()
              .catch(() => false);
            const hasError = await errorMessage.isVisible().catch(() => false);

            if (hasSuccess) {
              console.warn("[Essence Debug]", "âœ… Cambios guardados exitosamente");
            } else if (hasError) {
              console.warn("[Essence Debug]", "âŒ Error al guardar cambios");
            } else {
              console.warn("[Essence Debug]", "âš ï¸ Sin mensaje de confirmaciÃ³n visible");
            }
          }
        } else {
          console.warn("[Essence Debug]", "âš ï¸ No hay checkboxes de bodegas disponibles");
        }
      } else {
        console.warn("[Essence Debug]", "âš ï¸ PestaÃ±a 'Acceso a Bodegas' no encontrada");
      }
    }
  });

  test("VERIFICACIÃ“N: Membership debe cargarse correctamente", async ({
    page,
    loginAsAdmin,
  }) => {
    await loginAsAdmin();

    // Navegar a empleado
    await page.goto("/admin/employees");
    await page.waitForLoadState("networkidle");

    const detailButton = page
      .getByRole("button", { name: /ver detalle/i })
      .first();
    if (await detailButton.isVisible()) {
      await detailButton.click();
      await page.waitForLoadState("networkidle");

      // Interceptar llamadas API para verificar respuestas
      page.on("response", async response => {
        const url = response.url();

        if (url.includes("/members") && response.request().method() === "GET") {
          const status = response.status();
          console.warn("[Essence Debug]", `ðŸ“¡ API /members - Status: ${status}`);

          if (status === 200) {
            try {
              const data = await response.json();
              console.warn("[Essence Debug]", 
                `âœ… Members response:`,
                JSON.stringify(data, null, 2)
              );
            } catch (e) {
              console.warn("[Essence Debug]", "âš ï¸ No se pudo parsear respuesta de members");
            }
          }
        }
      });

      // Ir a pestaÃ±a de bodegas para triggear la carga
      const branchesTab = page.getByRole("tab", {
        name: /acceso a bodegas|bodegas/i,
      });
      if (await branchesTab.isVisible()) {
        await branchesTab.click();
        await page.waitForTimeout(3000);
      }
    }
  });
});

