import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock prisma BEFORE importing the route ───────────────────────────────────

const mockReserva = {
    id: 'reserva-id-1',
    codigo: 'RES-TEST-001',
    estado: 'PENDING_PAYMENT',
    estadoPago: 'PENDIENTE',
    idioma: 'ES',
    nombreCliente: 'Juan Pérez',
    emailCliente: 'juan@test.com',
    whatsappCliente: '+573001234567',
    fecha: new Date('2025-12-15'),
    hora: '10:00',
    numeroPasajeros: 2,
    precioBase: 100_000,
    precioTotal: 100_000,
    precioAdicionales: 0,
    servicioId: 'servicio-id-1',
    conductorId: null,
    vehiculoId: 'vehiculo-id-1',
    aliadoId: null,
    esReservaAliado: false,
    origen: 'web_directa',
    servicio: { id: 'servicio-id-1', nombre: { es: 'Traslado Aeropuerto', en: 'Airport Transfer' }, esCompartido: false },
    conductor: null,
    vehiculo: { id: 'vehiculo-id-1', nombre: 'Van' },
    aliado: null,
    calificacion: null,
    asistentes: [],
};

const mockServicio = {
    id: 'servicio-id-1',
    nombre: { es: 'Traslado Aeropuerto', en: 'Airport Transfer' },
    tipoServicio: 'AEROPUERTO',
    esMunicipal: false,
    activo: true,
    precioBase: 100_000,
    vehiculosPermitidos: [{ vehiculoId: 'vehiculo-id-1', precio: 100_000 }],
    aplicaRecargoNocturno: false,
    configuracion: { camposCustom: [] },
};

const mockPrismaMethods = {
    reserva: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
    },
    servicio: {
        findUnique: vi.fn(),
    },
};

vi.mock('@/lib/prisma', () => ({
    prisma: mockPrismaMethods,
}));

vi.mock('@/lib/email-service', () => ({
    sendCotizacionPendienteEmail: vi.fn().mockResolvedValue(undefined),
    sendReservaConfirmadaEmail: vi.fn().mockResolvedValue(undefined),
}));

// Admin GET /api/reservas now requires an authenticated session.
vi.mock('next-auth', () => ({
    getServerSession: vi.fn().mockResolvedValue({ user: { id: 'admin', email: 'admin@test' } }),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/reservas', () => {
    let GET: (req: Request) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPrismaMethods.reserva.findMany.mockResolvedValue([mockReserva]);
        const mod = await import('@/app/api/reservas/route');
        GET = mod.GET;
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('retorna lista de reservas en { data: [...] }', async () => {
        const req = new Request('http://localhost/api/reservas');
        const res = await GET(req as any);
        expect(res.status).toBe(200);
        const body = await res.json();
        // Route returns { data: reservas[] }
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data).toHaveLength(1);
    });

    it('filtra por estado', async () => {
        const req = new Request('http://localhost/api/reservas?estado=PENDING_PAYMENT');
        await GET(req as any);
        expect(mockPrismaMethods.reserva.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ estado: 'PENDING_PAYMENT' }),
            })
        );
    });

    it('filtra por esAliado=true', async () => {
        const req = new Request('http://localhost/api/reservas?esAliado=true');
        await GET(req as any);
        expect(mockPrismaMethods.reserva.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ esReservaAliado: true }),
            })
        );
    });

    it('sin filtros → llama findMany sin where restrictivo', async () => {
        const req = new Request('http://localhost/api/reservas');
        await GET(req as any);
        expect(mockPrismaMethods.reserva.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {},
            })
        );
    });

    it('retorna la respuesta ordenada por fecha descendente', async () => {
        const req = new Request('http://localhost/api/reservas');
        await GET(req as any);
        expect(mockPrismaMethods.reserva.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { fecha: 'desc' },
            })
        );
    });

    it('retorna 500 si hay error de base de datos', async () => {
        mockPrismaMethods.reserva.findMany.mockRejectedValue(new Error('DB error'));
        const req = new Request('http://localhost/api/reservas');
        const res = await GET(req as any);
        expect(res.status).toBe(500);
    });
});
