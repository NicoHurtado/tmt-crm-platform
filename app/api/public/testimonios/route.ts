import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const testimonios = await prisma.calificacion.findMany({
            where: {
                esPublica: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 10,
            include: {
                servicio: {
                    select: {
                        nombre: true,
                    },
                },
            },
        });

        return NextResponse.json({ data: testimonios });
    } catch (error) {
        console.error('Error fetching testimonios:', error);
        return NextResponse.json(
            { error: 'Error al obtener testimonios' },
            { status: 500 }
        );
    }
}
