import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EstadoReserva, EstadoPago } from '@prisma/client';
import { getVehicleForPassengers } from '@/lib/vehicle-selector';
import { buildDatosFromBody } from '@/types/reserva-datos';
import { calculateBoldCommission } from '@/lib/bold';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/pedido
 * Crear pedido con múltiples reservas desde el carrito
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Validar que hay items en el carrito
        if (!body.cartItems || body.cartItems.length === 0) {
            return NextResponse.json(
                { error: 'El carrito está vacío' },
                { status: 400 }
            );
        }

        // Usar el primer item como referencia para el pedido
        // Nota: Cada servicio puede tener diferentes clientes (nombre, email, whatsapp)
        const firstItem = body.cartItems[0];

        // Generar código único para el pedido
        const codigoPedido = await generateUniqueCodigo('PED');

        // Pre-calcular precios por item (incluyendo comisión de aliado) antes de la transacción
        const itemPrices = await Promise.all(body.cartItems.map(async (item: any) => {
            const precioBase = parseFloat(item.precioBase) || 0;
            const precioAdicionales = parseFloat(item.precioAdicionales) || 0;
            const recargoNocturno = parseFloat(item.recargoNocturno) || 0;
            // tarifaMunicipio incluye el recargo del MunicipioConfig dinámico
            const tarifaMunicipio = (parseFloat(item.tarifaMunicipio) || 0) + (parseFloat(item.tarifaMunicipioConfig) || 0);
            const descuentoAliado = parseFloat(item.descuentoAliado) || 0;

            const itemSubtotal = precioBase + precioAdicionales + recargoNocturno + tarifaMunicipio - descuentoAliado;

            let comisionAliado = 0;
            if (item.esReservaAliado && item.aliadoId) {
                try {
                    const tarifa = await prisma.tarifaAliado.findUnique({
                        where: {
                            aliadoId_servicioId: {
                                aliadoId: item.aliadoId,
                                servicioId: item.servicioId,
                            },
                        },
                    });
                    if (tarifa) {
                        comisionAliado = tarifa.tipoComision === 'PORCENTAJE'
                            ? itemSubtotal * (Number(tarifa.comisionPorcentaje) / 100)
                            : Number(tarifa.comisionPorcentaje);
                    }
                } catch (e) {
                    console.error('Error calculating ally commission:', e);
                }
            }

            return {
                precioBase,
                precioAdicionales,
                recargoNocturno,
                tarifaMunicipio,
                descuentoAliado,
                comisionAliado,
                itemSubtotal,
                precioTotalItem: itemSubtotal + comisionAliado,
            };
        }));

        // Subtotal del pedido = suma de totales por item (con comisión aliado incluida)
        const subtotal = itemPrices.reduce((sum, p) => sum + p.precioTotalItem, 0);

        // Verificar si todas las reservas son del mismo aliado
        const aliadoId = firstItem.aliadoId || null;
        const esReservaAliado = firstItem.esReservaAliado || false;

        // Determinar método de pago y estado para el pedido completo
        const metodoPago = body.metodoPago === 'EFECTIVO' ? 'EFECTIVO' : 'TARJETA';
        let estadoPago: EstadoPago | null = null;
        let comisionBold = 0;
        if (metodoPago === 'EFECTIVO') {
            estadoPago = null;
            comisionBold = 0;
        } else {
            estadoPago = EstadoPago.PENDIENTE;
            comisionBold = calculateBoldCommission(subtotal);
        }

        const precioTotal = subtotal + comisionBold;

        // Generar todos los códigos de reserva ANTES de la transacción
        // Esto evita problemas de timeout en la transacción
        let codigosReservas: string[] = [];
        for (let i = 0; i < body.cartItems.length; i++) {
            const codigo = await generateUniqueCodigo('RES');
            codigosReservas.push(codigo);
        }

        // WR-01: retry on P2002 unique constraint violation (race condition in code generation)
        let pedidoRetries = 3;
        let codigoPedidoActual = codigoPedido;

        // Crear el pedido con todas las reservas en una transacción
        const pedido = await (async () => {
            while (true) {
                try {
                    return await prisma.$transaction(async (tx) => {
            // 1. Crear el pedido
            const nuevoPedido = await tx.pedido.create({
                data: {
                    codigo: codigoPedidoActual,
                    nombreCliente: firstItem.nombreCliente,
                    whatsappCliente: firstItem.whatsappCliente,
                    emailCliente: firstItem.emailCliente,
                    idioma: body.idioma || 'ES',
                    subtotal,
                    comisionBold,
                    precioTotal,
                    estadoPago,
                    metodoPago,
                    aliadoId,
                    esReservaAliado,
                },
            });

            // 2. Crear todas las reservas
            const reservasCreadas = [];
            for (let i = 0; i < body.cartItems.length; i++) {
                const item = body.cartItems[i];
                // Usar el código pre-generado
                const codigoReserva = codigosReservas[i];

                // Usar precios pre-calculados (incluyen tarifaMunicipioConfig y comisionAliado)
                const itemPrice = itemPrices[i];
                const { precioBase: itemPrecioBase, precioAdicionales: itemPrecioAdicionales,
                    recargoNocturno: itemRecargoNocturno, tarifaMunicipio: itemTarifaMunicipio,
                    descuentoAliado: itemDescuentoAliado, comisionAliado,
                    precioTotalItem: precioTotalReserva } = itemPrice;

                // Auto-assign vehicle if client didn't select one
                let vehiculoId = item.vehiculoId || null;
                if (!vehiculoId) {
                    const vehiculoAsignado = await getVehicleForPassengers(
                        parseInt(item.numeroPasajeros),
                        tx
                    );
                    if (!vehiculoAsignado) {
                        throw new Error(`No hay vehículo disponible para ${item.numeroPasajeros} pasajeros`);
                    }
                    vehiculoId = vehiculoAsignado.id;
                }

                // Determinar estado inicial de la reserva
                const itemClientePaga = item.clientePaga !== undefined ? item.clientePaga : true;
                let estadoInicial: EstadoReserva;
                if (!itemClientePaga) {
                    estadoInicial = EstadoReserva.CONFIRMED_UNASSIGNED;
                } else if (item.municipio === 'OTRO' && !item.municipioConfigId) {
                    estadoInicial = EstadoReserva.CONFIRMED_UNASSIGNED;
                } else if (metodoPago === 'EFECTIVO') {
                    estadoInicial = EstadoReserva.CONFIRMED_UNASSIGNED;
                } else {
                    estadoInicial = EstadoReserva.PENDING_PAYMENT;
                }

                const datosItem = buildDatosFromBody(item);

                const reserva = await tx.reserva.create({
                    data: {
                        codigo: codigoReserva,
                        servicioId: item.servicioId,
                        fecha: new Date(item.fecha + 'T12:00:00.000Z'),
                        hora: item.hora,
                        nombreCliente: item.nombreCliente,
                        whatsappCliente: item.whatsappCliente,
                        emailCliente: item.emailCliente,
                        idioma: body.idioma || 'ES',
                        municipio: item.municipio,
                        otroMunicipio: item.otroMunicipio || null,
                        numeroPasajeros: parseInt(item.numeroPasajeros),
                        vehiculoId,

                        // Datos específicos del servicio (unificados en JSON)
                        datos: datosItem as any,

                        // Precios
                        precioBase: itemPrecioBase,
                        precioAdicionales: itemPrecioAdicionales,
                        recargoNocturno: itemRecargoNocturno,
                        tarifaMunicipio: itemTarifaMunicipio,
                        descuentoAliado: itemDescuentoAliado,
                        precioTotal: precioTotalReserva,
                        comisionAliado,

                        estado: estadoInicial,
                        estadoPago: metodoPago === 'EFECTIVO' ? null : EstadoPago.PENDIENTE,
                        metodoPago,

                        // Aliado
                        aliadoId: item.aliadoId || null,
                        esReservaAliado: item.esReservaAliado || false,
                        clientePaga: item.clientePaga !== undefined ? item.clientePaga : true,

                        // Pedido
                        pedidoId: nuevoPedido.id,
                        esPedido: true,

                        notas: item.notas || null,

                        // Crear asistentes si existen
                        asistentes: item.asistentes && item.asistentes.length > 0 ? {
                            create: item.asistentes.map((a: any) => ({
                                nombre: a.nombre,
                                tipoDocumento: a.tipoDocumento,
                                numeroDocumento: a.numeroDocumento,
                            }))
                        } : undefined,
                    },
                    include: {
                        servicio: true,
                        vehiculo: true,
                        asistentes: true,
                    },
                });

                reservasCreadas.push(reserva);

            }

            // 3. Retornar pedido con todas las reservas
            return await tx.pedido.findUnique({
                where: { id: nuevoPedido.id },
                include: {
                    reservas: {
                        include: {
                            servicio: true,
                            conductor: true,
                            vehiculo: true,
                            aliado: true,
                            asistentes: true,
                        }
                    },
                    aliado: true,
                },
            });
                    }, {
                        maxWait: 5000,
                        timeout: 20000,
                    });
                } catch (e: any) {
                    if (e?.code === 'P2002' && pedidoRetries > 1) {
                        pedidoRetries--;
                        // Regenerate all codes and retry
                        codigoPedidoActual = await generateUniqueCodigo('PED');
                        codigosReservas = [];
                        for (let i = 0; i < body.cartItems.length; i++) {
                            codigosReservas.push(await generateUniqueCodigo('RES'));
                        }
                        continue;
                    }
                    throw e;
                }
            }
        })();

        // Verificar que el pedido se creó correctamente
        if (!pedido) {
            return NextResponse.json(
                { error: 'Error creating pedido' },
                { status: 500 }
            );
        }

        // Enviar emails de confirmación individuales a cada cliente
        try {
            const { sendReservaConfirmadaEmail, sendCotizacionPendienteEmail, sendTourCompartidoConfirmationEmail } = await import('@/lib/email-service');

            console.log(`📧 [Pedido] Sending ${pedido.reservas.length} confirmation emails for pedido: ${pedido.codigo}`);

            const aliadoEmail = pedido.aliado?.email || null;
            const isExternalOrder = !body.cartItems[0]?.esReservaAliado && !body.cartItems[0]?.aliadoId;

            for (const reserva of pedido.reservas) {
                try {
                    if (reserva.servicio?.esCompartido) {
                        await sendTourCompartidoConfirmationEmail(reserva as any, body.idioma || 'ES');
                    } else if (!isExternalOrder) {
                        await sendReservaConfirmadaEmail(
                            reserva as any,
                            body.idioma || 'ES',
                            aliadoEmail
                        );
                    } else if (metodoPago === 'EFECTIVO') {
                        await sendReservaConfirmadaEmail(
                            reserva as any,
                            body.idioma || 'ES',
                            null
                        );
                    } else {
                        console.log(`📧 [Pedido] Reserva externa ${reserva.codigo}: email se enviará al confirmar pago`);
                    }
                    console.log(`✅ [Pedido] Email sent successfully for reserva: ${reserva.codigo} to ${reserva.emailCliente}${aliadoEmail ? ` + ally: ${aliadoEmail}` : ''}`);
                } catch (emailError) {
                    console.error(
                        `❌ [Pedido] Error sending email for reserva ${reserva.codigo} (client: ${reserva.emailCliente}):`,
                        emailError instanceof Error ? emailError.message : String(emailError)
                    );
                }
            }

            console.log(`✅ [Pedido] All confirmation emails processed for pedido: ${pedido.codigo}`);
        } catch (emailError) {
            console.error('❌ [Pedido] Error in email sending process:', emailError instanceof Error ? emailError.message : String(emailError));
        }

        // Crear eventos en Google Calendar para cada reserva
        try {
            const { createCalendarEvent, createOrUpdateTourCompartidoEvent } = await import('@/lib/google-calendar-service');

            for (const reserva of pedido.reservas) {
                try {
                    const eventId = reserva.servicio?.esCompartido
                        ? await createOrUpdateTourCompartidoEvent(reserva as any)
                        : await createCalendarEvent(reserva as any);

                    if (eventId) {
                        await prisma.reserva.update({
                            where: { id: reserva.id },
                            data: { googleCalendarEventId: eventId }
                        });
                        console.log('✅ [Pedido] Calendar event created for reserva:', reserva.codigo);
                    }
                } catch (calError) {
                    console.error(
                        `❌ [Pedido] Error creating calendar event for reserva ${reserva.codigo} (client: ${reserva.emailCliente}):`,
                        calError instanceof Error ? calError.message : String(calError)
                    );
                }
            }
        } catch (calendarError) {
            console.error('❌ [Pedido] Error in calendar integration:', calendarError instanceof Error ? calendarError.message : String(calendarError));
        }

        return NextResponse.json(
            {
                data: pedido,
                message: 'Pedido creado exitosamente'
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating pedido:', error);
        return NextResponse.json(
            { error: 'Error al crear pedido', details: String(error) },
            { status: 500 }
        );
    }
}

