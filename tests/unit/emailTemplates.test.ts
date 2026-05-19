import { describe, it, expect } from 'vitest';
import {
    formatPrice,
    formatDate,
    estadoFriendly,
    getTrackingUrl,
    tplReservaConfirmada,
    tplConductorAsignado,
    tplCambioEstado,
    tplCancelacion,
    tplServicioCompletado,
    tplPagoAprobado,
    type ReservaTemplate,
} from '@/lib/email-templates';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const mockReservaBase: ReservaTemplate = {
    codigo: 'RES-TEST-001',
    nombreCliente: 'Juan Pérez',
    whatsappCliente: '+573001234567',
    emailCliente: 'juan@test.com',
    fecha: new Date('2025-12-15'),
    hora: '10:00',
    numeroPasajeros: 2,
    municipio: 'MEDELLIN',
    otroMunicipio: null,
    metodoPago: 'TARJETA',
    estadoPago: 'APROBADO',
    precioBase: 100_000,
    precioAdicionales: 0,
    precioTotal: 100_000,
    recargoNocturno: null,
    tarifaMunicipio: null,
    descuentoAliado: null,
    estado: 'CONFIRMED_UNASSIGNED',
    notas: null,
    clientePaga: true,
    pagoId: 'TXN-001',
    servicio: { nombre: { es: 'Traslado Aeropuerto', en: 'Airport Transfer' } },
    conductor: null,
    vehiculo: { nombre: 'Van' },
    origen: 'web_directa',
    datos: null,
};

