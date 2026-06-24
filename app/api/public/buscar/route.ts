// app/api/public/buscar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { buildCatalogJson, searchCatalogServices } from '@/lib/api/service-catalog';

export const dynamic = 'force-dynamic';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q') ?? '';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';
        if (!q.trim()) {
            return NextResponse.json(
                { status: 'falta_q', mensaje: 'Indica q (texto a buscar).', resultados: [] },
                { headers: CORS }
            );
        }
        const catalogo = await buildCatalogJson('ES', appUrl);
        const resultados = searchCatalogServices(catalogo.servicios as any, q);
        return NextResponse.json(
            { status: resultados.length ? 'ok' : 'no_encontrado', total: resultados.length, resultados },
            { headers: CORS }
        );
    } catch (error) {
        console.error('[public/buscar]', error);
        return NextResponse.json(
            { status: 'error', mensaje: 'No fue posible buscar.', resultados: [] },
            { status: 200, headers: CORS }
        );
    }
}
