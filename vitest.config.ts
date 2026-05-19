import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./tests/setup/vitest-setup.ts'],
        include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: [
                'lib/state-transitions.ts',
                'lib/bold.ts',
                'lib/priceCalculator.ts',
                'lib/email-templates.ts',
            ],
            thresholds: {
                lines: 80,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
});
