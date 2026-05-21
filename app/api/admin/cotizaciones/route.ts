import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateBoldHash, calculateBoldCommission } from '@/lib/bold';
import { Idioma, Municipio, TipoDocumento, EstadoReserva, EstadoPago, MetodoPago } from '@prisma/client';
import { buildDatosFromBody } from '@/types/reserva-datos';

// Función para generar código de cotización único
function generateQuoteLink(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin caracteres ambiguos
    let code = 'COT';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * GET /api/admin/cotizaciones
 * Obtener historial de cotizaciones
 * Requiere autenticación de admin
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const cotizaciones = await prisma.reserva.findMany({
            where: {
                esCotizacion: true,
            },
            include: {
                servicio: true,
                vehiculo: true,
                aliado: { select: { id: true, nombre: true, email: true } },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json({
            success: true,
            data: cotizaciones,
        });

    } catch (error: any) {
        console.error('❌ Error obteniendo cotizaciones:', error);
        return NextResponse.json(
            { error: error.message || 'Error al obtener cotizaciones' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/cotizaciones
 * Crear una cotización con precio personalizado
 * Requiere autenticación de admin
 */
export async function POST(req: NextRequest) {
    try {
        // Verificar autenticación
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const body = await req.json();

        // Precio personalizado es OPCIONAL — si viene, es el total definitivo (sin agregar más cargos)
        const precioPersonalizado = body.precioPersonalizado ? Number(body.precioPersonalizado) : null;
        const esManual = precioPersonalizado !== null && precioPersonalizado > 0;

        // Determinar método de pago (default TARJETA)
        const metodoPagoSeleccionado: MetodoPago = body.metodoPago === 'EFECTIVO' ? MetodoPago.EFECTIVO : MetodoPago.TARJETA;
        const esBold = metodoPagoSeleccionado === MetodoPago.TARJETA;

        // Generar link único de cotización
        let linkCotizacion = generateQuoteLink();
        let attempts = 0;
        const maxAttempts = 10;

        // Asegurar que el link sea único
        while (attempts < maxAttempts) {
            const existing = await prisma.reserva.findUnique({
                where: { linkCotizacion }
            });
            if (!existing) break;
            linkCotizacion = generateQuoteLink();
            attempts++;
        }

        if (attempts >= maxAttempts) {
            return NextResponse.json(
                { error: 'No se pudo generar un link único. Intenta de nuevo.' },
                { status: 500 }
            );
        }

        // Generar código de reserva único
        const generateReservationCode = (): string => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = 'RES';
            for (let i = 0; i < 5; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        };

        let codigo = generateReservationCode();
        attempts = 0;
        while (attempts < maxAttempts) {
            const existing = await prisma.reserva.findUnique({
                where: { codigo }
            });
            if (!existing) break;
            codigo = generateReservationCode();
            attempts++;
        }

        // Calcular precio según si es manual o auto-calculado
        const precioBase = parseFloat(body.precioBase) || 0;
        const precioAdicionales = parseFloat(body.precioAdicionales) || 0;
        const recargoNocturno = parseFloat(body.recargoNocturno) || 0;
        const tarifaMunicipio = (parseFloat(body.tarifaMunicipio) || 0) + (parseFloat(body.tarifaMunicipioConfig) || 0);
        const descuentoAliado = parseFloat(body.descuentoAliado) || 0;
        const comisionAliado = parseFloat(body.comisionAliado) || 0;

        let precioTotal: number;
        let comisionBold = 0;
        let hashPago: string | null = null;

        if (esManual) {
            // El admin definió el total exacto — no se agrega nada más
            precioTotal = precioPersonalizado!;
        } else {
            // Auto-calculado: subtotal del desglose + comisión aliado + Bold si aplica
            const subtotal = precioBase + precioAdicionales + recargoNocturno + tarifaMunicipio + comisionAliado - descuentoAliado;
            comisionBold = esBold ? Math.round(calculateBoldCommission(subtotal)) : 0;
            precioTotal = subtotal + comisionBold;
        }

        if (esBold) {
            hashPago = generateBoldHash(codigo, precioTotal, 'COP');
        }

        // Determinar estado inicial según método de pago y clientePaga
        const clientePagaFlag = body.clientePaga !== undefined ? body.clientePaga : true;
        const estadoInicial = !clientePagaFlag
            ? EstadoReserva.CONFIRMED_UNASSIGNED
            : esBold ? EstadoReserva.PENDING_PAYMENT : EstadoReserva.CONFIRMED_UNASSIGNED;

        const estadoPagoInicial = !clientePagaFlag
            ? EstadoPago.APROBADO
            : esBold ? EstadoPago.PENDIENTE : EstadoPago.APROBADO;

        // Crear la cotización (reserva con precio manual)
        const cotizacion = await prisma.reserva.create({
            data: {
                codigo,
                linkCotizacion,
                esCotizacion: true,
                precioManual: esManual,

                // Información del cliente
                nombreCliente: body.nombreCliente,
                whatsappCliente: body.whatsappCliente,
                emailCliente: body.emailCliente,

                // Detalles del servicio
                servicioId: body.servicioId,
                fecha: new Date(body.fecha),
                hora: body.hora,
                idioma: body.idioma || Idioma.ES,
                municipio: body.municipio,
                otroMunicipio: body.otroMunicipio || null,
                numeroPasajeros: body.numeroPasajeros,
                vehiculoId: body.vehiculoId || null,

                // Campos específicos del servicio en datos JSON
                datos: buildDatosFromBody(body) as any,

                // Precios — desglose completo
                precioBase,
                precioAdicionales,
                recargoNocturno,
                tarifaMunicipio,
                descuentoAliado,
                comisionAliado,
                comisionBold,
                precioTotal,

                // Estado
                estado: estadoInicial,
                estadoPago: estadoPagoInicial,
                metodoPago: metodoPagoSeleccionado,

                // Pago
                hashPago,

                // Aliado (optional for internal quotes)
                aliadoId: body.aliadoId || null,
                esReservaAliado: !!body.aliadoId,

                // Payment flag
                clientePaga: body.clientePaga !== undefined ? body.clientePaga : true,

                // Notas
                notas: body.notas || null,
                notasInternas: body.notasInternas || `Cotización creada por ${session.user?.email} (${metodoPagoSeleccionado})`,


                // Asistentes
                asistentes: body.asistentes?.length > 0 ? {
                    create: body.asistentes
                        .filter((a: any) => a.nombre && a.numeroDocumento)
                        .map((a: any) => ({
                            nombre: a.nombre,
                            tipoDocumento: a.tipoDocumento || TipoDocumento.CC,
                            numeroDocumento: a.numeroDocumento,
                        }))
                } : undefined,
            },
            include: {
                servicio: true,
                conductor: true,
                vehiculo: true,
                aliado: true,
                asistentes: true,
            }
        });

        console.log('✅ Cotización creada:', {
            codigo: cotizacion.codigo,
            linkCotizacion: cotizacion.linkCotizacion,
            precioTotal: cotizacion.precioTotal,
            metodoPago: cotizacion.metodoPago,
        });

        // Enviar email al cliente con el link de la reserva
        try {
            const { sendCotizacionGeneradaEmail } = await import('@/lib/email-service');
            await sendCotizacionGeneradaEmail(cotizacion as any, cotizacion.idioma || 'ES');
            console.log('✅ Email de cotización enviado a:', cotizacion.emailCliente);
        } catch (emailError) {
            console.error('❌ Error enviando email de cotización:', emailError);
            // No fallar la cotización si el email falla
        }

        // Crear evento en Google Calendar
        try {
            const { createCalendarEvent } = await import('@/lib/google-calendar-service');
            const eventId = await createCalendarEvent(cotizacion as any);

            if (eventId) {
                await prisma.reserva.update({
                    where: { id: cotizacion.id },
                    data: { googleCalendarEventId: eventId }
                });
                console.log('✅ Evento de calendario creado para cotización:', eventId);
            }
        } catch (calError) {
            console.error('❌ Error creando evento de calendario para cotización:', calError);
        }

        return NextResponse.json({
            success: true,
            data: {
                codigo: cotizacion.codigo,
                linkCotizacion: cotizacion.linkCotizacion,
                precioTotal: cotizacion.precioTotal,
                cotizacion,
            }
        });

    } catch (error: any) {
        console.error('❌ Error creando cotización:', error);
        return NextResponse.json(
            { error: error.message || 'Error al crear cotización' },
            { status: 500 }
        );
    }
}
