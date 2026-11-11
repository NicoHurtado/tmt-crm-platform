import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateBoldHash, calculateBoldCommission } from '@/lib/bold';
import { Idioma, TipoDocumento, EstadoReserva, EstadoPago, MetodoPago, Prisma } from '@prisma/client';
import crypto from 'crypto';
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
                pedido: { select: { id: true, codigo: true } },
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

type ItemPreparado = {
    data: Prisma.ReservaUncheckedCreateInput;
    precioTotal: number;
    comisionBold: number;
};

const INCLUDE_RESERVA = {
    servicio: true,
    conductor: true,
    vehiculo: true,
    aliado: true,
    asistentes: true,
} as const;

/** Código único (prefijo + 5 caracteres) que no exista ni en Reserva ni en Pedido. */
async function codigoUnico(prefijo: 'RES' | 'PED', reservados: Set<string>): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let intento = 0; intento < 20; intento++) {
        let codigo = prefijo;
        for (let i = 0; i < 5; i++) codigo += chars.charAt(crypto.randomInt(0, chars.length));
        if (reservados.has(codigo)) continue;
        const [r, p] = await Promise.all([
            prisma.reserva.findUnique({ where: { codigo }, select: { id: true } }),
            prisma.pedido.findUnique({ where: { codigo }, select: { id: true } }),
        ]);
        if (!r && !p) {
            reservados.add(codigo);
            return codigo;
        }
    }
    throw new Error('No se pudo generar un código único. Intenta de nuevo.');
}

async function linkCotizacionUnico(reservados: Set<string>): Promise<string> {
    for (let intento = 0; intento < 20; intento++) {
        const link = generateQuoteLink();
        if (reservados.has(link)) continue;
        const existing = await prisma.reserva.findUnique({ where: { linkCotizacion: link }, select: { id: true } });
        if (!existing) {
            reservados.add(link);
            return link;
        }
    }
    throw new Error('No se pudo generar un link único. Intenta de nuevo.');
}

/**
 * Arma los datos de UNA reserva-cotización a partir del cuerpo de un servicio.
 * El método de pago, el aliado y "el cliente paga" vienen de la cotización completa.
 */