/**
 * GET /api/pedido/[codigo]
 * Obtener pedido por código
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const codigo = searchParams.get('codigo');

        if (!codigo) {
            return NextResponse.json(
                { error: 'Código de pedido requerido' },
                { status: 400 }
            );
        }

        const pedido = await prisma.pedido.findUnique({
            where: { codigo },
            include: {
                reservas: {
                    include: {
                        servicio: true,
                        vehiculo: true,
                        asistentes: true,
                        conductor: true,
                    }
                },
                aliado: true,
            },
        });

        if (!pedido) {
            return NextResponse.json(
                { error: 'Pedido no encontrado' },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: pedido });
    } catch (error) {
        console.error('Error fetching pedido:', error);
        return NextResponse.json(
            { error: 'Error al obtener pedido' },
            { status: 500 }
        );
    }
}

/**
 * Genera un código único de 8 caracteres alfanuméricos con prefijo.
 * IN-03: uses crypto.randomInt for cryptographically secure randomness.
 */
async function generateUniqueCodigo(prefix: string): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo: string;
    let exists = true;

    while (exists) {
        let randomPart = '';
        for (let i = 0; i < 5; i++) {
            // IN-03: crypto.randomInt replaces Math.random()
            randomPart += chars.charAt(crypto.randomInt(0, chars.length));
        }
        codigo = `${prefix}${randomPart}`;

        // Verificar si ya existe en Pedido o Reserva
        const [existingPedido, existingReserva] = await Promise.all([
            prisma.pedido.findUnique({ where: { codigo } }),
            prisma.reserva.findUnique({ where: { codigo } }),
        ]);

        exists = !!(existingPedido || existingReserva);
    }

    return codigo!;
}
