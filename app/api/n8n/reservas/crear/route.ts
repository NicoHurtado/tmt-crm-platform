// app/api/n8n/reservas/crear/route.ts
//
// Crea una COTIZACIÓN-RESERVA desde el agente de WhatsApp (n8n).
// La reserva queda en PENDING_PAYMENT y se devuelve el enlace a
// /reservas/confirmar/{codigo}, donde el viajero ve el formulario ya lleno y paga con Bold.
//
// El precio se calcula EXACTAMENTE igual que el formulario web directo (cliente final,
// sin aliado): tours por persona con `totalPorPersona`; el resto con
// `recalcularPrecioWebDirecto` (Olaya Herrera, por horas, compartido, adicionales,
// recargo nocturno y recargo de municipio vía MunicipioConfig).
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkApiKey, unauthorized } from '../../_auth';
import { recalcularPrecioWebDirecto } from '@/lib/priceCalculator';
import { categoriaDeServicio, modeloPrecioDeServicio } from '@/lib/servicio-categoria';
import { calculateBoldCommission } from '@/lib/bold';
import { getConfiguracion, totalPorPersona } from '@/types/servicio-config';
import { buildDatosFromBody } from '@/types/reserva-datos';
import { TipoServicio, Municipio, EstadoReserva, EstadoPago } from '@prisma/client';
import { calcularAnticipo } from '@/lib/anticipo';
import crypto from 'crypto';

/** Silla para niños: valor fijo por silla y por día (documento comercial, 10/11/2026). */
const VALOR_SILLA_NINO = 70_000;
/** Descuento autorizado: 10 % sobre los dos trayectos de aeropuerto, solo si el viajero lo pide. */
const DESCUENTO_IDA_REGRESO = 0.10;
type FormaPago = 'BOLD' | 'EFECTIVO' | 'TRANSFERENCIA';

export const dynamic = 'force-dynamic';

const MUNICIPIOS_BASE: Municipio[] = ['MEDELLIN', 'POBLADO', 'LAURELES', 'SABANETA', 'BELLO', 'ITAGUI', 'ENVIGADO'];
const AEROPUERTOS = ['JOSE_MARIA_CORDOVA', 'OLAYA_HERRERA'] as const;

async function generateUniqueCodigo(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo: string;
    let exists = true;
    do {
        codigo = '';
        for (let i = 0; i < 8; i++) {
            codigo += chars.charAt(crypto.randomInt(0, chars.length));
        }
        const existing = await prisma.reserva.findUnique({ where: { codigo } });
        exists = !!existing;
    } while (exists);
    return codigo!;
}

function fail(error: string, status = 400, extra: Record<string, unknown> = {}) {
    return NextResponse.json({ success: false, error, ...extra }, { status });
}

