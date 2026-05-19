import { NextRequest, NextResponse } from 'next/server';
import { checkApiKey, unauthorized } from '../_auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/n8n/webhook
 * Stub endpoint for n8n to push automation events.
 * Logs payload and confirms receipt. Ready for future logic.
 */
export async function POST(request: NextRequest) {
    if (!checkApiKey(request)) return unauthorized();

    try {
        const body = await request.json();
        console.log('[n8n webhook] Received event:', JSON.stringify(body, null, 2));

        return NextResponse.json({
            success: true,
            received: true,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }
}
