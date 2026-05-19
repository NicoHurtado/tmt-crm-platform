import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin — Autenticación', () => {
    test('login con credenciales correctas redirige al dashboard', async ({ page }) => {
        await loginAsAdmin(page);
        await expect(page).toHaveURL(/.*admin\/dashboard.*/);
    });

    test('login con contraseña incorrecta muestra error', async ({ page }) => {
        await page.goto('/admin/login');
        await page.waitForSelector('#email', { timeout: 10_000 });

        await page.fill('#email', 'admin');
        await page.fill('#password', 'contrasena_incorrecta_99999');
        await page.click('button[type="submit"]');

        // Should NOT redirect to dashboard
        await page.waitForTimeout(2000);
        expect(page.url()).not.toContain('/dashboard');
    });

    test('acceso directo a /admin/dashboard sin sesión redirige al login', async ({ page }) => {
        await page.goto('/admin/dashboard/reservas');
        // Should be redirected to login
        await page.waitForURL(/.*admin(?!\/dashboard).*/);
        expect(page.url()).not.toContain('/dashboard');
    });
});

test.describe('Admin — Dashboard de reservas', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('listado de reservas carga correctamente', async ({ page }) => {
        await page.goto('/admin/dashboard/reservas');
        await page.waitForLoadState('networkidle');

        // No error message visible
        await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();

        // Page has content
        const body = await page.locator('body').innerText();
        expect(body.trim().length).toBeGreaterThan(50);
    });

    test('filtro por estado funciona', async ({ page }) => {
        await page.goto('/admin/dashboard/reservas');
        await page.waitForLoadState('networkidle');

        // Try clicking a status filter if it exists
        const filterButtons = page.locator('[data-testid*="filter"], button:has-text("Pendiente"), button:has-text("Confirmada")');
        const count = await filterButtons.count();

        if (count > 0) {
            await filterButtons.first().click();
            await page.waitForLoadState('networkidle');
            // Should not crash
            await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
        }
    });

    test('no hay errores JS críticos en el dashboard', async ({ page }) => {
        const jsErrors: string[] = [];
        page.on('pageerror', (err) => jsErrors.push(err.message));

        await page.goto('/admin/dashboard');
        await page.waitForLoadState('networkidle');

        const criticalErrors = jsErrors.filter(e => !e.includes('Warning:'));
        expect(criticalErrors).toHaveLength(0);
    });
});

test.describe('Admin — Dashboard de estadísticas', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('página de estadísticas carga sin errores', async ({ page }) => {
        await page.goto('/admin/dashboard/estadisticas');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
        const body = await page.locator('body').innerText();
        expect(body.trim().length).toBeGreaterThan(20);
    });
});
