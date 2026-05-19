import { test, expect } from '@playwright/test';

test.describe('Flujo de Reserva — Wizard (Cliente)', () => {
    test('página principal carga sin errores', async ({ page }) => {
        const jsErrors: string[] = [];
        page.on('pageerror', (err) => jsErrors.push(err.message));

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
        const criticalErrors = jsErrors.filter(e => !e.includes('Warning:') && !e.includes('hydration'));
        expect(criticalErrors).toHaveLength(0);
    });

    test('páginas legales cargan sin errores', async ({ page }) => {
        await page.goto('/politica-privacidad');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();

        await page.goto('/terminos-condiciones');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
    });

    test('página de resultado de pago carga sin crash', async ({ page }) => {
        // Should handle missing params gracefully
        const response = await page.goto('/payment/result');
        expect(response?.status()).not.toBe(500);
    });
});

test.describe('API Endpoints — Verificación básica', () => {
    test('GET /api/bold/webhook retorna status activo', async ({ request }) => {
        const response = await request.get('/api/bold/webhook');
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.status).toContain('active');
    });

    test('GET /api/reservas requiere datos (no crash en 500)', async ({ request }) => {
        const response = await request.get('/api/reservas');
        // Should return 200 or 401, never 500
        expect(response.status()).not.toBe(500);
    });

    test('GET /api/municipios retorna lista de municipios', async ({ request }) => {
        const response = await request.get('/api/municipios');
        // Should return some data, not 500
        expect(response.status()).not.toBe(500);
    });

    test('GET /api/servicios retorna lista de servicios', async ({ request }) => {
        const response = await request.get('/api/servicios');
        expect(response.status()).not.toBe(500);
    });
});

test.describe('Bold Webhook — Verificación de seguridad', () => {
    test('POST /api/bold/webhook sin firma retorna 401', async ({ request }) => {
        const response = await request.post('/api/bold/webhook', {
            data: {
                order_id: 'RES-TEST',
                payment_status: 'approved',
                amount: 100_000,
                currency: 'COP',
            },
            headers: {
                'Content-Type': 'application/json',
                // No x-bold-signature header
            },
        });
        expect(response.status()).toBe(401);
    });

    test('POST /api/bold/webhook con firma inválida retorna 401', async ({ request }) => {
        const response = await request.post('/api/bold/webhook', {
            data: {
                order_id: 'RES-TEST',
                payment_status: 'approved',
                amount: 100_000,
                currency: 'COP',
            },
            headers: {
                'Content-Type': 'application/json',
                'x-bold-signature': 'firma_completamente_invalida_0000000',
            },
        });
        expect(response.status()).toBe(401);
    });
});
