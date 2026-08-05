import crypto from 'crypto';
import {
    AeropuertoNombre,
    EstadoPago,
    EstadoReserva,
    Idioma,
    MetodoPago,
    Prisma,
    Socio,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { categoriaDeServicio, modeloPrecioDeServicio } from '@/lib/servicio-categoria';
import { buildDatosFromBody } from '@/types/reserva-datos';
import { badRequest } from './errors';
import {
    cargarServicioCotizable,
    cotizarServicio,
    parseAeropuerto,
    parseDatosDinamicos,
    parseEnteroPositivo,
    parseFecha,
    parseHora,
    type Cotizacion,
} from './cotizar';

/**
 * Creación de reservas para socios de API (`/api/socios/*`).
 *
 * El socio cobra al huésped en su propia plataforma y nos envía la reserva ya pagada,
 * por eso entra como `clientePaga: false` y `estadoPago: APROBADO`. La liquidación entre
 * el socio y TMT se hace por fuera, filtrando por `Reserva.origen = 'socio:<codigo>'`.
 *
 * El precio SIEMPRE se recalcula aquí desde la base de datos: nunca se acepta un precio
 * enviado por el socio.
 */

const RESERVA_INCLUDE = {
    servicio: true,
    vehiculo: true,
    conductor: true,
} satisfies Prisma.ReservaInclude;

export type ReservaSocio = Prisma.ReservaGetPayload<{ include: typeof RESERVA_INCLUDE }>;

export interface CrearReservaInput {
    refExterna: string;
    servicioId: string;
    numeroPasajeros: number;
    fecha: string;
    hora: string;
    aeropuertoNombre?: string | null;
    aeropuertoTipo?: string | null;
    lugarRecogida?: string | null;
    numeroVuelo?: string | null;
    nombreCliente: string;
    whatsappCliente: string;
    emailCliente: string;
    idioma?: string | null;
    notas?: string | null;
    datosDinamicos?: unknown;
}

export interface ResultadoCreacion {
    reserva: ReservaSocio;
    cotizacion: Cotizacion | null;
    /** true si la refExterna ya existía: se devuelve la reserva original sin crear otra. */
    duplicado: boolean;
}

const CAMPOS_REQUERIDOS = [
    'refExterna',
    'servicioId',
    'numeroPasajeros',
    'fecha',
    'hora',
    'nombreCliente',
    'whatsappCliente',
    'emailCliente',
] as const;

async function generarCodigoUnico(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres confundibles
    let codigo = '';
    let existe = true;

    while (existe) {
        codigo = '';
        for (let i = 0; i < 8; i++) {
            codigo += chars.charAt(crypto.randomInt(0, chars.length));
        }
        existe = !!(await prisma.reserva.findUnique({ where: { codigo }, select: { id: true } }));
    }

    return codigo;
}

function parseTextoRequerido(valor: unknown, campo: string): string {
    if (typeof valor !== 'string' || valor.trim() === '') {
        badRequest(`${campo} es requerido`);
    }
    return (valor as string).trim();
}

function parseAeropuertoTipo(valor: unknown): 'DESDE' | 'HACIA' {
    if (valor !== 'DESDE' && valor !== 'HACIA') {
        badRequest('aeropuertoTipo debe ser DESDE (del aeropuerto) o HACIA (al aeropuerto)');
    }
    return valor as 'DESDE' | 'HACIA';
}

/**
 * El correo es el único canal por el que el huésped recibe su código de reserva, y un
 * fallo de envío se registra pero no tumba la reserva. Si aceptáramos una dirección mal
 * escrita, la reserva quedaría creada y el huésped nunca se enteraría. Mejor rechazarla
 * y que el socio la corrija antes de cobrarle.
 */
function parseEmail(valor: unknown): string {
    const email = parseTextoRequerido(valor, 'emailCliente');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        badRequest(`emailCliente no es una dirección de correo válida: ${email}`);
    }
    return email.toLowerCase();
}

