import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock auth BEFORE route import ────────────────────────────────────────────

vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));

vi.mock('@/auth', () => ({
    authOptions: {},
}));

const mockSession = { user: { email: 'admin@test.com' } };

// ─── Mock prisma ───────────────────────────────────────────────────────────────

const mockReserva = {
    id: 'reserva-id-1',
    codigo: 'RES-TEST-001',
    estado: 'PENDING_PAYMENT',
    estadoPago: 'PENDIENTE',
    idioma: 'ES',
    servicio: { esCompartido: false },
    conductor: null,
    vehiculo: null,
    aliado: { email: null },
    googleCalendarEventId: null,
    asistentes: [],
    adicionalesSeleccionados: [],
};

const mockPedido = {
    id: 'pedido-id-1',
    codigo: 'PED-TEST-001',
    estadoPago: 'PENDIENTE',
    idioma: 'ES',
    reservas: [
        { ...mockReserva, id: 'r1', codigo: 'RES-001' },
        { ...mockReserva, id: 'r2', codigo: 'RES-002' },
    ],
};

const txMethods = {
    pedido: { update: vi.fn().mockResolvedValue({}) },
    reserva: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
};

const mockPrismaMethods = {
    reserva: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
    },
    pedido: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: typeof txMethods) => Promise<void>) => cb(txMethods)),
};

vi.mock('@/lib/prisma', () => ({
    prisma: mockPrismaMethods,
}));

vi.mock('@/lib/email-service', () => ({
    sendReservaConfirmadaEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/google-calendar-service', () => ({
    createCalendarEvent: vi.fn().mockResolvedValue('cal-event-id'),
    createOrUpdateTourCompartidoEvent: vi.fn().mockResolvedValue('cal-event-tour'),
}));

