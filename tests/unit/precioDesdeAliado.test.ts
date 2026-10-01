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

    it('aeropuerto muestra el precio de José María Córdova aunque Olaya sea menor', () => {
        const r = calcularPrecioDesdeAliado({
            esAeropuerto: true,
            vehiculos: [{ precioServicio: 90000, tipoComision: 'PORCENTAJE', comisionValor: 0, precioServicioOlaya: 60000 }],
        }, 'HOTEL');
        expect(r?.monto).toBe(90000);
    });

    it('aeropuerto usa Olaya solo si el vehículo no tiene precio JMC', () => {
        const r = calcularPrecioDesdeAliado({
            esAeropuerto: true,
            vehiculos: [{ precioServicio: 0, tipoComision: 'FIJO', comisionValor: 5000, precioServicioOlaya: 60000 }],
        }, 'HOTEL');
        expect(r?.monto).toBe(65000);
    });

    it('tour POR_PERSONA usa el tramo más barato + comisión e indica desde cuántas personas', () => {
        const svc = { tipoTarifa: 'POR_PERSONA', preciosPorPersona: { p1: 200000, p2: 150000, p3: 120000 } };
        expect(calcularPrecioDesdeAliado(svc, 'HOTEL')).toEqual({ monto: 132000, unidad: 'persona', minPersonas: 3 });
        expect(calcularPrecioDesdeAliado(svc, 'AGENCIA')).toEqual({ monto: 108000, unidad: 'persona', minPersonas: 3 });
    });

    it('tour POR_PERSONA ignora tramos sin precio', () => {
        const svc = { tipoTarifa: 'POR_PERSONA', preciosPorPersona: { p1: 200000, p2: 150000, p3: 0 } };
        expect(calcularPrecioDesdeAliado(svc, null)).toEqual({ monto: 150000, unidad: 'persona', minPersonas: 2 });
    });

    it('devuelve null si el aliado no tiene precio configurado', () => {
        expect(calcularPrecioDesdeAliado({ vehiculos: [{ precioServicio: 0 }] }, 'HOTEL')).toBeNull();
    });
});
