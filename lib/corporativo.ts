import { randomInt } from 'crypto';
import { AeropuertoNombre, AeropuertoTipo, EstadoReserva, Idioma, MetodoPago, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
    TZ_COLOMBIA,
    partesColombia,
    ladoCiudad,
    etiquetaRuta,
    fechaReservable,
    type ReglasDisponibilidad,
} from '@/lib/corporativo-horarios';
import { categoriaDeServicio, modeloPrecioDeServicio } from '@/lib/servicio-categoria';

/**
 * Servicio corporativo por cupos.
 *
 * Un aliado con `corporativoActivo` tiene uno o más eventos (un link por aeropuerto +
 * sentido). Cada evento tiene un **horario diario** (`HorarioCorporativo`: las horas que se
 * repiten cada día, con puestos y precio) y una disponibilidad (rango de fechas y días de
 * la semana). El funcionario escoge **fecha** y **hora** y reserva su puesto.
 *
 * La salida concreta de esa fecha/hora (`TurnoCorporativo`) se crea al reservar el primer
 * cupo y desaparece si se liberan todos. Cada salida es UN vehículo con su propia `Reserva`
 * (origen `corporativo:<codigo>`): aparece en Reservas, se le asigna conductor y queda
 * ligada al aliado. `sincronizarReservaDeTurno` mantiene pasajeros, total y lista de nombres.
 *
 * No hay pago: se factura a la empresa = Σ cupos × precio de su salida.
 */

export { partesColombia };
export const PREFIJO_ORIGEN = 'corporativo:';

type Tx = Prisma.TransactionClient;
const TX_OPTS = { timeout: 20000, maxWait: 10000 };

export class CupoError extends Error {
    constructor(message: string, public status = 400) {
        super(message);
    }
}

/** Colombia no tiene horario de verano: siempre UTC-5. */
export function fechaHoraColombia(fecha: string, hora: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
        throw new CupoError('Fecha u hora inválida');
    }
    const d = new Date(`${fecha}T${hora}:00-05:00`);
    if (isNaN(d.getTime()) || partesColombia(d).fecha !== fecha) throw new CupoError('Fecha u hora inválida');
    return d;
}

