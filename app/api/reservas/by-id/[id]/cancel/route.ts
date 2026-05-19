import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EstadoReserva } from '@prisma/client';
import { canTransitionTo } from '@/lib/state-transitions';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

// POST /api/reservas/by-id/[id]/cancel - Cancel reservation (ally only)
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // Fetch reservation before parsing body to fail fast on not-found / auth
        const reserva = await prisma.reserva.findUnique({
            where: { id: params.id },
            include: {
                servicio: true,
                vehiculo: true,
                conductor: true,
                aliado: true,
            },
        });

        if (!reserva) {
            return NextResponse.json(
                { error: 'Reserva no encontrada' },
                { status: 404 }
            );
        }

        // Parse body AFTER confirming the reservation exists
        const { aliadoId } = await request.json();

        if (!aliadoId) {
            return NextResponse.json(
                { error: 'ID de aliado requerido' },
                { status: 400 }
            );
        }

        // Verify that the reservation belongs to this ally
        if (reserva.aliadoId !== aliadoId) {
            return NextResponse.json(
                { error: 'No tienes permiso para cancelar esta reserva' },
                { status: 403 }
            );
        }

        // Check if reservation is already cancelled or completed
        if (reserva.estado === EstadoReserva.CANCELLED) {
            return NextResponse.json(
                { error: 'Esta reserva ya está cancelada' },
                { status: 400 }
            );
        }

        if (reserva.estado === EstadoReserva.COMPLETED) {
            return NextResponse.json(
                { error: 'No se puede cancelar una reserva completada' },
                { status: 400 }
            );
        }

        // Check if current state allows cancellation
        if (!canTransitionTo(reserva.estado, EstadoReserva.CANCELLED)) {
            return NextResponse.json(
                { error: 'No se puede cancelar esta reserva en su estado actual' },
                { status: 400 }
            );
        }

        // Check if reservation is within 24 hours
        const reservationDateTime = new Date(reserva.fecha);
        const [hours, minutes] = reserva.hora.split(':');
        reservationDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        const now = new Date();
        const hoursUntilReservation = (reservationDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilReservation < 24 && hoursUntilReservation > 0) {
            return NextResponse.json(
                { 
                    error: 'No se puede cancelar una reserva dentro de las 24 horas previas al servicio',
                    hoursUntilReservation: Math.round(hoursUntilReservation * 10) / 10
                },
                { status: 400 }
            );
        }

        // Cancel the reservation
        const reservaActualizada = await prisma.reserva.update({
            where: { id: params.id },
            data: {
                estado: EstadoReserva.CANCELLED,
            },
            include: {
                servicio: true,
                vehiculo: true,
                conductor: true,
                aliado: true,
                asistentes: true,
            },
        });

        // Send cancellation notification email
        try {
            const emailService = await import('@/lib/email-service');
            const idioma = reservaActualizada.idioma || 'ES';
            
            // Send email to client notifying cancellation
            await emailService.sendCancelacionEmail(reservaActualizada as any, idioma);
        } catch (emailError) {
            console.error('Error sending cancellation email:', emailError);
            // Don't fail the cancellation if email fails
        }

        // Cancel Google Calendar event if exists
        try {
            if (reservaActualizada.googleCalendarEventId) {
                const { deleteCalendarEvent } = await import('@/lib/google-calendar-service');
                await deleteCalendarEvent(reservaActualizada.googleCalendarEventId);
            }
        } catch (calendarError) {
            console.error('Error canceling calendar event:', calendarError);
            // Don't fail the cancellation if calendar sync fails
        }

        return NextResponse.json({
            data: reservaActualizada,
            message: 'Reserva cancelada exitosamente'
        });
    } catch (error) {
        console.error('Error canceling reservation:', error);
        return NextResponse.json(
            { error: 'Error al cancelar la reserva' },
            { status: 500 }
        );
    }
}











