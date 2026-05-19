import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

// GET /api/calificaciones/destacadas - Public endpoint for landing page
export async function GET() {
    try {
        const calificaciones = await prisma.calificacion.findMany({
            where: {
                destacada: true,
            },
            include: {
                servicio: true,
            },
            orderBy: {
                ordenDestacada: 'asc',
            },
            take: 3,
        });

        return NextResponse.json({ data: calificaciones });
    } catch (error) {
        console.error('Error fetching featured calificaciones:', error);
        return NextResponse.json(
            { error: 'Error al obtener calificaciones destacadas' },
            { status: 500 }
        );
    }
}
