import { describe, it, expect } from 'vitest';
import {
    formatServicioContext,
    buildFullSystemPrompt,
    NICO_PERSONA,
    type ServicioContextData,
} from '@/lib/n8n/formatServicioContext';

const svcBase: ServicioContextData = {
    id: 'svc-guatape-1',
    tipoServicio: 'TOUR_GUATAPE',
    nombre: { es: 'Tour Guatapé', en: 'Guatapé Tour' },
    descripcion: { es: 'Tour de día completo al embalse Guatapé.', en: 'Full day tour to Guatapé lake.' },
    incluye: { es: 'Transporte, guía local', en: 'Transport, local guide' },
    duracion: '10 horas',
    aplicaRecargoNocturno: false,
    recargoNocturnoInicio: null,
    recargoNocturnoFin: null,
    montoRecargoNocturno: null,
    esPorHoras: false,
    esMunicipal: false,
    configuracion: { camposCustom: [] },
    vehiculosPermitidos: [
        {
            precio: 150_000,
            vehiculo: { nombre: 'Sedan', capacidadMinima: 1, capacidadMaxima: 3 },
        },
        {
            precio: 220_000,
            vehiculo: { nombre: 'Van', capacidadMinima: 1, capacidadMaxima: 7 },
        },
    ],
    tarifasMunicipios: [],
    adicionales: [],
};

describe('formatServicioContext', () => {
    it('incluye el enum del servicio', () => {
        const out = formatServicioContext([svcBase]);
        expect(out).toContain('TOUR_GUATAPE');
    });

    it('incluye nombre en ES y EN', () => {
        const out = formatServicioContext([svcBase]);
        expect(out).toContain('Tour Guatapé');
        expect(out).toContain('Guatapé Tour');
    });

    it('incluye vehículos con capacidad y precio', () => {
        const out = formatServicioContext([svcBase]);
        expect(out).toContain('Sedan');
        expect(out).toContain('Van');
        expect(out).toContain('150.000');
        expect(out).toContain('220.000');
        expect(out).toContain('1-3');
        expect(out).toContain('1-7');
    });

    it('muestra campos dinámicos con tipo y si es requerido', () => {
        const svc: ServicioContextData = {
            ...svcBase,
            tipoServicio: 'TRANSPORTE_AEROPUERTO',
            configuracion: {
                camposCustom: [
                    {
                        clave: 'aeropuertoTipo',
                        etiqueta: { es: 'Tipo de trayecto', en: 'Trip type' },
                        tipo: 'SELECT',
                        requerido: true,
                        orden: 0,
                        tienePrecio: false,
                        opciones: [
                            { valor: 'DESDE', etiqueta: { es: 'Desde el aeropuerto', en: 'From airport' } },
                            { valor: 'HACIA', etiqueta: { es: 'Hacia el aeropuerto', en: 'To airport' } },
                        ],
                    },
                ],
            },
        };
        const out = formatServicioContext([svc]);
        expect(out).toContain('aeropuertoTipo');
        expect(out).toContain('REQUERIDO');
        expect(out).toContain('DESDE');
        expect(out).toContain('HACIA');
    });

    it('muestra precio de campo COUNTER con precio', () => {
        const svc: ServicioContextData = {
            ...svcBase,
            configuracion: {
                camposCustom: [
                    {
                        clave: 'almuerzos',
                        etiqueta: { es: 'Almuerzos', en: 'Lunches' },
                        tipo: 'COUNTER',
                        requerido: false,
                        orden: 0,
                        tienePrecio: true,
                        precioUnitario: 35_000,
                        min: 0,
                        step: 1,
                    },
                ],
            },
        };
        const out = formatServicioContext([svc]);
        expect(out).toContain('almuerzos');
        expect(out).toContain('35.000');
    });

    it('muestra recargo nocturno cuando aplica', () => {
        const svc: ServicioContextData = {
            ...svcBase,
            aplicaRecargoNocturno: true,
            recargoNocturnoInicio: '22:00',
            recargoNocturnoFin: '05:00',
            montoRecargoNocturno: 30_000,
        };
        const out = formatServicioContext([svc]);
        expect(out).toContain('RECARGO NOCTURNO');
        expect(out).toContain('30.000');
        expect(out).toContain('22:00');
    });

    it('agrupa servicios TRANSPORTE_MUNICIPAL en una sola entrada con lista de destinos y servicioIds', () => {
        const muni1: ServicioContextData = {
            ...svcBase,
            id: 'muni-sabaneta-1',
            tipoServicio: 'TRANSPORTE_MUNICIPAL',
            nombre: { es: 'Sabaneta', en: 'Sabaneta' },
            esMunicipal: true,
            tarifasMunicipios: [],
        };
        const muni2: ServicioContextData = {
            ...svcBase,
            id: 'muni-bello-1',
            tipoServicio: 'TRANSPORTE_MUNICIPAL',
            nombre: { es: 'Bello', en: 'Bello' },
            esMunicipal: true,
            tarifasMunicipios: [],
        };
        const out = formatServicioContext([muni1, muni2]);
        expect(out).toContain('TRANSPORTE_MUNICIPAL');
        expect(out).toContain('Sabaneta');
        expect(out).toContain('Bello');
        expect(out).toContain('muni-sabaneta-1');
        expect(out).toContain('muni-bello-1');
        // Should appear only ONCE as a grouped entry, not twice
        expect(out.split('## TRANSPORTE_MUNICIPAL').length - 1).toBe(1);
    });

    // ServicioAdicional was removed from the schema (see commit 161d35d).
    // The Mía context no longer surfaces optional add-ons, so this test is
    // intentionally dropped instead of being re-implemented.

    it('no muestra sección de campos si no hay camposCustom', () => {
        const out = formatServicioContext([svcBase]);
        expect(out).not.toContain('CAMPOS PARA datosDinamicos');
    });

    it('no muestra recargo nocturno si no aplica', () => {
        const out = formatServicioContext([svcBase]);
        expect(out).not.toContain('RECARGO NOCTURNO');
    });
});

describe('buildFullSystemPrompt — índice liviano y 3 tools', () => {
    it('buildFullSystemPrompt usa el índice liviano y describe las 3 tools en toolMode', () => {
        const prompt = buildFullSystemPrompt([], 'https://www.medellintransportes.com', true);
        expect(prompt).toContain('ÍNDICE DE SERVICIOS');
        expect(prompt).toContain('cotizar');
        expect(prompt).toContain('detalle_servicio');
        expect(prompt).toContain('buscar_servicio');
    });
});

describe('buildFullSystemPrompt', () => {
    it('incluye la persona de Nico', () => {
        const out = buildFullSystemPrompt([svcBase]);
        expect(out).toContain('Nico');
        expect(out).toContain('TMT Travel');
    });

    it('incluye el índice liviano de servicios', () => {
        const out = buildFullSystemPrompt([svcBase]);
        expect(out).toContain('ÍNDICE DE SERVICIOS');
        expect(out).toContain('Tour Guatapé');
    });

    it('NICO_PERSONA es el mismo texto que aparece al inicio del prompt completo', () => {
        const out = buildFullSystemPrompt([svcBase]);
        expect(out.startsWith(NICO_PERSONA)).toBe(true);
    });
});
