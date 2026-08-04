import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDatos } from '@/types/reserva-datos';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/estadisticas/socios?dias=7|14|21|30|0
 *
 * Estadísticas de las reservas que entran por la API de socios (`/api/socios/*`).
 * Va aparte de `/api/admin/estadisticas` a propósito: aquella agrupa por mes calendario
 * y mezcla aliados; aquí interesan ventanas móviles ("cómo va la última semana") y el
 * corte es por socio.
 *
 * La ventana se aplica sobre `createdAt` — cuándo nos entró la reserva — porque la
 * pregunta que responde es cómo va la alianza, no cuántos traslados se prestan ese día.
 * `dias=0` devuelve el histórico completo.
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
function contar<T extends string>(valores: T[]): Array<{ nombre: string; cantidad: number }> {
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

        const socios = await prisma.socio.findMany({
            orderBy: { nombre: 'asc' },
            select: { id: true, codigo: true, nombre: true, activo: true, createdAt: true },
        });

        const filas = await prisma.socioReserva.findMany({
            where: desde ? { createdAt: { gte: desde } } : {},
            select: {
                socioId: true,
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

        const porSocio = socios.map((socio) => {
            const propias = filas.filter((f) => f.socioId === socio.id);
            const vigentes = propias.filter((f) => ESTADOS_VIGENTES.includes(f.reserva.estado));
            const canceladas = propias.length - vigentes.length;

            const facturado = vigentes.reduce((s, f) => s + Number(f.reserva.precioTotal || 0), 0);
            const pasajeros = vigentes.reduce((s, f) => s + (f.reserva.numeroPasajeros || 0), 0);
            const nocturnas = vigentes.filter((f) => Number(f.reserva.recargoNocturno || 0) > 0).length;

            // Serie por día de creación: alimenta el sparkline de tendencia.
            const porDiaMapa: Record<string, number> = {};
            propias.forEach((f) => {
                const dia = f.createdAt.toISOString().slice(0, 10);
                porDiaMapa[dia] = (porDiaMapa[dia] || 0) + 1;
            });
            const porDia = Object.entries(porDiaMapa)
                .map(([dia, cantidad]) => ({ dia, cantidad }))
                .sort((a, b) => a.dia.localeCompare(b.dia));

            return {
                id: socio.id,
                codigo: socio.codigo,
                nombre: socio.nombre,
                activo: socio.activo,
                reservas: propias.length,
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
                ultimas: [...propias]
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .slice(0, 8)
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
            };
        });

        return NextResponse.json({
            dias,
            desde: desde?.toISOString() ?? null,
            // Solo se listan socios con actividad en la ventana, más los activos sin
            // reservas (para que se vea que existen y están en cero, no que no existen).
            socios: porSocio.filter((s) => s.reservas > 0 || s.activo),
        });
    } catch (error) {
        console.error('[estadisticas/socios] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
