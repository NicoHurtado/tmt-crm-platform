import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
    prisma: {
        servicio: { findFirst: vi.fn() },
        reserva: { findUnique: vi.fn(), create: vi.fn() },
    },
}));

vi.mock('@/lib/priceCalculator', () => ({
    calculateReservationPrice: vi.fn(),
}));

vi.mock('@/lib/bold', () => ({
    calculateBoldCommission: vi.fn().mockReturnValue(9000),
}));

vi.mock('crypto', async () => {
    const actual = await vi.importActual<typeof import('crypto')>('crypto');
    return { ...actual, randomInt: vi.fn().mockReturnValue(0) };
});

const mockServicio = {
    id: 'svc-guatape',
    tipoServicio: 'TOUR_GUATAPE',
    nombre: { es: 'Tour Guatapé', en: 'Guatapé Tour' },
    activo: true,
    esPorHoras: false,
    aplicaRecargoNocturno: false,
    configuracion: { camposCustom: [] },
    vehiculosPermitidos: [
        {
            vehiculoId: 'veh-van',
            precio: 150_000,
            vehiculo: { id: 'veh-van', nombre: 'Van', capacidadMaxima: 7 },
        },
    ],
};

const mockPriceBreakdown = {
    precioBase: 150_000,
    camposDinamicos: [],
    recargoNocturno: 0,
    tarifaMunicipio: 0,
    descuentoAliado: 0,
    comisionAliado: 0,
    subtotal: 150_000,
    total: 150_000,
};

describe('POST /api/n8n/reservas/crear', () => {
    let POST: (req: Request) => Promise<Response>;
    let prisma: any;
    let calculateReservationPrice: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const prismaMod = await import('@/lib/prisma');
        prisma = prismaMod.prisma;
        const calcMod = await import('@/lib/priceCalculator');
        calculateReservationPrice = calcMod.calculateReservationPrice;

        prisma.servicio.findFirst.mockResolvedValue(mockServicio);
        prisma.reserva.findUnique.mockResolvedValue(null);
        prisma.reserva.create.mockResolvedValue({
            codigo: 'AAAAAAAA',
            precioTotal: 159_000,
        });
        calculateReservationPrice.mockResolvedValue(mockPriceBreakdown);

        const mod = await import('@/app/api/n8n/reservas/crear/route');
        POST = mod.POST;
    });

    afterEach(() => vi.resetModules());

    it('devuelve 401 sin API key', async () => {
        vi.stubEnv('N8N_API_KEY', '');
        const req = new Request('http://localhost/api/n8n/reservas/crear', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        const res = await POST(req);
        vi.unstubAllEnvs();
        expect(res.status).toBe(401);
    });

    it('devuelve 400 si faltan campos requeridos', async () => {
        process.env.N8N_API_KEY = 'test-key';
        const req = new Request('http://localhost/api/n8n/reservas/crear', {
            method: 'POST',
            headers: { 'x-api-key': 'test-key' },
            body: JSON.stringify({ nombreCliente: 'Juan' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('requeridos');
    });

    it('devuelve 400 si el servicio no existe', async () => {
        process.env.N8N_API_KEY = 'test-key';
        prisma.servicio.findFirst.mockResolvedValue(null);
        const req = new Request('http://localhost/api/n8n/reservas/crear', {
            method: 'POST',
            headers: { 'x-api-key': 'test-key' },
            body: JSON.stringify({
                nombreCliente: 'Juan',
                whatsappCliente: '573001234567',
                emailCliente: 'juan@test.com',
                servicioTipo: 'TOUR_GUATAPE',
                fecha: '2026-07-01',
                hora: '07:00',
                numeroPasajeros: 2,
                idioma: 'ES',
            }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('devuelve 400 si no hay vehículo para la cantidad de pasajeros', async () => {
        process.env.N8N_API_KEY = 'test-key';
        const req = new Request('http://localhost/api/n8n/reservas/crear', {
            method: 'POST',
            headers: { 'x-api-key': 'test-key' },
            body: JSON.stringify({
                nombreCliente: 'Juan',
                whatsappCliente: '573001234567',
                emailCliente: 'juan@test.com',
                servicioTipo: 'TOUR_GUATAPE',
                fecha: '2026-07-01',
                hora: '07:00',
                numeroPasajeros: 50,
                idioma: 'ES',
            }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('pasajeros');
    });

    it('crea la reserva y devuelve URL de confirmación', async () => {
        process.env.N8N_API_KEY = 'test-key';
        process.env.NEXT_PUBLIC_APP_URL = 'https://www.medellintransportes.com';
        const req = new Request('http://localhost/api/n8n/reservas/crear', {
            method: 'POST',
            headers: { 'x-api-key': 'test-key' },
            body: JSON.stringify({
                nombreCliente: 'Juan Pérez',
                whatsappCliente: '573001234567',
                emailCliente: 'juan@test.com',
                servicioTipo: 'TOUR_GUATAPE',
                fecha: '2026-07-01',
                hora: '07:00',
                numeroPasajeros: 2,
                idioma: 'ES',
            }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.codigo).toBeDefined();
        expect(data.url).toContain('/reservas/confirmar/');
        expect(data.precioEstimado).toBeGreaterThan(0);
    });

    it('devuelve 400 si numeroPasajeros es 0', async () => {
        process.env.N8N_API_KEY = 'test-key';
        const req = new Request('http://localhost/api/n8n/reservas/crear', {
            method: 'POST',
            headers: { 'x-api-key': 'test-key' },
            body: JSON.stringify({
                nombreCliente: 'Juan',
                whatsappCliente: '573001234567',
                emailCliente: 'juan@test.com',
                servicioTipo: 'TOUR_GUATAPE',
                fecha: '2026-07-01',
                hora: '07:00',
                numeroPasajeros: 0,
                idioma: 'ES',
            }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('numeroPasajeros');
    });

    it('devuelve 400 si la fecha es inválida', async () => {
        process.env.N8N_API_KEY = 'test-key';
        const req = new Request('http://localhost/api/n8n/reservas/crear', {
            method: 'POST',
            headers: { 'x-api-key': 'test-key' },
            body: JSON.stringify({
                nombreCliente: 'Juan',
                whatsappCliente: '573001234567',
                emailCliente: 'juan@test.com',
                servicioTipo: 'TOUR_GUATAPE',
                fecha: 'not-a-date',
                hora: '07:00',
                numeroPasajeros: 2,
                idioma: 'ES',
            }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('Fecha');
    });

    it('responde en inglés cuando idioma es EN', async () => {
        process.env.N8N_API_KEY = 'test-key';
        const req = new Request('http://localhost/api/n8n/reservas/crear', {
            method: 'POST',
            headers: { 'x-api-key': 'test-key' },
            body: JSON.stringify({
                nombreCliente: 'John Doe',
                whatsappCliente: '573001234567',
                emailCliente: 'john@test.com',
                servicioTipo: 'TOUR_GUATAPE',
                fecha: '2026-07-01',
                hora: '07:00',
                numeroPasajeros: 2,
                idioma: 'EN',
            }),
        });
        const res = await POST(req);
        const data = await res.json();
        expect(data.servicio).toBe('Guatapé Tour');
    });
});