function prepararItem(
    item: any,
    comun: { metodoPago: MetodoPago; clientePaga: boolean; aliadoId: string | null; creadoPor: string },
    codigo: string,
    linkCotizacion: string,
): ItemPreparado {
    const esBold = comun.metodoPago === MetodoPago.TARJETA;

    // Precio personalizado es OPCIONAL — si viene, es el total definitivo (sin agregar más cargos)
    const precioPersonalizado = item.precioPersonalizado ? Number(item.precioPersonalizado) : null;
    const esManual = precioPersonalizado !== null && precioPersonalizado > 0;

    const precioBase = parseFloat(item.precioBase) || 0;
    const precioAdicionales = parseFloat(item.precioAdicionales) || 0;
    const recargoNocturno = parseFloat(item.recargoNocturno) || 0;
    const tarifaMunicipio = (parseFloat(item.tarifaMunicipio) || 0) + (parseFloat(item.tarifaMunicipioConfig) || 0);
    const descuentoAliado = parseFloat(item.descuentoAliado) || 0;
    const comisionAliado = parseFloat(item.comisionAliado) || 0;

    let precioTotal: number;
    let comisionBold = 0;
    if (esManual) {
        // El admin definió el total exacto — no se agrega nada más
        precioTotal = precioPersonalizado!;
    } else {
        // Auto-calculado: subtotal del desglose + comisión aliado + Bold si aplica
        const subtotal = precioBase + precioAdicionales + recargoNocturno + tarifaMunicipio + comisionAliado - descuentoAliado;
        comisionBold = esBold ? Math.round(calculateBoldCommission(subtotal)) : 0;
        precioTotal = subtotal + comisionBold;
    }

    // Estado inicial según método de pago y clientePaga
    const estado = !comun.clientePaga
        ? EstadoReserva.CONFIRMED_UNASSIGNED
        : esBold ? EstadoReserva.PENDING_PAYMENT : EstadoReserva.CONFIRMED_UNASSIGNED;
    const estadoPago = !comun.clientePaga
        ? EstadoPago.APROBADO
        : esBold ? EstadoPago.PENDIENTE : EstadoPago.APROBADO;

    const asistentes = Array.isArray(item.asistentes)
        ? item.asistentes.filter((a: any) => a?.nombre && a?.numeroDocumento)
        : [];

    return {
        precioTotal,
        comisionBold,
        data: {
            codigo,
            linkCotizacion,
            esCotizacion: true,
            precioManual: esManual,

            // Información del cliente
            nombreCliente: item.nombreCliente,
            whatsappCliente: item.whatsappCliente,
            emailCliente: item.emailCliente,

            // Detalles del servicio
            servicioId: item.servicioId,
            // Almacenar al mediodía UTC para que el día calendario sea idéntico
            // en UTC y en America/Bogota (UTC-5) y no se desplace.
            fecha: new Date(String(item.fecha).slice(0, 10) + 'T12:00:00.000Z'),
            hora: item.hora,
            idioma: item.idioma || Idioma.ES,
            municipio: item.municipio,
            otroMunicipio: item.otroMunicipio || null,
            numeroPasajeros: item.numeroPasajeros,
            vehiculoId: item.vehiculoId || null,

            // Campos específicos del servicio en datos JSON
            datos: buildDatosFromBody(item) as any,

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
            estado,
            estadoPago,
            metodoPago: comun.metodoPago,

            // Aliado (optional for internal quotes)
            aliadoId: comun.aliadoId,
            esReservaAliado: !!comun.aliadoId,
            clientePaga: comun.clientePaga,

            // Notas
            notas: item.notas || null,
            notasInternas: item.notasInternas || `Cotización creada por ${comun.creadoPor} (${comun.metodoPago})`,

            // Asistentes
            asistentes: asistentes.length > 0 ? {
                create: asistentes.map((a: any) => ({
                    nombre: a.nombre,
                    tipoDocumento: a.tipoDocumento || TipoDocumento.CC,
                    numeroDocumento: a.numeroDocumento,
                })),
            } : undefined,
        },
    };
}

/** Crea el evento de calendario de cada reserva y guarda su id (sin fallar la cotización). */
async function sincronizarCalendario(reservas: Array<{ id: string; codigo: string }>) {
    try {
        const { createCalendarEvent } = await import('@/lib/google-calendar-service');
        for (const reserva of reservas) {
            try {
                const eventId = await createCalendarEvent(reserva as any);
                if (eventId) {
                    await prisma.reserva.update({
                        where: { id: reserva.id },
                        data: { googleCalendarEventId: eventId },
                    });
                }
            } catch (calError) {
                console.error(`❌ Error creando evento de calendario para cotización ${reserva.codigo}:`, calError);
            }
        }
    } catch (calError) {
        console.error('❌ Error cargando Google Calendar para cotizaciones:', calError);
    }
}

