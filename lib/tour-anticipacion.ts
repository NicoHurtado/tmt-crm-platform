// lib/tour-anticipacion.ts
//
// Regla operativa de los tours: se pueden agendar hasta las 8:00 p. m. (hora Colombia)
// del día anterior al tour. No se agendan tours para el mismo día.
// Ej.: para un tour del jueves, el plazo vence el miércoles a las 20:00.
import { categoriaDeServicio, type ServicioCategorizable } from './servicio-categoria';

/** Hora límite (Colombia, 24 h) del día anterior para agendar un tour. */
export const HORA_LIMITE_TOUR = 20;

interface ServicioTour extends ServicioCategorizable {
    tipoServicio?: string | null;
    esPorHoras?: boolean | null;
    nombre?: unknown;
}

/**
 * ¿El servicio es un tour? Tours por persona, tours compartidos y los tours privados
 * por vehículo (TOUR_* o con "tour"/"full day" en el nombre). Aeropuerto, traslados,
 * municipales y disposición por horas no son tours.
 */
export function esServicioTour(s: ServicioTour): boolean {
    const cat = categoriaDeServicio(s);
    if (cat === 'TOUR_PERSONA' || cat === 'COMPARTIDO') return true;
    if (cat !== 'OTRO' || s.esPorHoras) return false;
    if (typeof s.tipoServicio === 'string' && s.tipoServicio.startsWith('TOUR_')) return true;
    const n = s.nombre as { es?: string; en?: string } | string | null | undefined;
    const texto = typeof n === 'string' ? n : `${n?.es ?? ''} ${n?.en ?? ''}`;
    return /\b(tour|full\s*day)\b/i.test(texto);
}

/** Fecha y hora actuales en Colombia (UTC-5, sin horario de verano). */
function ahoraBogota(now: Date): { fecha: string; hora: number } {
    const d = new Date(now.getTime() - 5 * 3600_000);
    return { fecha: d.toISOString().slice(0, 10), hora: d.getUTCHours() };
}

function sumarDia(fecha: string, dias: number): string {
    const d = new Date(fecha + 'T12:00:00.000Z');
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

/**
 * ¿Todavía se puede agendar un tour para `fechaTour` (YYYY-MM-DD)?
 * Devuelve también la fecha más próxima que se puede agendar a esta hora.
 */
export function plazoTour(fechaTour: string, now: Date = new Date()): { permitido: boolean; primeraFechaDisponible: string } {
    const { fecha: hoy, hora } = ahoraBogota(now);
    const primeraFechaDisponible = sumarDia(hoy, hora < HORA_LIMITE_TOUR ? 1 : 2);
    return { permitido: fechaTour >= primeraFechaDisponible, primeraFechaDisponible };
}
