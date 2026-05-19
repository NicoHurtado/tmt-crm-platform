import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EstadoReserva } from '@prisma/client';
import { calculateBoldCommission } from '@/lib/bold';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { codigoReserva, metodoPago } = body;

        // Validate input
        if (!codigoReserva || !metodoPago) {
            return NextResponse.json(
                { success: false, error: 'Código de reserva y método de pago son requeridos' },
                { status: 400 }
            );
        }

        if (metodoPago !== 'EFECTIVO' && metodoPago !== 'TARJETA') {
            return NextResponse.json(
                { success: false, error: 'Método de pago inválido' },
                { status: 400 }
            );
        }

        // Find the reservation
        const reserva = await prisma.reserva.findUnique({
            where: { codigo: codigoReserva },
            include: {
                servicio: true,
                aliado: true,
            },
        });

        if (!reserva) {
            return NextResponse.json(
                { success: false, error: 'Reserva no encontrada' },
                { status: 404 }
            );
        }

        // Verify it's a Tour Compartido service
        if (!reserva.servicio?.esCompartido) {
            return NextResponse.json(
                { success: false, error: 'Esta función solo está disponible para Tour Compartido' },
                { status: 400 }
            );
        }

        // Verify it's a hotel/agency ally reservation
        if (!reserva.esReservaAliado || (reserva.aliado?.tipo !== 'HOTEL' && reserva.aliado?.tipo !== 'AGENCIA')) {
            return NextResponse.json(
                { success: false, error: 'Esta función solo está disponible para aliados hoteleros' },
                { status: 400 }
            );
        }

        // Verify current status is PENDING_PAYMENT
        if (reserva.estado !== EstadoReserva.PENDING_PAYMENT) {
            return NextResponse.json(
                { success: false, error: 'La reserva no está en estado pendiente de pago' },
                { status: 400 }
            );
        }

        // Determine new status based on payment method
        let newStatus: EstadoReserva = reserva.estado;
        if (metodoPago === 'EFECTIVO') {
            newStatus = EstadoReserva.CONFIRMED_UNASSIGNED;
        }
        // If TARJETA, status remains PENDING_PAYMENT

        // 🔥 RECALCULATE PRICE when switching to EFECTIVO
        // Remove Bold commission (6%) from the total
        let newPrecioTotal = Number(reserva.precioTotal);
        let newComisionBold = Number(reserva.comisionBold || 0);

        if (metodoPago === 'EFECTIVO') {
            // WR-03: reconstruct subtotal from base fields to avoid negative/wrong result when
            // comisionBold is 0 or null (e.g. reservation was originally created as EFECTIVO).
            const baseSubtotal =
                Number(reserva.precioBase || 0) +
                Number(reserva.precioAdicionales || 0) +
                Number(reserva.recargoNocturno || 0) +
                Number(reserva.tarifaMunicipio || 0) +
                Number(reserva.comisionAliado || 0) -
                Number(reserva.descuentoAliado || 0);
            // Fallback: if base fields sum to 0, subtract commission from total (legacy path)
            const subtotal = baseSubtotal > 0
                ? baseSubtotal
                : Number(reserva.comisionBold) > 0
                    ? Number(reserva.precioTotal) - Number(reserva.comisionBold)
                    : Number(reserva.precioTotal);
            newPrecioTotal = subtotal;
            newComisionBold = 0;
        } else if (metodoPago === 'TARJETA') {
            // If switching back to TARJETA, recalculate commission
            // (in case they selected EFECTIVO first, then changed to TARJETA)
            const subtotal =
                Number(reserva.precioBase) +
                Number(reserva.precioAdicionales || 0) +
                Number(reserva.recargoNocturno || 0) +
                Number(reserva.tarifaMunicipio || 0) +
                Number(reserva.comisionAliado || 0) -
                Number(reserva.descuentoAliado || 0);
            newComisionBold = calculateBoldCommission(subtotal);
            newPrecioTotal = subtotal + newComisionBold;
        }

        // Update the reservation
        const updatedReserva = await prisma.reserva.update({
            where: { codigo: codigoReserva },
            data: {
                metodoPago,
                estado: newStatus,
                precioTotal: newPrecioTotal,
                comisionBold: newComisionBold,
            },
            include: {
                servicio: true,
                aliado: true,
                vehiculo: true,
                conductor: true,
                asistentes: true,
            },
        });

        // Sincronizar calendario para que refleje método de pago/estado actualizado
        try {
            const { createOrUpdateTourCompartidoEvent } = await import('@/lib/google-calendar-service');
            const eventId = await createOrUpdateTourCompartidoEvent(updatedReserva as any);

            if (eventId && updatedReserva.googleCalendarEventId !== eventId) {
                await prisma.reserva.update({
                    where: { id: updatedReserva.id },
                    data: { googleCalendarEventId: eventId },
                });
            }
        } catch (calendarError) {
            console.error('Error sincronizando Tour Compartido con Google Calendar:', calendarError);
        }

        return NextResponse.json({
            success: true,
            reserva: updatedReserva,
        });
    } catch (error) {
        console.error('Error al seleccionar método de pago:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
