import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/aliados/[id]
 * Obtener un aliado
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const aliado = await prisma.aliado.findUnique({
            where: { id },
            include: {
                tarifas: {
                    include: {
                        servicio: true,
                    },
                },
                _count: {
                    select: { reservas: true },
                },
            },
        });

        if (!aliado) {
            return NextResponse.json(
                { error: 'Aliado no encontrado' },
                { status: 404 }
            );
        }

        // WR-05: strip linkToken before returning — it's a private auth secret
        const { linkToken, ...publicAliado } = aliado as any;
        return NextResponse.json({ data: publicAliado });
    } catch (error) {
        console.error('Error fetching aliado:', error);
        return NextResponse.json(
            { error: 'Error al obtener aliado' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/aliados/[id]
 * Actualizar aliado (ADMIN)
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

        // WR-16: explicit allowlist — never pass raw body to Prisma
        const updateData: Record<string, unknown> = {};
        if (body.nombre !== undefined) updateData.nombre = body.nombre;
        if (body.email !== undefined) updateData.email = body.email;
        if (body.whatsapp !== undefined) updateData.whatsapp = body.whatsapp;
        if (body.tipo !== undefined) updateData.tipo = body.tipo;
        if (body.activo !== undefined) updateData.activo = body.activo;
        if (body.comision !== undefined) updateData.comision = parseFloat(body.comision);
        if (body.ciudad !== undefined) updateData.ciudad = body.ciudad;
        if (body.direccion !== undefined) updateData.direccion = body.direccion;
        if (body.contacto !== undefined) updateData.contacto = body.contacto;
        if (body.notas !== undefined) updateData.notas = body.notas;

        const aliado = await prisma.aliado.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            data: aliado,
            message: 'Aliado actualizado exitosamente',
        });
    } catch (error) {
        console.error('Error updating aliado:', error);
        return NextResponse.json(
            { error: 'Error al actualizar aliado' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/aliados/[id]
 * Eliminar aliado (ADMIN) - Hard delete
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

        // No permitir borrado físico si tiene historial operativo asociado
        const [reservasCount, pedidosCount] = await Promise.all([
            prisma.reserva.count({ where: { aliadoId: id } }),
            prisma.pedido.count({ where: { aliadoId: id } }),
        ]);

        if (reservasCount > 0 || pedidosCount > 0) {
            return NextResponse.json(
                { error: 'No se puede borrar este aliado porque tiene reservas o pedidos asociados. Puedes desactivarlo en su lugar.' },
                { status: 400 }
            );
        }

        // Limpiar configuraciones relacionadas y borrar aliado
        await prisma.$transaction([
            prisma.tarifaAliado.deleteMany({ where: { aliadoId: id } }),
            prisma.tarifaMunicipioAliado.deleteMany({ where: { aliadoId: id } }),
            prisma.servicioAliado.deleteMany({ where: { aliadoId: id } }),
            prisma.aliado.delete({ where: { id } }),
        ]);

        return NextResponse.json({
            message: 'Aliado borrado exitosamente',
        });
    } catch (error) {
        console.error('Error deleting aliado:', error);
        return NextResponse.json(
            { error: 'Error al eliminar aliado' },
            { status: 500 }
        );
    }
}
