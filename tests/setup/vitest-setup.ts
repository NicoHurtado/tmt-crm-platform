import { vi } from 'vitest';

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
