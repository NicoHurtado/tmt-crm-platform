import { describe, it, expect } from 'vitest';
import { ocultarComisionAliado } from '@/lib/ocultar-comision';
import { tplReservaConfirmada } from '@/lib/email-templates';

describe('ocultarComisionAliado', () => {
    it('pliega la comisión en el precio base y elimina el campo', () => {
        const out = ocultarComisionAliado({
            precioBase: 120000,
            comisionAliado: 25000,
            precioTotal: 165000,
            aliado: { id: 'a1', nombre: 'Voyage', tipo: 'AGENCIA', linkToken: 'secreto', email: 'x@y.com' },
        });
        expect(out.precioBase).toBe(145000);
        expect('comisionAliado' in out).toBe(false);
        expect(out.aliado).not.toHaveProperty('linkToken');
        expect(out.aliado).not.toHaveProperty('email');
        expect(out.aliado).toMatchObject({ nombre: 'Voyage' });
    });

    it('sin comisión deja el precio base igual', () => {
        expect(ocultarComisionAliado({ precioBase: 80000 }).precioBase).toBe(80000);
    });
});

describe('correo de confirmación', () => {
    it('no muestra la comisión del aliado y la suma al precio base', () => {
        const html = tplReservaConfirmada({
            codigo: 'ABC123', nombreCliente: 'Yesid', emailCliente: 'c@c.com',
            fecha: new Date('2026-10-20T12:00:00Z'), hora: '22:37', numeroPasajeros: 1,
            metodoPago: 'TARJETA', estado: 'CONFIRMED_UNASSIGNED',
            precioBase: 120000, precioAdicionales: 0, precioTotal: 174900,
            recargoNocturno: 20000, comisionAliado: 25000,
            servicio: { nombre: { es: 'Aeropuerto', en: 'Airport' } },
        }, 'ES');
        expect(html).not.toMatch(/comisi[oó]n aliado/i);
        expect(html).toContain('145.000');
    });
});
