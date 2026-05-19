import { NextRequest } from 'next/server';

export function checkApiKey(request: NextRequest): boolean {
    const key = process.env.N8N_API_KEY;
    if (!key) {
        console.error('[n8n] N8N_API_KEY not set — denying request');
        return false;
    }
    return request.headers.get('x-api-key') === key;
}

export function unauthorized() {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
