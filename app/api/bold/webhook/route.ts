import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    calculateBoldCommission,
    verifyBoldWebhookSignature,
    parseBoldWebhookEvent,
} from '@/lib/bold';
import { sendPagoAprobadoEmail, sendCambioEstadoEmail } from '@/lib/email-service';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * Webhook de Bold para notificaciones de pago
 * https://developers.bold.co/pagos-en-linea/consulta-de-transacciones
 */
export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get('x-bold-signature');
        if (!verifyBoldWebhookSignature(rawBody, signature)) {
            console.warn('[Bold] Webhook rechazado: firma inválida');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
        const body = JSON.parse(rawBody);

        console.log('[Bold] Webhook recibido:', body?.type, body?.data?.metadata?.reference);

        // Bold envía la referencia en data.metadata.reference y el estado en `type`.
        const evento = parseBoldWebhookEvent(body);
        const order_id = evento.orderId;
        const transaction_id = evento.transactionId;
        const amount = evento.amount;

        // Traducimos a los estados que ya usaba el resto del handler.
        const payment_status =
            evento.estado === 'APROBADO' ? 'approved'
                : evento.estado === 'RECHAZADO' ? 'rejected'
                    : evento.estado === 'ANULADO' ? 'voided'
                        : 'unknown';

        if (!order_id) {
            // Pasa en ventas sin referencia (p. ej. QR de mostrador): no es un error
            // nuestro, así que respondemos 200 para que Bold no reintente en vano.
            console.log('[Bold] Evento sin referencia — se ignora');
            return NextResponse.json({ success: true, ignored: 'sin referencia' });
        }

        if (payment_status === 'unknown') {
            console.log(`[Bold] Tipo de evento no manejado: ${body?.type}`);
            return NextResponse.json({ success: true, ignored: `tipo ${body?.type}` });
        }

        // Detectar si es un pedido o una reserva individual
        const isPedido = order_id.startsWith('PED');

        if (isPedido) {
            // MANEJO DE PEDIDO
            const pedido = await prisma.pedido.findUnique({
                where: { codigo: order_id },
                include: {
                    reservas: {
                        include: {
                            servicio: true,
                            conductor: true,
                            vehiculo: true,
                        }
                    }
                },
            });

            if (!pedido) {
                console.error('Pedido not found for order_id:', order_id);
                return NextResponse.json(
                    { error: 'Pedido not found' },
                    { status: 404 }
                );
            }

            // Idempotency: if already APROBADO and webhook says approved, skip re-processing
            if (pedido.estadoPago === 'APROBADO' && payment_status === 'approved') {
                console.log(`✅ [Webhook] Pedido ${order_id} already APROBADO (idempotent skip)`);
                return NextResponse.json({
                    success: true,
                    message: 'Pedido already processed',
                    order_id,
                    already_processed: true,
                });
            }

            // Mapear estado de Bold a nuestro sistema
            let nuevoEstadoPago: string | null = null;
            let nuevoEstadoReserva: string | null = null;

            switch (payment_status) {
                case 'approved':
                    nuevoEstadoReserva = 'CONFIRMED_UNASSIGNED';
                    nuevoEstadoPago = 'APROBADO';
                    break;
                case 'rejected':
                    nuevoEstadoReserva = 'PAYMENT_FAILED';
                    nuevoEstadoPago = 'RECHAZADO';
                    break;
                case 'voided':
                    // Venta anulada después de aprobada. Marcamos el pago como rechazado
                    // pero NO cancelamos el servicio automáticamente: puede haber un
                    // conductor ya asignado y esa decisión es del equipo.
                    nuevoEstadoPago = 'RECHAZADO';
                    console.warn(`[Bold] ⚠️ Venta ANULADA para ${order_id} — revisar manualmente`);
                    break;
            }

            // Actualizar el pedido
            await prisma.pedido.update({
                where: { id: pedido.id },
                data: {
                    ...(nuevoEstadoPago && { estadoPago: nuevoEstadoPago as any }),
                    ...(transaction_id && { pagoId: transaction_id }),
                },
            });

            // Actualizar TODAS las reservas del pedido
            if (nuevoEstadoReserva) {
                await prisma.reserva.updateMany({
                    where: { pedidoId: pedido.id },
                    data: {
                        estado: nuevoEstadoReserva as any,
                        ...(nuevoEstadoPago && { estadoPago: nuevoEstadoPago as any }),
                        ...(transaction_id && { pagoId: transaction_id }),
                    },
                });
            }

            // Enviar emails si el pago fue aprobado
            if (payment_status === 'approved') {
                try {
                    const { sendReservaConfirmadaEmail } = await import('@/lib/email-service');
                    const { createCalendarEvent, createOrUpdateTourCompartidoEvent } = await import('@/lib/google-calendar-service');

                    for (const reserva of pedido.reservas) {
                        const reservaActualizada = await prisma.reserva.findUnique({
                            where: { id: reserva.id },
                            include: {
                                servicio: true,
                                conductor: true,
                                vehiculo: true,
                                aliado: true,
                                asistentes: true,
                            },
                        });

                        if (reservaActualizada) {
                            await sendPagoAprobadoEmail(
                                reservaActualizada,
                                pedido.idioma as 'ES' | 'EN'
                            );

                            try {
                                await sendReservaConfirmadaEmail(
                                    reservaActualizada as any,
                                    pedido.idioma as 'ES' | 'EN',
                                    reservaActualizada.aliado?.email || null
                                );
                            } catch (e) {
                                console.error('Error sending confirmation email:', e);
                            }

                            // Create/update calendar event for ALL reservation types
                            try {
                                if (!reservaActualizada.googleCalendarEventId) {
                                    const isTourCompartido = reservaActualizada.servicio?.esCompartido;
                                    const eventId = isTourCompartido
                                        ? await createOrUpdateTourCompartidoEvent(reservaActualizada as any)
                                        : await createCalendarEvent(reservaActualizada as any);
                                    if (eventId) {
                                        await prisma.reserva.update({
                                            where: { id: reserva.id },
                                            data: { googleCalendarEventId: eventId }
                                        });
                                        console.log(`✅ [Webhook] Calendar event created for: ${reserva.codigo}`);
                                    }
                                }
                            } catch (e) {
                                console.error('Error creating calendar event:', e);
                            }
                        }
                    }
                } catch (emailError) {
                    console.error('Error sending payment emails for pedido:', emailError);
                }
            }

            return NextResponse.json({
                success: true,
                message: 'Pedido webhook processed successfully',
                order_id,
                reservations_updated: pedido.reservas.length,
                new_status: nuevoEstadoReserva || 'unchanged',
            });

        } else {
            // MANEJO DE RESERVA INDIVIDUAL (código existente)
            const reserva = await prisma.reserva.findUnique({
                where: { codigo: order_id },
                include: {
                    servicio: true,
                    conductor: true,
                    vehiculo: true,
                    aliado: true,
                },
            });

            if (!reserva) {
                console.error('Reserva not found for order_id:', order_id);
                return NextResponse.json(
                    { error: 'Reserva not found' },
                    { status: 404 }
                );
            }

            // Idempotency: if already APROBADO and webhook says approved, skip re-processing
            if (reserva.estadoPago === 'APROBADO' && payment_status === 'approved') {
                console.log(`✅ [Webhook] Reserva ${order_id} already APROBADO (idempotent skip)`);
                return NextResponse.json({
                    success: true,
                    message: 'Reserva already processed',
                    order_id,
                    already_processed: true,
                });
            }

            // Mapear estado de Bold a nuestro sistema
            let nuevoEstado: string | null = null;
            let nuevoEstadoPago: string | null = null;

            switch (payment_status) {
                case 'approved':
                    nuevoEstado = 'CONFIRMED_UNASSIGNED';
                    nuevoEstadoPago = 'APROBADO';
                    break;
                case 'rejected':
                    nuevoEstado = 'PAYMENT_FAILED';
                    nuevoEstadoPago = 'RECHAZADO';
                    break;
                case 'voided':
                    // Venta anulada después de aprobada. Marcamos el pago como rechazado
                    // pero NO cancelamos el servicio automáticamente: puede haber un
                    // conductor ya asignado y esa decisión es del equipo.
                    nuevoEstadoPago = 'RECHAZADO';
                    console.warn(`[Bold] ⚠️ Venta ANULADA para ${order_id} — revisar manualmente`);
                    break;
            }

            // Actualizar reserva
            const estadoAnterior = reserva.estado;

            await prisma.reserva.update({
                where: { id: reserva.id },
                data: {
                    ...(nuevoEstado && { estado: nuevoEstado as any }),
                    ...(nuevoEstadoPago && { estadoPago: nuevoEstadoPago as any }),
                    ...(transaction_id && { pagoId: transaction_id }),
                    ...(amount && { comisionBold: calculateBoldCommission(Number(amount)) }),
                },
            });

            if (payment_status === 'approved') {
                try {
                    const { sendReservaConfirmadaEmail } = await import('@/lib/email-service');
                    const { createCalendarEvent, createOrUpdateTourCompartidoEvent } = await import('@/lib/google-calendar-service');

                    const reservaActualizada = await prisma.reserva.findUnique({
                        where: { id: reserva.id },
                        include: {
                            servicio: true,
                            conductor: true,
                            vehiculo: true,
                            aliado: true,
                            asistentes: true,
                        },
                    });

                    if (reservaActualizada) {
                        await sendPagoAprobadoEmail(
                            reservaActualizada,
                            reserva.idioma as 'ES' | 'EN'
                        );

                        try {
                            await sendReservaConfirmadaEmail(
                                reservaActualizada as any,
                                reserva.idioma as 'ES' | 'EN',
                                reservaActualizada.aliado?.email || null
                            );
                        } catch (e) {
                            console.error('Error sending confirmation email:', e);
                        }

                        // Create/update calendar event for ALL reservation types
                        try {
                            if (!reservaActualizada.googleCalendarEventId) {
                                const isTourCompartido = reservaActualizada.servicio?.esCompartido;
                                const eventId = isTourCompartido
                                    ? await createOrUpdateTourCompartidoEvent(reservaActualizada as any)
                                    : await createCalendarEvent(reservaActualizada as any);
                                if (eventId) {
                                    await prisma.reserva.update({
                                        where: { id: reserva.id },
                                        data: { googleCalendarEventId: eventId }
                                    });
                                    console.log(`✅ [Webhook] Calendar event created for: ${reserva.codigo}`);
                                }
                            }
                        } catch (e) {
                            console.error('Error creating calendar event:', e);
                        }
                    }
                } catch (emailError) {
                    console.error('Error sending payment email:', emailError);
                }
            }

            // Enviar email de cambio de estado si hubo cambio (Only if NOT approved/paid, to avoid double noise, or keep standard)
            // Ideally, status change email is for other movements. If we just sent "Approved" + "Confirmed", "Status Change" might be redundant but logic assumes it runs.
            if (nuevoEstado && nuevoEstado !== estadoAnterior && payment_status !== 'approved') {
                try {
                    const reservaActualizada = await prisma.reserva.findUnique({
                        where: { id: reserva.id },
                        include: {
                            servicio: true,
                            conductor: true,
                            vehiculo: true,
                        },
                    });

                    if (reservaActualizada) {
                        await sendCambioEstadoEmail(
                            reservaActualizada,
                            estadoAnterior,
                            reserva.idioma as 'ES' | 'EN'
                        );
                    }
                } catch (emailError) {
                    console.error('Error sending status change email:', emailError);
                }
            }

            return NextResponse.json({
                success: true,
                message: 'Webhook processed successfully',
                order_id,
                new_status: nuevoEstado || reserva.estado,
            });
        }
    } catch (error) {
        console.error('Bold webhook error:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed', details: String(error) },
            { status: 500 }
        );
    }
}

// Bold también puede enviar GET para verificar el endpoint
export async function GET(req: NextRequest) {
    return NextResponse.json({
        status: 'Bold webhook endpoint active',
        timestamp: new Date().toISOString(),
    });
}