/**
 * POST /api/admin/cotizaciones
 * Crear una cotización con precio personalizado.
 *
 * - Un servicio: el cuerpo es el servicio (formato original) → una reserva-cotización.
 * - Varios servicios: `{ items: [...], metodoPago, aliadoId, clientePaga }` → un Pedido
 *   que agrupa una reserva-cotización por servicio, con UN solo pago y UN solo correo.
 *
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
        const items: any[] = Array.isArray(body.items) && body.items.length > 0 ? body.items : [body];

        if (items.length > 20) {
            return NextResponse.json({ error: 'Una cotización admite máximo 20 servicios' }, { status: 400 });
        }
        if (items.some((it) => !it?.servicioId || !it?.fecha || !it?.nombreCliente || !it?.emailCliente)) {
            return NextResponse.json({ error: 'Cada servicio necesita servicio, fecha y datos del cliente' }, { status: 400 });
        }

        const clientePaga = body.clientePaga !== undefined ? body.clientePaga !== false : true;
        const comun = {
            // Sin cobro al cliente no hay pasarela: se guarda como efectivo (igual que antes).
            metodoPago: (!clientePaga || body.metodoPago === 'EFECTIVO') ? MetodoPago.EFECTIVO : MetodoPago.TARJETA,
            clientePaga,
            aliadoId: (body.aliadoId as string) || null,
            creadoPor: session.user?.email || 'admin',
        };
        const esBold = comun.metodoPago === MetodoPago.TARJETA;

        const codigosUsados = new Set<string>();
        const linksUsados = new Set<string>();
        const preparados: ItemPreparado[] = [];
        for (const item of items) {
            const codigo = await codigoUnico('RES', codigosUsados);
            const link = await linkCotizacionUnico(linksUsados);
            preparados.push(prepararItem(item, comun, codigo, link));
        }

        // ── UN SERVICIO: comportamiento original ─────────────────────────────
        if (preparados.length === 1) {
            const [p] = preparados;
            const cotizacion = await prisma.reserva.create({
                data: {
                    ...p.data,
                    hashPago: esBold ? generateBoldHash(p.data.codigo, p.precioTotal, 'COP') : null,
                },
                include: INCLUDE_RESERVA,
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

            await sincronizarCalendario([cotizacion]);

            return NextResponse.json({
                success: true,
                data: {
                    codigo: cotizacion.codigo,
                    linkCotizacion: cotizacion.linkCotizacion,
                    precioTotal: cotizacion.precioTotal,
                    cotizacion,
                }
            });
        }

        // ── VARIOS SERVICIOS: un Pedido con una reserva por servicio ─────────
        const codigoPedido = await codigoUnico('PED', codigosUsados);
        const precioTotal = Math.round(preparados.reduce((s, p) => s + p.precioTotal, 0));
        const comisionBold = preparados.reduce((s, p) => s + p.comisionBold, 0);
        const subtotal = precioTotal - comisionBold;
        const primero = items[0];

        const pedido = await prisma.$transaction(async (tx) => {
            const nuevo = await tx.pedido.create({
                data: {
                    codigo: codigoPedido,
                    nombreCliente: primero.nombreCliente,
                    whatsappCliente: primero.whatsappCliente,
                    emailCliente: primero.emailCliente,
                    idioma: primero.idioma === 'EN' ? Idioma.EN : Idioma.ES,
                    subtotal,
                    comisionBold,
                    precioTotal,
                    // Mismo criterio que la cotización de un servicio.
                    estadoPago: !clientePaga ? EstadoPago.APROBADO : esBold ? EstadoPago.PENDIENTE : EstadoPago.APROBADO,
                    metodoPago: comun.metodoPago,
                    // El pago se hace por el pedido completo (order_id = PED…): el webhook de Bold
                    // actualiza todas sus reservas.
                    hashPago: esBold ? generateBoldHash(codigoPedido, precioTotal, 'COP') : null,
                    aliadoId: comun.aliadoId,
                    esReservaAliado: !!comun.aliadoId,
                },
            });
            for (const p of preparados) {
                await tx.reserva.create({
                    data: { ...p.data, pedidoId: nuevo.id, esPedido: true, hashPago: null },
                });
            }
            return tx.pedido.findUniqueOrThrow({
                where: { id: nuevo.id },
                include: {
                    reservas: { include: INCLUDE_RESERVA, orderBy: [{ fecha: 'asc' }, { hora: 'asc' }] },
                    aliado: true,
                },
            });
        }, { maxWait: 5000, timeout: 20000 });

        console.log('✅ Cotización múltiple creada:', {
            pedido: pedido.codigo,
            servicios: pedido.reservas.map((r) => r.codigo),
            precioTotal: pedido.precioTotal,
            metodoPago: pedido.metodoPago,
        });

        // UN solo correo al cliente con todos los servicios desglosados
        try {
            const { sendCotizacionMultipleEmail } = await import('@/lib/email-service');
            await sendCotizacionMultipleEmail(pedido as any, pedido.idioma || 'ES');
            console.log('✅ Email de cotización múltiple enviado a:', pedido.emailCliente);
        } catch (emailError) {
            console.error('❌ Error enviando email de cotización múltiple:', emailError);
        }

        await sincronizarCalendario(pedido.reservas);

        return NextResponse.json({
            success: true,
            data: {
                codigo: pedido.codigo,
                esPedido: true,
                precioTotal: pedido.precioTotal,
                reservas: pedido.reservas.map((r) => ({ codigo: r.codigo, precioTotal: r.precioTotal })),
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
