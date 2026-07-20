import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

/**
 * Contrato REAL de Bold, verificado contra https://developers.bold.co/webhook
 * y contra la API de producción (payments.api.bold.co) el 2026-07-20.
 *
 * El código anterior asumía un payload inventado (`{order_id, payment_status}` en la
 * raíz) y firmaba el body crudo en vez del body en base64. Resultado: ni un solo
 * webhook se procesó jamás — 0 de 1526 reservas tenían `pagoId`.
 */

const SECRET = 'llave-secreta-de-prueba';

/** Firma tal como la calcula Bold: HMAC-SHA256 hex sobre el body en base64. */
function firmaBold(rawBody: string, secret = SECRET): string {
    const enBase64 = Buffer.from(rawBody, 'utf8').toString('base64');
    return crypto.createHmac('sha256', secret).update(enBase64).digest('hex');
}

/** Payload real de Bold para una venta aprobada con botón de pagos. */
function eventoBold(overrides: Record<string, any> = {}) {
    return {
        id: '2d49ef9b-ee8b-47d9-8bb1-ce60bc214116',
        type: 'SALE_APPROVED',
        subject: 'TS1CGZVLR3P',
        source: '/payments/button',
        spec_version: '1.0',
        time: 1761078064992473600,
        data: {
            payment_id: 'TS1CGZVLR3P',
            merchant_id: '9O0KRTMXYO',
            created_at: '2026-07-20T15:20:18-05:00',
            amount: { currency: 'COP', total: 190800, taxes: [], tip: 0 },
            user_id: '66354ce78519a9c7732b179f',
            metadata: { reference: 'RESVRBDX' },
            bold_code: 'B000',
            payer_email: 'cliente@example.com',
            payment_method: 'CARD',
            integration: 'BUTTON',
        },
        datacontenttype: 'application/json',
        ...overrides,
    };
}

describe('verifyBoldWebhookSignature', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env.BOLD_MODE = 'production';
        process.env.BOLD_SECRET_KEY = SECRET;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('acepta la firma calculada como la calcula Bold (HMAC sobre el body en base64)', async () => {
        const { verifyBoldWebhookSignature } = await import('@/lib/bold');
        const body = JSON.stringify(eventoBold());
        expect(verifyBoldWebhookSignature(body, firmaBold(body))).toBe(true);
    });

    it('rechaza la firma calculada sobre el body crudo (el bug anterior)', async () => {
        const { verifyBoldWebhookSignature } = await import('@/lib/bold');
        const body = JSON.stringify(eventoBold());
        const firmaVieja = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
        expect(verifyBoldWebhookSignature(body, firmaVieja)).toBe(false);
    });

    it('rechaza firma ausente, vacía o basura', async () => {
        const { verifyBoldWebhookSignature } = await import('@/lib/bold');
        const body = JSON.stringify(eventoBold());
        expect(verifyBoldWebhookSignature(body, null)).toBe(false);
        expect(verifyBoldWebhookSignature(body, '')).toBe(false);
        expect(verifyBoldWebhookSignature(body, 'no-es-hex')).toBe(false);
    });

    it('rechaza si el body fue alterado después de firmar', async () => {
        const { verifyBoldWebhookSignature } = await import('@/lib/bold');
        const original = JSON.stringify(eventoBold());
        const firma = firmaBold(original);
        const alterado = JSON.stringify(
            eventoBold({ data: { ...eventoBold().data, amount: { currency: 'COP', total: 1 } } })
        );
        expect(verifyBoldWebhookSignature(alterado, firma)).toBe(false);
    });

    it('en modo pruebas Bold firma con llave vacía', async () => {
        vi.stubEnv('BOLD_MODE', 'test');
        vi.resetModules();
        const { verifyBoldWebhookSignature } = await import('@/lib/bold');
        const body = JSON.stringify(eventoBold());
        expect(verifyBoldWebhookSignature(body, firmaBold(body, ''))).toBe(true);
    });
});

