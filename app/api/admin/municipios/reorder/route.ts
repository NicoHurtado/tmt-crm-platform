import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/municipios/reorder
 * Body: { orderedIds: string[] }  — array of MunicipioConfig IDs in the new order
 */
export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { orderedIds } = await req.json();

        if (!Array.isArray(orderedIds)) {
            return NextResponse.json({ error: 'orderedIds debe ser un array' }, { status: 400 });
        }

        await prisma.$transaction(
            orderedIds.map((id: string, index: number) =>
                prisma.municipioConfig.update({
                    where: { id },
                    data: { orden: index },
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error reordering municipios:', error);
        return NextResponse.json({ error: 'Error al reordenar municipios' }, { status: 500 });
    }
}
