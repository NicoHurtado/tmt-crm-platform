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

// Minimal hardcoded fallback — used SOLO cuando la BD falla Y no hay caché.
// Importante: NUNCA debe mencionar "dificultades técnicas" ni "no puedo acceder al catálogo"
// al cliente (eso da una pésima experiencia). En su lugar, saluda con calidez, responde lo
// que se pueda de forma general y deriva a un asesor sin culpar a fallas del sistema.
const FALLBACK_SYSTEM_PROMPT = `Eres Nico, el asistente virtual de TMT Travel 🌟 — empresa de transporte turístico premium en Medellín, Colombia.

Detecta en qué idioma escribe el cliente y responde SIEMPRE en ese idioma. Eres cálido, cercano y entusiasta.

Saluda con naturalidad y atiende la conversación con calidez. Si el cliente pregunta por precios o detalles concretos de un servicio, NO inventes nada y NO menciones problemas técnicos ni le pidas que visite la web: con calidez, dile que en un momento un asesor de TMT Travel le confirma esa información y escálalo.

Al escalar, primera línea EXACTA:
ESCALACION_REQUERIDA: confirmación de un asesor
Segunda línea: "¡Claro! Voy a conectarte con un asesor de TMT Travel que podrá ayudarte mejor. Te contactarán muy pronto 👤"`;

// Reintenta una función async ante fallos transitorios (típico: cold start de Neon/timeout
// de conexión). Reduce drásticamente la frecuencia con que se cae al fallback.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 350): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        }
    }
    throw lastErr;
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
    const { searchParams } = new URL(request.url);
    const formato = searchParams.get('formato') ?? 'json';
    const lang = (searchParams.get('lang') ?? 'ES').toUpperCase() as 'ES' | 'EN';
    // ?tools=1 → el systemPrompt incluye instrucciones para usar la herramienta `cotizar`
    // (úsalo cuando el agente de n8n tenga conectada la tool y un modelo que la sepa usar).
    const toolMode = ['1', 'true', 'yes'].includes((searchParams.get('tools') ?? '').toLowerCase());
    // ?compacto=1 → systemPrompt reducido ~5x (persona resumida + índice de una línea), para
    // modelos con límite bajo de tokens/minuto (ej. tier gratis de Groq). Solo aplica a formato=contexto.
    const compact = ['1', 'true', 'yes'].includes((searchParams.get('compacto') ?? '').toLowerCase());
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';
    const cacheKey = `${formato}-${lang}-${toolMode ? 'tools' : 'plain'}-${compact ? 'compact' : 'full'}`;

    try {
        let payload: Record<string, unknown>;

        if (formato === 'json') {
            payload = await withRetry(() => buildCatalogJson(lang, appUrl));
        } else {
            payload = await withRetry(() =>
                buildCatalogText(formato === 'contexto' ? 'contexto' : 'texto', appUrl, toolMode, compact)
            );
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
