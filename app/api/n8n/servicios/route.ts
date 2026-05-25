import { NextRequest, NextResponse } from 'next/server';
import { checkApiKey, unauthorized } from '../_auth';
import { buildCatalogJson } from '@/lib/api/service-catalog';

export const dynamic = 'force-dynamic';

/** GET /api/n8n/servicios — Active services with vehicle pricing */
export async function GET(request: NextRequest) {
    if (!checkApiKey(request)) return unauthorized();

    try {
        const payload = await buildCatalogJson('ES');
        return NextResponse.json({
            success: true,
            count: payload.totalServicios,
            precioOrigen: payload.precioOrigen,
            tipoPrecio: payload.tipoPrecio,
            data: payload.servicios,
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