const mockReservaConConductor: ReservaTemplate = {
    ...mockReservaBase,
    estado: 'CONFIRMED_ASSIGNED',
    conductor: {
        nombre: 'Carlos Gómez',
        whatsapp: '+573009876543',
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hasNoNullsOrUndefined = (html: string) => {
    // These visible strings indicate a bug where a field wasn't populated
    expect(html).not.toMatch(/>null</);
    expect(html).not.toMatch(/>undefined</);
    expect(html).not.toContain('null</');
    expect(html).not.toContain('undefined</');
};

// ─── formatPrice ─────────────────────────────────────────────────────────────

describe('formatPrice', () => {
    it('formatea precio en COP con el número y símbolo de moneda', () => {
        const formatted = formatPrice(150_000);
        expect(formatted).toContain('150');
        // Node.js Intl con es-CO devuelve "$ 150.000" (símbolo COP = $)
        expect(formatted).toMatch(/[\$COP]/);
    });

    it('formatea precio cero', () => {
        const formatted = formatPrice(0);
        expect(formatted).toBeTruthy();
        expect(formatted).not.toContain('undefined');
        expect(formatted).not.toContain('null');
    });
});

// ─── formatDate ──────────────────────────────────────────────────────────────

describe('formatDate', () => {
    const testDate = new Date('2025-12-15');

    it('retorna fecha en español legible', () => {
        const formatted = formatDate(testDate, 'ES');
        expect(formatted).toContain('2025');
        expect(formatted).not.toContain('undefined');
        expect(formatted).not.toContain('null');
    });

    it('retorna fecha en inglés cuando se especifica EN', () => {
        const formatted = formatDate(testDate, 'EN');
        expect(formatted).toContain('2025');
    });

    it('ES y EN producen formatos diferentes', () => {
        const es = formatDate(testDate, 'ES');
        const en = formatDate(testDate, 'EN');
        expect(es).not.toBe(en);
    });
});

// ─── estadoFriendly ───────────────────────────────────────────────────────────

describe('estadoFriendly', () => {
    const allStates = ['PENDING_PAYMENT', 'CONFIRMED_UNASSIGNED', 'CONFIRMED_ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PAYMENT_FAILED'];

    it('tiene todos los estados en español con etiquetas amigables', () => {
        for (const estado of allStates) {
            expect(estadoFriendly.ES[estado]).toBeTruthy();
            expect(estadoFriendly.ES[estado]).not.toBe(estado);
        }
    });

    it('tiene todos los estados en inglés', () => {
        for (const estado of allStates) {
            expect(estadoFriendly.EN[estado]).toBeTruthy();
        }
    });

    it('ES y EN tienen etiquetas diferentes', () => {
        expect(estadoFriendly.ES.PENDING_PAYMENT).not.toBe(estadoFriendly.EN.PENDING_PAYMENT);
    });
});

// ─── getTrackingUrl ───────────────────────────────────────────────────────────

describe('getTrackingUrl', () => {
    it('genera URL con el código de reserva', () => {
        const url = getTrackingUrl('RES-001', 'ES');
        expect(url).toContain('RES-001');
        expect(url).toContain('/tracking/');
    });

    it('incluye parámetro de idioma', () => {
        expect(getTrackingUrl('RES-001', 'ES')).toContain('lang=es');
        expect(getTrackingUrl('RES-001', 'EN')).toContain('lang=en');
    });

    it('la URL no contiene null ni undefined', () => {
        const url = getTrackingUrl('RES-TEST', 'ES');
        expect(url).not.toContain('null');
        expect(url).not.toContain('undefined');
    });
});

// ─── tplReservaConfirmada ─────────────────────────────────────────────────────

describe('tplReservaConfirmada', () => {
    it('contiene nombre del cliente', () => {
        const html = tplReservaConfirmada(mockReservaBase, 'ES');
        expect(html).toContain('Juan Pérez');
    });

    it('contiene el código de reserva', () => {
        const html = tplReservaConfirmada(mockReservaBase, 'ES');
        expect(html).toContain('RES-TEST-001');
    });

    it('contiene el precio total formateado', () => {
        const html = tplReservaConfirmada(mockReservaBase, 'ES');
        expect(html).toContain('100');
        // Node.js Intl con es-CO usa "$ N" no "COP N"
        expect(html).toMatch(/[\$COP]/);
    });

    it('contiene nombre del servicio', () => {
        const html = tplReservaConfirmada(mockReservaBase, 'ES');
        expect(html).toContain('Traslado Aeropuerto');
    });

    it('contiene link de tracking', () => {
        const html = tplReservaConfirmada(mockReservaBase, 'ES');
        expect(html).toContain('/tracking/RES-TEST-001');
    });

    it('no tiene campos null o undefined visibles', () => {
        const html = tplReservaConfirmada(mockReservaBase, 'ES');
        hasNoNullsOrUndefined(html);
    });

    it('genera HTML más largo para EN (incluye ambos idiomas)', () => {
        const htmlES = tplReservaConfirmada(mockReservaBase, 'ES');
        const htmlEN = tplReservaConfirmada(mockReservaBase, 'EN');
        expect(htmlES.length).toBeGreaterThan(100);
        expect(htmlEN.length).toBeGreaterThanOrEqual(htmlES.length);
    });

    it('maneja precio Decimal de Prisma (objeto con .toNumber())', () => {
        const reservaConDecimal = {
            ...mockReservaBase,
            precioTotal: { toNumber: () => 250_000 },
            precioBase: { toNumber: () => 250_000 },
        };
        const html = tplReservaConfirmada(reservaConDecimal, 'ES');
        expect(html).toContain('250');
        hasNoNullsOrUndefined(html);
    });
});

// ─── tplConductorAsignado ─────────────────────────────────────────────────────

describe('tplConductorAsignado', () => {
    it('contiene nombre del conductor cuando está asignado', () => {
        const html = tplConductorAsignado(mockReservaConConductor, 'ES');
        expect(html).toContain('Carlos Gómez');
    });

    it('contiene el whatsapp del conductor', () => {
        const html = tplConductorAsignado(mockReservaConConductor, 'ES');
        expect(html).toContain('+573009876543');
    });

    it('no tiene campos null o undefined visibles', () => {
        const html = tplConductorAsignado(mockReservaConConductor, 'ES');
        hasNoNullsOrUndefined(html);
    });
});

// ─── tplCambioEstado ──────────────────────────────────────────────────────────

describe('tplCambioEstado', () => {
    it('genera HTML sin errores', () => {
        const html = tplCambioEstado(mockReservaBase, 'PENDING_PAYMENT', 'ES');
        expect(html.length).toBeGreaterThan(100);
    });

    it('no tiene campos null o undefined visibles', () => {
        const html = tplCambioEstado(mockReservaBase, 'PENDING_PAYMENT', 'ES');
        hasNoNullsOrUndefined(html);
    });

    it('no expone el enum crudo del estado anterior', () => {
        const html = tplCambioEstado(mockReservaBase, 'PENDING_PAYMENT', 'ES');
        // Should show friendly label, not raw enum
        expect(html).not.toContain('>PENDING_PAYMENT<');
    });
});

// ─── tplCancelacion ───────────────────────────────────────────────────────────

describe('tplCancelacion', () => {
    it('contiene el nombre del cliente', () => {
        const html = tplCancelacion(mockReservaBase, 'ES');
        expect(html).toContain('Juan Pérez');
    });

    it('no tiene campos null o undefined visibles', () => {
        const html = tplCancelacion(mockReservaBase, 'ES');
        hasNoNullsOrUndefined(html);
    });
});

// ─── tplServicioCompletado ────────────────────────────────────────────────────

describe('tplServicioCompletado', () => {
    it('contiene link de calificación (via tracking#calificacion)', () => {
        const html = tplServicioCompletado(mockReservaBase, 'ES');
        // El link de calificación usa el tracking URL con fragmento #calificacion
        expect(html).toContain('#calificacion');
        expect(html).toContain('RES-TEST-001');
    });

    it('no tiene campos null o undefined visibles', () => {
        const html = tplServicioCompletado(mockReservaBase, 'ES');
        hasNoNullsOrUndefined(html);
    });
});

// ─── tplPagoAprobado ──────────────────────────────────────────────────────────

describe('tplPagoAprobado', () => {
    it('contiene el precio total formateado', () => {
        const html = tplPagoAprobado(mockReservaBase, 'ES');
        expect(html).toContain('100');
        expect(html).toMatch(/[\$COP]/);
    });

    it('no tiene campos null o undefined visibles', () => {
        const html = tplPagoAprobado(mockReservaBase, 'ES');
        hasNoNullsOrUndefined(html);
    });
});
