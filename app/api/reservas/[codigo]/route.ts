import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateBoldHash } from '@/lib/bold';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendCambioEstadoEmail, sendPagoAprobadoEmail, sendConductorAsignadoEmail, sendServicioCompletadoEmail, sendCotizacionListaEmail, sendCancelacionEmail } from '@/lib/email-service';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/reservas/[codigo]
 * Obtener reserva por CÓDIGO (público) o ID (admin/interno)
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const { codigo } = await params;

        // Intentar buscar por ID (String CUID)
        let reserva = await prisma.reserva.findUnique({
            where: { id: codigo },
            include: {
                servicio: true,
                conductor: true,
                vehiculo: true,
                calificacion: true,
                aliado: true,
                asistentes: true,
                adicionalesSeleccionados: {
                    include: {
                        adicional: true,
                    },
                },
            },
        });

        // Si no se encontró por ID, buscar por código
        if (!reserva) {
            reserva = await prisma.reserva.findUnique({
                where: { codigo },
                include: {
                    servicio: true,
                    conductor: true,
                    vehiculo: true,
                    calificacion: true,
                    aliado: true,
                    asistentes: true,
                    adicionalesSeleccionados: {
                        include: {
                            adicional: true,
                        },
                    },
                },
            });
        }

        if (!reserva) {
            return NextResponse.json(
                { error: 'Reserva not found' },
                { status: 404 }
            );
        }

        // IN-07: Hash update on GET moved — we still need to keep the hash current so the
        // Bold payment button on the tracking page works (it reads hashPago from this response).
        // The mutation is intentional: it keeps the stored hash in sync when precioTotal changes.
        // hashPago is stripped from the public response below so it is never leaked to clients.
        if (reserva.estado === 'PENDING_PAYMENT' || reserva.estado === 'PAYMENT_FAILED') {
            const amount = Math.round(Number(reserva.precioTotal));
            const expectedHash = generateBoldHash(reserva.codigo, amount, 'COP');

            if (reserva.hashPago !== expectedHash) {
                await prisma.reserva.update({
                    where: { id: reserva.id },
                    data: { hashPago: expectedHash },
                });

                reserva.hashPago = expectedHash;
            }
        }

        // CR-05: strip hashPago from public response to avoid leaking payment integrity secret
        const { hashPago, ...publicReserva } = reserva as any;
        return NextResponse.json(publicReserva);
    } catch (error) {
        console.error('Get reserva error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch reserva', details: String(error) },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/reservas/[codigo]
 * Actualizar reserva (ADMIN) - Se usa el ID (String) preferiblemente
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        // Verificar auth admin
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { codigo } = await params;
        const id = codigo; // El parámetro puede ser el ID directamente

        const body = await req.json();

        // Obtener reserva actual por ID
        let reservaActual = await prisma.reserva.findUnique({
            where: { id },
            include: {
                servicio: true,
                conductor: true,
            },
        });

        // Si no encuentra por ID, intentar por código (aunque para PUT idealmente es ID)
        if (!reservaActual) {
            reservaActual = await prisma.reserva.findUnique({
                where: { codigo: id }, // id variable holds the param value
                include: {
                    servicio: true,
                    conductor: true,
                },
            });
        }

        if (!reservaActual) {
            return NextResponse.json(
                { error: 'Reserva no encontrada' },
                { status: 404 }
            );
        }

        // CR-07: build explicit allowlist — never pass raw body to Prisma
        const updateData: Record<string, unknown> = {};
        if (body.estado !== undefined) updateData.estado = body.estado;
        if (body.conductorId !== undefined) updateData.conductorId = body.conductorId;
        if (body.vehiculoId !== undefined) updateData.vehiculoId = body.vehiculoId;
        if (body.fecha !== undefined) updateData.fecha = new Date(body.fecha + 'T12:00:00.000Z');
        if (body.hora !== undefined) updateData.hora = body.hora;
        if (body.numeroPasajeros !== undefined) updateData.numeroPasajeros = Number(body.numeroPasajeros);
        if (body.nombreCliente !== undefined) updateData.nombreCliente = body.nombreCliente;
        if (body.emailCliente !== undefined) updateData.emailCliente = body.emailCliente;
        if (body.whatsappCliente !== undefined) updateData.whatsappCliente = body.whatsappCliente;
        if (body.idioma !== undefined) updateData.idioma = body.idioma;
        if (body.municipio !== undefined) updateData.municipio = body.municipio;
        if (body.notas !== undefined) updateData.notas = body.notas;
        if (body.precioBase !== undefined) updateData.precioBase = parseFloat(body.precioBase);
        if (body.precioAdicionales !== undefined) updateData.precioAdicionales = parseFloat(body.precioAdicionales);
        if (body.recargoNocturno !== undefined) updateData.recargoNocturno = parseFloat(body.recargoNocturno);
        if (body.tarifaMunicipio !== undefined) updateData.tarifaMunicipio = parseFloat(body.tarifaMunicipio);
        if (body.descuentoAliado !== undefined) updateData.descuentoAliado = parseFloat(body.descuentoAliado);
        if (body.precioTotal !== undefined) updateData.precioTotal = parseFloat(body.precioTotal);
        if (body.comisionBold !== undefined) updateData.comisionBold = parseFloat(body.comisionBold);
        if (body.estadoPago !== undefined) updateData.estadoPago = body.estadoPago;
        if (body.googleCalendarEventId !== undefined) updateData.googleCalendarEventId = body.googleCalendarEventId;

        // Actualizar reserva usando el ID real encontrado
        const reservaActualizada = await prisma.reserva.update({
            where: { id: reservaActual.id },
            data: updateData,
            include: {
                servicio: true,
                conductor: true,
                vehiculo: true,
                aliado: true,
            },
        });

        // Enviar emails según cambios de estado
        const emailLang = (reservaActualizada.idioma as 'ES' | 'EN') ?? 'ES';
        try {
            if (body.estado && body.estado !== reservaActual.estado) {
                await sendCambioEstadoEmail(reservaActualizada, reservaActual.estado, emailLang);

                if (body.estado === 'CONFIRMED_UNASSIGNED' && reservaActual.estado !== 'CONFIRMED_UNASSIGNED') {
                    await sendPagoAprobadoEmail(reservaActualizada, emailLang);
                }

                if (body.estado === 'COMPLETED' && reservaActual.estado !== 'COMPLETED') {
                    await sendServicioCompletadoEmail(reservaActualizada, emailLang);
                }
            }

            if (body.conductorId && body.conductorId !== reservaActual.conductorId) {
                await sendConductorAsignadoEmail(reservaActualizada, emailLang);
            }
        } catch (emailError) {
            console.error('❌ [Reserva] Error sending status change email:', emailError);
        }

        // Actualizar evento en Google Calendar si cambió fecha/hora o se asignó conductor
        const cambioRelevante = body.fecha || body.hora || body.conductorId || body.vehiculoId || body.estado;

        if (cambioRelevante) {
            try {
                // Check if this is a Tour Compartido reservation
                if (reservaActualizada.servicio?.esCompartido) {
                    // Use consolidation function to update/maintain all reservations for the day
                    const { createOrUpdateTourCompartidoEvent } = await import('@/lib/google-calendar-service');
                    await createOrUpdateTourCompartidoEvent(reservaActualizada as any);
                    console.log('✅ [Reserva] Tour Compartido consolidated calendar event updated');
                } else if (reservaActualizada.googleCalendarEventId) {
                    // Regular services: update individual event
                    const { updateCalendarEvent } = await import('@/lib/google-calendar-service');
                    await updateCalendarEvent(reservaActualizada as any);
                    console.log('✅ [Reserva] Google Calendar event updated');
                }
            } catch (calendarError) {
                console.error('❌ [Reserva] Error updating calendar event:', calendarError);
            }
        }

        return NextResponse.json({
            data: reservaActualizada,
            message: 'Reserva actualizada exitosamente',
        });
    } catch (error) {
        console.error('Error updating reserva:', error);
        return NextResponse.json(
            { error: 'Error al actualizar reserva' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/reservas/[codigo]
 * Cancelar reserva (ADMIN) - Se usa el ID (String)
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        // Verificar auth admin
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { codigo } = await params;

        // Intentar encontrar por ID o Código
        let reserva = await prisma.reserva.findUnique({ where: { id: codigo } });
        if (!reserva) {
            reserva = await prisma.reserva.findUnique({ where: { codigo } });
        }

        if (!reserva) {
            return NextResponse.json(
                { error: 'Reserva no encontrada' },
                { status: 404 }
            );
        }

        // Soft delete: cambiar estado a CANCELADA
        const reservaActualizada = await prisma.reserva.update({
            where: { id: reserva.id },
            data: {
                estado: 'CANCELLED',
            },
            include: {
                servicio: true,
                conductor: true,
                vehiculo: true,
                aliado: true,
            },
        });

        // Enviar email de cancelación
        try {
            await sendCancelacionEmail(reservaActualizada, (reservaActualizada.idioma as 'ES' | 'EN') ?? 'ES');
        } catch (emailError) {
            console.error('❌ [Reserva] Error sending cancellation email:', emailError);
        }

        // Actualizar/eliminar evento de Google Calendar
        try {
            // Check if this is a Tour Compartido reservation
            if (reservaActualizada.servicio?.esCompartido) {
                // Update consolidation to reflect cancellation (will show updated status)
                const { createOrUpdateTourCompartidoEvent } = await import('@/lib/google-calendar-service');
                await createOrUpdateTourCompartidoEvent(reservaActualizada as any);
                console.log('✅ [Reserva] Tour Compartido consolidated calendar event updated after cancellation');
            } else if (reserva.googleCalendarEventId) {
                // Regular services: delete individual event
                const { deleteCalendarEvent } = await import('@/lib/google-calendar-service');
                await deleteCalendarEvent(reserva.googleCalendarEventId);
                console.log('✅ [Reserva] Google Calendar event deleted');
            }
        } catch (calendarError) {
            console.error('❌ [Reserva] Error updating/deleting calendar event:', calendarError);
        }

        return NextResponse.json({
            data: reservaActualizada,
            message: 'Reserva cancelada exitosamente',
        });
    } catch (error) {
        console.error('Error deleting reserva:', error);
        return NextResponse.json(
            { error: 'Error al cancelar reserva' },
            { status: 500 }
        );
    }
}
