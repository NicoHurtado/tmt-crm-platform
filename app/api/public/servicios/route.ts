import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildFullSystemPrompt, formatServicioContext, type ServicioContextData } from '@/lib/n8n/formatServicioContext';
import { getLocalizedText } from '@/types/multi-language';

export const dynamic = 'force-dynamic';

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS });
}

// ── In-memory cache ───────────────────────────────────────────────────────────
// Keeps last successful DB response per cacheKey (formato+lang).
// Survives cold starts within the same serverless instance.
// TTL = 5 min — after that we try DB again; stale still used if DB fails.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache: Record<string, { payload: Record<string, unknown>; ts: number }> = {};

// Minimal hardcoded fallback — used only when DB is down AND no cache exists
const FALLBACK_SYSTEM_PROMPT = `Eres Mía, la asistente virtual de TMT Travel 🌟 — empresa de transporte turístico premium en Medellín, Colombia.

Detecta en qué idioma escribe el cliente y responde SIEMPRE en ese idioma. Eres cálida, cercana y entusiasta.

En este momento estoy teniendo dificultades para acceder al catálogo completo. Por favor invita al cliente a visitar nuestro sitio web para ver servicios y precios actualizados, o indícale que lo conectarás con un asesor.

Sitio web: https://www.medellintransportes.com

Al escalar, primera línea EXACTA:
ESCALACION_REQUERIDA: catálogo no disponible temporalmente
Segunda línea: "¡Claro! Voy a conectarte con un asesor de TMT Travel que podrá ayudarte mejor. Te contactarán muy pronto 👤"`;

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
    const { searchParams } = new URL(request.url);
    const formato = searchParams.get('formato') ?? 'json';
    const lang = (searchParams.get('lang') ?? 'ES').toUpperCase() as 'ES' | 'EN';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';
    const cacheKey = `${formato}-${lang}`;

    // ── Try DB ────────────────────────────────────────────────────────────────
    let rawServicios: Awaited<ReturnType<typeof prisma.servicio.findMany>> | null = null;

    try {
        rawServicios = await prisma.servicio.findMany({
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
    } catch (dbError) {
        console.error('[public/servicios] DB error — falling back to cache:', dbError);
    }

    // ── DB failed: return stale cache or hardcoded fallback ───────────────────
    if (rawServicios === null) {
        const cached = cache[cacheKey];
        if (cached) {
            console.warn('[public/servicios] Returning stale cache');
            return NextResponse.json(cached.payload, {
                headers: { ...CORS, 'X-Cache': 'STALE' },
            });
        }
        // No cache at all — minimal fallback so chatbot still responds
        const fallback = {
            empresa: 'TMT Travel — Transportes Medellín',
            sitioWeb: appUrl,
            formato,
            actualizadoEn: new Date().toISOString(),
            totalServicios: 0,
            contenido: FALLBACK_SYSTEM_PROMPT,
            systemPrompt: FALLBACK_SYSTEM_PROMPT,
            _fallback: true,
        };
        return NextResponse.json(fallback, {
            headers: { ...CORS, 'X-Cache': 'FALLBACK' },
        });
    }

    // ── DB ok — build response ─────────────────────────────────────────────────
    try {
        let payload: Record<string, unknown>;

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

            payload = {
                empresa: 'TMT Travel — Transportes Medellín',
                sitioWeb: appUrl,
                moneda: 'COP',
                actualizadoEn: new Date().toISOString(),
                totalServicios: data.length,
                servicios: data,
            };
        } else {
            // formato=contexto | formato=texto
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

            payload = {
                empresa: 'TMT Travel — Transportes Medellín',
                sitioWeb: appUrl,
                formato,
                actualizadoEn: new Date().toISOString(),
                totalServicios: servicios.length,
                contenido: texto,
                systemPrompt: texto, // alias para compatibilidad con integraciones existentes
            };
        }

        // Store in cache
        cache[cacheKey] = { payload, ts: Date.now() };

        return NextResponse.json(payload, { headers: CORS });
    } catch (error) {
        console.error('[public/servicios] Build error:', error);
        return NextResponse.json(
            { error: 'Error al procesar servicios' },
            { status: 500, headers: CORS }
        );
    }
}
