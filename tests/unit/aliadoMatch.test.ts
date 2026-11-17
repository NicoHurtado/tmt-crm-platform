import { describe, it, expect } from 'vitest';
import { buscarAliado, puntajeAliado } from '@/lib/aliado-match';

const ALIADOS = [
    { id: 'a1', nombre: 'AMOBLADOS VELASQUEZ ', codigo: '982705' },
    { id: 'a2', nombre: 'HOUSY HOST ', codigo: '697025' },
    { id: 'a3', nombre: 'HOTEL KUUNA ', codigo: '521307' },
    { id: 'a4', nombre: 'SOY LOCAL Primavera', codigo: '369728' },
    { id: 'a5', nombre: 'SOY LOCAL Provenza', codigo: '820123' },
    { id: 'a6', nombre: 'TRAVEL   MI MEDELLIN ', codigo: '417977' },
    { id: 'a7', nombre: 'VOY MEDELLÍN TRAVEL', codigo: '743696' },
];

describe('buscarAliado', () => {
    it('encuentra el aliado aunque cambie una letra o tenga tildes (Velázquez ↔ VELASQUEZ)', () => {
        const r = buscarAliado('Amoblados Velázquez', ALIADOS);
        expect(r).toMatchObject({ estado: 'encontrado', aliado: { id: 'a1' } });
    });

    it('encuentra el aliado dentro de la frase del huésped', () => {
        expect(buscarAliado('Hola, soy Juan y vengo de parte de Housy Host', ALIADOS)).toMatchObject({ estado: 'encontrado', aliado: { id: 'a2' } });
        expect(buscarAliado('vengo de parte de amoblados velasques', ALIADOS)).toMatchObject({ estado: 'encontrado', aliado: { id: 'a1' } });
    });

    it('acepta una parte distintiva del nombre y omite "hotel"', () => {
        expect(buscarAliado('Housy', ALIADOS)).toMatchObject({ estado: 'encontrado', aliado: { id: 'a2' } });
        expect(buscarAliado('Kuuna', ALIADOS)).toMatchObject({ estado: 'encontrado', aliado: { id: 'a3' } });
    });

    it('acepta el código del aliado', () => {
        expect(buscarAliado('697025', ALIADOS)).toMatchObject({ estado: 'encontrado', aliado: { id: 'a2' } });
    });

    it('es ambiguo cuando el texto encaja con dos aliados', () => {
        const r = buscarAliado('Soy Local', ALIADOS);
        expect(r.estado).toBe('ambiguo');
        expect(buscarAliado('Medellín', ALIADOS).estado).toBe('ambiguo');
    });

    it('no inventa un aliado que no existe', () => {
        expect(buscarAliado('Hotel Intercontinental', ALIADOS).estado).toBe('no_encontrado');
        expect(puntajeAliado('ab', 'AB')).toBe(0);
    });
});
