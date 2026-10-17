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
