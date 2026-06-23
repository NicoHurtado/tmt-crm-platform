import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EstadoReserva, Prisma } from '@prisma/client';
import { buildDatosFromBody } from '@/types/reserva-datos';
import { calculateBoldCommission } from '@/lib/bold';
import { getConfiguracion, totalPorPersona, comisionPorPersona } from '@/types/servicio-config';
import { categoriaDeServicio, modeloPrecioDeServicio } from '@/lib/servicio-categoria';
import { recalcularPrecioWebDirecto } from '@/lib/priceCalculator';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/reservas
 * Lista todas las reservas con filtros opcionales
 * Query params: ?estado=, ?fecha=, ?servicio=, ?esAliado=
 */
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);

        // Construir filtros dinámicos
        const where: any = {};

        // Filtro por estado
        const estado = searchParams.get('estado');
        if (estado) {
            where.estado = estado;
        }

        // Filtro por fecha
        const fecha = searchParams.get('fecha');
        if (fecha) {
            where.fecha = new Date(fecha);
        }

        // Filtro por servicio
        const servicioId = searchParams.get('servicio');
        if (servicioId) {
            where.servicioId = parseInt(servicioId);
        }

        // Filtro por tipo (aliado o no)
        const esAliado = searchParams.get('esAliado');
        if (esAliado !== null) {
            where.esReservaAliado = esAliado === 'true';
        }

        // Buscar reservas
        const allReservas = await prisma.reserva.findMany({
            where,
            include: {
                servicio: true,
                conductor: true,
                vehiculo: true,
                aliado: true,
                calificacion: true,
                asistentes: true,
            },
            orderBy: {
                fecha: 'desc',
            },
        });

        return NextResponse.json({ data: allReservas });
    } catch (error) {
        console.error('Error fetching reservas:', error);
        return NextResponse.json(
            { error: 'Error al obtener reservas' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/reservas
 * Crear nueva reserva
 */
export async function POST(request: Request) {
    try {
        const requestStart = Date.now();
        const body = await request.json();

        // Get service first to check type
        const servicio = await prisma.servicio.findUnique({
            where: { id: body.servicioId },
            include: { vehiculosPermitidos: true }
        });

        if (!servicio) {
            return NextResponse.json(
                { error: 'Servicio no encontrado' },
                { status: 404 }
            );
        }

        // Categoría de tarifa por persona: formulario ágil (sin hora, vehículo ni municipio)
        const cfgServicio = getConfiguracion((servicio as any).configuracion);
        const esPorPersona = cfgServicio.tipoTarifa === 'POR_PERSONA';

        // Snapshot de categoría/modelo del servicio al momento de reservar (aditivo).
        const categoriaServicioSnapshot = categoriaDeServicio(servicio as any);
        const modeloPrecioSnapshot = modeloPrecioDeServicio(servicio as any);

        // Validar campos requeridos (municipio/hora no requeridos para TOUR_COMPARTIDO ni por persona)
        const requiredFields = [
            'servicioId',
            'fecha',
            'nombreCliente',
            'whatsappCliente',
            'emailCliente',
            'numeroPasajeros',
        ];

        // hora no aplica a tours por persona (no hay selección de hora)
        if (!esPorPersona) {
            requiredFields.push('hora');
        }

        // Add municipio to required fields only if NOT a shared tour / per-person tour
        if (!servicio.esCompartido && !esPorPersona) {
            requiredFields.push('municipio');
        }

        for (const field of requiredFields) {
            if (!body[field]) {
                return NextResponse.json(
                    { error: `Campo requerido: ${field}` },
                    { status: 400 }
                );
            }
        }

        const metodoPago = body.metodoPago === 'EFECTIVO' ? 'EFECTIVO' : 'TARJETA';

        // Para hoteles o servicios normales, continuar con el flujo normal
        // Generar código único de 8 caracteres
        const codigo = await generateUniqueCodigo();

        // Precio calculado server-side para tours por persona (no se confía en el front)
        // Componentes del precio base (sin comisión de aliado ni Bold)
        let precioBase = parseFloat(body.precioBase) || 0;
        let precioAdicionales = parseFloat(body.precioAdicionales) || 0;
        let recargoNocturno = parseFloat(body.recargoNocturno) || 0;
        let tarifaMunicipio = (parseFloat(body.tarifaMunicipio) || 0) + (parseFloat(body.tarifaMunicipioConfig) || 0);
        const descuentoAliado = parseFloat(body.descuentoAliado) || 0;

        // Calcular comisión de aliado si aplica — ahora por (aliado, servicio, vehículo)
        let comisionAliado = 0;

        if (esPorPersona) {
            // 🔒 Recálculo autoritativo desde la configuración del servicio.
            // total = precio del tramo (1/2/3+) × nº de pasajeros. Sin vehículo ni municipio.
            const pasajeros = parseInt(body.numeroPasajeros) || 1;
            precioBase = totalPorPersona(cfgServicio.preciosPorPersona, pasajeros);
            precioAdicionales = 0;
            recargoNocturno = 0;
            tarifaMunicipio = 0;

            // Comisión: override configurado por (aliado, servicio) si existe; si no,
            // automático por tipo de aliado (HOTEL/AIRBNB +10%, AGENCIA −10%).
            if (body.esReservaAliado && body.aliadoId) {
                try {
                    const [aliado, sa] = await Promise.all([
                        prisma.aliado.findUnique({
                            where: { id: body.aliadoId },
                            select: { tipo: true },
                        }),
                        prisma.servicioAliado.findUnique({
                            where: { aliadoId_servicioId: { aliadoId: body.aliadoId, servicioId: body.servicioId } },
                            select: { comisionPorPersonaTipo: true, comisionPorPersonaValor: true },
                        }),
                    ]);
                    comisionAliado = comisionPorPersona(precioBase, aliado?.tipo, {
                        tipo: (sa?.comisionPorPersonaTipo ?? null) as any,
                        valor: sa?.comisionPorPersonaValor != null ? Number(sa.comisionPorPersonaValor) : null,
                    });
                } catch (e) {
                    console.error('Error calculating per-person ally commission:', e);
                }
            }
        } else if (body.esReservaAliado && body.aliadoId && body.vehiculoId) {
            const subtotalPrevio = precioBase + precioAdicionales + recargoNocturno + tarifaMunicipio - descuentoAliado;
            try {
                const sa = await prisma.servicioAliado.findUnique({
                    where: {
                        aliadoId_servicioId: {
                            aliadoId: body.aliadoId,
                            servicioId: body.servicioId
                        }
                    },
                    include: {
                        preciosVehiculos: { where: { vehiculoId: body.vehiculoId } }
                    }
                });
                const pv = sa?.preciosVehiculos?.[0];
                if (pv) {
                    // Para aeropuerto Olaya Herrera usa la comisión alterna si está configurada (fallback a JMC).
                    const esOlaya = body.aeropuertoNombre === 'OLAYA_HERRERA';
                    const tipoComision = esOlaya && pv.tipoComisionOlaya != null ? pv.tipoComisionOlaya : pv.tipoComision;
                    const comisionValor = esOlaya && pv.comisionValorOlaya != null
                        ? Number(pv.comisionValorOlaya)
                        : Number(pv.comisionValor);
                    comisionAliado = tipoComision === 'PORCENTAJE'
                        ? subtotalPrevio * (comisionValor / 100)
                        : comisionValor;
                }
            } catch (e) {
                console.error('Error calculating ally commission:', e);
            }
        }

        // 🔒 FASE 3 — Camino web directo (cliente final, sin aliado): recálculo autoritativo
        // de los 4 componentes de precio desde la BD. El front ya no se confía para fijar el
        // precio. `precioManual` (override de admin) y las reservas de aliado quedan exentas.
        if (!esPorPersona && !body.esReservaAliado && !body.precioManual) {
            let municipioConfigRecargo = 0;
            if (body.municipioConfigId) {
                const mc = await prisma.municipioConfig.findUnique({
                    where: { id: body.municipioConfigId },
                    select: { recargo: true },
                });
                municipioConfigRecargo = mc ? Number(mc.recargo) : 0;
            }
            const comp = recalcularPrecioWebDirecto({
                servicio: servicio as any,
                vehiculoId: body.vehiculoId ?? null,
                numeroPasajeros: parseInt(body.numeroPasajeros) || 0,
                cantidadHoras: body.cantidadHoras != null ? Number(body.cantidadHoras) : null,
                hora: body.hora || '',
                datosDinamicos: (body.datosDinamicos ?? {}) as any,
                aeropuertoNombre:
                    body.aeropuertoNombre === 'JOSE_MARIA_CORDOVA' || body.aeropuertoNombre === 'OLAYA_HERRERA'
                        ? body.aeropuertoNombre
                        : null,
                municipio: body.municipio ?? null,
                municipioConfigId: body.municipioConfigId ?? null,
                municipioConfigRecargo,
            });
            // Observabilidad: si lo recalculado difiere de lo enviado por el front, dejar
            // rastro (no bloquea). Útil para detectar manipulación o gaps de paridad.
            const enviado = (parseFloat(body.precioBase) || 0) + (parseFloat(body.precioAdicionales) || 0)
                + (parseFloat(body.recargoNocturno) || 0)
                + ((parseFloat(body.tarifaMunicipio) || 0) + (parseFloat(body.tarifaMunicipioConfig) || 0));
            const recalc = comp.precioBase + comp.precioAdicionales + comp.recargoNocturno + comp.tarifaMunicipio;
            if (Math.abs(enviado - recalc) > 1) {
                console.warn(`[reservas] precio recalculado difiere del enviado: front=${enviado} server=${recalc} servicio=${body.servicioId}`);
            }
            precioBase = comp.precioBase;
            precioAdicionales = comp.precioAdicionales;
            recargoNocturno = comp.recargoNocturno;
            tarifaMunicipio = comp.tarifaMunicipio;
        }

        const subtotal = precioBase + precioAdicionales + recargoNocturno + tarifaMunicipio - descuentoAliado;

        // Subtotal final incluye comisión de aliado (el cliente la paga)
        const subtotalTotal = subtotal + comisionAliado;

        // Comisión de Bold (6%) sobre el total con comisión incluida
        let comisionBold = 0;
        if (metodoPago === 'TARJETA') {
            comisionBold = calculateBoldCommission(subtotalTotal);
        }

        const precioTotal = subtotalTotal + comisionBold;

        // Determinar estado inicial
        let estadoInicial: EstadoReserva;
        let estadoPago: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'PROCESANDO' | null = null;

        const clientePagaFlag = body.clientePaga !== undefined ? body.clientePaga : true;

        if (!clientePagaFlag) {
            // Sin cobro al cliente: confirmar de inmediato
            estadoInicial = EstadoReserva.CONFIRMED_UNASSIGNED;
            estadoPago = null;
        } else if (body.municipio === 'OTRO' && !body.municipioConfigId) {
            // Municipio desconocido sin config: requiere cotización manual
            estadoInicial = EstadoReserva.CONFIRMED_UNASSIGNED;
            estadoPago = null;
        } else if (metodoPago === 'EFECTIVO') {
            // Pago en efectivo (NON-Tour Compartido) va directo a confirmada sin asignar
            estadoInicial = EstadoReserva.CONFIRMED_UNASSIGNED;
            estadoPago = null;
        } else {
            // Pago con Bold: pendiente de pago
            estadoInicial = EstadoReserva.PENDING_PAYMENT;
            estadoPago = 'PENDIENTE';
        }

        // Crear reserva con asistentes
        const datosReserva = buildDatosFromBody(body);

        // WR-01: retry on P2002 unique constraint violation (race condition in code generation)
        let reserva!: Prisma.ReservaGetPayload<{
            include: {
                servicio: true;
                aliado: true;
                asistentes: true;
                vehiculo: true;
            };
        }>;
        {
            let retries = 3;
            let codigoActual = codigo;
            while (true) {
                try {
                    reserva = await prisma.reserva.create({
                        data: {
                            codigo: codigoActual,
                            servicioId: body.servicioId,
                            fecha: new Date(body.fecha + 'T12:00:00.000Z'),
                            hora: body.hora || (esPorPersona ? '08:00' : body.hora),
                            nombreCliente: body.nombreCliente,
                            whatsappCliente: body.whatsappCliente,
                            emailCliente: body.emailCliente,
                            idioma: body.idioma || 'ES',
                            municipio: esPorPersona ? null : (body.municipio || null),
                            otroMunicipio: body.otroMunicipio || null,
                            aeropuertoNombre:
                                body.aeropuertoNombre === 'JOSE_MARIA_CORDOVA' || body.aeropuertoNombre === 'OLAYA_HERRERA'
                                    ? body.aeropuertoNombre
                                    : null,
                            numeroPasajeros: parseInt(body.numeroPasajeros),
                            vehiculoId: esPorPersona ? null : (body.vehiculoId || null),

                            // Snapshot de categoría/modelo del servicio (aditivo)
                            categoriaServicio: categoriaServicioSnapshot,
                            modeloPrecio: modeloPrecioSnapshot,

                            // Datos específicos del servicio (unificados en JSON)
                            datos: datosReserva as any,

                            // Precios
                            precioBase,
                            precioAdicionales,
                            recargoNocturno,
                            tarifaMunicipio,
                            descuentoAliado,
                            precioTotal,
                            comisionBold,
                            comisionAliado,

                            estado: estadoInicial,
                            estadoPago: estadoPago,

                            // Método de Pago
                            metodoPago: metodoPago,

                            // Municipio dinámico (MunicipioConfig)
                            municipioConfigId: body.municipioConfigId || null,

                            // Aliado
                            aliadoId: body.aliadoId || null,
                            esReservaAliado: body.esReservaAliado || false,
                            origen: body.origen || 'web_directa',

                            notas: body.notas || null,

                            // Crear asistentes
                            asistentes: body.asistentes && body.asistentes.length > 0 ? {
                                create: body.asistentes.map((a: any) => ({
                                    nombre: a.nombre,
                                    tipoDocumento: a.tipoDocumento,
                                    numeroDocumento: a.numeroDocumento,
                                    email: a.email,
                                    telefono: a.telefono,
                                }))
                            } : undefined,
                        },
                        include: {
                            servicio: true,
                            aliado: true,
                            asistentes: true,
                            vehiculo: true,
                        },
                    });
                    break; // success
                } catch (e: any) {
                    if (e?.code === 'P2002' && retries > 1) {
                        retries--;
                        // Generate a fresh code and retry
                        codigoActual = await generateUniqueCodigo();
                        continue;
                    }
                    throw e;
                }
            }
        }

        // 📅 Calendar: BLOQUEANTE para que el evento aparezca inmediatamente
        const isExternalReservation = !body.esReservaAliado && !body.aliadoId;
        try {
            const calendarStart = Date.now();
            if (reserva.servicio.esCompartido) {
                const { createOrUpdateTourCompartidoEvent } = await import('@/lib/google-calendar-service');
                const eventId = await createOrUpdateTourCompartidoEvent(reserva as any);
                if (eventId) {
                    await prisma.reserva.update({
                        where: { id: reserva.id },
                        data: { googleCalendarEventId: eventId }
                    });
                    console.log('✅ [Tour Compartido] Calendar event created/updated:', eventId);
                }
            } else {
                const { createCalendarEvent } = await import('@/lib/google-calendar-service');
                const eventId = await createCalendarEvent(reserva as any);
                if (eventId) {
                    await prisma.reserva.update({
                        where: { id: reserva.id },
                        data: { googleCalendarEventId: eventId }
                    });
                    console.log('✅ [Reserva] Google Calendar event created:', eventId);
                }
            }
            console.log(`✅ [Reserva] Calendar flow completed in ${Date.now() - calendarStart}ms`);
        } catch (calendarError) {
            console.error('❌ [Reserva] Calendar error (non-blocking):', calendarError);
        }

        // 📧 Email: BLOQUEANTE para que se envíe antes de retornar la respuesta
        // (En Vercel serverless, los fire-and-forget se cancelan al enviar la respuesta)
        try {
            const emailStart = Date.now();
            const { sendReservaConfirmadaEmail, sendTourCompartidoConfirmationEmail } = await import('@/lib/email-service');

            if (reserva.servicio.esCompartido) {
                await sendTourCompartidoConfirmationEmail(reserva as any, body.idioma || 'ES');
            } else if (!isExternalReservation) {
                // Reserva de aliado: enviar email al cliente y al aliado
                const aliadoEmail = reserva.aliado?.email || null;
                await sendReservaConfirmadaEmail(reserva as any, body.idioma || 'ES', aliadoEmail);
            } else if (metodoPago === 'EFECTIVO') {
                // Reserva externa con pago en efectivo: enviar confirmación inmediatamente
                await sendReservaConfirmadaEmail(reserva as any, body.idioma || 'ES', null);
            } else {
                // Reserva externa con Bold: enviar email de pendiente de pago inmediatamente
                const { sendPendientePagoEmail } = await import('@/lib/email-service');
                await sendPendientePagoEmail(reserva as any, body.idioma || 'ES');
            }
            console.log(`✅ [Reserva] Email flow completed in ${Date.now() - emailStart}ms`);
        } catch (emailError) {
            console.error('❌ [Reserva] Email error:', emailError);
        }

        console.log(`✅ [Reserva] POST responded in ${Date.now() - requestStart}ms`);

        return NextResponse.json(
            {
                data: reserva,
                message: 'Reserva creada exitosamente'
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating reserva:', error);
        return NextResponse.json(
            { error: 'Error al crear reserva' },
            { status: 500 }
        );
    }
}

/**
 * Genera un código único de 8 caracteres alfanuméricos.
 * IN-03: uses crypto.randomInt for cryptographically secure randomness.
 */
async function generateUniqueCodigo(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars
    let codigo: string;
    let exists = true;

    while (exists) {
        codigo = '';
        for (let i = 0; i < 8; i++) {
            // IN-03: crypto.randomInt replaces Math.random()
            codigo += chars.charAt(crypto.randomInt(0, chars.length));
        }

        // Verificar si ya existe
        const existing = await prisma.reserva.findUnique({
            where: { codigo },
        });

        exists = !!existing;
    }

    return codigo!;
}
