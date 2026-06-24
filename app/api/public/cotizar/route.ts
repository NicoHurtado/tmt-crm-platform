import { NextRequest, NextResponse } from 'next/server';
import { fetchActiveCatalogServices } from '@/lib/api/service-catalog';
import { getLocalizedText } from '@/types/multi-language';
import { isNightSurchargeApplicable } from '@/lib/pricing';
import { getConfiguracion, totalPorPersona } from '@/types/servicio-config';

export const dynamic = 'force-dynamic';

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS });
}

/**
 * GET/POST /api/public/cotizar  — HERRAMIENTA DE COTIZACIÓN (tool para el bot)
 *
 * Fuente ÚNICA y DETERMINISTA del precio para clientes independientes. El bot NUNCA
 * debe escribir un precio de su memoria: siempre llama aquí y usa lo que devuelve.
 *
 * Parámetros (query o JSON):
 *   - servicioId  (preferido) id exacto del servicio
 *   - tipo        TipoServicio (ej. TOUR_GUATAPE) — alternativa a servicioId
 *   - q           texto libre del servicio (ej. "guatape") — última alternativa
 *   - pax         número de personas (entero)
 *   - aeropuerto  JOSE_MARIA_CORDOVA | OLAYA_HERRERA (solo servicios de aeropuerto)
 *   - hora        HH:mm (opcional, para informar recargo nocturno)
 *
 * Respuestas (campo `status`):
 *   - ok               → precio exacto + vehículo + link
 *   - falta_servicio   → no se indicó servicio
 *   - no_encontrado    → ningún servicio coincide
 *   - ambiguo          → varios servicios coinciden (lista en `opciones`) → preguntar
 *   - municipio        → es traslado municipal: sin precio aquí, va en el formulario
 *   - falta_aeropuerto → es aeropuerto y no se indicó cuál → preguntar
 *   - falta_pax        → falta el número de personas → preguntar
 *   - fuera_de_rango   → ningún vehículo cubre ese número de personas → escalar
 */

const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
function norm(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(COMBINING_MARKS, '')
        .trim();
}

