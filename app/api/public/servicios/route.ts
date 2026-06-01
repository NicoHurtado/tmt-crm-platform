import { NextRequest, NextResponse } from 'next/server';
import { buildCatalogJson, buildCatalogText } from '@/lib/api/service-catalog';

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
const FALLBACK_SYSTEM_PROMPT = `Eres Nico, el asistente virtual de TMT Travel 🌟 — empresa de transporte turístico premium en Medellín, Colombia.

Detecta en qué idioma escribe el cliente y responde SIEMPRE en ese idioma. Eres cálido, cercano y entusiasta.

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

    try {
        let payload: Record<string, unknown>;

        if (formato === 'json') {
            payload = await buildCatalogJson(lang, appUrl);
        } else {
            payload = await buildCatalogText(formato === 'contexto' ? 'contexto' : 'texto', appUrl);
        }

        cache[cacheKey] = { payload, ts: Date.now() };

        return NextResponse.json(payload, { headers: CORS });
    } catch (dbError) {
        console.error('[public/servicios] DB/build error — falling back to cache:', dbError);
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
}
