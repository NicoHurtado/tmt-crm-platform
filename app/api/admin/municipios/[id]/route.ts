import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/municipios/[id]
 * Update a MunicipioConfig
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { nombreES, nombreEN, recargo, activo } = body;
        const { id } = params;

        const municipio = await prisma.municipioConfig.update({
            where: { id },
            data: {
                ...(nombreES !== undefined && { nombreES: String(nombreES).trim() }),
                ...(nombreEN !== undefined && { nombreEN: String(nombreEN).trim() }),
                ...(recargo !== undefined && { recargo: parseFloat(String(recargo)) }),
                ...(activo !== undefined && { activo: Boolean(activo) }),
            },
        });

        return NextResponse.json({ success: true, data: municipio });
    } catch (error) {
        console.error('Error updating municipio:', error);
        return NextResponse.json(
            { error: 'Error al actualizar municipio' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/admin/municipios/[id]
 * Delete a MunicipioConfig
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { id } = params;

        await prisma.municipioConfig.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting municipio:', error);
        return NextResponse.json(
            { error: 'Error al eliminar municipio' },
            { status: 500 }
        );
    }
}
