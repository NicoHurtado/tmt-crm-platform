import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildFullSystemPrompt, formatServicioContext, type ServicioContextData } from '@/lib/n8n/formatServicioContext';
import { getLocalizedText } from '@/types/multi-language';

export const dynamic = 'force-dynamic';

// CORS headers — allow any origin so external automations can call this freely
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS });
}

/**
 * GET /api/public/servicios
 *
 * Public endpoint — no API key required.
 * Returns active services, pricing, and vehicle options.
 *
 * Query params:
 *   ?formato=json      (default) Structured JSON with all service data
 *   ?formato=contexto  Full AI system prompt — ready to paste into any chatbot/LLM
 *   ?formato=texto     Human-readable catalogue text — good for docs or descriptions
 *   ?lang=ES|EN        Language for name/description fields (default ES)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const formato = searchParams.get('formato') ?? 'json';
        const lang = (searchParams.get('lang') ?? 'ES').toUpperCase() as 'ES' | 'EN';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';

        const rawServicios = await prisma.servicio.findMany({
            where: { activo: true },
            include: {
                vehiculosPermitidos: {
                    where: { vehiculo: { activo: true } },
                    include: { vehiculo: true },
                    orderBy: { vehiculo: { capacidadMaxima: 'asc' } },
                },
            },
            orderBy: { orden: 'asc' },
        });

        // ── formato=json (default) ────────────────────────────────────────────
        if (formato === 'json') {
            const data = rawServicios.map((s) => ({
                id: s.id,
                tipo: s.tipoServicio,
                nombre: getLocalizedText(s.nombre, lang),
                nombreES: getLocalizedText(s.nombre, 'ES'),
                nombreEN: getLocalizedText(s.nombre, 'EN'),
                descripcion: getLocalizedText(s.descripcion, lang),
                descripcionES: getLocalizedText(s.descripcion, 'ES'),
                descripcionEN: getLocalizedText(s.descripcion, 'EN'),
                precioBase: Number(s.precioBase),
                duracion: s.duracion,
                esAeropuerto: s.esAeropuerto,
                esPorHoras: s.esPorHoras,
                esMunicipal: s.esMunicipal,
                recargoNocturno: s.aplicaRecargoNocturno
                    ? {
                          aplica: true,
                          inicio: s.recargoNocturnoInicio,
                          fin: s.recargoNocturnoFin,
                          monto: s.montoRecargoNocturno ? Number(s.montoRecargoNocturno) : null,
                      }
                    : { aplica: false },
                linkReserva: `${appUrl.replace(/\/$/, '')}/reservas?serviceId=${s.id}&form=1`,
                vehiculos: s.vehiculosPermitidos.map((sv) => ({
                    nombre: sv.vehiculo.nombre,
                    capacidadMinima: sv.vehiculo.capacidadMinima,
                    capacidadMaxima: sv.vehiculo.capacidadMaxima,
                    precio: Number(sv.precio ?? sv.vehiculo.precioBase),
                })),
            }));

            return NextResponse.json(
                {
                    empresa: 'TMT Travel — Transportes Medellín',
                    sitioWeb: appUrl,
                    moneda: 'COP',
                    actualizadoEn: new Date().toISOString(),
                    totalServicios: data.length,
                    servicios: data,
                },
                { headers: CORS }
            );
        }

        // ── formato=contexto | formato=texto ─────────────────────────────────
        const servicios: ServicioContextData[] = rawServicios.map((s) => ({
            id: s.id,
            tipoServicio: s.tipoServicio,
            nombre: s.nombre,
            descripcion: s.descripcion,
            incluye: s.incluye,
            duracion: s.duracion,
            precioBase: Number(s.precioBase),
            aplicaRecargoNocturno: s.aplicaRecargoNocturno,
            recargoNocturnoInicio: s.recargoNocturnoInicio ?? null,
            recargoNocturnoFin: s.recargoNocturnoFin ?? null,
            montoRecargoNocturno: s.montoRecargoNocturno ? Number(s.montoRecargoNocturno) : null,
            esPorHoras: s.esPorHoras,
            esMunicipal: s.esMunicipal,
            configuracion: s.configuracion,
            vehiculosPermitidos: s.vehiculosPermitidos.map((sv) => ({
                precio: sv.precio ? Number(sv.precio) : null,
                vehiculo: {
                    nombre: sv.vehiculo.nombre,
                    capacidadMinima: sv.vehiculo.capacidadMinima,
                    capacidadMaxima: sv.vehiculo.capacidadMaxima,
                    precioBase: Number(sv.vehiculo.precioBase),
                },
            })),
        }));

        const texto =
            formato === 'contexto'
                ? buildFullSystemPrompt(servicios, appUrl)
                : formatServicioContext(servicios, appUrl);

        return NextResponse.json(
            {
                empresa: 'TMT Travel — Transportes Medellín',
                sitioWeb: appUrl,
                formato,
                actualizadoEn: new Date().toISOString(),
                totalServicios: servicios.length,
                contenido: texto,
                systemPrompt: texto, // alias para compatibilidad con integraciones existentes
            },
            { headers: CORS }
        );
    } catch (error) {
        console.error('[public/servicios]', error);
        return NextResponse.json(
            { error: 'Error al obtener servicios' },
            { status: 500, headers: CORS }
        );
    }
}
