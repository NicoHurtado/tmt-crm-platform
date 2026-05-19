import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/municipios
 * Public: list all ACTIVE MunicipioConfig for the client booking form
 */
export async function GET(req: NextRequest) {
    try {
        const municipios = await prisma.municipioConfig.findMany({
            where: { activo: true },
            orderBy: { orden: 'asc' },
            select: { id: true, nombreES: true, nombreEN: true, recargo: true },
        });

        return NextResponse.json({ success: true, data: municipios });
    } catch (error) {
        console.error('Error fetching public municipios:', error);
        return NextResponse.json(
            { error: 'Error al obtener municipios' },
            { status: 500 }
        );
    }
}
