import { describe, it, expect } from 'vitest';
import { calcularAnticipo, parseOrderId, orderIdAnticipo, cambiosPorAnticipo, datosPagoTotal } from '@/lib/anticipo';

describe('anticipo 30 %', () => {
    it('calcula base, cobro con comisión y saldo en enteros', () => {
        // Caso del documento: servicio 275.000 + comisión 16.500 = 291.500
        const a = calcularAnticipo(291_500, 16_500);
        expect(a.subtotal).toBe(275_000);
        expect(a.anticipoBase).toBe(82_500);
        expect(a.anticipoCobro).toBe(82_500 + 4_950);
        expect(a.saldo).toBe(192_500);
        expect(Number.isInteger(a.anticipoCobro)).toBe(true);
    });

    it('separa el orderId del anticipo y deja intacto el del pago total', () => {
        expect(orderIdAnticipo('T41XFK9L')).toBe('T41XFK9L-A30');
        expect(parseOrderId('T41XFK9L-A30')).toEqual({ codigo: 'T41XFK9L', esAnticipo: true });
        expect(parseOrderId('T41XFK9L')).toEqual({ codigo: 'T41XFK9L', esAnticipo: false });
        expect(parseOrderId('PEDABC12')).toEqual({ codigo: 'PEDABC12', esAnticipo: false });
    });

    it('deja constancia del anticipo en datos y notas sin duplicar', () => {
        const r = { precioTotal: 291_500, comisionBold: 16_500, datos: { numeroVuelo: 'AB193' }, notas: '6 maletas' };
        const c = cambiosPorAnticipo(r, 87_450);
        expect((c.datos as any).numeroVuelo).toBe('AB193');
        expect((c.datos as any).pago).toMatchObject({ modalidad: 'ANTICIPO_30', montoPagado: 87_450, saldoPorCobrar: 192_500 });
        expect(c.notas).toContain('6 maletas');
        expect(c.notas).toContain('SALDO por cobrar al llegar: $192.500');
        const otra = cambiosPorAnticipo({ ...r, notas: c.notas }, 87_450);
        expect(otra.notas.match(/Anticipo 30 %/g)?.length).toBe(1);
    });

    it('marca el pago total sin pisar un pago ya registrado', () => {
        expect((datosPagoTotal({}, 291_500) as any).pago.modalidad).toBe('TOTAL');
        expect((datosPagoTotal({ pago: { modalidad: 'ANTICIPO_30' } }) as any).pago.modalidad).toBe('ANTICIPO_30');
    });
});
