import { describe, it, expect } from 'vitest';
import {
    fechaHoraColombia,
    partesColombia,
    slugify,
    validarCodigoLink,
    parseCupo,
    parseHorarios,
    parseDisponibilidad,
    parseAeropuerto,
    parseSentido,
    precioDeTurno,
    totalFacturar,
    CupoError,
} from '@/lib/corporativo';
import {
    generarHorarios,
    fechaReservable,
    proximasFechas,
    sumarDias,
    rutaPorDefecto,
    sufijoLink,
    ladoCiudad,
} from '@/lib/corporativo-horarios';

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

    it('rechaza formatos y fechas inexistentes', () => {
        expect(() => fechaHoraColombia('20/10/2026', '15:00')).toThrow();
        expect(() => fechaHoraColombia('2026-10-20', '3pm')).toThrow();
        expect(() => fechaHoraColombia('2026-02-31', '10:00')).toThrow();
    });
});

describe('corporativo — horario diario', () => {
    it('genera 4 carros cada hora con 15 puestos', () => {
        const h = generarHorarios('14:00', 4, 60, 15);
        expect(h.map((x) => x.hora)).toEqual(['14:00', '15:00', '16:00', '17:00']);
        expect(h.every((x) => x.capacidad === 15)).toBe(true);
    });

    it('valida horas, puestos y precio por hora', () => {
        const [a, b] = parseHorarios([
            { hora: '14:00', capacidad: 15, precioPorPersona: '60000' },
            { hora: '15:00', precioPorPersona: '' },
        ]);
        expect(a).toMatchObject({ hora: '14:00', capacidad: 15, precioPorPersona: 60000, activo: true });
        expect(b.precioPorPersona).toBeNull();
        expect(b.capacidad).toBe(15);
        expect(() => parseHorarios([{ hora: '25:00' }])).toThrow(CupoError);
        expect(() => parseHorarios([{ hora: '14:00' }, { hora: '14:00' }])).toThrow('repetida');
        expect(() => parseHorarios([{ hora: '14:00', capacidad: 0 }])).toThrow(CupoError);
    });

    it('precio y total: cada cupo al precio de su salida', () => {
        const evento = { precioPorPersona: 45000 };
        expect(precioDeTurno({ precioPorPersona: null }, evento)).toBe(45000);
        expect(totalFacturar(evento, [{ precioPorPersona: 60000, cupos: 2 }, { precioPorPersona: null, cupos: 3 }])).toBe(255000);
    });
});

describe('corporativo — disponibilidad de fechas', () => {
    const lunAVie = { fechaDesde: '2026-10-19', fechaHasta: '2026-10-31', diasSemana: [1, 2, 3, 4, 5] };

    it('respeta el rango y los días de la semana', () => {
        expect(fechaReservable('2026-10-19', lunAVie)).toBe(true); // lunes
        expect(fechaReservable('2026-10-24', lunAVie)).toBe(false); // sábado
        expect(fechaReservable('2026-10-18', lunAVie)).toBe(false); // antes del rango
        expect(fechaReservable('2026-11-02', lunAVie)).toBe(false); // después del rango
        expect(fechaReservable('2026-12-25', { fechaDesde: null, fechaHasta: null, diasSemana: [0, 1, 2, 3, 4, 5, 6] })).toBe(true);
    });

    it('lista las próximas fechas reservables desde hoy', () => {
        expect(proximasFechas(lunAVie, 3, '2026-10-17')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
        expect(proximasFechas(lunAVie, 50, '2026-10-17')).toHaveLength(10);
        expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
    });

    it('valida la disponibilidad enviada por el admin', () => {
        expect(parseDisponibilidad({ fechaDesde: '', diasSemana: [5, 1, 1] })).toEqual({ fechaDesde: null, diasSemana: [1, 5] });
        expect(() => parseDisponibilidad({ diasSemana: [] })).toThrow(CupoError);
        expect(() => parseDisponibilidad({ fechaDesde: '2026-11-01', fechaHasta: '2026-10-01' })).toThrow(CupoError);
    });
});

describe('corporativo — link, aeropuerto y sentido', () => {
    it('arma links legibles a partir del nombre', () => {
        expect(slugify('LOVELYTICS')).toBe('lovelytics');
        expect(slugify('Compañía Ñandú S.A.S.')).toBe('compania-nandu-s-a-s');
        expect(validarCodigoLink('  Love Lytics 2026 ')).toBe('love-lytics-2026');
        expect(() => validarCodigoLink('!!')).toThrow(CupoError);
    });

    it('origen, destino y sufijo por combinación', () => {
        expect(rutaPorDefecto('JOSE_MARIA_CORDOVA', 'DESDE')).toMatchObject({ origen: 'Aeropuerto José María Córdova', destino: 'Medellín' });
        expect(rutaPorDefecto('OLAYA_HERRERA', 'HACIA')).toMatchObject({ origen: 'Medellín', destino: 'Aeropuerto Olaya Herrera' });
        expect(sufijoLink('JOSE_MARIA_CORDOVA', 'DESDE')).toBe('jmc-bajada');
        expect(sufijoLink('OLAYA_HERRERA', 'HACIA')).toBe('olaya-subida');
        expect(ladoCiudad('DESDE', 'Aeropuerto', 'Hotel X')).toBe('Hotel X');
        expect(parseAeropuerto('OLAYA_HERRERA')).toBe('OLAYA_HERRERA');
        expect(() => parseAeropuerto('EL_DORADO')).toThrow(CupoError);
        expect(() => parseSentido('IDA')).toThrow(CupoError);
    });
});

describe('corporativo — datos del funcionario', () => {
    it('normaliza el cupo y exige nombre, email y WhatsApp; vuelo opcional', () => {
        const c = parseCupo({ nombre: ' Ana ', email: 'ANA@Empresa.com ', telefono: '3001234567', numeroVuelo: 'av9301' });
        expect(c).toMatchObject({ nombre: 'Ana', email: 'ana@empresa.com', numeroVuelo: 'AV9301' });
        expect(parseCupo({ nombre: 'Ana', email: 'a@b.co', telefono: '+57 300 123 4567' }).numeroVuelo).toBeNull();
        expect(() => parseCupo({ nombre: 'Ana', email: 'no-es-email', telefono: '3001234567' })).toThrow(CupoError);
        expect(() => parseCupo({ nombre: '', email: 'a@b.co', telefono: '3001234567' })).toThrow(CupoError);
    });
});
