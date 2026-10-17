import { randomInt } from 'crypto';
import { EstadoReserva, Idioma, MetodoPago, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { TZ_COLOMBIA, partesColombia } from '@/lib/corporativo-horarios';
import { categoriaDeServicio, modeloPrecioDeServicio } from '@/lib/servicio-categoria';

/**
 * Servicio corporativo por cupos.
 *
 * Un aliado con `corporativoActivo` tiene uno o más eventos. Cada evento publica un link
 * (`/corporativo/<codigo>`) donde sus funcionarios escogen una hora de salida (turno) y
 * reservan su puesto. No pagan: se factura a la empresa = Σ cupos × precio de su hora.
 *
 * Cada turno es UN vehículo, así que tiene su propia `Reserva` (origen `corporativo:<codigo>`):
 * así aparece en Reservas/Calendario, se le asigna conductor y queda ligada al aliado.
 * Esa reserva la mantiene `sincronizarReservaDeTurno` — pasajeros, precio y lista de
 * nombres se recalculan cada vez que cambia un cupo o el turno.
 */

export { partesColombia };
export const PREFIJO_ORIGEN = 'corporativo:';

type Tx = Prisma.TransactionClient;
const TX_OPTS = { timeout: 20000, maxWait: 10000 };

/** Colombia no tiene horario de verano: siempre UTC-5. */
export function fechaHoraColombia(fecha: string, hora: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
        throw new CupoError('Fecha u hora inválida');
    }
    const d = new Date(`${fecha}T${hora}:00-05:00`);
    if (isNaN(d.getTime())) throw new CupoError('Fecha u hora inválida');
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
 * Código del link a partir del nombre (ej. `lovelytics`). Si ya está tomado se le agrega
 * `-2`, `-3`… para que el link siga siendo legible.
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

export interface TurnoInput {
    id?: string;
    fecha: string;
    hora: string;
    capacidad?: number;
    vehiculo?: string | null;
    activo?: boolean;
    precioPorPersona?: number | null;
}

export function parsePrecio(v: unknown, campo = 'Precio por persona'): number | null {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new CupoError(`${campo} inválido`);
    return n;
}

export function parseTurnos(raw: unknown): TurnoInput[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((t) => {
        const capacidad = Number(t?.capacidad ?? 14);
        if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 100) {
            throw new CupoError('Capacidad inválida (1–100)');
        }
        return {
            id: typeof t?.id === 'string' ? t.id : undefined,
            fecha: String(t?.fecha ?? ''),
            hora: String(t?.hora ?? ''),
            capacidad,
            vehiculo: t?.vehiculo ? String(t.vehiculo).trim() : null,
            activo: t?.activo !== undefined ? Boolean(t.activo) : true,
            precioPorPersona: parsePrecio(t?.precioPorPersona, 'Precio de la hora'),
        };
    });
}

export class CupoError extends Error {
    constructor(message: string, public status = 400) {
        super(message);
    }
}

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

/** Precio por persona efectivo de un turno (el de la hora o, si no tiene, el del evento). */
export function precioDeTurno(turno: { precioPorPersona: number | null }, evento: { precioPorPersona: number }) {
    return turno.precioPorPersona ?? evento.precioPorPersona;
}

export function formatHoraColombia(d: Date | string, opts: Intl.DateTimeFormatOptions = {}) {
    return new Date(d).toLocaleString('es-CO', { timeZone: TZ_COLOMBIA, ...opts });
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
 * Crea o actualiza la `Reserva` de un turno a partir de su estado actual (evento, aliado,
 * cupos). No toca estado, conductor ni vehículo: eso lo maneja la operación normal.
 * Un turno oculto y sin cupos no necesita carro: su reserva se borra si aún no se asignó.
 */
export async function sincronizarReservaDeTurno(tx: Tx, turnoId: string) {
    const turno = await tx.turnoCorporativo.findUnique({
        where: { id: turnoId },
        include: {
            evento: { include: { aliado: true } },
            cupos: { orderBy: { createdAt: 'asc' } },
            reserva: { select: { id: true, estado: true } },
        },
    });
    if (!turno) return;
    const { evento } = turno;

    if (!turno.activo && turno.cupos.length === 0) {
        if (turno.reserva && turno.reserva.estado === EstadoReserva.CONFIRMED_UNASSIGNED) {
            await tx.turnoCorporativo.update({ where: { id: turno.id }, data: { reservaId: null } });
            await tx.reserva.delete({ where: { id: turno.reserva.id } });
        }
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
        `Corporativo ${evento.empresa} · ${evento.origen} → ${evento.destino}\n` +
        `Vehículo: ${turno.vehiculo || '—'} · Pasajeros ${turno.cupos.length}/${turno.capacidad}` +
        (lista ? `\n${lista}` : '\nAún sin pasajeros');

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
        aeropuertoNombre: servicio.esAeropuerto ? ('JOSE_MARIA_CORDOVA' as const) : null,
        datos: {
            ...(servicio.esAeropuerto && { aeropuertoTipo: 'DESDE', aeropuertoNombre: 'JOSE_MARIA_CORDOVA' }),
            // En traslados DESDE el aeropuerto, `lugarRecogida` es la dirección a la que se
            // lleva al pasajero (así lo leen el admin y los correos), no el aeropuerto.
            lugarRecogida: servicio.esAeropuerto ? evento.destino : evento.origen,
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
            // Nadie paga al conductor: se factura a la empresa.
            metodoPago: MetodoPago.EFECTIVO,
            clientePaga: false,
        },
    });
    await tx.turnoCorporativo.update({ where: { id: turno.id }, data: { reservaId: reserva.id } });
}

