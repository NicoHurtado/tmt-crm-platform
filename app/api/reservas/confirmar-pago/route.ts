import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { consultarTransaccionBold } from '@/lib/bold';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * Confirma el pago de una reserva o pedido.
 *
 * Lo llama la página pública /payment/result cuando el cliente vuelve de Bold, así
 * que NO puede exigir sesión de admin: antes lo hacía y todo cliente o agencia
 * recibía 401, dejando la reserva en PENDING_PAYMENT aunque hubiera pagado. Solo
 * funcionaba si quien pagaba estaba logueado en el backoffice — por eso pasó las
 * pruebas internas.
 *
 * Tampoco puede confiar en quien llama: si no hay sesión de admin, el estado del
 * pago se verifica contra la API de Bold. Sin esa verificación, cualquiera con un
 * código de reserva podría marcarla como pagada.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const esAdmin = !!session;

        const body = await req.json();
        const { orderId } = body;

        if (!orderId) {
            return NextResponse.json(
                { error: 'orderId es requerido' },
                { status: 400 }
            );
        }

        // Origen público: Bold es la única fuente de verdad sobre el pago.
        if (!esAdmin) {
            const transaccion = await consultarTransaccionBold(orderId);

            if (transaccion.status !== 'APPROVED') {
                console.warn(
                    `[Confirmar Pago] ${orderId} no confirmado por Bold (estado: ${transaccion.status})`
                );
                return NextResponse.json(
                    {
                        error: 'El pago aún no aparece aprobado en Bold',
                        boldStatus: transaccion.status,
                    },
                    // 409: la petición es válida pero el pago todavía no está confirmado.
                    // La página reintenta, y el webhook de Bold sirve de respaldo.
                    { status: 409 }
                );
            }

            console.log(`✅ [Confirmar Pago] Bold confirmó el pago de ${orderId}`);
        }

        // Detectar si es un pedido (PED prefix) o una reserva individual
        const isPedido = orderId.startsWith('PED');

        if (isPedido) {
            // ==========================================
            // PEDIDO FLOW: Update pedido + all its reservas
            // ==========================================
            return await handlePedidoPayment(orderId);
        } else {
            // ==========================================
            // RESERVA INDIVIDUAL FLOW
            // ==========================================
            return await handleReservaPayment(orderId);
        }

    } catch (error) {
        console.error('Error confirmando pago:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

/**
 * Handle payment confirmation for an individual Reserva
 */
async function handleReservaPayment(orderId: string) {
    // Buscar la reserva existente
    const reserva = await prisma.reserva.findUnique({
        where: { codigo: orderId }
    });

    if (!reserva) {
        console.error(`❌ [Confirmar Pago] Reserva no encontrada: ${orderId}`);
        return NextResponse.json(
            { error: 'Reserva no encontrada' },
            { status: 404 }
        );
    }

    // Verificar que la reserva esté en un estado que permita el pago
    if (reserva.estado !== 'PENDING_PAYMENT' && reserva.estado !== 'PAYMENT_FAILED') {
        // Si ya está pagada, retornar éxito (idempotencia)
        if (reserva.estadoPago === 'APROBADO') {
            console.log(`✅ [Confirmar Pago] Reserva ${orderId} ya estaba pagada (idempotente)`);
            return NextResponse.json({
                success: true,
                message: 'Reserva ya estaba pagada',
                alreadyPaid: true
            });
        }

        return NextResponse.json({
            message: 'Reserva no está en estado pendiente de pago',
            currentState: reserva.estado
        });
    }

    // Actualizar el estado de la reserva
    const updated = await prisma.reserva.update({
        where: { codigo: orderId },
        data: {
            estado: 'CONFIRMED_UNASSIGNED',
            estadoPago: 'APROBADO'
        },
        include: {
            servicio: true,
            conductor: true,
            vehiculo: true,
            aliado: true,
            asistentes: true,
        }
    });

    console.log(`✅ [Confirmar Pago] Reserva ${orderId} actualizada a CONFIRMED_UNASSIGNED`);

    // Determine if this is an external reservation (not from an ally)
    const isExternalReservation = !updated.esReservaAliado && !updated.aliadoId;

    // 📅 Crear evento en Google Calendar AHORA que el pago está confirmado
    try {
        if (updated.servicio?.esCompartido) {
            const { createOrUpdateTourCompartidoEvent } = await import('@/lib/google-calendar-service');
            const eventId = await createOrUpdateTourCompartidoEvent(updated as any);

            if (eventId) {
                await prisma.reserva.update({
                    where: { id: updated.id },
                    data: { googleCalendarEventId: eventId }
                });
                console.log(`📅 [Tour Compartido] Calendar event created/updated: ${eventId}`);
            }
        } else {
            // Any non-tour reservation: ensure it has a calendar event after payment confirmation.
            // This covers external bookings and ALL ally types (e.g., Medellin Florece).
            if (!updated.googleCalendarEventId) {
                const { createCalendarEvent } = await import('@/lib/google-calendar-service');
                const eventId = await createCalendarEvent(updated as any);

                if (eventId) {
                    await prisma.reserva.update({
                        where: { id: updated.id },
                        data: { googleCalendarEventId: eventId }
                    });
                    console.log(`📅 [Reserva] Calendar event created: ${eventId}`);
                }
            }
        }
    } catch (calendarError) {
        console.error('❌ Error creating calendar event:', calendarError);
    }

    // 📧 Enviar email de confirmación de pago a TODOS los tipos de reserva
    try {
        const { sendReservaConfirmadaEmail } = await import('@/lib/email-service');
        await sendReservaConfirmadaEmail(updated as any, updated.idioma || 'ES', updated.aliado?.email || null);
        console.log(`📧 [Reserva] Email de confirmación enviado para: ${orderId}`);
    } catch (emailError) {
        console.error('❌ Error sending confirmation email:', emailError);
    }

    return NextResponse.json({
        success: true,
        data: updated,
        message: 'Pago confirmado exitosamente'
    });
}

/**
 * Handle payment confirmation for a Pedido (multi-service order)
 */
async function handlePedidoPayment(orderId: string) {
    // Buscar el pedido
    const pedido = await prisma.pedido.findUnique({
        where: { codigo: orderId },
        include: {
            reservas: {
                include: {
                    servicio: true,
                    conductor: true,
                    vehiculo: true,
                    aliado: true,
                }
            },
            aliado: true,
        }
    });

    if (!pedido) {
        console.error(`❌ [Confirmar Pago] Pedido no encontrado: ${orderId}`);
        return NextResponse.json(
            { error: 'Pedido no encontrado' },
            { status: 404 }
        );
    }

    // Idempotencia: si ya está pagado, retornar éxito
    if (pedido.estadoPago === 'APROBADO') {
        console.log(`✅ [Confirmar Pago] Pedido ${orderId} ya estaba pagado (idempotente)`);
        return NextResponse.json({
            success: true,
            message: 'Pedido ya estaba pagado',
            alreadyPaid: true
        });
    }

    // Verificar que el pedido necesita pago
    if (pedido.estadoPago !== 'PENDIENTE') {
        return NextResponse.json({
            message: 'Pedido no está en estado pendiente de pago',
            currentState: pedido.estadoPago
        });
    }

    // 1. Actualizar pedido y reservas de forma atómica
    await prisma.$transaction(async (tx) => {
        await tx.pedido.update({
            where: { id: pedido.id },
            data: {
                estadoPago: 'APROBADO',
            }
        });

        await tx.reserva.updateMany({
            where: { pedidoId: pedido.id },
            data: {
                estado: 'CONFIRMED_UNASSIGNED',
                estadoPago: 'APROBADO',
            }
        });
    });

    console.log(`✅ [Confirmar Pago] Pedido ${orderId} y ${pedido.reservas.length} reservas actualizadas a PAGADO`);

    // 3. Enviar emails y crear eventos de calendario para cada reserva
    for (const reserva of pedido.reservas) {
        const reservaActualizada = await prisma.reserva.findUnique({
            where: { id: reserva.id },
            include: {
                servicio: true,
                conductor: true,
                vehiculo: true,
                aliado: true,
            },
        });

        if (!reservaActualizada) continue;

        // 📧 Enviar email de confirmación
        try {
            const { sendReservaConfirmadaEmail } = await import('@/lib/email-service');
            const aliadoEmail = reservaActualizada.aliado?.email || pedido.aliado?.email || null;
            await sendReservaConfirmadaEmail(
                reservaActualizada as any,
                pedido.idioma as 'ES' | 'EN',
                aliadoEmail
            );
            console.log(`📧 [Pedido] Email de confirmación enviado para reserva: ${reserva.codigo}`);
        } catch (emailError) {
            console.error(`❌ Error sending email for reserva ${reserva.codigo}:`, emailError);
        }

        // 📅 Crear evento en Google Calendar
        try {
            if (!reservaActualizada.googleCalendarEventId) {
                if (reservaActualizada.servicio?.esCompartido) {
                    const { createOrUpdateTourCompartidoEvent } = await import('@/lib/google-calendar-service');
                    const eventId = await createOrUpdateTourCompartidoEvent(reservaActualizada as any);
                    if (eventId) {
                        await prisma.reserva.update({
                            where: { id: reserva.id },
                            data: { googleCalendarEventId: eventId }
                        });
                        console.log(`📅 [Pedido] Tour Compartido calendar event for: ${reserva.codigo}`);
                    }
                } else {
                    const { createCalendarEvent } = await import('@/lib/google-calendar-service');
                    const eventId = await createCalendarEvent(reservaActualizada as any);
                    if (eventId) {
                        await prisma.reserva.update({
                            where: { id: reserva.id },
                            data: { googleCalendarEventId: eventId }
                        });
                        console.log(`📅 [Pedido] Calendar event created for: ${reserva.codigo}`);
                    }
                }
            }
        } catch (calendarError) {
            console.error(`❌ Error creating calendar event for ${reserva.codigo}:`, calendarError);
        }
    }

    return NextResponse.json({
        success: true,
        message: `Pedido ${orderId} confirmado exitosamente con ${pedido.reservas.length} reservas`,
        reservations_updated: pedido.reservas.length
    });
}
