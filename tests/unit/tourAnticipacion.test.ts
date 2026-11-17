import { describe, it, expect } from 'vitest';
import { esServicioTour, plazoTour } from '@/lib/tour-anticipacion';

// Hora Colombia = UTC-5.
const bogota = (fechaHora: string) => new Date(`${fechaHora}:00-05:00`);

describe('plazoTour', () => {
    it('antes de las 8:00 p. m. se puede agendar para mañana', () => {
        expect(plazoTour('2026-11-18', bogota('2026-11-17T19:59'))).toEqual({ permitido: true, primeraFechaDisponible: '2026-11-18' });
    });

    it('desde las 8:00 p. m. el tour más próximo es pasado mañana', () => {
        expect(plazoTour('2026-11-18', bogota('2026-11-17T20:00'))).toEqual({ permitido: false, primeraFechaDisponible: '2026-11-19' });
        expect(plazoTour('2026-11-19', bogota('2026-11-17T23:30')).permitido).toBe(true);
    });

    it('no se agendan tours para el mismo día', () => {
        expect(plazoTour('2026-11-17', bogota('2026-11-17T06:00')).permitido).toBe(false);
    });

    it('usa la hora de Colombia aunque en UTC ya sea el día siguiente', () => {
        // 21:00 en Bogotá = 02:00 UTC del día siguiente.
        expect(plazoTour('2026-11-18', bogota('2026-11-17T21:00')).primeraFechaDisponible).toBe('2026-11-19');
    });
});

describe('esServicioTour', () => {
    it('reconoce tours por persona, compartidos y full day', () => {
        expect(esServicioTour({ configuracion: { tipoTarifa: 'POR_PERSONA' }, nombre: { es: 'Tour del Café' } })).toBe(true);
        expect(esServicioTour({ esCompartido: true, nombre: { es: 'Tour compartido Guatapé' } })).toBe(true);
        expect(esServicioTour({ tipoServicio: 'TOUR_PARAPENTE', nombre: { es: 'Parapente' } })).toBe(true);
        expect(esServicioTour({ tipoServicio: 'OTRO', nombre: { es: 'Full Day Jardín' } })).toBe(true);
    });

    it('no aplica a aeropuerto, traslados, por horas ni conciertos', () => {
        expect(esServicioTour({ esAeropuerto: true, nombre: { es: 'Traslado Aeropuerto' } })).toBe(false);
        expect(esServicioTour({ esTraslado: true, tipoServicio: 'TOUR_GUATAPE', nombre: { es: 'Traslado Guatapé' } })).toBe(false);
        expect(esServicioTour({ esPorHoras: true, nombre: { es: 'Disposición por horas' } })).toBe(false);
        expect(esServicioTour({ tipoServicio: 'OTRO', nombre: { es: 'Transporte Concierto' } })).toBe(false);
    });
});
