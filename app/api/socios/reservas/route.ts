import { NextRequest, NextResponse } from 'next/server';
import { resolveSocio, socioUnauthorized } from '../_auth';
import {
    crearReservaSocio,
    ejecutarEfectosReserva,
    formatReservaSocio,
} from '@/lib/socios/crear-reserva';

export const dynamic = 'force-dynamic';

/**
 * POST /api/socios/reservas
 *
 * Crea una reserva a partir de los datos que el socio capturó en su plataforma.
 * El precio se recalcula siempre en el servidor; nunca se acepta uno enviado por el socio.
 *
 * Idempotente por `refExterna`: reintentar con la misma referencia devuelve la reserva
 * original con status 200 en vez de duplicarla.
 *
 * Header: x-api-key
 */
export async function POST(request: NextRequest) {
    const socio = await resolveSocio(request);
    if (!socio) return socioUnauthorized();

    try {
        const body = await request.json().catch(() => ({}));
        const { reserva, duplicado } = await crearReservaSocio(socio, body);

        if (!duplicado) {
            await ejecutarEfectosReserva(reserva);
        }

        return NextResponse.json(
            { ok: true, duplicado, ...formatReservaSocio(reserva) },
            { status: duplicado ? 200 : 201 }
        );
    } catch (error) {
        console.error('[socios/reservas]', error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : String(error) },
            { status: 400 }
        );
    }
}
