import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { validateBoldHash, calculateBoldCommission } from '@/lib/bold';
import { sendPagoAprobadoEmail, sendCambioEstadoEmail } from '@/lib/email-service';

function verifyBoldSignature(rawBody: string, signatureHeader: string | null): boolean {
    const secret = process.env.BOLD_SECRET_KEY;
    if (!secret) {
        console.error('[Bold] BOLD_SECRET_KEY not set — rejecting webhook');
        return false;
    }
    if (!signatureHeader) return false;
    const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signatureHeader, 'hex'),
            Buffer.from(expected, 'hex')
        );
    } catch {
        return false;
    }
}

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * Webhook de Bold para notificaciones de pago
 * https://developers.bold.co/pagos-en-linea/consulta-de-transacciones
 */
export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get('x-bold-signature') ?? req.headers.get('x-bold-hmac-256');
        if (!verifyBoldSignature(rawBody, signature)) {
            console.warn('[Bold] Webhook rejected: invalid signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
        const body = JSON.parse(rawBody);

        console.log('Bold webhook received:', body);

        // Extraer datos del webhook de Bold
        const {
            order_id,
            payment_status,
            transaction_id,
            amount,
            currency,
            // Bold también puede enviar más campos
        } = body;

        if (!order_id) {
            return NextResponse.json(
                { error: 'order_id is required' },
                { status: 400 }
            );
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
                case 'failed':
                    nuevoEstadoReserva = 'PAYMENT_FAILED';
                    nuevoEstadoPago = 'RECHAZADO';
                    break;
                case 'pending':
                    nuevoEstadoPago = 'PROCESANDO';
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
                                adicionalesSeleccionados: {
                                    include: { adicional: true },
                                },
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
                case 'failed':
                    nuevoEstado = 'PAYMENT_FAILED';
                    nuevoEstadoPago = 'RECHAZADO';
                    break;
                case 'pending':
                    nuevoEstadoPago = 'PROCESANDO';
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
