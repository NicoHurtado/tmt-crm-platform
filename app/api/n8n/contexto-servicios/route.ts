import { NextRequest, NextResponse } from 'next/server';
import { checkApiKey, unauthorized } from '../_auth';
import { buildCatalogText, PRICE_SOURCE, PRICE_TYPE } from '@/lib/api/service-catalog';

export const dynamic = 'force-dynamic';

/**
 * GET /api/n8n/contexto-servicios
 *
 * ⚠️ USO EN n8n:
 * - `systemPrompt` es lo ÚNICO que debe inyectarse como contexto del modelo de IA. Ya
 *   contiene el catálogo completo (precios por vehículo, reglas de enrutamiento, links).
 * - `servicios` (JSON) es SOLO para lógica programática del flujo (armar links por ID, etc.).
 *   NO lo pases también al prompt del modelo: duplicar el catálogo en dos formatos confunde
 *   al bot y mezcla la información. Una sola fuente de verdad = `systemPrompt`.
 */
export async function GET(request: NextRequest) {
    if (!checkApiKey(request)) return unauthorized();

    try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';
        const { searchParams } = new URL(request.url);
        const toolMode = ['1', 'true', 'yes'].includes((searchParams.get('tools') ?? '').toLowerCase());
        const payload = await buildCatalogText('contexto', appUrl, toolMode);

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
