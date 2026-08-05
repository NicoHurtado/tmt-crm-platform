import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDatos } from '@/types/reserva-datos';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/estadisticas/socios?dias=7|14|21|30|90|0
 *
 * Estadísticas de las reservas que entran por la API de socios (`/api/socios/*`).
 * Va aparte de `/api/admin/estadisticas` a propósito: aquella agrupa por mes calendario
 * y mezcla aliados; aquí interesan ventanas móviles ("cómo va la última semana").
 *
 * Las cifras son **globales**: se suman todas las reservas que entraron por la API, sin
 * importar con qué llave. Una reserva hecha con la llave de pruebas cuenta igual que una
 * del socio en producción — para el negocio es un traslado real que hay que operar y
 * cobrar. Si hiciera falta distinguirlas, el campo `Reserva.origen` (`socio:<codigo>`)
 * sigue guardando con qué llave entró y se puede filtrar en la lista de reservas.
 *
 * La ventana se aplica sobre `createdAt` — cuándo nos entró la reserva — porque la
 * pregunta que responde es cuánto volumen está trayendo la integración, no cuántos
 * traslados se prestan ese día. `dias=0` devuelve el histórico completo.
 */

const ESTADOS_VIGENTES = [
    'CONFIRMED_UNASSIGNED',
    'CONFIRMED_ASSIGNED',
    'IN_PROGRESS',
    'COMPLETED',
];

const AEROPUERTO_LABEL: Record<string, string> = {
    JOSE_MARIA_CORDOVA: 'José María Córdova',
    OLAYA_HERRERA: 'Olaya Herrera',
};

const SENTIDO_LABEL: Record<string, string> = {
    DESDE: 'Llegada (del aeropuerto)',
    HACIA: 'Salida (al aeropuerto)',
};

/** Cuenta ocurrencias y devuelve la lista ordenada de mayor a menor. */
function contar(valores: string[]): Array<{ nombre: string; cantidad: number }> {
    const mapa: Record<string, number> = {};
    for (const v of valores) mapa[v] = (mapa[v] || 0) + 1;
    return Object.entries(mapa)
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const diasParam = Number(searchParams.get('dias') ?? 30);
        const dias = [0, 7, 14, 21, 30, 90].includes(diasParam) ? diasParam : 30;

        const desde = dias > 0 ? new Date(Date.now() - dias * 86_400_000) : null;

        const filas = await prisma.socioReserva.findMany({
            where: desde ? { createdAt: { gte: desde } } : {},
            select: {
                createdAt: true,
                reserva: {
                    select: {
                        codigo: true,
                        fecha: true,
                        hora: true,
                        estado: true,
                        numeroPasajeros: true,
                        precioTotal: true,
                        recargoNocturno: true,
                        aeropuertoNombre: true,
                        datos: true,
                        vehiculo: { select: { nombre: true } },
                    },
                },
            },
        });

        const vigentes = filas.filter((f) => ESTADOS_VIGENTES.includes(f.reserva.estado));
        const canceladas = filas.length - vigentes.length;

        const facturado = vigentes.reduce((s, f) => s + Number(f.reserva.precioTotal || 0), 0);
        const pasajeros = vigentes.reduce((s, f) => s + (f.reserva.numeroPasajeros || 0), 0);
        const nocturnas = vigentes.filter((f) => Number(f.reserva.recargoNocturno || 0) > 0).length;

        // Serie por día de creación: alimenta el gráfico de tendencia.
        const porDiaMapa: Record<string, number> = {};
        filas.forEach((f) => {
            const dia = f.createdAt.toISOString().slice(0, 10);
            porDiaMapa[dia] = (porDiaMapa[dia] || 0) + 1;
        });
        const porDia = Object.entries(porDiaMapa)
            .map(([dia, cantidad]) => ({ dia, cantidad }))
            .sort((a, b) => a.dia.localeCompare(b.dia));

        return NextResponse.json({
            dias,
            desde: desde?.toISOString() ?? null,
            reservas: filas.length,
            vigentes: vigentes.length,
            canceladas,
            facturado,
            pasajeros,
            ticketPromedio: vigentes.length > 0 ? Math.round(facturado / vigentes.length) : 0,
            nocturnas,
            porDia,
            porVehiculo: contar(vigentes.map((f) => f.reserva.vehiculo?.nombre || 'Sin vehículo')),
            porAeropuerto: contar(
                vigentes.map(
                    (f) => AEROPUERTO_LABEL[f.reserva.aeropuertoNombre ?? ''] ?? 'Sin aeropuerto'
                )
            ),
            porSentido: contar(
                vigentes.map((f) => {
                    const tipo = getDatos(f.reserva.datos).aeropuertoTipo;
                    return SENTIDO_LABEL[tipo ?? ''] ?? 'Sin sentido';
                })
            ),
            ultimas: [...filas]
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .slice(0, 10)
                .map((f) => ({
                    codigo: f.reserva.codigo,
                    creada: f.createdAt.toISOString(),
                    fecha: f.reserva.fecha.toISOString().slice(0, 10),
                    hora: f.reserva.hora,
                    estado: f.reserva.estado,
                    pasajeros: f.reserva.numeroPasajeros,
                    vehiculo: f.reserva.vehiculo?.nombre ?? null,
                    total: Number(f.reserva.precioTotal || 0),
                })),
        });
    } catch (error) {
        console.error('[estadisticas/socios] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