export function slugify(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

/**
 * Código del link a partir del nombre (ej. `lovelytics-jmc-bajada`). Si ya está tomado se
 * le agrega `-2`, `-3`… para que el link siga siendo legible.
 */
export async function codigoEventoDisponible(base: string, excluirEventoId?: string): Promise<string> {
    const raiz = slugify(base) || 'evento';
    for (let n = 1; n < 100; n++) {
        const codigo = n === 1 ? raiz : `${raiz}-${n}`;
        const existe = await prisma.eventoCorporativo.findUnique({ where: { codigo }, select: { id: true } });
        if (!existe || existe.id === excluirEventoId) return codigo;
    }
    throw new CupoError('No se pudo generar un link único');
}

export function validarCodigoLink(codigo: string): string {
    const c = slugify(codigo);
    if (c.length < 3) throw new CupoError('El link debe tener al menos 3 letras o números');
    return c;
}

export function parseAeropuerto(v: unknown): AeropuertoNombre {
    if (v === AeropuertoNombre.JOSE_MARIA_CORDOVA || v === AeropuertoNombre.OLAYA_HERRERA) return v;
    throw new CupoError('Aeropuerto inválido (JMC u Olaya Herrera)');
}

export function parseSentido(v: unknown): AeropuertoTipo {
    if (v === AeropuertoTipo.DESDE || v === AeropuertoTipo.HACIA) return v;
    throw new CupoError('Sentido inválido (bajada o subida)');
}

export function parsePrecio(v: unknown, campo = 'Precio por persona'): number | null {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new CupoError(`${campo} inválido`);
    return n;
}

// ─── Horario diario y disponibilidad ─────────────────────────────────────────

export interface HorarioInput {
    id?: string;
    hora: string;
    capacidad: number;
    precioPorPersona: number | null;
    vehiculo: string | null;
    activo: boolean;
}

export function parseHorarios(raw: unknown): HorarioInput[] {
    if (!Array.isArray(raw)) return [];
    const horas = new Set<string>();
    return raw.map((h) => {
        const hora = String(h?.hora ?? '');
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new CupoError(`Hora inválida: ${hora || '(vacía)'}`);
        if (horas.has(hora)) throw new CupoError(`La hora ${hora} está repetida`);
        horas.add(hora);
        const capacidad = Number(h?.capacidad ?? 15);
        if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 100) {
            throw new CupoError('Puestos inválidos (1–100)');
        }
        return {
            id: typeof h?.id === 'string' && h.id ? h.id : undefined,
            hora,
            capacidad,
            precioPorPersona: parsePrecio(h?.precioPorPersona, `Precio de las ${hora}`),
            vehiculo: h?.vehiculo ? String(h.vehiculo).trim() : null,
            activo: h?.activo !== undefined ? Boolean(h.activo) : true,
        };
    });
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDisponibilidad(body: any): Partial<ReglasDisponibilidad> {
    const out: Partial<ReglasDisponibilidad> = {};
    for (const k of ['fechaDesde', 'fechaHasta'] as const) {
        if (body[k] === undefined) continue;
        const v = body[k] ? String(body[k]) : null;
        if (v && !FECHA_RE.test(v)) throw new CupoError('Fecha de disponibilidad inválida');
        out[k] = v;
    }
    if (out.fechaDesde && out.fechaHasta && out.fechaDesde > out.fechaHasta) {
        throw new CupoError('La fecha "desde" no puede ser después de "hasta"');
    }
    if (body.diasSemana !== undefined) {
        const dias = Array.isArray(body.diasSemana) ? body.diasSemana.map(Number) : [];
        if (dias.length === 0 || dias.some((d: number) => !Number.isInteger(d) || d < 0 || d > 6)) {
            throw new CupoError('Escoge al menos un día de la semana');
        }
        out.diasSemana = Array.from(new Set<number>(dias)).sort();
    }
    return out;
}

// ─── Cupos ───────────────────────────────────────────────────────────────────

export interface CupoInput {
    nombre: string;
    email: string;
    telefono: string;
    documento?: string | null;
    numeroVuelo?: string | null;
    notas?: string | null;
}

export function parseCupo(body: any): CupoInput {
    const nombre = String(body?.nombre ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const telefono = String(body?.telefono ?? '').trim();
    if (!nombre || nombre.length > 120) throw new CupoError('Nombre requerido');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CupoError('Email inválido');
    if (telefono.replace(/\D/g, '').length < 7 || telefono.length > 30) throw new CupoError('Número de WhatsApp inválido');
    const opt = (v: unknown, max: number) => {
        const s = v ? String(v).trim().slice(0, max) : '';
        return s || null;
    };
    return {
        nombre,
        email,
        telefono,
        documento: opt(body?.documento, 40),
        numeroVuelo: opt(body?.numeroVuelo, 20)?.toUpperCase() ?? null,
        notas: opt(body?.notas, 500),
    };
}

/** Precio por persona efectivo de una salida (el suyo o, si no tiene, el del evento). */
export function precioDeTurno(turno: { precioPorPersona: number | null }, evento: { precioPorPersona: number }) {
    return turno.precioPorPersona ?? evento.precioPorPersona;
}

export function formatHoraColombia(d: Date | string, opts: Intl.DateTimeFormatOptions = {}) {
    return new Date(d).toLocaleString('es-CO', { timeZone: TZ_COLOMBIA, ...opts });
}

/** Total a facturar: cada cupo al precio de su salida. */
export function totalFacturar(
    evento: { precioPorPersona: number },
    turnos: { precioPorPersona: number | null; cupos: number }[]
) {
    return turnos.reduce((s, t) => s + t.cupos * precioDeTurno(t, evento), 0);
}

// ─── Reserva operativa de cada salida ────────────────────────────────────────

async function codigoReservaUnico(tx: Tx): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (;;) {
        let codigo = '';
        for (let i = 0; i < 8; i++) codigo += chars.charAt(randomInt(0, chars.length));
        const existe = await tx.reserva.findUnique({ where: { codigo }, select: { id: true } });
        if (!existe) return codigo;
    }
}

/** Servicio de las reservas: el elegido en el evento o, si no, uno activo de aeropuerto. */
async function servicioParaEvento(tx: Tx, servicioId: string | null) {
    if (servicioId) {
        const s = await tx.servicio.findFirst({ where: { id: servicioId } });
        if (s) return s;
    }
    const s =
        (await tx.servicio.findFirst({ where: { activo: true, esAeropuerto: true }, orderBy: { createdAt: 'asc' } })) ??
        (await tx.servicio.findFirst({ where: { activo: true }, orderBy: { createdAt: 'asc' } }));
    if (!s) throw new CupoError('No hay ningún servicio activo para crear las reservas de las salidas');
    return s;
}

/**
 * Pone la `Reserva` de una salida al día con sus cupos. Sin cupos, la salida no necesita
 * carro: se borran la reserva (si nadie la tomó aún) y la salida. No toca estado,
 * conductor ni vehículo: eso lo maneja la operación normal.
 */
export async function sincronizarReservaDeTurno(tx: Tx, turnoId: string) {
    const turno = await tx.turnoCorporativo.findUnique({
        where: { id: turnoId },
        include: {
            evento: { include: { aliado: true } },
            cupos: { orderBy: { createdAt: 'asc' } },
            reserva: { select: { id: true, estado: true, conductorId: true } },
        },
    });
    if (!turno) return;
    const { evento } = turno;

    if (turno.cupos.length === 0) {
        const libre =
            !turno.reserva ||
            (turno.reserva.estado === EstadoReserva.CONFIRMED_UNASSIGNED && !turno.reserva.conductorId);
        if (!libre) return; // ya tiene conductor: se deja para que el admin decida
        if (turno.reserva) {
            await tx.turnoCorporativo.update({ where: { id: turno.id }, data: { reservaId: null } });
            await tx.reserva.delete({ where: { id: turno.reserva.id } });
        }
        await tx.turnoCorporativo.delete({ where: { id: turno.id } });
        return;
    }

    const precio = precioDeTurno(turno, evento);
    const total = turno.cupos.length * precio;
    const { fecha, hora } = partesColombia(turno.fechaHora);
    const servicio = await servicioParaEvento(tx, evento.servicioId);

    const lista = turno.cupos
        .map((c, i) => `${i + 1}. ${c.nombre} — ${c.telefono}${c.numeroVuelo ? ` — vuelo ${c.numeroVuelo}` : ''}`)
        .join('\n');
    const notas =
        `Corporativo ${evento.empresa} · ${etiquetaRuta(evento.aeropuertoNombre, evento.aeropuertoTipo)} · ${evento.origen} → ${evento.destino}\n` +
        `Vehículo: ${turno.vehiculo || '—'} · Pasajeros ${turno.cupos.length}/${turno.capacidad}\n${lista}`;

    const data = {
        servicioId: servicio.id,
        categoriaServicio: categoriaDeServicio(servicio),
        modeloPrecio: modeloPrecioDeServicio(servicio),
        // Mediodía UTC: mismo día calendario en UTC y en Bogotá (convención del proyecto).
        fecha: new Date(`${fecha}T12:00:00.000Z`),
        hora,
        nombreCliente: `${evento.empresa} (corporativo)`,
        whatsappCliente: evento.aliado?.contacto || '—',
        emailCliente: evento.contactoEmail || evento.aliado?.email || '',
        numeroPasajeros: turno.cupos.length,
        precioBase: total,
        precioTotal: total,
        aliadoId: evento.aliadoId,
        esReservaAliado: !!evento.aliadoId,
        origen: `${PREFIJO_ORIGEN}${evento.codigo}`,
        aeropuertoNombre: evento.aeropuertoNombre,
        datos: {
            aeropuertoTipo: evento.aeropuertoTipo,
            aeropuertoNombre: evento.aeropuertoNombre,
            // En traslados de aeropuerto `lugarRecogida` es el punto en la ciudad (destino si
            // bajan del aeropuerto, origen si suben): así lo leen el admin y los correos.
            lugarRecogida: ladoCiudad(evento.aeropuertoTipo, evento.origen, evento.destino),
            trasladoDestino: evento.destino,
            corporativo: { eventoId: evento.id, turnoId: turno.id, capacidad: turno.capacidad, precioPorPersona: precio },
        } as Prisma.InputJsonValue,
        notas,
        notasInternas: `Salida corporativa. Pasajeros y total se recalculan solos desde /admin/dashboard/corporativo/${evento.id}`,
    };

    if (turno.reserva) {
        await tx.reserva.update({ where: { id: turno.reserva.id }, data });
        return;
    }
    const reserva = await tx.reserva.create({
        data: {
            ...data,
            codigo: await codigoReservaUnico(tx),
            idioma: Idioma.ES,
            precioAdicionales: 0,
            recargoNocturno: 0,
            tarifaMunicipio: 0,
            descuentoAliado: 0,
            comisionAliado: 0,
            comisionBold: 0,
            estado: EstadoReserva.CONFIRMED_UNASSIGNED,
            // Nadie le paga al conductor: se factura a la empresa.
            metodoPago: MetodoPago.EFECTIVO,
            clientePaga: false,
        },
    });
    await tx.turnoCorporativo.update({ where: { id: turno.id }, data: { reservaId: reserva.id } });
}

/** Reservas que ya están en curso o terminadas no se borran desde aquí. */
const ESTADOS_INTOCABLES: EstadoReserva[] = [EstadoReserva.IN_PROGRESS, EstadoReserva.COMPLETED];

// ─── Salidas por fecha + hora ────────────────────────────────────────────────

type HorarioConEvento = Prisma.HorarioCorporativoGetPayload<{
    include: { evento: { include: { aliado: { select: { corporativoActivo: true } } } } };
}>;

async function cargarHorario(horarioId: string): Promise<HorarioConEvento> {
    const horario = await prisma.horarioCorporativo.findUnique({
        where: { id: horarioId },
        include: { evento: { include: { aliado: { select: { corporativoActivo: true } } } } },
    });
    if (!horario) throw new CupoError('Hora no encontrada', 404);
    return horario;
}

/**
 * Devuelve la salida de `fecha` + hora del horario, creándola si es la primera reserva de
 * ese día/hora (con foto de puestos, precio y vehículo). Dos reservas simultáneas no crean
 * dos salidas: el índice único (evento, fechaHora) hace que la segunda reutilice la primera.
 */
async function salidaParaFecha(horario: HorarioConEvento, fecha: string) {
    const fechaHora = fechaHoraColombia(fecha, horario.hora);
    const where = { eventoId_fechaHora: { eventoId: horario.eventoId, fechaHora } };
    const existente = await prisma.turnoCorporativo.findUnique({ where });
    if (existente) return existente;
    try {
        return await prisma.turnoCorporativo.create({
            data: {
                eventoId: horario.eventoId,
                horarioId: horario.id,
                fechaHora,
                capacidad: horario.capacidad,
                precioPorPersona: horario.precioPorPersona ?? horario.evento.precioPorPersona,
                vehiculo: horario.vehiculo,
            },
        });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            return prisma.turnoCorporativo.findUniqueOrThrow({ where });
        }
        throw e;
    }
}

