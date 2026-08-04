import { NextRequest, NextResponse } from 'next/server';
import { resolveSocio, socioUnauthorized } from '../_auth';
import {
    cargarServicioCotizable,
    cotizarServicio,
    parseAeropuerto,
    parseDatosDinamicos,
    parseEnteroPositivo,
    parseHora,
} from '@/lib/socios/cotizar';
import { SocioRequestError } from '@/lib/socios/errors';

export const dynamic = 'force-dynamic';

/**
 * POST /api/socios/cotizar
 *
 * Devuelve el precio de un servicio para el número de pasajeros y la hora indicados.
 * Es el mismo precio que vería un cliente en la web: incluye recargo nocturno y el
 * precio alterno de Olaya Herrera cuando aplica.
 *
 * Header: x-api-key
 */
export async function POST(request: NextRequest) {
    const socio = await resolveSocio(request);
    if (!socio) return socioUnauthorized();

    try {
        const body = await request.json().catch(() => ({}));

        const servicio = await cargarServicioCotizable(body.servicioId);
        const cotizacion = cotizarServicio(servicio, {
            servicioId: servicio.id,
            numeroPasajeros: parseEnteroPositivo(body.numeroPasajeros, 'numeroPasajeros'),
            hora: parseHora(body.hora),
            aeropuertoNombre: parseAeropuerto(body.aeropuertoNombre),
            datosDinamicos: parseDatosDinamicos(body.datosDinamicos),
        });

        return NextResponse.json({ ok: true, ...cotizacion });
    } catch (error) {
        if (error instanceof SocioRequestError) {
            return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        }
        console.error('[socios/cotizar] Error inesperado:', error);
        return NextResponse.json(
            { ok: false, error: 'Error interno al cotizar. Reintenta en unos segundos.' },
            { status: 500 }
        );
    }
}