/** Normaliza texto para comparar nombres de municipio ("Rionegro" == "rionegro " == "Ríonegro"). */
function norm(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/** Fecha de hoy en Colombia (UTC-5, sin horario de verano), formato YYYY-MM-DD. */
function hoyBogota(): string {
    return new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
    if (!checkApiKey(request)) return unauthorized();

    try {
        const body = await request.json();
        const {
            nombreCliente,
            whatsappCliente,
            servicioTipo,
            servicioId,
            fecha,
            idioma = 'ES',
            aeropuertoNombre,
            aeropuertoTipo,
            municipio,
            municipioNombre,
            notas,
        } = body;
        const emailCliente = typeof body.emailCliente === 'string' ? body.emailCliente.trim().toLowerCase() : body.emailCliente;
        const numeroPasajeros = Number(body.numeroPasajeros);
        const datosDinamicos: Record<string, unknown> =
            body.datosDinamicos && typeof body.datosDinamicos === 'object' ? body.datosDinamicos : {};
        const cantidadHorasRaw = body.cantidadHoras ?? datosDinamicos.cantidadHoras;
        const cantidadHoras = cantidadHorasRaw != null && cantidadHorasRaw !== '' ? Number(cantidadHorasRaw) : undefined;
        // soloConsultar: calcula el valor sin crear la reserva (el agente lo usa antes del resumen).
        const soloConsultar = body.soloConsultar === true || body.soloConsultar === 'true';
        const formaPago: FormaPago = (['EFECTIVO', 'TRANSFERENCIA'] as const).includes(String(body.formaPago || '').toUpperCase() as any)
            ? (String(body.formaPago).toUpperCase() as FormaPago) : 'BOLD';
        const sillasNinos = Math.max(0, Math.min(10, Math.floor(Number(body.sillasNinos) || 0)));
        const descuentoIdaRegreso = body.descuentoIdaRegreso === true || body.descuentoIdaRegreso === 'true';
        const documento = typeof body.documento === 'string' ? body.documento.trim().slice(0, 40) : '';
        const factura = typeof body.factura === 'string' ? body.factura.trim().slice(0, 300) : '';

        const requeridos = soloConsultar
            ? ['fecha', 'numeroPasajeros']
            : ['nombreCliente', 'whatsappCliente', 'emailCliente', 'fecha', 'numeroPasajeros'];
        const missing = requeridos.filter((k) => !body[k]);
        if (!servicioTipo && !servicioId) missing.push('servicioTipo o servicioId');
        if (missing.length > 0) {
            return fail(`Campos requeridos: ${missing.join(', ')}`);
        }

        if (!Number.isInteger(numeroPasajeros) || numeroPasajeros < 1) {
            return fail('numeroPasajeros debe ser un número entero mayor a 0');
        }

        if (!soloConsultar && (typeof emailCliente !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCliente))) {
            return fail('emailCliente inválido');
        }

        // La fecha debe llegar como YYYY-MM-DD. Se almacena al mediodía UTC
        // (T12:00:00.000Z) para que el día calendario sea idéntico en UTC y en
        // America/Bogota (UTC-5) y no se desplace en el calendario ni en los correos.
        const fechaSolo = typeof fecha === 'string' ? fecha.slice(0, 10) : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaSolo)) {
            return fail('Fecha inválida. Use formato YYYY-MM-DD');
        }
        const fechaDate = new Date(fechaSolo + 'T12:00:00.000Z');
        if (isNaN(fechaDate.getTime())) {
            return fail('Fecha inválida. Use formato YYYY-MM-DD');
        }
        if (fechaSolo < hoyBogota()) {
            return fail('La fecha ya pasó', 400, { status: 'fecha_pasada' });
        }

        const servicio = await prisma.servicio.findFirst({
            where: servicioId
                ? { id: servicioId, activo: true }
                : { tipoServicio: servicioTipo as TipoServicio, activo: true },
            include: {
                vehiculosPermitidos: {
                    include: { vehiculo: true },
                },
            },
        });

        if (!servicio) {
            return fail('Servicio no disponible', 400, { status: 'servicio_no_encontrado' });
        }

        if ((servicio as any).esMunicipal) {
            return fail(
                'Los traslados municipales se cotizan desde el formulario web',
                400,
                { status: 'municipal', linkReserva: `${appUrl()}/reservas/transporte-municipal` }
            );
        }

        const cfg = getConfiguracion((servicio as any).configuracion);
        const esPorPersona = cfg.tipoTarifa === 'POR_PERSONA';

        // Hora: obligatoria salvo en tours por persona (el formulario web usa 08:00 por defecto).
        const hora: string = typeof body.hora === 'string' && body.hora ? body.hora : (esPorPersona ? '08:00' : '');
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
            return fail('Hora inválida. Use formato HH:MM (24 horas)');
        }

        // Aeropuerto
        const aeropuerto = AEROPUERTOS.includes(aeropuertoNombre) ? (aeropuertoNombre as (typeof AEROPUERTOS)[number]) : null;
        if (servicio.esAeropuerto) {
            if (!aeropuerto) {
                return fail('aeropuertoNombre requerido: JOSE_MARIA_CORDOVA u OLAYA_HERRERA', 400, { status: 'falta_aeropuerto' });
            }
            if (aeropuertoTipo !== 'DESDE' && aeropuertoTipo !== 'HACIA') {
                return fail('aeropuertoTipo requerido: DESDE (llegada, recoger en el aeropuerto) o HACIA (salida, llevar al aeropuerto)', 400, { status: 'falta_aeropuerto_tipo' });
            }
        }

        // Por horas: mínimo 4 horas, igual que la web.
        if (servicio.esPorHoras) {
            if (!cantidadHoras || !Number.isInteger(cantidadHoras) || cantidadHoras < 4) {
                return fail('cantidadHoras requerido (entero, mínimo 4)', 400, { status: 'falta_horas' });
            }
        }

        // Municipio / zona de recogida → recargo vía MunicipioConfig (igual que el wizard).
        let municipioFinal: Municipio | null = null;
        let municipioConfigId: string | null = null;
        let municipioConfigRecargo = 0;
        let otroMunicipio: string | null = null;
        if (!esPorPersona && !servicio.esCompartido) {
            if (municipio && MUNICIPIOS_BASE.includes(municipio as Municipio)) {
                municipioFinal = municipio as Municipio;
            } else if (typeof municipioNombre === 'string' && municipioNombre.trim()) {
                const configs = await prisma.municipioConfig.findMany({
                    where: { activo: true },
                    select: { id: true, nombreES: true, nombreEN: true, recargo: true },
                });
                const buscado = norm(municipioNombre);
                const mc = configs.find((c) => norm(c.nombreES) === buscado || norm(c.nombreEN) === buscado);
                if (!mc) {
                    return fail(
                        `El municipio "${municipioNombre}" no tiene tarifa configurada`,
                        400,
                        { status: 'municipio_no_configurado' }
                    );
                }
                municipioFinal = 'OTRO';
                municipioConfigId = mc.id;
                municipioConfigRecargo = Number(mc.recargo) || 0;
                otroMunicipio = mc.nombreES;
            } else {
                municipioFinal = 'MEDELLIN';
            }
        }

        // Vehículo: el más pequeño cuya capacidad cubre a los pasajeros (igual que el wizard).
        let vehiculoId: string | null = null;
        let vehiculoNombre: string | null = null;
        if (!esPorPersona) {
            const vehiculoEntry = [...servicio.vehiculosPermitidos]
                .sort((a, b) => a.vehiculo.capacidadMaxima - b.vehiculo.capacidadMaxima)
                .find((v) =>
                    v.vehiculo.capacidadMaxima >= numeroPasajeros &&
                    ((v.vehiculo as any).capacidadMinima == null || (v.vehiculo as any).capacidadMinima <= numeroPasajeros)
                ) ?? [...servicio.vehiculosPermitidos]
                .sort((a, b) => a.vehiculo.capacidadMaxima - b.vehiculo.capacidadMaxima)
                .find((v) => v.vehiculo.capacidadMaxima >= numeroPasajeros);
            if (!vehiculoEntry) {
                return fail(`No hay vehículo disponible para ${numeroPasajeros} pasajeros`, 400, { status: 'sin_vehiculo' });
            }
            vehiculoId = vehiculoEntry.vehiculoId;
            vehiculoNombre = vehiculoEntry.vehiculo.nombre;
        }

        // Precio — misma lógica que POST /api/reservas (web directo, sin aliado).
        let precioBase = 0;
        let precioAdicionales = 0;
        let recargoNocturno = 0;
        let tarifaMunicipio = 0;
        if (esPorPersona) {
            precioBase = totalPorPersona(cfg.preciosPorPersona, numeroPasajeros);
        } else {
            const comp = recalcularPrecioWebDirecto({
                servicio: servicio as any,
                vehiculoId,
                numeroPasajeros,
                cantidadHoras: cantidadHoras ?? null,
                hora,
                datosDinamicos: datosDinamicos as any,
                aeropuertoNombre: aeropuerto,
                municipio: municipioFinal,
                municipioConfigId,
                municipioConfigRecargo,
            });
            precioBase = comp.precioBase;
            precioAdicionales = comp.precioAdicionales;
            recargoNocturno = comp.recargoNocturno;
            tarifaMunicipio = comp.tarifaMunicipio;
        }

        precioAdicionales += sillasNinos * VALOR_SILLA_NINO;
        const bruto = precioBase + precioAdicionales + recargoNocturno + tarifaMunicipio;
        if (!Number.isFinite(bruto) || bruto <= 0) {
            return fail('El servicio no tiene precio configurado para estos datos', 400, { status: 'sin_precio' });
        }
        if (descuentoIdaRegreso && !servicio.esAeropuerto) {
            return fail('El descuento de ida y regreso solo aplica a traslados de aeropuerto', 400, { status: 'descuento_no_aplica' });
        }
        const descuento = descuentoIdaRegreso ? Math.round(bruto * DESCUENTO_IDA_REGRESO) : 0;
        const subtotal = bruto - descuento;
        // Bold cobra montos enteros en COP: se redondea la comisión para que el total sea entero.
        // El recargo del 6 % solo aplica al pago con tarjeta (Bold); en efectivo o transferencia no.
        const comisionTarjeta = Math.round(calculateBoldCommission(subtotal));
        const totalTarjeta = subtotal + comisionTarjeta;
        const anticipo = calcularAnticipo(totalTarjeta, comisionTarjeta);
        const comisionBold = formaPago === 'BOLD' ? comisionTarjeta : 0;
        const precioTotal = subtotal + comisionBold;

        const nombreServicio =
            (servicio.nombre as { es: string; en: string })[idioma === 'EN' ? 'en' : 'es'];
        const valores = {
            servicio: nombreServicio,
            vehiculo: vehiculoNombre,
            fecha: fechaSolo,
            hora,
            numeroPasajeros,
            desglose: {
                precioBase,
                adicionales: precioAdicionales,
                sillasNinos: sillasNinos * VALOR_SILLA_NINO,
                recargoNocturno,
                recargoMunicipio: tarifaMunicipio,
                descuentoIdaRegreso: descuento,
                subtotal,
                comisionTarjeta,
            },
            // Total pagando en efectivo o por transferencia (sin recargo del 6 %).
            totalEfectivo: subtotal,
            // Total pagando con tarjeta por Bold (con recargo del 6 %).
            totalTarjeta,
            // Anticipo del 30 % por Bold (incluye el 6 % sobre lo que paga) y saldo al llegar.
            anticipoBold: anticipo.anticipoCobro,
            saldoAlLlegar: anticipo.saldo,
        };
        if (soloConsultar) {
            return NextResponse.json({ success: true, status: 'ok', consulta: true, ...valores });
        }

        const lineasNotas = [
            typeof notas === 'string' && notas.trim() ? notas.trim() : '',
            documento ? `Documento: ${documento}` : '',
            factura ? `Factura electrónica: ${factura}` : '',
            sillasNinos ? `Sillas para niños: ${sillasNinos}` : '',
            descuento ? `Descuento 10 % ida y regreso aeropuerto: -$${descuento.toLocaleString('es-CO')}` : '',
            formaPago === 'EFECTIVO' ? `💵 PAGO EN EFECTIVO el día del servicio: $${subtotal.toLocaleString('es-CO')}` : '',
            formaPago === 'TRANSFERENCIA' ? `🏦 TRANSFERENCIA POR VERIFICAR: $${subtotal.toLocaleString('es-CO')} (Bre-B o Bancolombia). Confirmar la reserva cuando llegue el comprobante.` : '',
        ].filter(Boolean);

        const datos: Record<string, unknown> = buildDatosFromBody({
            ...body,
            aeropuertoNombre: aeropuerto ?? undefined,
            cantidadHoras: cantidadHoras ?? undefined,
            datosDinamicos,
        });
        if (documento) datos.documentoCliente = documento;
        if (factura) datos.facturaElectronica = factura;
        if (sillasNinos) datos.sillasNinos = sillasNinos;
        datos.formaPago = formaPago;
        if (formaPago === 'TRANSFERENCIA') datos.pago = { modalidad: 'TRANSFERENCIA_POR_VERIFICAR', montoPagado: null, saldoPorCobrar: subtotal };
        if (formaPago === 'EFECTIVO') datos.pago = { modalidad: 'EFECTIVO_DIA_SERVICIO', montoPagado: 0, saldoPorCobrar: subtotal };

        const codigo = await generateUniqueCodigo();

        const reservaCreada = await prisma.reserva.create({
            data: {
                codigo,
                nombreCliente: String(nombreCliente).trim(),
                whatsappCliente: String(whatsappCliente).trim(),
                emailCliente,
                servicioId: servicio.id,
                vehiculoId,
                categoriaServicio: categoriaDeServicio(servicio as any),
                modeloPrecio: modeloPrecioDeServicio(servicio as any),
                fecha: fechaDate,
                hora,
                numeroPasajeros,
                idioma: idioma === 'EN' ? 'EN' : 'ES',
                municipio: municipioFinal,
                otroMunicipio,
                municipioConfigId,
                aeropuertoNombre: aeropuerto,
                datos: datos as any,
                notas: lineasNotas.length ? lineasNotas.join('\n') : null,
                precioBase,
                precioAdicionales,
                recargoNocturno,
                tarifaMunicipio,
                descuentoAliado: descuento,
                comisionBold,
                comisionAliado: 0,
                precioTotal,
                // Efectivo: confirmada de una vez, como en el formulario web. Bold y transferencia:
                // pendiente hasta que Bold apruebe o el equipo verifique el comprobante.
                estado: formaPago === 'EFECTIVO' ? EstadoReserva.CONFIRMED_UNASSIGNED : EstadoReserva.PENDING_PAYMENT,
                estadoPago: formaPago === 'EFECTIVO' ? null : EstadoPago.PENDIENTE,
                metodoPago: formaPago === 'BOLD' ? 'TARJETA' : 'EFECTIVO',
                origen: 'whatsapp_bot',
                clientePaga: true,
                esReservaAliado: false,
            },
            include: { servicio: true, vehiculo: true, conductor: true, aliado: true, asistentes: true },
        });

        // Mismo correo que envía el formulario web al crear una reserva con pago en Bold
        // ("Reserva recibida"), con copia a la empresa: así el equipo se entera de que la
        // reserva quedó en la plataforma. Bloqueante, como en /api/reservas (en Vercel los
        // envíos en segundo plano se cortan al responder); un fallo de correo no rompe la reserva.
        try {
            const emailLang = idioma === 'EN' ? 'EN' : 'ES';
            if (formaPago === 'EFECTIVO') {
                // Igual que el formulario web con pago en efectivo: confirmación y evento de calendario.
                const { sendReservaConfirmadaEmail } = await import('@/lib/email-service');
                await sendReservaConfirmadaEmail(reservaCreada as any, emailLang, null);
                try {
                    const { createCalendarEvent } = await import('@/lib/google-calendar-service');
                    const eventId = await createCalendarEvent(reservaCreada as any);
                    if (eventId) await prisma.reserva.update({ where: { id: reservaCreada.id }, data: { googleCalendarEventId: eventId } });
                } catch (calendarError) {
                    console.error('[n8n crear reserva] Error de calendario:', calendarError);
                }
            } else {
                const { sendPendientePagoEmail } = await import('@/lib/email-service');
                await sendPendientePagoEmail(reservaCreada as any, emailLang);
            }
        } catch (emailError) {
            console.error('[n8n crear reserva] Error enviando correo:', emailError);
        }

        return NextResponse.json({
            success: true,
            status: 'ok',
            codigo,
            formaPago,
            estadoReserva: formaPago === 'EFECTIVO' ? 'CONFIRMADA' : 'PENDIENTE_DE_PAGO',
            url: `${appUrl()}/reservas/confirmar/${codigo}`,
            ...valores,
            // Compatibilidad con el bot anterior
            precioEstimado: precioTotal,
        });
    } catch (error) {
        console.error('[n8n crear reserva]', error);
        return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
    }
}

function appUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';
}
