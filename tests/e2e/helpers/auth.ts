import { Page } from '@playwright/test';

/**
 * Login as admin for E2E tests.
 * Credentials: set TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD env vars,
 * or defaults to the seed values (admin / admin).
 */
export async function loginAsAdmin(page: Page): Promise<void> {
    // Login page is at /admin/login (NextAuth signIn page)
    await page.goto('/admin/login');
    await page.waitForSelector('#email', { timeout: 10_000 });

    const adminEmail = process.env.TEST_ADMIN_EMAIL ?? 'admin';
    const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? 'admin';

    // The email field is type="text" with id="email"
    await page.fill('#email', adminEmail);
    await page.fill('#password', adminPassword);
    // Start watching for the URL change before clicking so we don't miss a fast redirect
    await Promise.all([
        page.waitForURL('**/admin/dashboard**', { timeout: 25_000 }),
        page.click('button[type="submit"]'),
    ]);
}

/**
 * Save auth state so tests can reuse the session (faster).
 * Call this once in globalSetup or a setup fixture.
 */
export async function saveAuthState(page: Page, storageStatePath: string): Promise<void> {
    await loginAsAdmin(page);
    await page.context().storageState({ path: storageStatePath });
}
