import crypto from 'crypto';
import {
    EstadoPago,
    EstadoReserva,
    Idioma,
    MetodoPago,
    Municipio,
    Prisma,
    TipoServicio,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateReservationPrice } from '@/lib/priceCalculator';
import { getLocalizedText } from '@/types/multi-language';
import { buildDatosFromBody, getDatos } from '@/types/reserva-datos';
import { validateFieldValues, validateDynamicFieldsSafe } from '@/types/dynamic-fields';
import { getConfiguracion, totalPorPersona } from '@/types/servicio-config';

const RESERVA_INCLUDE = {
    servicio: true,
    vehiculo: true,
    conductor: true,
    asistentes: true,
} satisfies Prisma.ReservaInclude;

type ReservaWithRelations = Prisma.ReservaGetPayload<{ include: typeof RESERVA_INCLUDE }>;

const ESTADOS = new Set(Object.values(EstadoReserva));
const ESTADOS_PAGO = new Set(Object.values(EstadoPago));
const METODOS_PAGO = new Set(Object.values(MetodoPago));
const IDIOMAS = new Set(Object.values(Idioma));
const MUNICIPIOS = new Set(Object.values(Municipio));
const FORBIDDEN_ALIADO_FIELDS = ['aliadoId', 'aliadoCodigo', 'aliadoLinkToken'];

function assertEnum<T extends string>(value: unknown, values: Set<T>, label: string): T {
    if (typeof value !== 'string' || !values.has(value as T)) {
        throw new Error(`${label} inválido: ${String(value)}`);
    }
    return value as T;
}

function assertNoAliadoFields(body: Record<string, unknown>) {
    const forbidden = FORBIDDEN_ALIADO_FIELDS.filter((field) => body[field] !== undefined);
    if (forbidden.length > 0) {
        throw new Error(
            `La API externa solo acepta reservas independientes. Campos no permitidos: ${forbidden.join(', ')}`
        );
    }
}

export function formatExternalReserva(r: ReservaWithRelations) {
    const datos = getDatos(r.datos);
    return {
        id: r.id,
        codigo: r.codigo,
        estado: r.estado,
        estadoPago: r.estadoPago,
        metodoPago: r.metodoPago,
        origen: r.origen,
        fecha: r.fecha,
        hora: r.hora,
        municipio: r.municipio,
        otroMunicipio: r.otroMunicipio,
        municipioConfigId: r.municipioConfigId,
        numeroPasajeros: r.numeroPasajeros,
        idioma: r.idioma,
        clientePaga: r.clientePaga,
        esReservaAliado: false,
        notas: r.notas,
        notasInternas: r.notasInternas,
        datos,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        cliente: {
            nombre: r.nombreCliente,
            whatsapp: r.whatsappCliente,
            email: r.emailCliente,
        },
        servicio: r.servicio
            ? {
                  id: r.servicio.id,
                  tipo: r.servicio.tipoServicio,
                  nombre: getLocalizedText(r.servicio.nombre, 'ES'),
                  nombreEN: getLocalizedText(r.servicio.nombre, 'EN'),
                  esAeropuerto: r.servicio.esAeropuerto,
                  esCompartido: r.servicio.esCompartido,
              }
            : null,
        vehiculo: r.vehiculo
            ? {
                  id: r.vehiculo.id,
                  nombre: r.vehiculo.nombre,
                  capacidadMinima: r.vehiculo.capacidadMinima,
                  capacidadMaxima: r.vehiculo.capacidadMaxima,
              }
            : null,
        conductor: r.conductor
            ? {
                  id: r.conductor.id,
                  nombre: r.conductor.nombre,
                  whatsapp: r.conductor.whatsapp,
                  placa: r.conductor.placa,
              }
            : null,
        precios: {
            precioBase: Number(r.precioBase),
            precioAdicionales: Number(r.precioAdicionales),
            recargoNocturno: Number(r.recargoNocturno),
            tarifaMunicipio: Number(r.tarifaMunicipio),
            comisionBold: Number(r.comisionBold ?? 0),
            precioTotal: Number(r.precioTotal),
            precioOrigen: 'ServicioVehiculo.precio',
            tipoPrecio: 'independiente',
        },
        asistentes: r.asistentes.map((a) => ({
            id: a.id,
            nombre: a.nombre,
            tipoDocumento: a.tipoDocumento,
            numeroDocumento: a.numeroDocumento,
            email: a.email,
            telefono: a.telefono,
        })),
    };
}

