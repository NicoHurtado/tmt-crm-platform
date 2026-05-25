import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
    prisma: {
        servicio: {
            findMany: vi.fn(),
        },
    },
}));

const rawServicios = [
    {
        id: 'svc-1',
        tipoServicio: 'TOUR_GUATAPE',
        nombre: { es: 'Tour Guatapé', en: 'Guatapé Tour' },
        descripcion: { es: 'Tour privado', en: 'Private tour' },
        incluye: { es: 'Transporte', en: 'Transport' },
        duracion: '10 horas',
        aplicaRecargoNocturno: false,
        recargoNocturnoInicio: null,
        recargoNocturnoFin: null,
        montoRecargoNocturno: null,
        esAeropuerto: false,
        esPorHoras: false,
        esMunicipal: false,
        configuracion: { camposCustom: [] },
        vehiculosPermitidos: [
            {
                precio: 150_000,
                vehiculo: {
                    id: 'veh-1',
                    nombre: 'Sedan',
                    capacidadMinima: 1,
                    capacidadMaxima: 3,
                },
            },
            {
                precio: 250_000,
                vehiculo: {
                    id: 'veh-2',
                    nombre: 'Van',
                    capacidadMinima: 1,
                    capacidadMaxima: 7,
                },
            },
        ],
    },
];

describe('service catalog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('consulta solo servicios activos y vehículos activos', async () => {
        const { prisma } = await import('@/lib/prisma');
        const { fetchActiveCatalogServices } = await import('@/lib/api/service-catalog');
        (prisma.servicio.findMany as any).mockResolvedValue(rawServicios);

        await fetchActiveCatalogServices();

        expect(prisma.servicio.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { activo: true },
                include: expect.objectContaining({
                    vehiculosPermitidos: expect.objectContaining({
                        where: { vehiculo: { activo: true } },
                    }),
                }),
            })
        );
    });

    it('declara ServicioVehiculo.precio como fuente de precio independiente', async () => {
        const { toCatalogServices } = await import('@/lib/api/service-catalog');
        const data = toCatalogServices(rawServicios as any, 'ES', 'https://tmt.test');

        expect(data[0].precioDesde).toBe(150_000);
        expect(data[0].precioOrigen).toBe('ServicioVehiculo.precio');
        expect(data[0].tipoPrecio).toBe('independiente');
        expect(data[0].vehiculos[0]).toMatchObject({
            precio: 150_000,
            precioOrigen: 'ServicioVehiculo.precio',
            tipoPrecio: 'independiente',
        });
    });
});
