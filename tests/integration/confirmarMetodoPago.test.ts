import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
    prisma: {
        reserva: {
            findUnique: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
    },
}));

vi.mock('@/lib/email-service', () => ({
    sendReservaConfirmadaEmail: vi.fn().mockResolvedValue(undefined),
}));

const baseReserva = {
    id: 'res-1',
    codigo: 'ABCD1234',
    estado: 'PENDING_PAYMENT',
    estadoPago: 'PENDIENTE',
    metodoPago: 'TARJETA',
    idioma: 'ES',
    precioTotal: 159_000,
    comisionBold: 9_000,
    nombreCliente: 'Juan',
    emailCliente: 'juan@test.com',
    servicio: { nombre: { es: 'Tour Guatapé', en: 'Guatapé Tour' } },
    vehiculo: null,
    conductor: null,
    aliado: null,
    asistentes: [],
    adicionalesSeleccionados: [],
};

describe('POST /api/reservas/confirmar-metodo-pago', () => {
    let POST: (req: Request) => Promise<Response>;
    let prisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import('@/lib/prisma');
        prisma = mod.prisma;
        const updatedReserva = {
            ...baseReserva,
            metodoPago: 'EFECTIVO',
            estado: 'CONFIRMED_UNASSIGNED',
            comisionBold: 0,
            precioTotal: 150_000,
        };
        prisma.reserva.findUnique
            .mockResolvedValueOnce(baseReserva)   // initial 404/state check
            .mockResolvedValue(updatedReserva);    // refetch after updateMany
        prisma.reserva.updateMany.mockResolvedValue({ count: 1 });

        const routeMod = await import('@/app/api/reservas/confirmar-metodo-pago/route');
        POST = routeMod.POST;
    });

    afterEach(() => vi.resetModules());

    it('devuelve 400 sin campos requeridos', async () => {
        const req = new Request('http://localhost', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('devuelve 400 con método de pago inválido', async () => {
        const req = new Request('http://localhost', {
            method: 'POST',
            body: JSON.stringify({ codigoReserva: 'ABCD1234', metodoPago: 'BITCOIN' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('devuelve 404 si la reserva no existe', async () => {
        prisma.reserva.findUnique.mockReset();
        prisma.reserva.findUnique.mockResolvedValue(null);
        const req = new Request('http://localhost', {
            method: 'POST',
            body: JSON.stringify({ codigoReserva: 'NOPE0000', metodoPago: 'EFECTIVO' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(404);
    });

    it('devuelve 400 si la reserva no está en PENDING_PAYMENT', async () => {
        prisma.reserva.findUnique.mockReset();
        prisma.reserva.findUnique.mockResolvedValue({
            ...baseReserva,
            estado: 'CONFIRMED_UNASSIGNED',
        });
        const req = new Request('http://localhost', {
            method: 'POST',
            body: JSON.stringify({ codigoReserva: 'ABCD1234', metodoPago: 'EFECTIVO' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('EFECTIVO: cambia estado, quita comisión Bold', async () => {
        const req = new Request('http://localhost', {
            method: 'POST',
            body: JSON.stringify({ codigoReserva: 'ABCD1234', metodoPago: 'EFECTIVO' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(prisma.reserva.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    codigo: 'ABCD1234',
                    estado: 'PENDING_PAYMENT',
                }),
                data: expect.objectContaining({
                    metodoPago: 'EFECTIVO',
                    estado: 'CONFIRMED_UNASSIGNED',
                    comisionBold: 0,
                    precioTotal: 150_000,
                }),
            })
        );
    });

    it('EFECTIVO: devuelve 409 si updateMany.count === 0 (race condition)', async () => {
        prisma.reserva.updateMany.mockResolvedValueOnce({ count: 0 });
        const req = new Request('http://localhost', {
            method: 'POST',
            body: JSON.stringify({ codigoReserva: 'ABCD1234', metodoPago: 'EFECTIVO' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.success).toBe(false);
    });

    it('TARJETA: no actualiza la reserva', async () => {
        const req = new Request('http://localhost', {
            method: 'POST',
            body: JSON.stringify({ codigoReserva: 'ABCD1234', metodoPago: 'TARJETA' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(prisma.reserva.updateMany).not.toHaveBeenCalled();
    });

    it('EFECTIVO: llama sendReservaConfirmadaEmail', async () => {
        const { sendReservaConfirmadaEmail } = await import('@/lib/email-service');
        const req = new Request('http://localhost', {
            method: 'POST',
            body: JSON.stringify({ codigoReserva: 'ABCD1234', metodoPago: 'EFECTIVO' }),
        });
        await POST(req);
        // fire-and-forget: flush microtasks synchronously
        await Promise.resolve();
        expect(sendReservaConfirmadaEmail).toHaveBeenCalled();
    });
});