/**
 * El conductor contacta al huésped por WhatsApp, y el link se arma quitándole todo lo que
 * no sea dígito al número. Sin indicativo de país el link no abre ningún chat, así que se
 * exige formato internacional. Se aceptan espacios, guiones y paréntesis y se normaliza a
 * `+<dígitos>` para que quede uniforme en el admin y en los correos.
 */
function parseWhatsapp(valor: unknown): string {
    const crudo = parseTextoRequerido(valor, 'whatsappCliente');
    // Se permiten separadores de escritura habituales, pero nada más: si llegara texto
    // mezclado con el número, quitarlo en silencio dejaría un teléfono distinto al que
    // el socio quiso mandar y el conductor no podría contactar al huésped.
    const formaValida = /^\+[\d\s()-]+$/.test(crudo);
    const digitos = crudo.replace(/[^\d]/g, '');
    if (!formaValida || digitos.length < 10 || digitos.length > 15) {
        badRequest(
            `whatsappCliente debe ir en formato internacional con indicativo, ej. +573001234567 (recibido: ${crudo})`
        );
    }
    return `+${digitos}`;
}

async function buscarPorRefExterna(socioId: string, refExterna: string): Promise<ReservaSocio | null> {
    const existente = await prisma.socioReserva.findUnique({
        where: { socioId_refExterna: { socioId, refExterna } },
        include: { reserva: { include: RESERVA_INCLUDE } },
    });
    return existente?.reserva ?? null;
}

export async function crearReservaSocio(
    socio: Socio,
    body: CrearReservaInput
): Promise<ResultadoCreacion> {
    const faltantes = CAMPOS_REQUERIDOS.filter((campo) => !body[campo]);
    if (faltantes.length > 0) {
        badRequest(`Campos requeridos: ${faltantes.join(', ')}`);
    }

    const refExterna = parseTextoRequerido(body.refExterna, 'refExterna');

    // Idempotencia: si el socio reintenta con la misma refExterna, devolvemos la reserva
    // que ya creamos en vez de duplicar el traslado.
    const yaExiste = await buscarPorRefExterna(socio.id, refExterna);
    if (yaExiste) {
        return { reserva: yaExiste, cotizacion: null, duplicado: true };
    }

    const servicio = await cargarServicioCotizable(body.servicioId);

    const numeroPasajeros = parseEnteroPositivo(body.numeroPasajeros, 'numeroPasajeros');
    const fecha = parseFecha(body.fecha);
    const hora = parseHora(body.hora);
    const aeropuertoNombre = parseAeropuerto(body.aeropuertoNombre);
    const datosDinamicos = parseDatosDinamicos(body.datosDinamicos);
    const idioma = body.idioma === 'EN' ? Idioma.EN : Idioma.ES;

    // En traslados de aeropuerto, el sentido y la dirección del alojamiento son lo que
    // le dice al conductor a dónde ir: sin eso la reserva no es operable.
    const aeropuertoTipo = servicio.esAeropuerto ? parseAeropuertoTipo(body.aeropuertoTipo) : null;
    const lugarRecogida = servicio.esAeropuerto
        ? parseTextoRequerido(body.lugarRecogida, 'lugarRecogida')
        : typeof body.lugarRecogida === 'string'
          ? body.lugarRecogida.trim() || null
          : null;

    const nombreCliente = parseTextoRequerido(body.nombreCliente, 'nombreCliente');
    const whatsappCliente = parseWhatsapp(body.whatsappCliente);
    const emailCliente = parseEmail(body.emailCliente);

    const cotizacion = cotizarServicio(servicio, {
        servicioId: servicio.id,
        numeroPasajeros,
        hora,
        aeropuertoNombre,
        datosDinamicos,
    });

    const datos = buildDatosFromBody({
        aeropuertoTipo,
        aeropuertoNombre,
        numeroVuelo: body.numeroVuelo,
        lugarRecogida,
        datosDinamicos,
    });

    const codigo = await generarCodigoUnico();

    try {
        const reserva = await prisma.$transaction(async (tx) => {
            const creada = await tx.reserva.create({
                data: {
                    codigo,
                    servicioId: servicio.id,
                    vehiculoId: cotizacion.vehiculo.id,
                    categoriaServicio: categoriaDeServicio(servicio),
                    modeloPrecio: modeloPrecioDeServicio(servicio),
                    fecha,
                    hora,
                    nombreCliente,
                    whatsappCliente,
                    emailCliente,
                    idioma,
                    // Sin zona: los traslados de aeropuerto no cobran tarifa de municipio.
                    municipio: null,
                    otroMunicipio: null,
                    municipioConfigId: null,
                    aeropuertoNombre: aeropuertoNombre as AeropuertoNombre | null,
                    numeroPasajeros,
                    datos: datos as Prisma.InputJsonValue,
                    precioBase: cotizacion.desglose.precioBase,
                    precioAdicionales: cotizacion.desglose.precioAdicionales,
                    recargoNocturno: cotizacion.desglose.recargoNocturno,
                    tarifaMunicipio: cotizacion.desglose.tarifaMunicipio,
                    descuentoAliado: 0,
                    comisionAliado: 0,
                    // El socio cobra por su cuenta: no pasa por Bold, no hay comisión de pasarela.
                    comisionBold: 0,
                    precioTotal: cotizacion.total,
                    estado: EstadoReserva.CONFIRMED_UNASSIGNED,
                    estadoPago: EstadoPago.APROBADO,
                    metodoPago: MetodoPago.EFECTIVO,
                    aliadoId: null,
                    esReservaAliado: false,
                    // El huésped ya le pagó al socio: no se le cobra nada al llegar.
                    clientePaga: false,
                    origen: `socio:${socio.codigo}`,
                    notas: typeof body.notas === 'string' ? body.notas.trim() || null : null,
                },
                include: RESERVA_INCLUDE,
            });

            await tx.socioReserva.create({
                data: {
                    socioId: socio.id,
                    reservaId: creada.id,
                    refExterna,
                    payload: body as unknown as Prisma.InputJsonValue,
                },
            });

            return creada;
        });

        return { reserva, cotizacion, duplicado: false };
    } catch (error) {
        // Carrera: dos requests con la misma refExterna a la vez. El índice único de
        // (socioId, refExterna) aborta la segunda; devolvemos la que sí quedó.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const existente = await buscarPorRefExterna(socio.id, refExterna);
            if (existente) return { reserva: existente, cotizacion: null, duplicado: true };
        }
        throw error;
    }
}

