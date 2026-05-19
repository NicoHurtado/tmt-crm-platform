import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();

        // Handle featuring/unfeaturing
        if (body.destacada !== undefined) {
            if (body.destacada === true) {
                // Check how many are currently featured
                const featuredCount = await prisma.calificacion.count({
                    where: { destacada: true },
                });

                if (featuredCount >= 3) {
                    // Find the oldest featured review and unfeature it
                    const oldestFeatured = await prisma.calificacion.findFirst({
                        where: { destacada: true },
                        orderBy: { updatedAt: 'asc' },
                    });

                    if (oldestFeatured) {
                        await prisma.calificacion.update({
                            where: { id: oldestFeatured.id },
                            data: {
                                destacada: false,
                                ordenDestacada: null,
                            },
                        });
                    }
                }

                // Get the next available order number
                const featuredReviews = await prisma.calificacion.findMany({
                    where: { destacada: true },
                    orderBy: { ordenDestacada: 'asc' },
                });

                const usedOrders = featuredReviews.map(r => r.ordenDestacada).filter(o => o !== null);
                let nextOrder = 1;
                for (let i = 1; i <= 3; i++) {
                    if (!usedOrders.includes(i)) {
                        nextOrder = i;
                        break;
                    }
                }

                const calificacion = await prisma.calificacion.update({
                    where: { id },
                    data: {
                        destacada: true,
                        ordenDestacada: nextOrder,
                    },
                });

                return NextResponse.json({ data: calificacion });
            } else {
                // Unfeaturing
                const calificacion = await prisma.calificacion.update({
                    where: { id },
                    data: {
                        destacada: false,
                        ordenDestacada: null,
                    },
                });

                return NextResponse.json({ data: calificacion });
            }
        }

        // Handle other updates (esPublica, etc.)
        const calificacion = await prisma.calificacion.update({
            where: { id },
            data: {
                esPublica: body.esPublica,
            },
        });

        return NextResponse.json({ data: calificacion });
    } catch (error) {
        console.error('Error updating calificacion:', error);
        return NextResponse.json(
            { error: 'Error al actualizar calificación' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { id } = await params;

        await prisma.calificacion.delete({
            where: { id },
        });

        return NextResponse.json({ message: 'Calificación eliminada' });
    } catch (error) {
        console.error('Error deleting calificacion:', error);
        return NextResponse.json(
            { error: 'Error al eliminar calificación' },
            { status: 500 }
        );
    }
}
