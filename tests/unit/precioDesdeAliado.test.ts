import { describe, it, expect } from 'vitest';
import { calcularPrecioDesdeAliado } from '@/lib/precio-desde-aliado';

describe('calcularPrecioDesdeAliado', () => {
    it('toma el vehículo más barato del aliado sumando su comisión', () => {
        const r = calcularPrecioDesdeAliado({
            esAeropuerto: true,
            vehiculos: [
                { precioServicio: 100000, tipoComision: 'PORCENTAJE', comisionValor: 10 },
                { precioServicio: 70000, tipoComision: 'FIJO', comisionValor: 10000 },
                { precioServicio: 50000, activo: false },
                { precioServicio: 0 },
            ],
        }, 'HOTEL');
        expect(r).toEqual({ monto: 80000, unidad: null });
    });

    it('considera el precio alterno de Olaya si es menor', () => {
        const r = calcularPrecioDesdeAliado({
            esAeropuerto: true,
            vehiculos: [{ precioServicio: 90000, tipoComision: 'PORCENTAJE', comisionValor: 0, precioServicioOlaya: 60000 }],
        }, 'HOTEL');
        expect(r?.monto).toBe(60000);
    });

    it('tour POR_PERSONA usa p1 + comisión por tipo de aliado', () => {
        const svc = { tipoTarifa: 'POR_PERSONA', preciosPorPersona: { p1: 200000, p2: 150000, p3: 120000 } };
        expect(calcularPrecioDesdeAliado(svc, 'HOTEL')).toEqual({ monto: 220000, unidad: 'persona' });
        expect(calcularPrecioDesdeAliado(svc, 'AGENCIA')).toEqual({ monto: 180000, unidad: 'persona' });
    });

    it('devuelve null si el aliado no tiene precio configurado', () => {
        expect(calcularPrecioDesdeAliado({ vehiculos: [{ precioServicio: 0 }] }, 'HOTEL')).toBeNull();
    });
});