describe('parseBoldWebhookEvent', () => {
    it('extrae la referencia desde data.metadata.reference, no desde la raíz', async () => {
        const { parseBoldWebhookEvent } = await import('@/lib/bold');
        const evento = parseBoldWebhookEvent(eventoBold());
        expect(evento.orderId).toBe('RESVRBDX');
        expect(evento.transactionId).toBe('TS1CGZVLR3P');
        expect(evento.amount).toBe(190800);
    });

    it('mapea SALE_APPROVED a aprobado', async () => {
        const { parseBoldWebhookEvent } = await import('@/lib/bold');
        expect(parseBoldWebhookEvent(eventoBold()).estado).toBe('APROBADO');
    });

    it('mapea SALE_REJECTED a rechazado', async () => {
        const { parseBoldWebhookEvent } = await import('@/lib/bold');
        expect(parseBoldWebhookEvent(eventoBold({ type: 'SALE_REJECTED' })).estado).toBe('RECHAZADO');
    });

    it('mapea VOID_APPROVED a anulado', async () => {
        const { parseBoldWebhookEvent } = await import('@/lib/bold');
        expect(parseBoldWebhookEvent(eventoBold({ type: 'VOID_APPROVED' })).estado).toBe('ANULADO');
    });

    it('devuelve estado desconocido para un tipo que no manejamos', async () => {
        const { parseBoldWebhookEvent } = await import('@/lib/bold');
        expect(parseBoldWebhookEvent(eventoBold({ type: 'ALGO_NUEVO' })).estado).toBe('DESCONOCIDO');
    });

    it('no revienta si falta metadata o data', async () => {
        const { parseBoldWebhookEvent } = await import('@/lib/bold');
        expect(parseBoldWebhookEvent({ type: 'SALE_APPROVED' }).orderId).toBeNull();
        expect(parseBoldWebhookEvent({}).orderId).toBeNull();
        expect(parseBoldWebhookEvent(null).orderId).toBeNull();
    });

    it('trata una referencia nula (venta QR sin referencia) como sin orderId', async () => {
        const { parseBoldWebhookEvent } = await import('@/lib/bold');
        const evento = eventoBold();
        evento.data.metadata.reference = null as any;
        expect(parseBoldWebhookEvent(evento).orderId).toBeNull();
    });
});

describe('consultarTransaccionBold', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env.BOLD_MODE = 'production';
        process.env.BOLD_PUBLIC_KEY = 'llave-de-identidad';
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('consulta el endpoint de voucher con la llave de identidad', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                link_id: 'BTN_IJ64G4SU63',
                total: 190800,
                reference_id: 'RESVRBDX',
                payment_status: 'APPROVED',
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const { consultarTransaccionBold } = await import('@/lib/bold');
        const resultado = await consultarTransaccionBold('RESVRBDX');

        expect(fetchMock).toHaveBeenCalledWith(
            'https://payments.api.bold.co/v2/payment-voucher/RESVRBDX',
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'x-api-key llave-de-identidad' }),
            })
        );
        expect(resultado.status).toBe('APPROVED');
        expect(resultado.total).toBe(190800);
    });

    it('NO_TRANSACTION_FOUND significa que el link existe pero nadie pagó', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                link_id: 'BTN_X',
                total: 190800,
                reference_id: 'RESVRBDX',
                payment_status: 'NO_TRANSACTION_FOUND',
            }),
        }));
        const { consultarTransaccionBold } = await import('@/lib/bold');
        expect((await consultarTransaccionBold('RESVRBDX')).status).toBe('NO_TRANSACTION_FOUND');
    });

    it('404 (referencia no encontrada) se reporta como NOT_FOUND, no como aprobado', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({ payload: {}, errors: [{ message: 'La referencia X no fue encontrada' }] }),
        }));
        const { consultarTransaccionBold } = await import('@/lib/bold');
        expect((await consultarTransaccionBold('X')).status).toBe('NOT_FOUND');
    });

    it('si Bold falla o la red cae, NUNCA devuelve APPROVED', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
        const { consultarTransaccionBold } = await import('@/lib/bold');
        const resultado = await consultarTransaccionBold('RESVRBDX');
        expect(resultado.status).toBe('ERROR');
        expect(resultado.status).not.toBe('APPROVED');
    });

    it('401 por llave equivocada se reporta como ERROR', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ errors: [{ message: 'Unauthorized' }] }),
        }));
        const { consultarTransaccionBold } = await import('@/lib/bold');
        expect((await consultarTransaccionBold('X')).status).toBe('ERROR');
    });
});