/**
 * Mete un cupo en una salida sin sobrevender: bloquea la fila de la salida (`FOR UPDATE`)
 * antes de contar, así dos personas que reservan a la vez el último puesto no quedan ambas.
 */
async function ocuparSalida(
    turnoId: string,
    accion: { crear: { eventoId: string; datos: CupoInput } } | { moverCupoId: string }
) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "TurnoCorporativo" WHERE id = ${turnoId} FOR UPDATE`;
        const turno = await tx.turnoCorporativo.findUnique({
            where: { id: turnoId },
            include: { _count: { select: { cupos: true } } },
        });
        if (!turno) throw new CupoError('La salida ya no existe, intenta de nuevo', 409);
        if (turno._count.cupos >= turno.capacidad) {
            throw new CupoError('Esta hora ya está llena, escoge otra', 409);
        }

        if ('moverCupoId' in accion) {
            const cupo = await tx.cupoCorporativo.findUnique({ where: { id: accion.moverCupoId } });
            if (!cupo) throw new CupoError('Cupo no encontrado', 404);
            if (cupo.eventoId !== turno.eventoId) throw new CupoError('La hora es de otro evento');
            if (cupo.turnoId === turnoId) return cupo;
            const movido = await tx.cupoCorporativo.update({ where: { id: cupo.id }, data: { turnoId } });
            await sincronizarReservaDeTurno(tx, turnoId);
            await sincronizarReservaDeTurno(tx, cupo.turnoId);
            return movido;
        }

        const { eventoId, datos } = accion.crear;
        if (turno.eventoId !== eventoId) throw new CupoError('La hora es de otro evento');
        const existente = await tx.cupoCorporativo.findUnique({
            where: { eventoId_email: { eventoId, email: datos.email } },
            include: { turno: { select: { fechaHora: true } } },
        });
        if (existente) {
            const cuando = formatHoraColombia(existente.turno.fechaHora, {
                day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: true,
            });
            throw new CupoError(`Ya tienes un cupo reservado con este correo (${cuando}). Si cambió tu vuelo, escríbenos.`, 409);
        }
        const cupo = await tx.cupoCorporativo.create({ data: { ...datos, eventoId, turnoId } });
        await sincronizarReservaDeTurno(tx, turnoId);
        return cupo;
    }, TX_OPTS).catch(async (e) => {
        // Si la salida quedó vacía porque la transacción falló justo al crearla, se limpia.
        await limpiarSalidaVacia(turnoId);
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            throw new CupoError('Ya hay un cupo reservado con este correo para este servicio', 409);
        }
        throw e;
    });
}

async function limpiarSalidaVacia(turnoId: string) {
    try {
        await prisma.$transaction((tx) => sincronizarReservaDeTurno(tx, turnoId), TX_OPTS);
    } catch {
        /* no bloqueante */
    }
}

export interface ReservaCupoInput {
    horarioId: string;
    fecha: string;
    datos: CupoInput;
}

/** Reserva de un funcionario desde el link público: valida fecha, hora y disponibilidad. */
export async function reservarCupoPublico(codigo: string, { horarioId, fecha, datos }: ReservaCupoInput) {
    const horario = await cargarHorario(horarioId);
    const { evento } = horario;
    if (evento.codigo !== codigo) throw new CupoError('Hora no encontrada', 404);
    const aliadoOk = evento.aliado ? evento.aliado.corporativoActivo : true;
    if (!evento.activo || !aliadoOk) throw new CupoError('Este link ya no está disponible', 404);
    if (!horario.activo) throw new CupoError('Esa hora ya no está disponible');
    if (!fechaReservable(fecha, evento)) throw new CupoError('No se puede reservar para esa fecha');
    if (fechaHoraColombia(fecha, horario.hora).getTime() <= Date.now()) {
        throw new CupoError('Esa hora ya pasó, escoge otra');
    }
    const salida = await salidaParaFecha(horario, fecha);
    const cupo = await ocuparSalida(salida.id, { crear: { eventoId: evento.id, datos } });
    return { cupo, evento, salida };
}

/** El admin agrega un pasajero a mano (sin restricciones de fecha ni de link abierto). */
export async function agregarCupoAdmin(eventoId: string, { horarioId, fecha, datos }: ReservaCupoInput) {
    const horario = await cargarHorario(horarioId);
    if (horario.eventoId !== eventoId) throw new CupoError('La hora es de otro evento');
    const salida = await salidaParaFecha(horario, fecha);
    return ocuparSalida(salida.id, { crear: { eventoId, datos } });
}

/** Mueve un pasajero a otra fecha y/o hora del mismo evento. */
export async function moverCupo(cupoId: string, horarioId: string, fecha: string) {
    const horario = await cargarHorario(horarioId);
    const cupo = await prisma.cupoCorporativo.findUnique({ where: { id: cupoId } });
    if (!cupo) throw new CupoError('Cupo no encontrado', 404);
    if (cupo.eventoId !== horario.eventoId) throw new CupoError('La hora es de otro evento');
    const salida = await salidaParaFecha(horario, fecha);
    return ocuparSalida(salida.id, { moverCupoId: cupoId });
}

export async function eliminarCupo(cupoId: string) {
    return prisma.$transaction(async (tx) => {
        const cupo = await tx.cupoCorporativo.delete({ where: { id: cupoId } });
        await sincronizarReservaDeTurno(tx, cupo.turnoId);
    }, TX_OPTS);
}

// ─── Configuración del evento ────────────────────────────────────────────────

/** Crea el horario diario de un evento recién creado. */
export async function crearHorarios(eventoId: string, horarios: HorarioInput[]) {
    if (horarios.length === 0) return;
    await prisma.horarioCorporativo.createMany({
        data: horarios.map(({ id: _id, ...h }) => ({ ...h, eventoId })),
    });
}

/**
 * Aplica el horario diario editado en el admin (crear, editar, quitar horas) y pasa los
 * cambios de puestos, precio y vehículo a las salidas que aún no han salido. Las salidas
 * pasadas conservan su precio, para que la facturación no cambie hacia atrás.
 */
export async function guardarHorarios(eventoId: string, horarios: HorarioInput[] | undefined) {
    const ahora = new Date();
    await prisma.$transaction(async (tx) => {
        if (horarios) {
            const actuales = await tx.horarioCorporativo.findMany({
                where: { eventoId },
                include: { turnos: { where: { fechaHora: { gte: ahora } }, include: { _count: { select: { cupos: true } } } } },
            });
            const enviados = new Set(horarios.filter((h) => h.id).map((h) => h.id!));
            for (const a of actuales) {
                const futuros = a.turnos.reduce((s, t) => s + t._count.cupos, 0);
                const nuevo = horarios.find((h) => h.id === a.id);
                if (!nuevo && futuros > 0) {
                    throw new CupoError(`Las ${a.hora} tienen ${futuros} cupo(s) en fechas próximas: muévelos o libéralos antes de quitar esa hora`);
                }
                if (nuevo && nuevo.hora !== a.hora && futuros > 0) {
                    throw new CupoError(`Las ${a.hora} tienen cupos en fechas próximas: no se puede cambiar la hora (crea una hora nueva)`);
                }
                if (nuevo) {
                    const maxOcupado = Math.max(0, ...a.turnos.map((t) => t._count.cupos));
                    if (nuevo.capacidad < maxOcupado) {
                        throw new CupoError(`Las ${a.hora} ya tienen ${maxOcupado} cupos en una fecha: los puestos no pueden ser menos`);
                    }
                }
            }
            for (const h of horarios) {
                if (h.id && !actuales.some((a) => a.id === h.id)) throw new CupoError('Hora no pertenece a este evento');
            }
            const quitados = actuales.filter((a) => !enviados.has(a.id)).map((a) => a.id);
            await tx.horarioCorporativo.deleteMany({ where: { id: { in: quitados } } });
            // Primero se liberan las horas que cambian (evita choques con el índice único).
            for (const h of horarios.filter((x) => x.id)) {
                await tx.horarioCorporativo.update({ where: { id: h.id }, data: { hora: `tmp-${h.id}` } });
            }
            for (const { id, ...h } of horarios) {
                if (id) await tx.horarioCorporativo.update({ where: { id }, data: h });
                else await tx.horarioCorporativo.create({ data: { ...h, eventoId } });
            }
        }

        // Salidas que no han salido: se actualizan desde su hora del horario y el precio por defecto.
        const evento = await tx.eventoCorporativo.findUniqueOrThrow({ where: { id: eventoId } });
        const futuras = await tx.turnoCorporativo.findMany({
            where: { eventoId, fechaHora: { gte: ahora } },
            include: { horario: true },
        });
        for (const t of futuras) {
            if (t.horario) {
                await tx.turnoCorporativo.update({
                    where: { id: t.id },
                    data: {
                        capacidad: t.horario.capacidad,
                        precioPorPersona: t.horario.precioPorPersona ?? evento.precioPorPersona,
                        vehiculo: t.horario.vehiculo,
                    },
                });
            }
            await sincronizarReservaDeTurno(tx, t.id);
        }
    }, TX_OPTS);
}

/** Borra el evento, sus cupos, salidas y las reservas de sus salidas. */
export async function eliminarEvento(eventoId: string) {
    await prisma.$transaction(async (tx) => {
        const turnos = await tx.turnoCorporativo.findMany({
            where: { eventoId },
            include: { reserva: { select: { id: true, estado: true, codigo: true } } },
        });
        const bloqueada = turnos.find((t) => t.reserva && ESTADOS_INTOCABLES.includes(t.reserva.estado));
        if (bloqueada) {
            throw new CupoError(`La salida con reserva ${bloqueada.reserva!.codigo} ya está en curso o completada`);
        }
        const reservas = turnos.flatMap((t) => (t.reserva ? [t.reserva.id] : []));
        await tx.turnoCorporativo.updateMany({ where: { eventoId }, data: { reservaId: null } });
        await tx.reserva.deleteMany({ where: { id: { in: reservas } } });
        await tx.cupoCorporativo.deleteMany({ where: { eventoId } });
        await tx.eventoCorporativo.delete({ where: { id: eventoId } });
    }, TX_OPTS);
}

/** Perfil (aliado) de la empresa. `undefined` = no vino en el body. */
export async function datosDesdeAliado(aliadoId: unknown) {
    if (aliadoId === undefined) return undefined;
    if (aliadoId === null || aliadoId === '') return null;
    const aliado = await prisma.aliado.findUnique({ where: { id: String(aliadoId) } });
    if (!aliado) throw new CupoError('Perfil de aliado no encontrado');
    return aliado;
}