vi.mock('@/lib/bold', () => ({
    consultarTransaccionBold: vi.fn(),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/reservas/confirmar-pago', () => {
    let POST: (req: Request) => Promise<Response>;

    function buildRequest(body: object): Request {
        return new Request('http://localhost/api/reservas/confirmar-pago', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    }

    beforeEach(async () => {
        vi.clearAllMocks();

        const { getServerSession } = await import('next-auth');
        (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

        const { consultarTransaccionBold } = await import('@/lib/bold');
        (consultarTransaccionBold as ReturnType<typeof vi.fn>).mockResolvedValue({
            status: 'APPROVED',
            total: 100000,
            referenceId: 'RES-TEST-001',
        });

        mockPrismaMethods.reserva.findUnique.mockResolvedValue({ ...mockReserva });
        mockPrismaMethods.reserva.update.mockResolvedValue({
            ...mockReserva,
            estado: 'CONFIRMED_UNASSIGNED',
            estadoPago: 'APROBADO',
        });
        mockPrismaMethods.pedido.findUnique.mockResolvedValue({ ...mockPedido });
        mockPrismaMethods.pedido.update.mockResolvedValue({ ...mockPedido, estadoPago: 'APROBADO' });
        mockPrismaMethods.reserva.updateMany.mockResolvedValue({ count: 2 });

        const mod = await import('@/app/api/reservas/confirmar-pago/route');
        POST = mod.POST;
    });

    afterEach(() => {
        vi.resetModules();
    });

    // ── Origen público: Bold decide ────────────────────────────────────────────
    //
    // Regresión: este endpoint exigía sesión de admin y lo llama la página pública
    // /payment/result. Todo cliente o agencia recibía 401 y la reserva se quedaba en
    // PENDING_PAYMENT pese a haber pagado. Ahora no exige sesión, pero verifica
    // contra Bold antes de tocar nada.

    async function sinSesion() {
        const { getServerSession } = await import('next-auth');
        (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    }

    async function boldResponde(status: string) {
        const { consultarTransaccionBold } = await import('@/lib/bold');
        (consultarTransaccionBold as ReturnType<typeof vi.fn>).mockResolvedValue({
            status,
            total: 100000,
            referenceId: 'RES-TEST-001',
        });
    }

    it('sin sesión y con pago aprobado en Bold → confirma la reserva', async () => {
        await sinSesion();
        await boldResponde('APPROVED');
        const res = await POST(buildRequest({ orderId: 'RES-TEST-001' }) as any);
        expect(res.status).toBe(200);
        expect(mockPrismaMethods.reserva.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ estadoPago: 'APROBADO' }),
            })
        );
    });

    it('sin sesión y sin transacción en Bold → 409 y no toca la reserva', async () => {
        await sinSesion();
        await boldResponde('NO_TRANSACTION_FOUND');
        const res = await POST(buildRequest({ orderId: 'RES-TEST-001' }) as any);
        expect(res.status).toBe(409);
        expect(mockPrismaMethods.reserva.update).not.toHaveBeenCalled();
    });

    it('sin sesión y pago rechazado en Bold → 409 y no toca la reserva', async () => {
        await sinSesion();
        await boldResponde('REJECTED');
        const res = await POST(buildRequest({ orderId: 'RES-TEST-001' }) as any);
        expect(res.status).toBe(409);
        expect(mockPrismaMethods.reserva.update).not.toHaveBeenCalled();
    });

    it('sin sesión y Bold inalcanzable → 409, nunca confirma a ciegas', async () => {
        await sinSesion();
        await boldResponde('ERROR');
        const res = await POST(buildRequest({ orderId: 'RES-TEST-001' }) as any);
        expect(res.status).toBe(409);
        expect(mockPrismaMethods.reserva.update).not.toHaveBeenCalled();
    });

    it('el admin puede confirmar manualmente sin consultar a Bold', async () => {
        const { consultarTransaccionBold } = await import('@/lib/bold');
        const res = await POST(buildRequest({ orderId: 'RES-TEST-001' }) as any);
        expect(res.status).toBe(200);
        expect(consultarTransaccionBold).not.toHaveBeenCalled();
    });

    // ── Reserva individual ─────────────────────────────────────────────────────

    it('confirmar pago individual → estado CONFIRMED_UNASSIGNED', async () => {
        const req = buildRequest({ orderId: 'RES-TEST-001' });
        const res = await POST(req as any);
        expect(res.status).toBe(200);
        expect(mockPrismaMethods.reserva.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    estado: 'CONFIRMED_UNASSIGNED',
                    estadoPago: 'APROBADO',
                }),
            })
        );
    });

    it('confirmar pago individual → envía correo de confirmación', async () => {
        const { sendReservaConfirmadaEmail } = await import('@/lib/email-service');
        const req = buildRequest({ orderId: 'RES-TEST-001' });
        await POST(req as any);
        expect(sendReservaConfirmadaEmail).toHaveBeenCalledTimes(1);
    });

    it('confirmar pago individual → reserva no encontrada → 404', async () => {
        mockPrismaMethods.reserva.findUnique.mockResolvedValue(null);
        const req = buildRequest({ orderId: 'RES-INEXISTENTE' });
        const res = await POST(req as any);
        expect(res.status).toBe(404);
    });

    it('idempotencia: reserva ya APROBADA → responde success sin re-procesar', async () => {
        mockPrismaMethods.reserva.findUnique.mockResolvedValue({
            ...mockReserva,
            estado: 'CONFIRMED_UNASSIGNED',
            estadoPago: 'APROBADO',
        });
        const req = buildRequest({ orderId: 'RES-TEST-001' });
        const res = await POST(req as any);
        expect(res.status).toBe(200);
    });

    // ── Pedido ─────────────────────────────────────────────────────────────────

    it('confirmar pago de pedido (PED-) → todas las reservas confirmadas via $transaction', async () => {
        const req = buildRequest({ orderId: 'PED-TEST-001' });
        const res = await POST(req as any);
        expect(res.status).toBe(200);
        // Transaction was called
        expect(mockPrismaMethods.$transaction).toHaveBeenCalled();
        // Inside the transaction, reserva.updateMany was called with correct states
        expect(txMethods.reserva.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    estado: 'CONFIRMED_UNASSIGNED',
                    estadoPago: 'APROBADO',
                }),
            })
        );
    });

    it('confirmar pedido → pedido marcado como APROBADO via $transaction', async () => {
        const req = buildRequest({ orderId: 'PED-TEST-001' });
        await POST(req as any);
        expect(txMethods.pedido.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    estadoPago: 'APROBADO',
                }),
            })
        );
    });
});
