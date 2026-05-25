import { NextRequest } from 'next/server';

export function checkExternalApiKey(request: NextRequest): boolean {
    const key = process.env.EXTERNAL_RESERVAS_API_KEY;
    if (!key) {
        console.error('[external reservas] EXTERNAL_RESERVAS_API_KEY not set — denying request');
        return false;
    }
    return request.headers.get('x-api-key') === key;
}

export function externalUnauthorized() {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