/**
 * Efectos posteriores a la creación: evento de calendario y correo al huésped.
 * Nunca lanzan — una falla de Google o del SMTP no debe tumbar una reserva ya guardada.
 * Se ejecutan dentro del request porque en serverless el fire-and-forget se cancela
 * al enviar la respuesta (mismo criterio que POST /api/reservas).
 */
export async function ejecutarEfectosReserva(reserva: ReservaSocio): Promise<void> {
    try {
        const { createCalendarEvent } = await import('@/lib/google-calendar-service');
        const eventId = await createCalendarEvent(reserva as any);
        if (eventId) {
            await prisma.reserva.update({
                where: { id: reserva.id },
                data: { googleCalendarEventId: eventId },
            });
        }
    } catch (error) {
        console.error('[socios] Error creando evento de calendario (no bloqueante):', error);
    }

    try {
        const { sendReservaConfirmadaEmail } = await import('@/lib/email-service');
        await sendReservaConfirmadaEmail(reserva as any, reserva.idioma, null);
    } catch (error) {
        console.error('[socios] Error enviando correo de confirmación (no bloqueante):', error);
    }
}

/** Respuesta pública de una reserva creada por un socio. */
export function formatReservaSocio(reserva: ReservaSocio) {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com').replace(/\/$/, '');
    return {
        codigo: reserva.codigo,
        estado: reserva.estado,
        fecha: reserva.fecha.toISOString().slice(0, 10),
        hora: reserva.hora,
        numeroPasajeros: reserva.numeroPasajeros,
        vehiculo: reserva.vehiculo?.nombre ?? null,
        total: Number(reserva.precioTotal),
        moneda: 'COP' as const,
        tracking: `${appUrl}/tracking/${reserva.codigo}`,
    };
}