/** Reservas que ya están en curso o terminadas no se borran ni se mueven desde aquí. */
const ESTADOS_INTOCABLES: EstadoReserva[] = [EstadoReserva.IN_PROGRESS, EstadoReserva.COMPLETED];

async function borrarReservasDeTurnos(tx: Tx, turnoIds: string[]) {
    if (turnoIds.length === 0) return;
    const turnos = await tx.turnoCorporativo.findMany({
        where: { id: { in: turnoIds }, reservaId: { not: null } },
        include: { reserva: { select: { id: true, estado: true, codigo: true } } },
    });
    const bloqueada = turnos.find((t) => t.reserva && ESTADOS_INTOCABLES.includes(t.reserva.estado));
    if (bloqueada) {
        throw new CupoError(`La salida con reserva ${bloqueada.reserva!.codigo} ya está en curso o completada`);
    }
    const ids = turnos.map((t) => t.reserva!.id);
    await tx.turnoCorporativo.updateMany({ where: { id: { in: turnoIds } }, data: { reservaId: null } });
    await tx.reserva.deleteMany({ where: { id: { in: ids } } });
}

export async function sincronizarEvento(tx: Tx, eventoId: string) {
    const turnos = await tx.turnoCorporativo.findMany({ where: { eventoId }, select: { id: true } });
    for (const t of turnos) await sincronizarReservaDeTurno(tx, t.id);
}

/** Recalcula todas las reservas de un evento (tras cambiar precio, empresa, servicio…). */
export function resincronizarEvento(eventoId: string) {
    return prisma.$transaction((tx) => sincronizarEvento(tx, eventoId), TX_OPTS);
}

// ─── Cupos ───────────────────────────────────────────────────────────────────

/**
 * Reserva (o mueve) un cupo en un turno sin sobrevender: bloquea la fila del turno
 * (`FOR UPDATE`) antes de contar, así dos funcionarios que reservan a la vez el último
 * puesto no quedan ambos adentro.
 */
