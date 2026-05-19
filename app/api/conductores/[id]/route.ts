import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/conductores/[id]
 * Obtener un conductor
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const conductor = await prisma.conductor.findUnique({
            where: { id },
            include: {
                reservas: {
                    take: 10,
                    orderBy: { fecha: 'desc' },
                    include: { servicio: true },
                },
            },
        });

        if (!conductor) {
            return NextResponse.json(
                { error: 'Conductor no encontrado' },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: conductor });
    } catch (error) {
        console.error('Error fetching conductor:', error);
        return NextResponse.json(
            { error: 'Error al obtener conductor' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/conductores/[id]
 * Actualizar conductor (ADMIN)
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const body = await req.json();

        // Si actualiza fechas, convertirlas
        if (body.vencimientoLicencia) {
            body.vencimientoLicencia = new Date(body.vencimientoLicencia);
        }

        const conductor = await prisma.conductor.update({
            where: { id },
            data: body,
        });

        return NextResponse.json({
            data: conductor,
            message: 'Conductor actualizado exitosamente',
        });
    } catch (error) {
        console.error('Error updating conductor:', error);
        return NextResponse.json(
            { error: 'Error al actualizar conductor' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/conductores/[id]
 * Eliminar conductor (ADMIN) - Soft delete
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { id } = await params;

        // Verificar si tiene reservas activas
        const reservasActivas = await prisma.reserva.count({
            where: {
                conductorId: id,
                estado: {
                    notIn: ['COMPLETED', 'CANCELLED'],
                },
            },
        });

        if (reservasActivas > 0) {
            return NextResponse.json(
                { error: 'No se puede eliminar un conductor con reservas activas' },
                { status: 400 }
            );
        }

        // Soft delete
        const conductor = await prisma.conductor.update({
            where: { id },
            data: { activo: false },
        });

        return NextResponse.json({
            data: conductor,
            message: 'Conductor eliminado exitosamente',
        });
    } catch (error) {
        console.error('Error deleting conductor:', error);
        return NextResponse.json(
            { error: 'Error al eliminar conductor' },
            { status: 500 }
        );
    }
}
