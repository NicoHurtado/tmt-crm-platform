import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/vehiculos/[id]
 * Obtener un vehículo
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const vehiculo = await prisma.vehiculo.findUnique({
            where: { id },
        });

        if (!vehiculo) {
            return NextResponse.json(
                { error: 'Vehículo no encontrado' },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: vehiculo });
    } catch (error) {
        console.error('Error fetching vehiculo:', error);
        return NextResponse.json(
            { error: 'Error al obtener vehículo' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/vehiculos/[id]
 * Actualizar vehículo (ADMIN)
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

        const updateData: Record<string, unknown> = {};
        if (body.nombre !== undefined) updateData.nombre = body.nombre;
        if (body.capacidadMinima !== undefined) updateData.capacidadMinima = body.capacidadMinima;
        if (body.capacidadMaxima !== undefined) updateData.capacidadMaxima = body.capacidadMaxima;
        if (body.imagen !== undefined) updateData.imagen = body.imagen;
        if (body.activo !== undefined) updateData.activo = body.activo;
        if (body.precioBase !== undefined) updateData.precioBase = body.precioBase;

        const vehiculo = await prisma.vehiculo.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            data: vehiculo,
            message: 'Vehículo actualizado exitosamente',
        });
    } catch (error) {
        console.error('Error updating vehiculo:', error);
        return NextResponse.json(
            { error: 'Error al actualizar vehículo' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/vehiculos/[id]
 * Eliminar vehículo (ADMIN) - Soft delete
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

        // Soft delete
        const vehiculo = await prisma.vehiculo.update({
            where: { id },
            data: { activo: false },
        });

        return NextResponse.json({
            data: vehiculo,
            message: 'Vehículo eliminado exitosamente',
        });
    } catch (error) {
        console.error('Error deleting vehiculo:', error);
        return NextResponse.json(
            { error: 'Error al eliminar vehículo' },
            { status: 500 }
        );
    }
}
