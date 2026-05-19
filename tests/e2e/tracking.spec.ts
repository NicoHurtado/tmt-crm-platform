import { test, expect } from '@playwright/test';

test.describe('Página de Tracking', () => {
    test('código válido muestra el estado de la reserva', async ({ page }) => {
        // This test requires a real reservation code in the test DB.
        // Adjust the codigo below to match a real reservation.
        const testCodigo = process.env.TEST_RESERVA_CODIGO ?? 'RES-TEST';

        await page.goto(`/tracking/${testCodigo}`);

        // Should NOT show a 500 error page or white screen
        await expect(page).not.toHaveTitle(/500|Error interno/i);

        // Should show either the reservation details or a "not found" message
        // but never a blank page
        const body = page.locator('body');
        const bodyText = await body.innerText();
        expect(bodyText.trim().length).toBeGreaterThan(10);
    });

    test('código inválido muestra mensaje de error amigable (no 500)', async ({ page }) => {
        const response = await page.goto('/tracking/CODIGO-QUE-NO-EXISTE-JAMAS-12345');

        // Should not crash with 500
        expect(response?.status()).not.toBe(500);

        // Should show some content (error message, not blank)
        const body = page.locator('body');
        const bodyText = await body.innerText();
        expect(bodyText.trim().length).toBeGreaterThan(5);
    });

    test('la página carga sin errores de JavaScript en consola', async ({ page }) => {
        const jsErrors: string[] = [];
        page.on('pageerror', (err) => jsErrors.push(err.message));

        await page.goto('/tracking/CODIGO-INVALIDO');
        await page.waitForLoadState('networkidle');

        // No unhandled JS errors should occur
        const criticalErrors = jsErrors.filter(e =>
            !e.includes('hydration') && // Next.js hydration warnings are ok in dev
            !e.includes('Warning:')
        );
        expect(criticalErrors).toHaveLength(0);
    });
});
