/**
 * Utilidades puras de horarios corporativos (sin Prisma): seguras para el cliente.
 * Colombia no tiene horario de verano, así que la hora local es siempre UTC-5.
 */

export const TZ_COLOMBIA = 'America/Bogota';
const OFFSET_MS = 5 * 3600 * 1000;

export interface TurnoGenerado {
    fecha: string;
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

/** 'YYYY-MM-DD' de mañana en hora Colombia. */
export function mananaColombia(): string {
    return partesColombia(new Date(Date.now() + 24 * 3600 * 1000)).fecha;
}

/** N salidas cada `intervaloMin` minutos desde `horaInicio` (ej. 4 carros cada hora). */
export function generarTurnos(
    fecha: string,
    horaInicio: string,
    cantidad: number,
    intervaloMin: number,
    capacidad: number
): TurnoGenerado[] {
    const [h, m] = horaInicio.split(':').map(Number);
    return Array.from({ length: cantidad }, (_, i) => {
        const total = h * 60 + m + i * intervaloMin;
        const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
        const mm = String(total % 60).padStart(2, '0');
        return { fecha, hora: `${hh}:${mm}`, capacidad, vehiculo: 'Van 14 pasajeros', activo: true };
    });
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
