import { describe, it, expect } from 'vitest';
import { getCamposBuiltin, getMissingBuiltinFields } from '@/lib/service-fields';

/**
 * Regresión: los tours compartidos y los POR_PERSONA no incluían `hora` en su lista
 * de campos, así que el wizard nunca la pedía ni la validaba y la reserva se guardaba
 * con `hora = ""`. Eso rompía la creación del evento de Google Calendar.
 */
describe('getCamposBuiltin — hora obligatoria en todos los tipos', () => {
    const tipos: Array<[string, Parameters<typeof getCamposBuiltin>[0]]> = [
        ['tour compartido', { esCompartido: true }],
        ['tour por persona', { tipoTarifa: 'POR_PERSONA' }],
        ['aeropuerto', { esAeropuerto: true }],
        ['traslado', { esTraslado: true }],
        ['municipal', { esMunicipal: true }],
        ['por horas', { esPorHoras: true }],
        ['tour privado estándar', {}],
    ];

    for (const [nombre, service] of tipos) {
        it(`${nombre} exige hora`, () => {
            const campoHora = getCamposBuiltin(service).find((c) => c.id === 'hora');
            expect(campoHora, `${nombre} no incluye el campo hora`).toBeDefined();
            expect(campoHora!.required).toBe(true);
        });
    }
});

describe('getMissingBuiltinFields', () => {
    it('marca hora faltante en tour compartido', () => {
        const faltantes = getMissingBuiltinFields(
            { esCompartido: true },
            { fecha: new Date(), numeroPasajeros: 2, hora: '' }
        );
        expect(faltantes.map((c) => c.id)).toContain('hora');
    });

    it('marca hora faltante en tour por persona', () => {
        const faltantes = getMissingBuiltinFields(
            { tipoTarifa: 'POR_PERSONA' },
            { fecha: new Date(), numeroPasajeros: 2, lugarRecogida: 'Hotel X', hora: '' }
        );
        expect(faltantes.map((c) => c.id)).toContain('hora');
    });

    it('no marca nada cuando el tour compartido está completo', () => {
        const faltantes = getMissingBuiltinFields(
            { esCompartido: true },
            { fecha: new Date(), numeroPasajeros: 2, hora: '07:50' }
        );
        expect(faltantes).toHaveLength(0);
    });

    it('no marca nada cuando el tour por persona está completo', () => {
        const faltantes = getMissingBuiltinFields(
            { tipoTarifa: 'POR_PERSONA' },
            { fecha: new Date(), numeroPasajeros: 2, lugarRecogida: 'Hotel X', hora: '09:00' }
        );
        expect(faltantes).toHaveLength(0);
    });
});
