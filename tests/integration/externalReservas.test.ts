import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
    prisma: {
        servicio: { findFirst: vi.fn() },
        reserva: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('@/lib/priceCalculator', () => ({
    calculateReservationPrice: vi.fn(),
}));

vi.mock('crypto', async () => {
    const actual = await vi.importActual<typeof import('crypto')>('crypto');
    return { ...actual, randomInt: vi.fn().mockReturnValue(0) };
});

const mockServicio = {
    id: 'svc-1',
    tipoServicio: 'TOUR_GUATAPE',
    nombre: { es: 'Tour Guatapé', en: 'Guatapé Tour' },
    activo: true,
    esPorHoras: false,
    aplicaRecargoNocturno: false,
    configuracion: { camposCustom: [] },
    vehiculosPermitidos: [
        {
            vehiculoId: 'veh-1',
            precio: 150_000,
            vehiculo: {
                id: 'veh-1',
                nombre: 'Sedan',
                capacidadMinima: 1,
                capacidadMaxima: 3,
            },
        },
    ],
};

const mockReserva = {
    id: 'res-1',
    codigo: 'AAAAAAAA',
    estado: 'CONFIRMED_UNASSIGNED',
    estadoPago: 'APROBADO',
    metodoPago: 'EFECTIVO',
    origen: 'external_marketing',
    fecha: new Date('2026-07-01T12:00:00.000Z'),
    hora: '07:00',
    municipio: 'MEDELLIN',
    otroMunicipio: null,
    municipioConfigId: null,
    numeroPasajeros: 2,
    idioma: 'ES',
    clientePaga: true,
    esReservaAliado: false,
    notas: null,
    notasInternas: null,
    datos: {},
    precioBase: 150_000,
    precioAdicionales: 0,
    recargoNocturno: 0,
    tarifaMunicipio: 0,
    descuentoAliado: 0,
    comisionAliado: 0,
    comisionBold: 0,
    precioTotal: 150_000,
    createdAt: new Date(),
    updatedAt: new Date(),
    servicio: { ...mockServicio, esAeropuerto: false, esCompartido: false },
    vehiculo: mockServicio.vehiculosPermitidos[0].vehiculo,
    conductor: null,
    asistentes: [],
};

describe('external reservas API', () => {
    let prisma: any;
    let calculateReservationPrice: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubEnv('EXTERNAL_RESERVAS_API_KEY', 'external-key');
        const prismaMod = await import('@/lib/prisma');
        prisma = prismaMod.prisma;
        const priceMod = await import('@/lib/priceCalculator');
        calculateReservationPrice = priceMod.calculateReservationPrice;

        prisma.reserva.findUnique.mockResolvedValue(null);
        prisma.reserva.findFirst.mockResolvedValue(null);
        prisma.servicio.findFirst.mockResolvedValue(mockServicio);
        prisma.reserva.create.mockResolvedValue(mockReserva);
        calculateReservationPrice.mockResolvedValue({
            precioBase: 150_000,
            camposDinamicos: [],
            recargoNocturno: 0,
            tarifaMunicipio: 0,
            descuentoAliado: 0,
            comisionAliado: 0,
            subtotal: 150_000,
            total: 150_000,
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('rechaza requests sin EXTERNAL_RESERVAS_API_KEY', async () => {
        const { POST } = await import('@/app/api/external/reservas/route');
        const req = new Request('http://localhost/api/external/reservas', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const res = await POST(req as any);

        expect(res.status).toBe(401);
    });

    it('crea reserva independiente recalculando desde ServicioVehiculo.precio', async () => {
        const { POST } = await import('@/app/api/external/reservas/route');
        const req = new Request('http://localhost/api/external/reservas', {
            method: 'POST',
            headers: { 'x-api-key': 'external-key' },
            body: JSON.stringify({
                nombreCliente: 'Juan Pérez',
                whatsappCliente: '573001234567',
                emailCliente: 'juan@test.com',
                servicioId: 'svc-1',
                fecha: '2026-07-01',
                hora: '07:00',
                numeroPasajeros: 2,
            }),
        });

        const res = await POST(req as any);
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.success).toBe(true);
        expect(calculateReservationPrice).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'svc-1' }),
            'veh-1',
            {},
            expect.any(Date),
            '07:00',
            'MEDELLIN',
            undefined,
            undefined
        );
        expect(prisma.reserva.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    precioBase: 150_000,
                    precioTotal: 150_000,
                    esReservaAliado: false,
                    aliadoId: null,
                    origen: 'external_marketing',
                }),
            })
        );
        expect(body.data.precios.precioOrigen).toBe('ServicioVehiculo.precio');
    });

    it('rechaza campos de aliado porque la API externa solo crea reservas independientes', async () => {
        const { POST } = await import('@/app/api/external/reservas/route');
        const req = new Request('http://localhost/api/external/reservas', {
            method: 'POST',
            headers: { 'x-api-key': 'external-key' },
            body: JSON.stringify({
                nombreCliente: 'Ana',
                whatsappCliente: '573009999999',
                emailCliente: 'ana@test.com',
                servicioId: 'svc-1',
                aliadoCodigo: 'HOTEL',
                fecha: '2026-07-01',
                hora: '07:00',
                numeroPasajeros: 2,
            }),
        });

        const res = await POST(req as any);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('solo acepta reservas independientes');
        expect(prisma.reserva.create).not.toHaveBeenCalled();
    });

    it('DELETE cancela, no borra físicamente', async () => {
        prisma.reserva.findFirst.mockResolvedValue({ id: 'res-1' });
        prisma.reserva.update.mockResolvedValue({ ...mockReserva, estado: 'CANCELLED' });
        const { DELETE } = await import('@/app/api/external/reservas/[codigo]/route');
        const req = new Request('http://localhost/api/external/reservas/AAAAAAAA', {
            method: 'DELETE',
            headers: { 'x-api-key': 'external-key' },
        });

        const res = await DELETE(req as any, { params: { codigo: 'AAAAAAAA' } });

        expect(res.status).toBe(200);
        expect(prisma.reserva.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'res-1' },
                data: expect.objectContaining({ estado: 'CANCELLED' }),
            })
        );
    });
});
