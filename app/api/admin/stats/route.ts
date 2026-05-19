import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { EstadoReserva } from '@prisma/client';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // Count reservations by state using a single groupBy query
        const [estadoCounts, total] = await Promise.all([
            prisma.reserva.groupBy({
                by: ['estado'],
                _count: { estado: true },
            }),
            prisma.reserva.count(),
        ]);

        const countsByEstado = Object.fromEntries(
            estadoCounts.map(({ estado, _count }) => [estado, _count.estado])
        );

        // Build stats array in the same shape as before, filling zeros for missing states
        const stats = Object.values(EstadoReserva).map((estado) => ({
            estado,
            count: countsByEstado[estado] ?? 0,
        }));

        return NextResponse.json({
            stats,
            total,
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json(
            { error: 'Error al obtener estadísticas' },
            { status: 500 }
        );
    }
}
