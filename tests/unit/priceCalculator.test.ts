import { describe, it, expect } from 'vitest';
import {
    calculatePriceClientSide,
    getPriceBreakdownClientSide,
} from '@/lib/priceCalculator';

// Sample campo configurations for testing
const camposVacios = [];

// Campo COUNTER — incluir orden, min, step que requiere el schema Zod
const camposConCounter = [
    {
        clave: 'almuerzos',
        tipo: 'COUNTER',
        etiqueta: { es: 'Almuerzos', en: 'Lunches' },
        tienePrecio: true,
        precioUnitario: 25_000,
        requerido: false,
        orden: 0,
        min: 0,
        step: 1,
    },
];

// Campo SWITCH — incluir orden que requiere el schema Zod
const camposConSwitch = [
    {
        clave: 'guia_ingles',
        tipo: 'SWITCH',
        etiqueta: { es: 'Guía en inglés', en: 'English guide' },
        tienePrecio: true,
        precioUnitario: 50_000,
        requerido: false,
        orden: 0,
    },
];

const camposConSelect = [
    {
        clave: 'tipo_transporte',
        tipo: 'SELECT',
        etiqueta: { es: 'Tipo de transporte', en: 'Transport type' },
        tienePrecio: false,
        requerido: true,
        orden: 0,
        opciones: [
            { valor: 'bus', etiqueta: { es: 'Bus', en: 'Bus' }, precio: 0 },
            { valor: 'van', etiqueta: { es: 'Van', en: 'Van' }, precio: 30_000 },
        ],
    },
];

describe('calculatePriceClientSide', () => {
    const precioVehiculo = 100_000;

    it('retorna solo el precio base cuando no hay campos dinámicos', () => {
        expect(
            calculatePriceClientSide(camposVacios, precioVehiculo, {}, false, 0, 0)
        ).toBe(precioVehiculo);
    });

    it('suma campo COUNTER correctamente', () => {
        const total = calculatePriceClientSide(
            camposConCounter,
            precioVehiculo,
            { almuerzos: 3 },
            false,
            0,
            0
        );
        expect(total).toBe(100_000 + 3 * 25_000); // 175_000
    });

    it('campo COUNTER con valor 0 no agrega costo', () => {
        const total = calculatePriceClientSide(
            camposConCounter,
            precioVehiculo,
            { almuerzos: 0 },
            false,
            0,
            0
        );
        expect(total).toBe(precioVehiculo);
    });

    it('campo COUNTER sin valor no agrega costo', () => {
        const total = calculatePriceClientSide(
            camposConCounter,
            precioVehiculo,
            {},
            false,
            0,
            0
        );
        expect(total).toBe(precioVehiculo);
    });

    it('suma campo SWITCH cuando está activo', () => {
        const total = calculatePriceClientSide(
            camposConSwitch,
            precioVehiculo,
            { guia_ingles: true },
            false,
            0,
            0
        );
        expect(total).toBe(100_000 + 50_000); // 150_000
    });

    it('campo SWITCH inactivo no agrega costo', () => {
        const total = calculatePriceClientSide(
            camposConSwitch,
            precioVehiculo,
            { guia_ingles: false },
            false,
            0,
            0
        );
        expect(total).toBe(precioVehiculo);
    });

    it('suma recargo nocturno cuando aplica', () => {
        const total = calculatePriceClientSide(
            camposVacios,
            precioVehiculo,
            {},
            true,
            20_000,
            0,
            '23:00',
            '22:00',
            '06:00'
        );
        expect(total).toBe(100_000 + 20_000);
    });

    it('NO suma recargo nocturno si la hora está fuera del rango', () => {
        const total = calculatePriceClientSide(
            camposVacios,
            precioVehiculo,
            {},
            true,
            20_000,
            0,
            '14:00', // horario diurno
            '22:00',
            '06:00'
        );
        expect(total).toBe(precioVehiculo);
    });

    it('suma tarifa municipal', () => {
        const total = calculatePriceClientSide(
            camposVacios,
            precioVehiculo,
            {},
            false,
            0,
            15_000
        );
        expect(total).toBe(100_000 + 15_000);
    });

    it('suma todos los componentes juntos', () => {
        const total = calculatePriceClientSide(
            camposConCounter,
            precioVehiculo,
            { almuerzos: 2 },
            true,
            20_000,
            15_000,
            '23:00',
            '22:00',
            '06:00'
        );
        // 100_000 + (2 × 25_000) + 20_000 + 15_000 = 185_000
        expect(total).toBe(185_000);
    });

    it('retorna precio base como fallback si hay error en campos', () => {
        const total = calculatePriceClientSide(
            'campos_invalidos_no_json',
            precioVehiculo,
            {},
            false,
            0,
            0
        );
        expect(total).toBe(precioVehiculo);
    });
});

describe('getPriceBreakdownClientSide', () => {
    it('retorna desglose con base y total cuando no hay extras', () => {
        const breakdown = getPriceBreakdownClientSide(
            camposVacios,
            100_000,
            {},
            false,
            0,
            0
        );
        expect(breakdown.base).toBe(100_000);
        expect(breakdown.total).toBe(100_000);
        expect(breakdown.items).toHaveLength(0);
    });

    it('incluye item de campo COUNTER en el desglose', () => {
        const breakdown = getPriceBreakdownClientSide(
            camposConCounter,
            100_000,
            { almuerzos: 2 },
            false,
            0,
            0
        );
        expect(breakdown.items).toHaveLength(1);
        expect(breakdown.items[0].amount).toBe(50_000);
        expect(breakdown.items[0].label).toContain('Almuerzos');
        expect(breakdown.total).toBe(150_000);
    });

    it('incluye item de recargo nocturno en el desglose', () => {
        const breakdown = getPriceBreakdownClientSide(
            camposVacios,
            100_000,
            {},
            true,
            20_000,
            0
        );
        expect(breakdown.items.some(i => i.label.toLowerCase().includes('nocturno'))).toBe(true);
        expect(breakdown.total).toBe(120_000);
    });

    it('incluye item de tarifa municipal en el desglose', () => {
        const breakdown = getPriceBreakdownClientSide(
            camposVacios,
            100_000,
            {},
            false,
            0,
            10_000
        );
        expect(breakdown.items.some(i => i.label.toLowerCase().includes('municipal'))).toBe(true);
        expect(breakdown.total).toBe(110_000);
    });

    it('total = base + suma de todos los items', () => {
        const breakdown = getPriceBreakdownClientSide(
            camposConCounter,
            100_000,
            { almuerzos: 3 },
            true,
            20_000,
            15_000
        );
        const sumItems = breakdown.items.reduce((s, i) => s + i.amount, 0);
        expect(breakdown.total).toBe(breakdown.base + sumItems);
    });
});
