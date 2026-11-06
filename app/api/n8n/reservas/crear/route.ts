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
import crypto from 'crypto';

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

        const missing = ['nombreCliente', 'whatsappCliente', 'emailCliente', 'fecha', 'numeroPasajeros']
            .filter((k) => !body[k]);
        if (!servicioTipo && !servicioId) missing.push('servicioTipo o servicioId');
        if (missing.length > 0) {
            return fail(`Campos requeridos: ${missing.join(', ')}`);
        }

        if (!Number.isInteger(numeroPasajeros) || numeroPasajeros < 1) {
            return fail('numeroPasajeros debe ser un número entero mayor a 0');
        }

        if (typeof emailCliente !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCliente)) {
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

        const subtotal = precioBase + precioAdicionales + recargoNocturno + tarifaMunicipio;
        if (!Number.isFinite(subtotal) || subtotal <= 0) {
            return fail('El servicio no tiene precio configurado para estos datos', 400, { status: 'sin_precio' });
        }
        const comisionBold = calculateBoldCommission(subtotal);
        const precioTotal = subtotal + comisionBold;

        const datos = buildDatosFromBody({
            ...body,
            aeropuertoNombre: aeropuerto ?? undefined,
            cantidadHoras: cantidadHoras ?? undefined,
            datosDinamicos,
        });

        const codigo = await generateUniqueCodigo();

        await prisma.reserva.create({
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
                notas: typeof notas === 'string' && notas.trim() ? notas.trim() : null,
                precioBase,
                precioAdicionales,
                recargoNocturno,
                tarifaMunicipio,
                descuentoAliado: 0,
                comisionBold,
                comisionAliado: 0,
                precioTotal,
                estado: EstadoReserva.PENDING_PAYMENT,
                estadoPago: EstadoPago.PENDIENTE,
                metodoPago: 'TARJETA',
                origen: 'whatsapp_bot',
                clientePaga: true,
                esReservaAliado: false,
            },
        });

        const nombreServicio =
            (servicio.nombre as { es: string; en: string })[idioma === 'EN' ? 'en' : 'es'];

        return NextResponse.json({
            success: true,
            status: 'ok',
            codigo,
            url: `${appUrl()}/reservas/confirmar/${codigo}`,
            servicio: nombreServicio,
            vehiculo: vehiculoNombre,
            fecha: fechaSolo,
            hora,
            numeroPasajeros,
            desglose: {
                precioBase,
                adicionales: precioAdicionales,
                recargoNocturno,
                recargoMunicipio: tarifaMunicipio,
                subtotal,
                comisionTarjeta: comisionBold,
            },
            totalTarjeta: precioTotal,
            totalEfectivo: subtotal,
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
