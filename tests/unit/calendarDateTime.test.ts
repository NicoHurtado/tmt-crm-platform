import { describe, it, expect } from 'vitest';
import { buildColombiaDateTime, parseHoraReserva, HORA_FALLBACK } from '@/lib/google-calendar-service';

/**
 * Regresión: las cotizaciones de tours compartidos y POR_PERSONA se guardaban con
 * `hora = ""` porque el wizard nunca pedía la hora. `"".split(':').map(Number)` da
 * `[0]`, así que `minutos` quedaba `undefined` y el dateTime salía como
 * "2026-08-09T00:undefined:00" — Google respondía 400 y el evento nunca se creaba,
 * en silencio. 7 reservas confirmadas quedaron fuera del calendario por esto.
 */
describe('parseHoraReserva', () => {
    it('acepta HH:MM 24h', () => {
        expect(parseHoraReserva('10:30')).toBe('10:30');
        expect(parseHoraReserva('00:00')).toBe('00:00');
        expect(parseHoraReserva('23:59')).toBe('23:59');
    });

    it('normaliza horas de un dígito', () => {
        expect(parseHoraReserva('7:05')).toBe('07:05');
    });

    it('ignora espacios alrededor', () => {
        expect(parseHoraReserva('  09:15 ')).toBe('09:15');
    });

    it('devuelve null para hora ausente o vacía', () => {
        expect(parseHoraReserva('')).toBeNull();
        expect(parseHoraReserva(null)).toBeNull();
        expect(parseHoraReserva(undefined)).toBeNull();
        expect(parseHoraReserva('   ')).toBeNull();
    });

    it('devuelve null para horas fuera de rango o mal formadas', () => {
        expect(parseHoraReserva('24:00')).toBeNull();
        expect(parseHoraReserva('10:75')).toBeNull();
        expect(parseHoraReserva('mañana')).toBeNull();
        expect(parseHoraReserva('10')).toBeNull();
        expect(parseHoraReserva('10:5')).toBeNull();
    });
});

describe('buildColombiaDateTime', () => {
    const fecha = new Date('2026-08-09T12:00:00.000Z');

    it('construye el dateTime con la hora de la reserva', () => {
        expect(buildColombiaDateTime(fecha, '10:30')).toBe('2026-08-09T10:30:00');
    });

    it('nunca produce un dateTime inválido cuando la hora viene vacía', () => {
        const resultado = buildColombiaDateTime(fecha, '');
        expect(resultado).not.toContain('undefined');
        expect(resultado).not.toContain('NaN');
        expect(resultado).toBe(`2026-08-09T${HORA_FALLBACK}:00`);
    });

    it('nunca produce un dateTime inválido cuando la hora es null', () => {
        const resultado = buildColombiaDateTime(fecha, null as any);
        expect(resultado).toBe(`2026-08-09T${HORA_FALLBACK}:00`);
    });

    it('todo dateTime generado cumple el formato ISO local que exige Google', () => {
        const horas = ['10:30', '', '   ', 'basura', '24:00', null, undefined];
        for (const hora of horas) {
            expect(buildColombiaDateTime(fecha, hora as any)).toMatch(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/
            );
        }
    });

    it('ancla el día a Colombia, no a UTC', () => {
        // 2026-08-10T02:00Z es todavía 9 de agosto en Bogotá (UTC-5)
        const nocturna = new Date('2026-08-10T02:00:00.000Z');
        expect(buildColombiaDateTime(nocturna, '21:00')).toBe('2026-08-09T21:00:00');
    });
});
