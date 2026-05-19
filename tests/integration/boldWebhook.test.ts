import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = 'test-secret-key-for-hmac-testing-only';

function buildSignature(body: string): string {
    return crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

function buildRequest(body: object, signature?: string): Request {
    const json = JSON.stringify(body);
    const sig = signature ?? buildSignature(json);
    return new Request('http://localhost/api/bold/webhook', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-bold-signature': sig,
        },
        body: json,
    });
}

// ─── Mock prisma BEFORE importing the route ───────────────────────────────────

const mockReserva = {
    id: 'reserva-id-1',
    codigo: 'RES-TEST-001',
    estado: 'PENDING_PAYMENT',
    estadoPago: 'PENDIENTE',
    idioma: 'ES',
    servicio: { esCompartido: false },
    conductor: null,
    vehiculo: null,
    aliado: null,
    googleCalendarEventId: null,
    asistentes: [],
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
};

vi.mock('@/lib/prisma', () => ({
    prisma: mockPrismaMethods,
}));

// Mock email-service to avoid actually sending emails
vi.mock('@/lib/email-service', () => ({
    sendPagoAprobadoEmail: vi.fn().mockResolvedValue(undefined),
    sendCambioEstadoEmail: vi.fn().mockResolvedValue(undefined),
    sendReservaConfirmadaEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock google calendar to avoid real API calls
vi.mock('@/lib/google-calendar-service', () => ({
    createCalendarEvent: vi.fn().mockResolvedValue('cal-event-id-test'),
    createOrUpdateTourCompartidoEvent: vi.fn().mockResolvedValue('cal-event-id-tour'),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/bold/webhook', () => {
    let POST: (req: Request) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset mocks to default happy-path state
        mockPrismaMethods.reserva.findUnique.mockResolvedValue({ ...mockReserva });
        mockPrismaMethods.reserva.update.mockResolvedValue({ ...mockReserva, estadoPago: 'APROBADO', estado: 'CONFIRMED_UNASSIGNED' });
        // Import the route handler after mocks are set up
        const mod = await import('@/app/api/bold/webhook/route');
        POST = mod.POST;
    });

    afterEach(() => {
        vi.resetModules();
    });

    // ── Signature verification ─────────────────────────────────────────────────

    it('rechaza webhook con firma inválida → 401', async () => {
        const req = buildRequest({ order_id: 'RES-TEST-001', payment_status: 'approved' }, 'firma_incorrecta');
        const res = await POST(req as any);
        expect(res.status).toBe(401);
        expect(mockPrismaMethods.reserva.update).not.toHaveBeenCalled();
    });

    it('rechaza webhook sin header de firma → 401', async () => {
        const body = JSON.stringify({ order_id: 'RES-TEST-001', payment_status: 'approved' });
        const req = new Request('http://localhost/api/bold/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });
        const res = await POST(req as any);
        expect(res.status).toBe(401);
    });

    // ── Missing fields ─────────────────────────────────────────────────────────

    it('retorna 400 si no hay order_id', async () => {
        const req = buildRequest({ payment_status: 'approved' });
        const res = await POST(req as any);
        expect(res.status).toBe(400);
    });

    // ── Reserva no encontrada ──────────────────────────────────────────────────

    it('retorna 404 si la reserva no existe', async () => {
        mockPrismaMethods.reserva.findUnique.mockResolvedValue(null);
        const req = buildRequest({ order_id: 'RES-INEXISTENTE', payment_status: 'approved' });
        const res = await POST(req as any);
        expect(res.status).toBe(404);
    });

    // ── Pago aprobado ──────────────────────────────────────────────────────────

    it('pago aprobado → actualiza estado a CONFIRMED_UNASSIGNED', async () => {
        const req = buildRequest({
            order_id: 'RES-TEST-001',
            payment_status: 'approved',
            transaction_id: 'TXN-001',
            amount: 150_000,
            currency: 'COP',
        });
        const res = await POST(req as any);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockPrismaMethods.reserva.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    estado: 'CONFIRMED_UNASSIGNED',
                    estadoPago: 'APROBADO',
                    pagoId: 'TXN-001',
                }),
            })
        );
    });

    it('pago aprobado → comisión Bold calculada (6%)', async () => {
        const req = buildRequest({
            order_id: 'RES-TEST-001',
            payment_status: 'approved',
            transaction_id: 'TXN-001',
            amount: 150_000,
            currency: 'COP',
        });
        await POST(req as any);
        expect(mockPrismaMethods.reserva.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    comisionBold: 150_000 * 0.06,
                }),
            })
        );
    });

    // ── Pago rechazado ─────────────────────────────────────────────────────────

    it('pago rechazado → estado PAYMENT_FAILED, estadoPago RECHAZADO', async () => {
        const req = buildRequest({
            order_id: 'RES-TEST-001',
            payment_status: 'rejected',
            currency: 'COP',
        });
        const res = await POST(req as any);
        expect(res.status).toBe(200);
        expect(mockPrismaMethods.reserva.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    estado: 'PAYMENT_FAILED',
                    estadoPago: 'RECHAZADO',
                }),
            })
        );
    });

    it('pago "failed" → mismo resultado que rejected', async () => {
        const req = buildRequest({
            order_id: 'RES-TEST-001',
            payment_status: 'failed',
        });
        const res = await POST(req as any);
        expect(res.status).toBe(200);
        expect(mockPrismaMethods.reserva.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    estado: 'PAYMENT_FAILED',
                    estadoPago: 'RECHAZADO',
                }),
            })
        );
    });

    // ── Idempotencia ───────────────────────────────────────────────────────────

    it('reserva ya APROBADA + webhook approved → responde already_processed sin re-procesar', async () => {
        mockPrismaMethods.reserva.findUnique.mockResolvedValue({
            ...mockReserva,
            estadoPago: 'APROBADO',
        });
        const req = buildRequest({
            order_id: 'RES-TEST-001',
            payment_status: 'approved',
        });
        const res = await POST(req as any);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.already_processed).toBe(true);
        expect(mockPrismaMethods.reserva.update).not.toHaveBeenCalled();
    });
});
