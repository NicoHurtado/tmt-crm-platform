import { describe, it, expect } from 'vitest';
import { fechaHoraColombia, partesColombia, slugify, validarCodigoLink, parseCupo, parseTurnos, precioDeTurno, totalFacturar, CupoError } from '@/lib/corporativo';
import { generarTurnos } from '@/lib/corporativo-horarios';

describe('corporativo — horas Colombia', () => {
    it('interpreta fecha/hora como UTC-5 y vuelve a las mismas partes', () => {
        const d = fechaHoraColombia('2026-10-20', '15:00');
        expect(d.toISOString()).toBe('2026-10-20T20:00:00.000Z');
        expect(partesColombia(d)).toEqual({ fecha: '2026-10-20', hora: '15:00' });
    });

    it('maneja salidas nocturnas que en UTC caen al día siguiente', () => {
        const d = fechaHoraColombia('2026-10-20', '22:30');
        expect(d.toISOString()).toBe('2026-10-21T03:30:00.000Z');
        expect(partesColombia(d)).toEqual({ fecha: '2026-10-20', hora: '22:30' });
    });

    it('rechaza formatos inválidos', () => {
        expect(() => fechaHoraColombia('20/10/2026', '15:00')).toThrow();
        expect(() => fechaHoraColombia('2026-10-20', '3pm')).toThrow();
    });
});

describe('corporativo — generador de turnos', () => {
    it('crea 4 carros cada hora con 14 puestos', () => {
        const t = generarTurnos('2026-10-20', '14:00', 4, 60, 14);
        expect(t.map((x) => x.hora)).toEqual(['14:00', '15:00', '16:00', '17:00']);
        expect(t.every((x) => x.capacidad === 14)).toBe(true);
    });
});

describe('corporativo — validaciones', () => {
    it('arma links legibles a partir del nombre', () => {
        expect(slugify('LOVELYTICS')).toBe('lovelytics');
        expect(slugify('Compañía Ñandú S.A.S.')).toBe('compania-nandu-s-a-s');
        expect(validarCodigoLink('  Love Lytics 2026 ')).toBe('love-lytics-2026');
        expect(() => validarCodigoLink('!!')).toThrow(CupoError);
    });

    it('normaliza el cupo y exige nombre, email y teléfono', () => {
        const c = parseCupo({ nombre: ' Ana ', email: 'ANA@Empresa.com ', telefono: '3001234567', numeroVuelo: 'av9301' });
        expect(c).toMatchObject({ nombre: 'Ana', email: 'ana@empresa.com', numeroVuelo: 'AV9301', documento: null });
        expect(() => parseCupo({ nombre: 'Ana', email: 'no-es-email', telefono: '3001234567' })).toThrow(CupoError);
        expect(() => parseCupo({ nombre: '', email: 'a@b.co', telefono: '3001234567' })).toThrow(CupoError);
    });

    it('el número de vuelo es opcional', () => {
        const base = { nombre: 'Ana', email: 'a@b.co', telefono: '+57 300 123 4567' };
        expect(parseCupo(base).numeroVuelo).toBeNull();
        expect(parseCupo({ ...base, numeroVuelo: 'lA4010' }).numeroVuelo).toBe('LA4010');
    });

    it('rechaza capacidades fuera de rango', () => {
        expect(() => parseTurnos([{ fecha: '2026-10-20', hora: '14:00', capacidad: 0 }])).toThrow();
        expect(parseTurnos([{ fecha: '2026-10-20', hora: '14:00' }])[0].capacidad).toBe(14);
    });

    it('precio por hora: usa el de la hora o el del evento', () => {
        const [conPrecio, sinPrecio] = parseTurnos([
            { fecha: '2026-10-20', hora: '14:00', precioPorPersona: '60000' },
            { fecha: '2026-10-20', hora: '15:00', precioPorPersona: '' },
        ]);
        expect(conPrecio.precioPorPersona).toBe(60000);
        expect(sinPrecio.precioPorPersona).toBeNull();
        const evento = { precioPorPersona: 45000 };
        expect(precioDeTurno({ precioPorPersona: null }, evento)).toBe(45000);
        expect(totalFacturar(evento, [{ precioPorPersona: 60000, cupos: 2 }, { precioPorPersona: null, cupos: 3 }])).toBe(255000);
        expect(() => parseTurnos([{ fecha: '2026-10-20', hora: '14:00', precioPorPersona: '-5' }])).toThrow(CupoError);
    });
});
