import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

// DELETE /api/reservas/by-id/[id]/delete - Hard delete reservation (admin only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const reserva = await prisma.reserva.findUnique({
            where: { id: params.id },
            include: {
                servicio: true,
                conductor: true,
                vehiculo: true,
                aliado: true,
                asistentes: true,
            },
        });

        if (!reserva) {
            return NextResponse.json(
                { error: 'Reserva no encontrada' },
                { status: 404 }
            );
        }

        const deletedReservation = await prisma.reserva.delete({
            where: { id: params.id },
        });

        try {
            if (reserva.servicio?.esCompartido) {
                const reservaDate = new Date(reserva.fecha);
                const startOfDay = new Date(reservaDate.getFullYear(), reservaDate.getMonth(), reservaDate.getDate());
                const endOfDay = new Date(reservaDate.getFullYear(), reservaDate.getMonth(), reservaDate.getDate() + 1);

                const reservasRestantes = await prisma.reserva.findMany({
                    where: {
                        servicioId: reserva.servicioId,
                        fecha: {
                            gte: startOfDay,
                            lt: endOfDay,
                        },
                        servicio: { esCompartido: true },
                        estado: {
                            not: 'CANCELLED',
                        },
                    },
                    include: {
                        servicio: true,
                        conductor: true,
                        vehiculo: true,
                        aliado: true,
                        asistentes: true,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                });

                if (reservasRestantes.length > 0) {
                    const { createOrUpdateTourCompartidoEvent } = await import('@/lib/google-calendar-service');
                    await createOrUpdateTourCompartidoEvent(reservasRestantes[0] as any);
                } else if (reserva.googleCalendarEventId) {
                    const { deleteCalendarEvent } = await import('@/lib/google-calendar-service');
                    await deleteCalendarEvent(reserva.googleCalendarEventId);
                }
            } else if (reserva.googleCalendarEventId) {
                const { deleteCalendarEvent } = await import('@/lib/google-calendar-service');
                await deleteCalendarEvent(reserva.googleCalendarEventId);
            }
        } catch (calendarError) {
            console.error('Error sincronizando Google Calendar tras eliminar reserva:', calendarError);
            // No revertimos el borrado de la reserva si falla Calendar.
        }

        return NextResponse.json({
            data: deletedReservation,
            message: 'Reserva eliminada exitosamente',
        });
    } catch (error) {
        console.error('Error deleting reservation by id:', error);
        return NextResponse.json(
            { error: 'Error al eliminar la reserva' },
            { status: 500 }
        );
    }
}
