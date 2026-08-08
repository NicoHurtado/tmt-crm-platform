import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    retries: 1,
    timeout: 30_000,
    reporter: [['html', { outputFolder: 'test-results/playwright' }], ['list']],
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            testIgnore: /responsive\.spec\.ts/,
        },
        // La auditoría de responsive corre en dos tamaños de teléfono.
        // Se fuerza browserName porque los descriptores de iPhone piden WebKit, que en
        // Linux necesita librerías del sistema (sudo npx playwright install-deps webkit).
        // El desborde horizontal es un cálculo de layout: da igual en ambos motores.
        {
            name: 'mobile-iphone',
            use: { ...devices['iPhone 14'], browserName: 'chromium' },
            testMatch: /responsive\.spec\.ts/,
        },
        {
            name: 'mobile-android',
            use: { ...devices['Pixel 7'], browserName: 'chromium' },
            testMatch: /responsive\.spec\.ts/,
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