async function generateUniqueCodigo(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo = '';
    let exists = true;

    while (exists) {
        codigo = '';
        for (let i = 0; i < 8; i++) {
            codigo += chars.charAt(crypto.randomInt(0, chars.length));
        }
        const existing = await prisma.reserva.findUnique({ where: { codigo } });
        exists = !!existing;
    }

    return codigo;
}

function parseDate(fecha: unknown): Date {
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        throw new Error('fecha debe usar formato YYYY-MM-DD');
    }
    const parsed = new Date(`${fecha}T12:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) throw new Error('fecha inválida');
    return parsed;
}

function parseHora(hora: unknown): string {
    if (typeof hora !== 'string' || !/^\d{2}:\d{2}$/.test(hora)) {
        throw new Error('hora debe usar formato HH:MM');
    }
    return hora;
}

function parsePositiveInt(value: unknown, label: string): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(n) || n < 1) throw new Error(`${label} debe ser entero mayor a 0`);
    return n;
}

async function findServicio(body: any) {
    if (!body.servicioId && !body.servicioTipo) {
        throw new Error('servicioId o servicioTipo es requerido');
    }

    return prisma.servicio.findFirst({
        where: body.servicioId
            ? { id: body.servicioId, activo: true }
            : { tipoServicio: assertEnum(body.servicioTipo, new Set(Object.values(TipoServicio)), 'servicioTipo'), activo: true },
        include: {
            vehiculosPermitidos: {
                where: { vehiculo: { activo: true } },
                include: { vehiculo: true },
            },
        },
    });
}

function selectVehicle(
    servicio: NonNullable<Awaited<ReturnType<typeof findServicio>>>,
    numeroPasajeros: number,
    vehiculoId?: string
) {
    const entries = [...servicio.vehiculosPermitidos].sort(
        (a, b) => a.vehiculo.capacidadMaxima - b.vehiculo.capacidadMaxima
    );
    const selected = vehiculoId
        ? entries.find((v) => v.vehiculoId === vehiculoId)
        : entries.find(
              (v) =>
                  numeroPasajeros >= v.vehiculo.capacidadMinima &&
                  numeroPasajeros <= v.vehiculo.capacidadMaxima
          );

    if (!selected) {
        throw new Error(`No hay vehículo activo disponible para ${numeroPasajeros} pasajeros`);
    }
    if (
        numeroPasajeros < selected.vehiculo.capacidadMinima ||
        numeroPasajeros > selected.vehiculo.capacidadMaxima
    ) {
        throw new Error('vehiculoId no cubre la cantidad de pasajeros');
    }
    return selected;
}

function validateDynamicPayload(servicio: any, datosDinamicos: unknown) {
    const fields = validateDynamicFieldsSafe(getConfiguracion(servicio.configuracion).camposCustom);
    const result = validateFieldValues(datosDinamicos ?? {}, fields);
    if (!result.valid) throw new Error(result.errors.join(', '));
}

async function calculateExternalPrice(input: {
    servicio: NonNullable<Awaited<ReturnType<typeof findServicio>>>;
    vehiculoId: string;
    datosDinamicos: Record<string, unknown>;
    fecha: Date;
    hora: string;
    municipio: Municipio;
    aeropuertoNombre?: 'JOSE_MARIA_CORDOVA' | 'OLAYA_HERRERA' | null;
}) {
    const cantidadHoras =
        typeof input.datosDinamicos?.cantidadHoras === 'number'
            ? input.datosDinamicos.cantidadHoras
            : undefined;
    const breakdown = await calculateReservationPrice(
        input.servicio as any,
        input.vehiculoId,
        input.datosDinamicos as any,
        input.fecha,
        input.hora,
        input.municipio,
        undefined,
        cantidadHoras,
        input.aeropuertoNombre ?? null
    );
    const precioAdicionales = breakdown.camposDinamicos.reduce((sum, c) => sum + c.total, 0);

    return { breakdown, precioAdicionales };
}

export async function createExternalReserva(body: any): Promise<ReservaWithRelations> {
    assertNoAliadoFields(body);

    const required = ['nombreCliente', 'whatsappCliente', 'emailCliente', 'fecha', 'hora', 'numeroPasajeros'];
    const missing = required.filter((field) => !body[field]);
    if (missing.length) throw new Error(`Campos requeridos: ${missing.join(', ')}`);

    const servicio = await findServicio(body);
    if (!servicio) throw new Error('Servicio no disponible');

    const numeroPasajeros = parsePositiveInt(body.numeroPasajeros, 'numeroPasajeros');
    const fecha = parseDate(body.fecha);
    const hora = parseHora(body.hora);
    const idioma = body.idioma === undefined ? Idioma.ES : assertEnum(body.idioma, IDIOMAS, 'idioma');
    const municipio = body.municipio
        ? assertEnum(body.municipio, MUNICIPIOS, 'municipio')
        : Municipio.MEDELLIN;
    const metodoPago =
        body.metodoPago === undefined ? MetodoPago.EFECTIVO : assertEnum(body.metodoPago, METODOS_PAGO, 'metodoPago');
    const estado =
        body.estado === undefined
            ? EstadoReserva.CONFIRMED_UNASSIGNED
            : assertEnum(body.estado, ESTADOS, 'estado');
    const estadoPago =
        body.estadoPago === undefined
            ? estado === EstadoReserva.PENDING_PAYMENT
                ? EstadoPago.PENDIENTE
                : EstadoPago.APROBADO
            : body.estadoPago === null
              ? null
              : assertEnum(body.estadoPago, ESTADOS_PAGO, 'estadoPago');

    const cfg = getConfiguracion(servicio.configuracion);
    const esPorPersona = cfg.tipoTarifa === 'POR_PERSONA';
    const datosReserva = buildDatosFromBody(body);

    let vehiculoId: string | null = null;
    let municipioFinal: Municipio | null = municipio;
    let aeropuertoNombre: 'JOSE_MARIA_CORDOVA' | 'OLAYA_HERRERA' | null = null;
    let precioBase = 0;
    let precioAdicionales = 0;
    let recargoNocturno = 0;
    let tarifaMunicipio = 0;
    let descuentoAliado = 0;
    let precioTotal = 0;

    if (esPorPersona) {
        // Tour por persona: total = precio del tramo (1/2/3+) × nº de personas.
        // Sin vehículo, sin municipio, sin recargos ni adicionales.
        precioBase = totalPorPersona(cfg.preciosPorPersona, numeroPasajeros);
        if (precioBase <= 0) {
            throw new Error('El servicio es por persona pero no tiene precios por persona configurados');
        }
        municipioFinal = null;
        precioTotal = precioBase;
    } else {
        const vehiculoEntry = selectVehicle(servicio, numeroPasajeros, body.vehiculoId);
        vehiculoId = vehiculoEntry.vehiculoId;
        validateDynamicPayload(servicio, datosReserva);
        aeropuertoNombre =
            servicio.esAeropuerto &&
            (body.aeropuertoNombre === 'JOSE_MARIA_CORDOVA' || body.aeropuertoNombre === 'OLAYA_HERRERA')
                ? body.aeropuertoNombre
                : null;
        const calc = await calculateExternalPrice({
            servicio,
            vehiculoId: vehiculoEntry.vehiculoId,
            datosDinamicos: datosReserva,
            fecha,
            hora,
            municipio,
            aeropuertoNombre,
        });
        precioBase = Number(calc.breakdown.precioBase);
        precioAdicionales = calc.precioAdicionales;
        recargoNocturno = Number(calc.breakdown.recargoNocturno);
        tarifaMunicipio = Number(calc.breakdown.tarifaMunicipio);
        descuentoAliado = Number(calc.breakdown.descuentoAliado);
        precioTotal = Number(calc.breakdown.total) - Number(calc.breakdown.comisionAliado);
    }

    const codigo = await generateUniqueCodigo();
    return prisma.reserva.create({
        data: {
            codigo,
            servicioId: servicio.id,
            vehiculoId,
            fecha,
            hora,
            nombreCliente: body.nombreCliente,
            whatsappCliente: body.whatsappCliente,
            emailCliente: body.emailCliente,
            idioma,
            municipio: municipioFinal,
            otroMunicipio: body.otroMunicipio || null,
            municipioConfigId: body.municipioConfigId || null,
            numeroPasajeros,
            aeropuertoNombre,
            datos: datosReserva as any,
            precioBase,
            precioAdicionales,
            recargoNocturno,
            tarifaMunicipio,
            descuentoAliado,
            comisionAliado: 0,
            comisionBold: 0,
            precioTotal,
            estado,
            estadoPago,
            metodoPago,
            aliadoId: null,
            esReservaAliado: false,
            clientePaga: body.clientePaga === undefined ? true : Boolean(body.clientePaga),
            origen: body.origen || 'external_marketing',
            notas: body.notas || null,
            notasInternas: body.notasInternas || null,
            asistentes: Array.isArray(body.asistentes)
                ? {
                      create: body.asistentes.map((a: any) => ({
                          nombre: a.nombre,
                          tipoDocumento: a.tipoDocumento,
                          numeroDocumento: a.numeroDocumento,
                          email: a.email || null,
                          telefono: a.telefono || null,
                      })),
                  }
                : undefined,
        },
        include: RESERVA_INCLUDE,
    });
}

export async function updateExternalReserva(codigo: string, body: any): Promise<ReservaWithRelations> {
    assertNoAliadoFields(body);

    const current = await prisma.reserva.findFirst({
        where: { codigo, esReservaAliado: false },
        include: { ...RESERVA_INCLUDE, servicio: { include: { vehiculosPermitidos: { include: { vehiculo: true } } } } },
    });
    if (!current) throw new Error('Reserva no encontrada');

    const updateData: Prisma.ReservaUpdateInput = {};
    if (body.estado !== undefined) updateData.estado = assertEnum(body.estado, ESTADOS, 'estado');
    if (body.estadoPago !== undefined) {
        updateData.estadoPago = body.estadoPago === null ? null : assertEnum(body.estadoPago, ESTADOS_PAGO, 'estadoPago');
    }
    if (body.metodoPago !== undefined) updateData.metodoPago = assertEnum(body.metodoPago, METODOS_PAGO, 'metodoPago');
    if (body.nombreCliente !== undefined) updateData.nombreCliente = body.nombreCliente;
    if (body.whatsappCliente !== undefined) updateData.whatsappCliente = body.whatsappCliente;
    if (body.emailCliente !== undefined) updateData.emailCliente = body.emailCliente;
    if (body.idioma !== undefined) updateData.idioma = assertEnum(body.idioma, IDIOMAS, 'idioma');
    if (body.fecha !== undefined) updateData.fecha = parseDate(body.fecha);
    if (body.hora !== undefined) updateData.hora = parseHora(body.hora);
    if (body.numeroPasajeros !== undefined) updateData.numeroPasajeros = parsePositiveInt(body.numeroPasajeros, 'numeroPasajeros');
    if (body.municipio !== undefined) updateData.municipio = body.municipio === null ? null : assertEnum(body.municipio, MUNICIPIOS, 'municipio');
    if (body.otroMunicipio !== undefined) updateData.otroMunicipio = body.otroMunicipio || null;
    if (body.municipioConfigId !== undefined) updateData.municipioConfig = body.municipioConfigId ? { connect: { id: body.municipioConfigId } } : { disconnect: true };
    if (body.conductorId !== undefined) updateData.conductor = body.conductorId ? { connect: { id: body.conductorId } } : { disconnect: true };
    if (body.clientePaga !== undefined) updateData.clientePaga = Boolean(body.clientePaga);
    if (body.notas !== undefined) updateData.notas = body.notas || null;
    if (body.notasInternas !== undefined) updateData.notasInternas = body.notasInternas || null;

    const priceRelevant = [
        'servicioId',
        'servicioTipo',
        'vehiculoId',
        'fecha',
        'hora',
        'numeroPasajeros',
        'municipio',
        'datosDinamicos',
    ].some((field) => body[field] !== undefined);

    if (priceRelevant) {
        const mergedBody = {
            servicioId: body.servicioId ?? current.servicioId,
            fecha: body.fecha ?? current.fecha.toISOString().slice(0, 10),
            hora: body.hora ?? current.hora,
            numeroPasajeros: body.numeroPasajeros ?? current.numeroPasajeros,
            municipio: body.municipio ?? current.municipio ?? Municipio.MEDELLIN,
            vehiculoId: body.vehiculoId ?? current.vehiculoId ?? undefined,
            datosDinamicos: {
                ...getDatos(current.datos),
                ...(body.datosDinamicos && typeof body.datosDinamicos === 'object' ? body.datosDinamicos : {}),
            },
        };
        const servicio = await findServicio(mergedBody);
        if (!servicio) throw new Error('Servicio no disponible');
        const numeroPasajeros = parsePositiveInt(mergedBody.numeroPasajeros, 'numeroPasajeros');
        const fecha = parseDate(mergedBody.fecha);
        const hora = parseHora(mergedBody.hora);
        const cfg = getConfiguracion(servicio.configuracion);

        if (cfg.tipoTarifa === 'POR_PERSONA') {
            // Tour por persona: total = precio del tramo × nº de personas. Sin vehículo ni municipio.
            const precioBase = totalPorPersona(cfg.preciosPorPersona, numeroPasajeros);
            if (precioBase <= 0) {
                throw new Error('El servicio es por persona pero no tiene precios por persona configurados');
            }
            updateData.servicio = { connect: { id: servicio.id } };
            updateData.vehiculo = { disconnect: true };
            updateData.fecha = fecha;
            updateData.hora = hora;
            updateData.numeroPasajeros = numeroPasajeros;
            updateData.municipio = null;
            updateData.datos = mergedBody.datosDinamicos as any;
            updateData.esReservaAliado = false;
            updateData.precioBase = precioBase;
            updateData.precioAdicionales = 0;
            updateData.recargoNocturno = 0;
            updateData.tarifaMunicipio = 0;
            updateData.descuentoAliado = 0;
            updateData.comisionAliado = 0;
            updateData.comisionBold = 0;
            updateData.precioTotal = precioBase;
        } else {
            const vehiculoEntry = selectVehicle(servicio, numeroPasajeros, mergedBody.vehiculoId);
            const municipio = assertEnum(mergedBody.municipio, MUNICIPIOS, 'municipio');
            validateDynamicPayload(servicio, mergedBody.datosDinamicos);
            const { breakdown, precioAdicionales } = await calculateExternalPrice({
                servicio,
                vehiculoId: vehiculoEntry.vehiculoId,
                datosDinamicos: mergedBody.datosDinamicos,
                fecha,
                hora,
                municipio,
            });

            updateData.servicio = { connect: { id: servicio.id } };
            updateData.vehiculo = { connect: { id: vehiculoEntry.vehiculoId } };
            updateData.fecha = fecha;
            updateData.hora = hora;
            updateData.numeroPasajeros = numeroPasajeros;
            updateData.municipio = municipio;
            updateData.datos = mergedBody.datosDinamicos as any;
            updateData.esReservaAliado = false;
            updateData.precioBase = breakdown.precioBase;
            updateData.precioAdicionales = precioAdicionales;
            updateData.recargoNocturno = breakdown.recargoNocturno;
            updateData.tarifaMunicipio = breakdown.tarifaMunicipio;
            updateData.descuentoAliado = breakdown.descuentoAliado;
            updateData.comisionAliado = 0;
            updateData.comisionBold = 0;
            updateData.precioTotal = breakdown.total - breakdown.comisionAliado;
        }
    }

    if (Array.isArray(body.asistentes)) {
        updateData.asistentes = {
            deleteMany: {},
            create: body.asistentes.map((a: any) => ({
                nombre: a.nombre,
                tipoDocumento: a.tipoDocumento,
                numeroDocumento: a.numeroDocumento,
                email: a.email || null,
                telefono: a.telefono || null,
            })),
        };
    }

    return prisma.reserva.update({
        where: { id: current.id },
        data: updateData,
        include: RESERVA_INCLUDE,
    });
}

export async function cancelExternalReserva(codigo: string): Promise<ReservaWithRelations> {
    const current = await prisma.reserva.findFirst({
        where: { codigo, esReservaAliado: false },
        select: { id: true },
    });
    if (!current) throw new Error('Reserva no encontrada');

    return prisma.reserva.update({
        where: { id: current.id },
        data: { estado: EstadoReserva.CANCELLED, canceladaAt: new Date() },
        include: RESERVA_INCLUDE,
    });
}

export async function getExternalReserva(codigo: string): Promise<ReservaWithRelations | null> {
    return prisma.reserva.findFirst({ where: { codigo, esReservaAliado: false }, include: RESERVA_INCLUDE });
}

export async function listExternalReservas(searchParams: URLSearchParams): Promise<ReservaWithRelations[]> {
    const where: Prisma.ReservaWhereInput = { esReservaAliado: false };
    const estado = searchParams.get('estado');
    if (estado) where.estado = assertEnum(estado, ESTADOS, 'estado');
    const codigo = searchParams.get('codigo');
    if (codigo) where.codigo = { contains: codigo, mode: 'insensitive' };
    const whatsapp = searchParams.get('whatsapp');
    if (whatsapp) where.whatsappCliente = { contains: whatsapp, mode: 'insensitive' };
    const servicioId = searchParams.get('servicioId');
    if (servicioId) where.servicioId = servicioId;
    const servicioTipo = searchParams.get('servicioTipo');
    if (servicioTipo) where.servicio = { tipoServicio: assertEnum(servicioTipo, new Set(Object.values(TipoServicio)), 'servicioTipo') };

    const fecha = searchParams.get('fecha');
    if (fecha) {
        const d = parseDate(fecha);
        where.fecha = { gte: d, lt: new Date(d.getTime() + 86400000) };
    }
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    if (desde || hasta) {
        where.fecha = {};
        if (desde) where.fecha.gte = parseDate(desde);
        if (hasta) where.fecha.lte = new Date(parseDate(hasta).getTime() + 86399999);
    }

    return prisma.reserva.findMany({
        where,
        include: RESERVA_INCLUDE,
        orderBy: [{ fecha: 'desc' }, { hora: 'asc' }],
    });
}
