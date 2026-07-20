import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

/**
 * Estos tests usan el payload y la firma REALES de Bold
 * (https://developers.bold.co/webhook, verificado el 2026-07-20).
 *
 * La versión anterior de este archivo inventaba el contrato: mandaba
 * `{order_id, payment_status}` en la raíz y firmaba el body crudo. Los tests pasaban
 * porque el handler asumía exactamente lo mismo, pero en producción no se procesó ni
 * un solo webhook: 0 de 1526 reservas tenían `pagoId`.
 */

const SECRET = 'test-secret-key-for-hmac-testing-only';

/** Firma como Bold: HMAC-SHA256 hex sobre el cuerpo convertido a base64. */
function buildSignature(body: string): string {
    const enBase64 = Buffer.from(body, 'utf8').toString('base64');
    return crypto.createHmac('sha256', SECRET).update(enBase64).digest('hex');
}

/** Evento real de Bold. `reference` es nuestro código de reserva o pedido. */
function eventoBold(
    reference: string | null,
    type: string = 'SALE_APPROVED',
    extra: { paymentId?: string; total?: number } = {}
) {
    return {
        id: 'c1d4e7f0-a3b8-4c9d-8e7f-1a2b3c4d5e6f',
        type,
        subject: extra.paymentId ?? 'TXN-001',
        source: '/payments/button',
        spec_version: '1.0',
        time: 1761065000000000000,
        data: {
            payment_id: extra.paymentId ?? 'TXN-001',
            merchant_id: 'MCNT2026XYZ',
            created_at: '2026-07-20T12:40:00-05:00',
            amount: { currency: 'COP', total: extra.total ?? 150_000, taxes: [], tip: 0 },
            user_id: 'user_9876543210',
            metadata: { reference },
            bold_code: 'B000',
            payer_email: 'cliente@example.com',
            payment_method: 'CARD',
        },
        datacontenttype: 'application/json',
    };
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

vi.mock('@/lib/email-service', () => ({
    sendPagoAprobadoEmail: vi.fn().mockResolvedValue(undefined),
    sendCambioEstadoEmail: vi.fn().mockResolvedValue(undefined),
    sendReservaConfirmadaEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/google-calendar-service', () => ({
    createCalendarEvent: vi.fn().mockResolvedValue('cal-event-id-test'),
    createOrUpdateTourCompartidoEvent: vi.fn().mockResolvedValue('cal-event-id-tour'),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/bold/webhook', () => {
    let POST: (req: Request) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.BOLD_MODE = 'production';
        process.env.BOLD_SECRET_KEY = SECRET;
        mockPrismaMethods.reserva.findUnique.mockResolvedValue({ ...mockReserva });
        mockPrismaMethods.reserva.update.mockResolvedValue({
            ...mockReserva,
            estadoPago: 'APROBADO',
            estado: 'CONFIRMED_UNASSIGNED',
        });
        const mod = await import('@/app/api/bold/webhook/route');
        POST = mod.POST;
    });

    afterEach(() => {
        vi.resetModules();
    });

    // ── Verificación de firma ──────────────────────────────────────────────────

    it('acepta la firma real de Bold y procesa el evento', async () => {
        const res = await POST(buildRequest(eventoBold('RES-TEST-001')) as any);
        expect(res.status).toBe(200);
        expect(mockPrismaMethods.reserva.update).toHaveBeenCalled();
    });

    it('rechaza webhook con firma inválida → 401', async () => {
        const req = buildRequest(eventoBold('RES-TEST-001'), 'firma_incorrecta');
        const res = await POST(req as any);
        expect(res.status).toBe(401);
        expect(mockPrismaMethods.reserva.update).not.toHaveBeenCalled();
    });

    it('rechaza una firma calculada sobre el body crudo (contrato viejo) → 401', async () => {
        const json = JSON.stringify(eventoBold('RES-TEST-001'));
        const firmaVieja = crypto.createHmac('sha256', SECRET).update(json).digest('hex');
        const req = new Request('http://localhost/api/bold/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-bold-signature': firmaVieja },
            body: json,
        });
        const res = await POST(req as any);
        expect(res.status).toBe(401);
    });

    it('rechaza webhook sin header de firma → 401', async () => {
        const req = new Request('http://localhost/api/bold/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventoBold('RES-TEST-001')),
        });
        const res = await POST(req as any);
        expect(res.status).toBe(401);
    });

    // ── Eventos sin referencia o de tipo desconocido ───────────────────────────

    it('evento sin referencia (venta QR de mostrador) → 200 sin tocar nada', async () => {
        const res = await POST(buildRequest(eventoBold(null)) as any);
        expect(res.status).toBe(200);
        expect(mockPrismaMethods.reserva.update).not.toHaveBeenCalled();
    });

    it('tipo de evento no manejado → 200 sin tocar nada', async () => {
        const res = await POST(buildRequest(eventoBold('RES-TEST-001', 'ALGO_NUEVO')) as any);
        expect(res.status).toBe(200);
        expect(mockPrismaMethods.reserva.update).not.toHaveBeenCalled();
    });

    // ── Reserva no encontrada ──────────────────────────────────────────────────

    it('retorna 404 si la reserva no existe', async () => {
        mockPrismaMethods.reserva.findUnique.mockResolvedValue(null);
        const res = await POST(buildRequest(eventoBold('RES-INEXISTENTE')) as any);
        expect(res.status).toBe(404);
    });

    // ── Pago aprobado ──────────────────────────────────────────────────────────

    it('SALE_APPROVED → estado CONFIRMED_UNASSIGNED y pagoId guardado', async () => {
        const evento = eventoBold('RES-TEST-001', 'SALE_APPROVED', {
            paymentId: 'TXN-001',
            total: 150_000,
        });
        const res = await POST(buildRequest(evento) as any);
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

    it('SALE_APPROVED → comisión Bold calculada (6%) sobre data.amount.total', async () => {
        const evento = eventoBold('RES-TEST-001', 'SALE_APPROVED', { total: 150_000 });
        await POST(buildRequest(evento) as any);
        expect(mockPrismaMethods.reserva.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ comisionBold: 150_000 * 0.06 }),
            })
        );
    });

    // ── Pago rechazado / anulado ───────────────────────────────────────────────

    it('SALE_REJECTED → estado PAYMENT_FAILED, estadoPago RECHAZADO', async () => {
        const res = await POST(buildRequest(eventoBold('RES-TEST-001', 'SALE_REJECTED')) as any);
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

    it('VOID_APPROVED → marca el pago rechazado pero NO cancela el servicio', async () => {
        const res = await POST(buildRequest(eventoBold('RES-TEST-001', 'VOID_APPROVED')) as any);
        expect(res.status).toBe(200);
        const llamada = mockPrismaMethods.reserva.update.mock.calls[0][0];
        expect(llamada.data.estadoPago).toBe('RECHAZADO');
        expect(llamada.data.estado).toBeUndefined();
    });

    // ── Idempotencia ───────────────────────────────────────────────────────────

    it('reserva ya APROBADA + SALE_APPROVED → already_processed sin re-procesar', async () => {
        mockPrismaMethods.reserva.findUnique.mockResolvedValue({
            ...mockReserva,
            estadoPago: 'APROBADO',
        });
        const res = await POST(buildRequest(eventoBold('RES-TEST-001')) as any);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.already_processed).toBe(true);
        expect(mockPrismaMethods.reserva.update).not.toHaveBeenCalled();
    });
});
