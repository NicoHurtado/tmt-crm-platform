import { vi } from 'vitest';

// Test-only env. The Bold secret must match the SECRET literal in
// tests/integration/boldWebhook.test.ts so its HMAC signatures verify.
process.env.BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY ?? 'test-secret-key-for-hmac-testing-only';
process.env.BOLD_MODE = process.env.BOLD_MODE ?? 'production';
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? 'test-nextauth-secret';
process.env.DISABLE_ALIADO_EMAILS = process.env.DISABLE_ALIADO_EMAILS ?? '1';
process.env.DISABLE_CALENDAR_SYNC = process.env.DISABLE_CALENDAR_SYNC ?? '1';

// Mock Next.js server-only modules so unit tests don't require the Next.js runtime
vi.mock('next/server', () => ({
    NextResponse: {
        json: (body: unknown, init?: ResponseInit) => ({
            body,
            status: init?.status ?? 200,
            json: async () => body,
        }),
    },
    NextRequest: class {
        constructor(public url: string, public init?: RequestInit) {}
    },
}));

// Suppress console.error noise in tests (comment out to debug)
// vi.spyOn(console, 'error').mockImplementation(() => {});
