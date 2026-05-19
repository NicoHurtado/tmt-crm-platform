import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin — CRUD Servicios', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('listado de servicios carga sin errores', async ({ page }) => {
        await page.goto('/admin/dashboard/servicios');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
    });

    test('formulario de creación de servicio abre correctamente', async ({ page }) => {
        await page.goto('/admin/dashboard/servicios/crear');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();

        // Should have some form inputs
        const inputs = page.locator('input, textarea, select');
        const inputCount = await inputs.count();
        expect(inputCount).toBeGreaterThan(0);
    });
});

test.describe('Admin — CRUD Aliados', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('listado de aliados carga sin errores', async ({ page }) => {
        await page.goto('/admin/dashboard/aliados');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
    });
});

test.describe('Admin — CRUD Conductores', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('listado de conductores carga sin errores', async ({ page }) => {
        await page.goto('/admin/dashboard/conductores');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
    });
});

test.describe('Admin — CRUD Vehículos', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('listado de vehículos carga sin errores', async ({ page }) => {
        await page.goto('/admin/dashboard/vehiculos');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
    });
});

test.describe('Admin — Calendario', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('calendario carga sin errores JavaScript críticos', async ({ page }) => {
        const jsErrors: string[] = [];
        page.on('pageerror', (err) => jsErrors.push(err.message));

        await page.goto('/admin/dashboard/calendario');
        await page.waitForLoadState('networkidle');

        const criticalErrors = jsErrors.filter(e => !e.includes('Warning:'));
        expect(criticalErrors).toHaveLength(0);
        await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
    });
});
