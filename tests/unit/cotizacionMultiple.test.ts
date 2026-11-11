import { describe, it, expect } from 'vitest';
import { tplCotizacionMultiple, type ReservaTemplate } from '@/lib/email-templates';
import { normalizarDocumento, ultimosDigitos } from '@/lib/clientes';

const reserva = (over: Partial<ReservaTemplate> & { comisionBold?: number } = {}): ReservaTemplate => ({
    codigo: 'RESAAAAA',
    nombreCliente: 'Ana Gómez',
    emailCliente: 'ana@test.com',
    fecha: new Date('2026-12-15T12:00:00Z'),
    hora: '10:00',
    numeroPasajeros: 2,
    municipio: 'MEDELLIN',
    metodoPago: 'TARJETA',
    estadoPago: 'PENDIENTE',
    precioBase: 100_000,
    precioAdicionales: 0,
    precioTotal: 106_000,
    estado: 'PENDING_PAYMENT',
    servicio: { nombre: { es: 'Traslado Aeropuerto', en: 'Airport Transfer' } },
    vehiculo: { nombre: 'Van' },
    ...over,
} as ReservaTemplate);

describe('tplCotizacionMultiple', () => {
    const pedido = {
        codigo: 'PEDBBBBB',
        nombreCliente: 'Ana Gómez',
        metodoPago: 'TARJETA',
        estadoPago: 'PENDIENTE',
        subtotal: 300_000,
        comisionBold: 18_000,
        precioTotal: 318_000,
        reservas: [
            reserva({ comisionBold: 6_000 } as any),
            reserva({
                codigo: 'RESCCCCC',
                precioBase: 200_000,
                precioTotal: 212_000,
                servicio: { nombre: { es: 'Tour Guatapé', en: 'Guatapé Tour' } },
                comisionBold: 12_000,
            } as any),
        ],
    };

    it('desglosa cada servicio y el total en un solo correo', () => {
        const html = tplCotizacionMultiple(pedido, 'ES');
        expect(html).toContain('PEDBBBBB');
        expect(html).toContain('RESAAAAA');
        expect(html).toContain('RESCCCCC');
        expect(html).toContain('Servicio 1 de 2');
        expect(html).toContain('Servicio 2 de 2');
        expect(html).toContain('Tour Guatapé');
        expect(html).toContain('/tracking/PEDBBBBB');
        expect(html).toContain('Ver Cotización y Pagar');
        expect(html).not.toMatch(/>(null|undefined|NaN)</);
    });

    it('en inglés traduce el contenido', () => {
        const html = tplCotizacionMultiple(pedido, 'EN');
        expect(html).toContain('Service 1 of 2');
        expect(html).toContain('Guatapé Tour');
    });

    it('sin cobro al cliente no invita a pagar', () => {
        const html = tplCotizacionMultiple({ ...pedido, metodoPago: 'EFECTIVO', estadoPago: 'APROBADO', comisionBold: 0 }, 'ES');
        expect(html).not.toContain('Ver Cotización y Pagar');
        expect(html).toContain('Ver mi Cotización');
    });
});

describe('búsqueda de clientes', () => {
    it('compara celulares por sus últimos 10 dígitos', () => {
        expect(ultimosDigitos('+57 300 123 4567')).toBe('3001234567');
        expect(ultimosDigitos('3001234567')).toBe('3001234567');
    });

    it('normaliza documentos con puntos, guiones y minúsculas', () => {
        expect(normalizarDocumento('1.020.304.050')).toBe('1020304050');
        expect(normalizarDocumento('ab-123 456')).toBe('AB123456');
    });
});
