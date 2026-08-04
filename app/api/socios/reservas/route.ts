import { NextRequest, NextResponse } from 'next/server';
import { resolveSocio, socioUnauthorized } from '../_auth';
import {
    crearReservaSocio,
    ejecutarEfectosReserva,
    formatReservaSocio,
} from '@/lib/socios/crear-reserva';
import { SocioRequestError } from '@/lib/socios/errors';

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
        // Petición inválida: el socio debe corregirla, reintentar no sirve.
        if (error instanceof SocioRequestError) {
            return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        }
        // Falla nuestra (base de datos, bug). Se responde 500 para que el socio SÍ
        // reintente con la misma refExterna: la idempotencia hace que sea seguro, y así
        // no pierde una reserva que ya le cobró al huésped. El detalle no se expone.
        console.error('[socios/reservas] Error inesperado:', error);
        return NextResponse.json(
            {
                ok: false,
                error: 'Error interno al crear la reserva. Reintenta con la misma refExterna.',
            },
            { status: 500 }
        );
    }
}
