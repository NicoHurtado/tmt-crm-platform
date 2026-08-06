import { test, expect, type Page } from '@playwright/test';

/**
 * Auditoría de responsive.
 *
 * Falla si una página desborda horizontalmente en un teléfono. El desborde horizontal es
 * el síntoma que hace que en móvil aparezca la barra de scroll lateral y el contenido se
 * salga de la pantalla, y es medible sin depender del diseño.
 *
 * Cuando falla, el mensaje dice qué elemento se sale y cuántos píxeles, para poder ir
 * directo a arreglarlo.
 *
 * Requiere sesión de admin para las rutas de /admin/dashboard (usuario admin/admin del
 * seed). Si no hay sesión, esas pruebas se saltan en vez de fallar.
 */

const RUTAS_PUBLICAS = [
    '/',
    '/reservas',
    '/reservas/aeropuerto',
    '/reservas/transporte-municipal',
    '/reservas/tour-compartido-guatape',
    '/reservas/mis-reservas',
    '/terminos-condiciones',
    '/politica-privacidad',
    '/payment/result',
    '/admin/login',
];

const RUTAS_ADMIN = [
    '/admin/dashboard',
    '/admin/dashboard/reservas',
    '/admin/dashboard/servicios',
    '/admin/dashboard/servicios/crear',
    '/admin/dashboard/aliados',
    '/admin/dashboard/conductores',
    '/admin/dashboard/vehiculos',
    '/admin/dashboard/calendario',
    '/admin/dashboard/estadisticas',
    '/admin/dashboard/cotizaciones',
    '/admin/dashboard/calificaciones',
    '/admin/dashboard/pagos',
    '/admin/dashboard/estado-general',
    '/admin/dashboard/configuracion',
    '/admin/dashboard/terminos',
    '/admin/dashboard/tour-compartido',
];

/** Tolerancia en píxeles: por debajo de esto es ruido de redondeo del navegador. */
const TOLERANCIA = 2;

async function medirDesborde(page: Page) {
    return page.evaluate(() => {
        const anchoVisible = document.documentElement.clientWidth;
        const anchoReal = Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
        );
        const culpables: string[] = [];

        if (anchoReal - anchoVisible > 2) {
            document.querySelectorAll('*').forEach((el) => {
                const caja = el.getBoundingClientRect();
                if (caja.width === 0 || caja.right <= anchoVisible + 2) return;

                const clases =
                    typeof el.className === 'string' && el.className
                        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
                        : '';
                const descripcion = `${el.tagName.toLowerCase()}${clases}`;
                const yaListado = culpables.some((c) => c.startsWith(descripcion.slice(0, 30)));

                if (culpables.length < 5 && !yaListado) {
                    culpables.push(`${descripcion} (se sale ${Math.round(caja.right - anchoVisible)}px)`);
                }
            });
        }

        return { desborde: anchoReal - anchoVisible, culpables };
    });
}

async function esperarPagina(page: Page, ruta: string) {
    await page.goto(ruta, { waitUntil: 'networkidle', timeout: 45_000 }).catch(async () => {
        await page.goto(ruta, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    });
    // Da tiempo a que carguen datos y se estabilice el layout antes de medir.
    await page.waitForTimeout(1_000);
}

async function verificarSinDesborde(page: Page, ruta: string) {
    await esperarPagina(page, ruta);
    const { desborde, culpables } = await medirDesborde(page);

    expect(
        desborde,
        desborde > TOLERANCIA
            ? `${ruta} desborda ${desborde}px en móvil. Elementos que se salen:\n  - ${culpables.join('\n  - ')}`
            : '',
    ).toBeLessThanOrEqual(TOLERANCIA);
}

test.describe('Responsive — sin desborde horizontal en móvil', () => {
    test.describe('Páginas públicas', () => {
        for (const ruta of RUTAS_PUBLICAS) {
            test(`${ruta} cabe en la pantalla`, async ({ page }) => {
                await verificarSinDesborde(page, ruta);
            });
        }
    });

    test.describe('Panel de administración', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/admin/login', { waitUntil: 'networkidle' });
            await page.fill('input[type="email"], input[name="email"]', 'admin');
            await page.fill('input[type="password"], input[name="password"]', 'admin');
            await page.click('button[type="submit"]');
            await page.waitForURL(/dashboard/, { timeout: 25_000 });
        });

        for (const ruta of RUTAS_ADMIN) {
            test(`${ruta} cabe en la pantalla`, async ({ page }) => {
                await verificarSinDesborde(page, ruta);
            });
        }

        // El detalle no tiene URL fija: se llega haciendo clic en una fila, que abre un
        // panel lateral, y desde ahí "Abrir completo" lleva a la página entera. Se revisan
        // los dos, porque el panel es lo que usa el equipo a diario.
        test('el detalle de una reserva cabe en la pantalla', async ({ page }) => {
            // Recorre dos vistas y en desarrollo la segunda se compila al vuelo, así que
            // necesita más margen que el resto de pruebas.
            test.setTimeout(90_000);

            await esperarPagina(page, '/admin/dashboard/reservas');

            const primeraFila = page.locator('tbody tr').first();
            const hayReservas = (await primeraFila.count()) > 0;
            test.skip(!hayReservas, 'No hay reservas en la base para abrir el detalle');

            // 1. El panel lateral
            await primeraFila.click();
            await page.waitForTimeout(1_500);

            const panel = page.locator('[data-slot="sheet-content"], [role="dialog"]').first();
            await expect(panel).toBeVisible();

            const panelCabe = await panel.evaluate((el) => {
                const caja = el.getBoundingClientRect();
                return caja.left >= -2 && caja.right <= document.documentElement.clientWidth + 2;
            });
            expect(panelCabe, 'El panel lateral de la reserva se sale de la pantalla').toBe(true);

            const trasAbrirPanel = await medirDesborde(page);
            expect(
                trasAbrirPanel.desborde,
                trasAbrirPanel.desborde > TOLERANCIA
                    ? `Con el panel de reserva abierto la página desborda ${trasAbrirPanel.desborde}px:\n  - ${trasAbrirPanel.culpables.join('\n  - ')}`
                    : '',
            ).toBeLessThanOrEqual(TOLERANCIA);

            // 2. La página completa
            await page.getByRole('button', { name: /Abrir completo/i }).click();
            await page.waitForURL(/\/admin\/dashboard\/reservas\/.+/, { timeout: 20_000 });
            await page.waitForTimeout(1_500);

            const { desborde, culpables } = await medirDesborde(page);
            expect(
                desborde,
                desborde > TOLERANCIA
                    ? `La página de detalle desborda ${desborde}px en móvil. Elementos que se salen:\n  - ${culpables.join('\n  - ')}`
                    : '',
            ).toBeLessThanOrEqual(TOLERANCIA);
        });
    });
});
