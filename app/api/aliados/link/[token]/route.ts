import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/aliados/link/[token]
 * Lookup an active aliado by their unique linkToken
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        const aliado = await prisma.aliado.findFirst({
            where: { linkToken: token, activo: true },
            include: {
                serviciosAliado: {
                    where: { activo: true },
                    include: { servicio: true },
                },
            },
        });

        if (!aliado) {
            return NextResponse.json(
                { error: 'Aliado no encontrado' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            id: aliado.id,
            nombre: aliado.nombre,
            tipo: aliado.tipo,
            email: aliado.email,
            codigo: aliado.codigo,
            serviciosHabilitados: aliado.serviciosAliado,
        });
    } catch (error) {
        console.error('Error fetching aliado by token:', error);
        return NextResponse.json(
            { error: 'Error al obtener aliado' },
            { status: 500 }
        );
    }
}