export async function asignarCupoEnTurno(
    turnoId: string,
    opts: { crear?: { eventoId: string; datos: CupoInput }; moverCupoId?: string; validarPublico?: boolean }
) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "TurnoCorporativo" WHERE id = ${turnoId} FOR UPDATE`;
        const turno = await tx.turnoCorporativo.findUnique({
            where: { id: turnoId },
            include: {
                _count: { select: { cupos: true } },
                evento: { select: { id: true, activo: true, aliado: { select: { corporativoActivo: true } } } },
            },
        });
        if (!turno) throw new CupoError('Turno no encontrado', 404);
        if (opts.validarPublico) {
            const aliadoOk = turno.evento.aliado ? turno.evento.aliado.corporativoActivo : true;
            if (!turno.evento.activo || !turno.activo || !aliadoOk) throw new CupoError('Este turno no está disponible');
            if (turno.fechaHora.getTime() < Date.now()) throw new CupoError('Este turno ya salió');
        }
        if (turno._count.cupos >= turno.capacidad) {
            throw new CupoError('Este turno ya está lleno, escoge otra hora', 409);
        }

        if (opts.moverCupoId) {
            const cupo = await tx.cupoCorporativo.findUnique({ where: { id: opts.moverCupoId } });
            if (!cupo) throw new CupoError('Cupo no encontrado', 404);
            if (cupo.eventoId !== turno.eventoId) throw new CupoError('El turno es de otro evento');
            if (cupo.turnoId === turnoId) return cupo;
            const movido = await tx.cupoCorporativo.update({ where: { id: cupo.id }, data: { turnoId } });
            await sincronizarReservaDeTurno(tx, cupo.turnoId);
            await sincronizarReservaDeTurno(tx, turnoId);
            return movido;
        }

        const { eventoId, datos } = opts.crear!;
        if (turno.eventoId !== eventoId) throw new CupoError('El turno es de otro evento');
        const existente = await tx.cupoCorporativo.findUnique({
            where: { eventoId_email: { eventoId, email: datos.email } },
            select: { id: true },
        });
        if (existente) throw new CupoError('Ya hay un cupo reservado con este email para este evento', 409);
        const cupo = await tx.cupoCorporativo.create({ data: { ...datos, eventoId, turnoId } });
        await sincronizarReservaDeTurno(tx, turnoId);
        return cupo;
    }, TX_OPTS).catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            throw new CupoError('Ya hay un cupo reservado con este email para este evento', 409);
        }
        throw e;
    });
}

export async function eliminarCupo(cupoId: string) {
    return prisma.$transaction(async (tx) => {
        const cupo = await tx.cupoCorporativo.delete({ where: { id: cupoId } });
        await sincronizarReservaDeTurno(tx, cupo.turnoId);
    }, TX_OPTS);
}

// ─── Turnos y eventos ────────────────────────────────────────────────────────

const dataTurno = (t: TurnoInput) => ({
    fechaHora: fechaHoraColombia(t.fecha, t.hora),
    capacidad: t.capacidad ?? 14,
    vehiculo: t.vehiculo ?? null,
    activo: t.activo ?? true,
    precioPorPersona: t.precioPorPersona ?? null,
});

/** Crea los turnos iniciales de un evento recién creado (con su reserva cada uno). */
export async function crearTurnos(eventoId: string, turnos: TurnoInput[]) {
    await prisma.$transaction(async (tx) => {
        for (const t of turnos) {
            const creado = await tx.turnoCorporativo.create({ data: { ...dataTurno(t), eventoId } });
            await sincronizarReservaDeTurno(tx, creado.id);
        }
    }, TX_OPTS);
}

/**
 * Sincroniza los turnos de un evento con la lista editada en el admin:
 * actualiza los existentes, crea los nuevos y borra los que se quitaron
 * (solo si no tienen cupos). No deja bajar la capacidad por debajo de lo reservado.
 * Después recalcula la reserva de cada salida.
 */
export async function sincronizarTurnos(eventoId: string, turnos: TurnoInput[]) {
    const actuales = await prisma.turnoCorporativo.findMany({
        where: { eventoId },
        include: { _count: { select: { cupos: true } } },
    });
    const idsEnviados = new Set(turnos.filter((t) => t.id).map((t) => t.id!));

    for (const t of actuales) {
        if (!idsEnviados.has(t.id) && t._count.cupos > 0) {
            throw new CupoError(
                `No se puede eliminar un horario con ${t._count.cupos} cupo(s) reservado(s). Mueve o elimina esos cupos primero.`
            );
        }
    }
    for (const t of turnos) {
        if (!t.id) continue;
        const actual = actuales.find((a) => a.id === t.id);
        if (!actual) throw new CupoError('Horario no pertenece a este evento');
        if ((t.capacidad ?? 14) < actual._count.cupos) {
            throw new CupoError(`La capacidad no puede ser menor a los ${actual._count.cupos} cupos ya reservados`);
        }
    }

    await prisma.$transaction(async (tx) => {
        const quitados = actuales.filter((a) => !idsEnviados.has(a.id)).map((a) => a.id);
        await borrarReservasDeTurnos(tx, quitados);
        await tx.turnoCorporativo.deleteMany({ where: { id: { in: quitados } } });
        for (const t of turnos) {
            if (t.id) await tx.turnoCorporativo.update({ where: { id: t.id }, data: dataTurno(t) });
            else await tx.turnoCorporativo.create({ data: { ...dataTurno(t), eventoId } });
        }
        await sincronizarEvento(tx, eventoId);
    }, TX_OPTS);
}

/** Borra el evento, sus horarios, cupos y las reservas de sus salidas. */
export async function eliminarEvento(eventoId: string) {
    await prisma.$transaction(async (tx) => {
        const turnos = await tx.turnoCorporativo.findMany({ where: { eventoId }, select: { id: true } });
        await borrarReservasDeTurnos(tx, turnos.map((t) => t.id));
        await tx.cupoCorporativo.deleteMany({ where: { eventoId } });
        await tx.eventoCorporativo.delete({ where: { id: eventoId } });
    }, TX_OPTS);
}

/**
 * Resuelve el perfil (aliado) de la empresa. Si viene `aliadoId`, los datos que no se
 * enviaron (empresa, contacto, email) se toman del aliado.
 */
export async function datosDesdeAliado(aliadoId: unknown) {
    if (aliadoId === undefined) return undefined;
    if (aliadoId === null || aliadoId === '') return null;
    const aliado = await prisma.aliado.findUnique({ where: { id: String(aliadoId) } });
    if (!aliado) throw new CupoError('Perfil de aliado no encontrado');
    return aliado;
}

/** Total a facturar: cada cupo al precio de su hora. */
export function totalFacturar(
    evento: { precioPorPersona: number },
    turnos: { precioPorPersona: number | null; cupos: number }[]
) {
    return turnos.reduce((s, t) => s + t.cupos * precioDeTurno(t, evento), 0);
}
