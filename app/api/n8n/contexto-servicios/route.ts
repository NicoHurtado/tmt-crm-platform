import { NextRequest, NextResponse } from 'next/server';
import { checkApiKey, unauthorized } from '../_auth';
import { buildCatalogText, PRICE_SOURCE, PRICE_TYPE } from '@/lib/api/service-catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    if (!checkApiKey(request)) return unauthorized();

    try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';
        const payload = await buildCatalogText('contexto', appUrl);

        return NextResponse.json({
            systemPrompt: payload.systemPrompt,
            servicios: payload.servicios,
            updatedAt: payload.actualizadoEn,
            serviciosCount: payload.totalServicios,
            precioOrigen: PRICE_SOURCE,
            tipoPrecio: PRICE_TYPE,
        });
    } catch (error) {
        console.error('[contexto-servicios]', error);
        return NextResponse.json({ error: 'Error al obtener contexto de servicios' }, { status: 500 });
    }
}