function fmtCOP(n: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

async function handle(params: {
    servicioId?: string | null;
    tipo?: string | null;
    q?: string | null;
    pax?: string | number | null;
    aeropuerto?: string | null;
    hora?: string | null;
}) {
    const appBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com').replace(/\/$/, '');
    const servicios = await fetchActiveCatalogServices();
    // Solo servicios con algún vehículo con precio (cotizables). Municipales se tratan aparte.
    const link = (id: string) => `${appBase}/reservas?serviceId=${id}&form=1`;

    // 1. Resolver el servicio
    let candidatos = servicios;
    if (params.servicioId) {
        candidatos = servicios.filter((s) => s.id === params.servicioId);
    } else if (params.tipo) {
        const t = String(params.tipo).toUpperCase();
        candidatos = servicios.filter((s) => s.tipoServicio === t);
    } else if (params.q) {
        const q = norm(String(params.q));
        candidatos = servicios.filter((s) => {
            const es = norm(getLocalizedText(s.nombre, 'ES'));
            const en = norm(getLocalizedText(s.nombre, 'EN'));
            return es.includes(q) || en.includes(q) || q.includes(es);
        });
        // Para búsqueda libre, no consideres municipales individuales como match de precio
        if (candidatos.length > 1) {
            const noMunicipales = candidatos.filter((s) => !s.esMunicipal);
            if (noMunicipales.length >= 1) candidatos = noMunicipales;
        }
    } else {
        return {
            status: 'falta_servicio',
            mensaje: 'Indica el servicio (servicioId, tipo o q) para cotizar.',
        };
    }

    if (candidatos.length === 0) {
        return { status: 'no_encontrado', mensaje: 'No encontré un servicio que coincida. Pregunta al cliente a qué servicio se refiere.' };
    }
    if (candidatos.length > 1) {
        return {
            status: 'ambiguo',
            mensaje: 'Varios servicios coinciden. Pregunta al cliente cuál antes de cotizar.',
            opciones: candidatos.map((s) => ({
                servicioId: s.id,
                tipo: s.tipoServicio,
                nombre: getLocalizedText(s.nombre, 'ES'),
                nombreEN: getLocalizedText(s.nombre, 'EN'),
                esAeropuerto: s.esAeropuerto,
            })),
        };
    }

    const svc = candidatos[0];
    const nombre = getLocalizedText(svc.nombre, 'ES');

    // 2. Municipal → sin precio aquí
    if (svc.esMunicipal) {
        return {
            status: 'municipio',
            servicioId: svc.id,
            nombre,
            mensaje: 'El precio de los traslados municipales no se cotiza aquí: varía por destino y aparece en el formulario al elegir vehículo. Envía el link.',
            linkReserva: link(svc.id),
        };
    }

    // 3. Aeropuerto → exige saber cuál
    const aeropuerto = params.aeropuerto ? String(params.aeropuerto).toUpperCase() : null;
    const aeropuertoValido = aeropuerto === 'JOSE_MARIA_CORDOVA' || aeropuerto === 'OLAYA_HERRERA';
    if (svc.esAeropuerto && !aeropuertoValido) {
        return {
            status: 'falta_aeropuerto',
            servicioId: svc.id,
            nombre,
            mensaje: 'Es un traslado de aeropuerto y el precio depende del aeropuerto. Pregunta a cuál: José María Córdova (JMC) u Olaya Herrera.',
            opciones: ['JOSE_MARIA_CORDOVA', 'OLAYA_HERRERA'],
        };
    }

    // 4. Pax
    const paxNum = params.pax != null && params.pax !== '' ? Number(params.pax) : NaN;
    if (!Number.isFinite(paxNum) || paxNum <= 0) {
        return {
            status: 'falta_pax',
            servicioId: svc.id,
            nombre,
            mensaje: 'Falta el número de personas. Pregúntalo antes de cotizar (define el vehículo y el precio).',
        };
    }

    // 4b. Tour POR PERSONA: precio del tramo (1/2/3+) × nº de personas. No depende de vehículo.
    const cfgSvc = getConfiguracion((svc as any).configuracion);
    if (cfgSvc.tipoTarifa === 'POR_PERSONA') {
        const precioPP = totalPorPersona(cfgSvc.preciosPorPersona, paxNum);
        if (!Number.isFinite(precioPP) || precioPP <= 0) {
            return {
                status: 'fuera_de_rango',
                servicioId: svc.id,
                nombre,
                mensaje: 'Este servicio es por persona pero no tiene precios configurados. Ofrece conectar con un asesor.',
            };
        }
        return {
            status: 'ok',
            servicioId: svc.id,
            nombre,
            tipo: svc.tipoServicio,
            esAeropuerto: false,
            aeropuerto: null,
            pax: paxNum,
            vehiculo: null,
            precio: precioPP,
            precioFormateado: fmtCOP(precioPP),
            moneda: 'COP',
            nota: `Precio por persona × ${paxNum} ${paxNum === 1 ? 'persona' : 'personas'}.`,
            recargoNocturno: { aplica: false },
            linkReserva: link(svc.id),
        };
    }

    // 5. Vehículo que cubre el grupo
    const vehiculos = [...svc.vehiculosPermitidos].sort(
        (a, b) => a.vehiculo.capacidadMaxima - b.vehiculo.capacidadMaxima
    );
    const elegido = vehiculos.find(
        (v) => paxNum >= v.vehiculo.capacidadMinima && paxNum <= v.vehiculo.capacidadMaxima
    );
    if (!elegido) {
        const maxCap = vehiculos.length ? vehiculos[vehiculos.length - 1].vehiculo.capacidadMaxima : 0;
        return {
            status: 'fuera_de_rango',
            servicioId: svc.id,
            nombre,
            capacidadMaxima: maxCap,
            mensaje: `No hay un vehículo para ${paxNum} personas en este servicio (máximo ${maxCap}). Ofrece conectar con un asesor.`,
        };
    }

    // 6. Precio exacto (independiente). Olaya usa precioOlaya si existe (fallback a precio).
    const usarOlaya = svc.esAeropuerto && aeropuerto === 'OLAYA_HERRERA';
    const precioOlaya = (elegido as any).precioOlaya;
    const precioVehiculo = usarOlaya && precioOlaya != null && Number(precioOlaya) > 0
        ? Number(precioOlaya)
        : Number(elegido.precio ?? 0);

    // Compartido: el precio del cupo es POR PERSONA → multiplicar por nº de pasajeros.
    const precio = svc.esCompartido ? precioVehiculo * paxNum : precioVehiculo;

    if (!Number.isFinite(precio) || precio <= 0) {
        return {
            status: 'fuera_de_rango',
            servicioId: svc.id,
            nombre,
            mensaje: 'Ese vehículo no tiene precio configurado. Ofrece conectar con un asesor.',
        };
    }

    // 7. Recargo nocturno informativo (no se suma aquí; es referencia)
    let recargoNocturno: { aplica: boolean; monto?: number; mensaje?: string } = { aplica: false };
    if (svc.aplicaRecargoNocturno && svc.montoRecargoNocturno) {
        const monto = Number(svc.montoRecargoNocturno);
        const aplicaAhora = params.hora
            ? isNightSurchargeApplicable(String(params.hora), svc.recargoNocturnoInicio ?? null, svc.recargoNocturnoFin ?? null)
            : false;
        recargoNocturno = {
            aplica: aplicaAhora,
            monto,
            mensaje: `Recargo nocturno de ${fmtCOP(monto)} entre ${svc.recargoNocturnoInicio}–${svc.recargoNocturnoFin}${aplicaAhora ? ' (aplica a esta hora)' : ''}.`,
        };
    }

    return {
        status: 'ok',
        servicioId: svc.id,
        nombre,
        tipo: svc.tipoServicio,
        esAeropuerto: svc.esAeropuerto,
        aeropuerto: svc.esAeropuerto ? aeropuerto : null,
        pax: paxNum,
        vehiculo: {
            nombre: elegido.vehiculo.nombre,
            capacidadMinima: elegido.vehiculo.capacidadMinima,
            capacidadMaxima: elegido.vehiculo.capacidadMaxima,
        },
        precio,
        precioFormateado: fmtCOP(precio),
        moneda: 'COP',
        nota: svc.esCompartido
            ? `Precio por persona (cupo compartido) × ${paxNum} ${paxNum === 1 ? 'persona' : 'personas'}.`
            : 'Precio por el vehículo completo (servicio privado).',
        recargoNocturno,
        linkReserva: link(svc.id),
    };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const result = await handle({
            servicioId: searchParams.get('servicioId'),
            tipo: searchParams.get('tipo'),
            q: searchParams.get('q'),
            pax: searchParams.get('pax'),
            aeropuerto: searchParams.get('aeropuerto'),
            hora: searchParams.get('hora'),
        });
        return NextResponse.json(result, { headers: CORS });
    } catch (error) {
        console.error('[public/cotizar]', error);
        return NextResponse.json(
            { status: 'error', mensaje: 'No fue posible cotizar en este momento. Ofrece conectar con un asesor.' },
            { status: 200, headers: CORS }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const result = await handle({
            servicioId: body.servicioId,
            tipo: body.tipo,
            q: body.q,
            pax: body.pax,
            aeropuerto: body.aeropuerto,
            hora: body.hora,
        });
        return NextResponse.json(result, { headers: CORS });
    } catch (error) {
        console.error('[public/cotizar]', error);
        return NextResponse.json(
            { status: 'error', mensaje: 'No fue posible cotizar en este momento. Ofrece conectar con un asesor.' },
            { status: 200, headers: CORS }
        );
    }
}
