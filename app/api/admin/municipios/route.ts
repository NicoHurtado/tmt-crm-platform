import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/municipios
 * List all MunicipioConfig records sorted by orden
 */
export async function GET(req: NextRequest) {
    try {
        const municipios = await prisma.municipioConfig.findMany({
            orderBy: { orden: 'asc' },
        });

        return NextResponse.json({ success: true, data: municipios });
    } catch (error) {
        console.error('Error fetching municipios:', error);
        return NextResponse.json(
            { error: 'Error al obtener municipios' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/municipios
 * Create new MunicipioConfig
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { nombreES, nombreEN, recargo, activo } = body;

        if (!nombreES || !nombreEN || recargo === undefined || recargo === null) {
            return NextResponse.json(
                { error: 'Campos requeridos: nombreES, nombreEN, recargo' },
                { status: 400 }
            );
        }

        // Set orden to max + 1 so new items go to the bottom
        const maxOrden = await prisma.municipioConfig.aggregate({ _max: { orden: true } });
        const nextOrden = (maxOrden._max.orden ?? -1) + 1;

        const municipio = await prisma.municipioConfig.create({
            data: {
                nombreES: String(nombreES).trim(),
                nombreEN: String(nombreEN).trim(),
                recargo: parseFloat(String(recargo)),
                activo: activo !== undefined ? Boolean(activo) : true,
                orden: nextOrden,
            },
        });

        return NextResponse.json({ success: true, data: municipio }, { status: 201 });
    } catch (error) {
        console.error('Error creating municipio:', error);
        return NextResponse.json(
            { error: 'Error al crear municipio' },
            { status: 500 }
        );
    }
}
