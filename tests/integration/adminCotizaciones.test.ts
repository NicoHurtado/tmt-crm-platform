import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks (antes de importar la ruta) ────────────────────────────────────────

const tx = {
    pedido: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
    reserva: { create: vi.fn() },
};

const mockPrisma = {
    reserva: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    pedido: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

const sendCotizacionGeneradaEmail = vi.fn().mockResolvedValue(undefined);
const sendCotizacionMultipleEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/email-service', () => ({ sendCotizacionGeneradaEmail, sendCotizacionMultipleEmail }));
vi.mock('@/lib/google-calendar-service', () => ({ createCalendarEvent: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/bold', () => ({
    generateBoldHash: vi.fn((orderId: string, amount: number) => `hash-${orderId}-${amount}`),
    calculateBoldCommission: (n: number) => n * 0.06,
}));
vi.mock('next-auth', () => ({
    getServerSession: vi.fn().mockResolvedValue({ user: { email: 'admin@test' } }),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const item = (over: Record<string, any> = {}) => ({
    servicioId: 'srv-1',
    fecha: '2026-12-15',
    hora: '10:00',
    idioma: 'ES',
    municipio: 'MEDELLIN',
    numeroPasajeros: 2,
    nombreCliente: 'Ana Gómez',
    whatsappCliente: '+57 300 123 4567',
    emailCliente: 'ana@test.com',
    asistentes: [{ nombre: 'Ana Gómez', tipoDocumento: 'CC', numeroDocumento: '1020304050' }],
    precioBase: 100_000,
    precioAdicionales: 0,
    recargoNocturno: 0,
    tarifaMunicipio: 0,
    comisionAliado: 0,
    metodoPago: 'TARJETA',
    clientePaga: true,
    ...over,
});

const post = (body: unknown) =>
    new Request('http://localhost/api/admin/cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

describe('POST /api/admin/cotizaciones', () => {
    let POST: (req: any) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPrisma.reserva.findUnique.mockResolvedValue(null);
        mockPrisma.pedido.findUnique.mockResolvedValue(null);
        mockPrisma.reserva.create.mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data }));
        tx.pedido.create.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));
        tx.reserva.create.mockImplementation(async ({ data }: any) => ({ id: `r-${data.codigo}`, ...data }));
        POST = (await import('@/app/api/admin/cotizaciones/route')).POST;
    });

    afterEach(() => vi.resetModules());

    it('un servicio: crea una reserva-cotización y su correo de siempre', async () => {
        const res = await POST(post(item()));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.codigo).toMatch(/^RES/);

        const data = mockPrisma.reserva.create.mock.calls[0][0].data;
        expect(data.esCotizacion).toBe(true);
        expect(data.precioTotal).toBe(106_000); // 100.000 + 6 % Bold
        expect(data.hashPago).toBe(`hash-${data.codigo}-106000`);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        expect(sendCotizacionGeneradaEmail).toHaveBeenCalledTimes(1);
        expect(sendCotizacionMultipleEmail).not.toHaveBeenCalled();
    });

    it('varios servicios: un pedido, una reserva por servicio y UN solo correo', async () => {
        const reservasCreadas: any[] = [];
        tx.reserva.create.mockImplementation(async ({ data }: any) => {
            const r = { id: `r-${data.codigo}`, ...data };
            reservasCreadas.push(r);
            return r;
        });
        tx.pedido.findUniqueOrThrow.mockImplementation(async () => ({
            ...tx.pedido.create.mock.calls[0][0].data,
            id: 'p1',
            reservas: reservasCreadas,
            aliado: null,
        }));

        const res = await POST(post({
            items: [
                item(),
                item({ servicioId: 'srv-2', precioBase: 200_000 }),
                item({ servicioId: 'srv-3', precioPersonalizado: 50_000 }),
            ],
            metodoPago: 'TARJETA',
            aliadoId: null,
            clientePaga: true,
        }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.codigo).toMatch(/^PED/);
        expect(body.data.reservas).toHaveLength(3);

        const pedido = tx.pedido.create.mock.calls[0][0].data;
        // 106.000 + 212.000 + 50.000 (precio manual: sin Bold encima)
        expect(pedido.precioTotal).toBe(368_000);
        expect(pedido.comisionBold).toBe(18_000);
        expect(pedido.subtotal).toBe(350_000);
        expect(pedido.estadoPago).toBe('PENDIENTE');
        expect(pedido.hashPago).toBe(`hash-${pedido.codigo}-368000`);

        expect(tx.reserva.create).toHaveBeenCalledTimes(3);
        const codigos = new Set(reservasCreadas.map((r) => r.codigo));
        expect(codigos.size).toBe(3);
        for (const r of reservasCreadas) {
            expect(r.pedidoId).toBe('p1');
            expect(r.esPedido).toBe(true);
            expect(r.esCotizacion).toBe(true);
            expect(r.hashPago).toBeNull(); // se paga por el pedido
        }

        expect(sendCotizacionMultipleEmail).toHaveBeenCalledTimes(1);
        expect(sendCotizacionGeneradaEmail).not.toHaveBeenCalled();
    });

    it('varios servicios sin cobro al cliente: todo en efectivo y pago aprobado', async () => {
        tx.pedido.findUniqueOrThrow.mockResolvedValue({ codigo: 'PEDX', reservas: [], precioTotal: 0, metodoPago: 'EFECTIVO' });
        const res = await POST(post({
            items: [item({ metodoPago: 'EFECTIVO' }), item({ metodoPago: 'EFECTIVO' })],
            metodoPago: 'TARJETA',
            clientePaga: false,
        }));
        expect(res.status).toBe(200);
        const pedido = tx.pedido.create.mock.calls[0][0].data;
        expect(pedido.metodoPago).toBe('EFECTIVO');
        expect(pedido.estadoPago).toBe('APROBADO');
        expect(pedido.comisionBold).toBe(0);
        expect(pedido.hashPago).toBeNull();
        for (const call of tx.reserva.create.mock.calls) {
            expect(call[0].data.estado).toBe('CONFIRMED_UNASSIGNED');
        }
    });

    it('rechaza servicios sin datos mínimos', async () => {
        const res = await POST(post({ items: [item(), item({ fecha: null })] }));
        expect(res.status).toBe(400);
        expect(tx.pedido.create).not.toHaveBeenCalled();
    });
});
