import { NextRequest, NextResponse } from 'next/server';
import { fetchActiveCatalogServices, toServicioContextData } from '@/lib/api/service-catalog';
import { buildServicioDetalle } from '@/lib/n8n/buildServicioDetalle';

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
    const servicioId = searchParams.get('servicioId');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';
    if (!servicioId) {
      return NextResponse.json(
        { status: 'falta_servicio', mensaje: 'Indica servicioId.' },
        { headers: CORS }
      );
    }
    const raw = await fetchActiveCatalogServices();
    const match = raw.find((s) => s.id === servicioId);
    if (!match) {
      return NextResponse.json(
        { status: 'no_encontrado', mensaje: 'No existe un servicio activo con ese id.' },
        { headers: CORS }
      );
    }
    const [ctx] = toServicioContextData([match]);
    return NextResponse.json(
      { status: 'ok', servicio: buildServicioDetalle(ctx, appUrl) },
      { headers: CORS }
    );
  } catch (error) {
    console.error('[public/servicio]', error);
    return NextResponse.json(
      { status: 'error', mensaje: 'No fue posible obtener el detalle.' },
      { status: 200, headers: CORS }
    );
  }
}
