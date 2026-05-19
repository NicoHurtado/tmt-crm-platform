import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/servicios/[id]/toggle
 * Toggle service active status
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // Get current status
        const servicio = await prisma.servicio.findUnique({
            where: { id: params.id },
            select: { activo: true },
        });

        if (!servicio) {
            return NextResponse.json(
                { error: 'Servicio no encontrado' },
                { status: 404 }
            );
        }

        // Toggle status
        const updated = await prisma.servicio.update({
            where: { id: params.id },
            data: { activo: !servicio.activo },
            select: {
                id: true,
                nombre: true,
                activo: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: updated,
            message: `Servicio ${updated.activo ? 'activado' : 'desactivado'} exitosamente`,
        });
    } catch (error) {
        console.error('Error toggling service:', error);
        return NextResponse.json(
            { error: 'Error al cambiar estado del servicio' },
            { status: 500 }
        );
    }
}
