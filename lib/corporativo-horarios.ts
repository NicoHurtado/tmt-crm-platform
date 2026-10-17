/**
 * Utilidades puras de horarios corporativos (sin Prisma): seguras para el cliente.
 * Colombia no tiene horario de verano, así que la hora local es siempre UTC-5.
 */

export const TZ_COLOMBIA = 'America/Bogota';
const OFFSET_MS = 5 * 3600 * 1000;

export interface HorarioGenerado {
    hora: string;
    capacidad: number;
    vehiculo: string;
    activo: boolean;
}

/** Instante → { fecha: 'YYYY-MM-DD', hora: 'HH:mm' } en hora Colombia. */
export function partesColombia(d: Date | string): { fecha: string; hora: string } {
    const iso = new Date(new Date(d).getTime() - OFFSET_MS).toISOString();
    return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

/** 'YYYY-MM-DD' de hoy en hora Colombia. */
export const hoyColombia = () => partesColombia(new Date()).fecha;

/** 'YYYY-MM-DD' de mañana en hora Colombia. */
export function mananaColombia(): string {
    return partesColombia(new Date(Date.now() + 24 * 3600 * 1000)).fecha;
}

/** Suma días a una fecha 'YYYY-MM-DD'. */
export function sumarDias(fecha: string, dias: number): string {
    const d = new Date(`${fecha}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha 'YYYY-MM-DD'. */
export const diaSemana = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

export const NOMBRES_DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Horario diario: N salidas cada `intervaloMin` minutos desde `horaInicio` (ej. 4 carros cada hora). */
export function generarHorarios(horaInicio: string, cantidad: number, intervaloMin: number, capacidad: number): HorarioGenerado[] {
    const [h, m] = horaInicio.split(':').map(Number);
    return Array.from({ length: cantidad }, (_, i) => {
        const total = h * 60 + m + i * intervaloMin;
        const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
        const mm = String(total % 60).padStart(2, '0');
        return { hora: `${hh}:${mm}`, capacidad, vehiculo: 'Van', activo: true };
    });
}

// ─── Disponibilidad ──────────────────────────────────────────────────────────

export interface ReglasDisponibilidad {
    fechaDesde: string | null;
    fechaHasta: string | null;
    diasSemana: number[];
}

/** ¿Se puede reservar en esta fecha según el rango y los días de la semana? (no mira la hora). */
export function fechaReservable(fecha: string, r: ReglasDisponibilidad): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    if (r.fechaDesde && fecha < r.fechaDesde) return false;
    if (r.fechaHasta && fecha > r.fechaHasta) return false;
    return (r.diasSemana.length ? r.diasSemana : [0, 1, 2, 3, 4, 5, 6]).includes(diaSemana(fecha));
}

/** Próximas `n` fechas reservables a partir de hoy (busca hasta 120 días adelante). */
export function proximasFechas(r: ReglasDisponibilidad, n: number, desde = hoyColombia()): string[] {
    const out: string[] = [];
    let f = r.fechaDesde && r.fechaDesde > desde ? r.fechaDesde : desde;
    for (let i = 0; i < 120 && out.length < n; i++, f = sumarDias(f, 1)) {
        if (r.fechaHasta && f > r.fechaHasta) break;
        if (fechaReservable(f, r)) out.push(f);
    }
    return out;
}

// ─── Aeropuerto y sentido de cada link ───────────────────────────────────────

export type AeropuertoCorp = 'JOSE_MARIA_CORDOVA' | 'OLAYA_HERRERA';
/** DESDE = llegan en vuelo y bajan a la ciudad · HACIA = suben de la ciudad a tomar vuelo. */
export type SentidoCorp = 'DESDE' | 'HACIA';

export const AEROPUERTOS: Record<AeropuertoCorp, { nombre: string; corto: string; slug: string }> = {
    JOSE_MARIA_CORDOVA: { nombre: 'Aeropuerto José María Córdova', corto: 'JMC (Rionegro)', slug: 'jmc' },
    OLAYA_HERRERA: { nombre: 'Aeropuerto Olaya Herrera', corto: 'Olaya Herrera', slug: 'olaya' },
};

export const SENTIDOS: Record<SentidoCorp, { label: string; corto: string; slug: string; vuelo: string }> = {
    DESDE: { label: 'Aeropuerto → ciudad (bajada)', corto: 'Bajada', slug: 'bajada', vuelo: 'la llegada de tu vuelo' },
    HACIA: { label: 'Ciudad → aeropuerto (subida)', corto: 'Subida', slug: 'subida', vuelo: 'la salida de tu vuelo' },
};

/** Etiqueta corta para listas y badges, ej. "JMC (Rionegro) · Bajada". */
export const etiquetaRuta = (a: AeropuertoCorp, s: SentidoCorp) => `${AEROPUERTOS[a].corto} · ${SENTIDOS[s].corto}`;

/** Sufijo del link para cada combinación, ej. `jmc-bajada`. */
export const sufijoLink = (a: AeropuertoCorp, s: SentidoCorp) => `${AEROPUERTOS[a].slug}-${SENTIDOS[s].slug}`;

/** Origen, destino y título por defecto según aeropuerto, sentido y el lugar en la ciudad. */
export function rutaPorDefecto(a: AeropuertoCorp, s: SentidoCorp, ciudad = 'Medellín') {
    const aeropuerto = AEROPUERTOS[a].nombre;
    return s === 'DESDE'
        ? { origen: aeropuerto, destino: ciudad, titulo: `Traslado ${AEROPUERTOS[a].corto} → ${ciudad}` }
        : { origen: ciudad, destino: aeropuerto, titulo: `Traslado ${ciudad} → ${AEROPUERTOS[a].corto}` };
}

/** El punto en la ciudad (no el aeropuerto) de un evento. */
export const ladoCiudad = (s: SentidoCorp, origen: string, destino: string) => (s === 'DESDE' ? destino : origen);
