import crypto from 'crypto';

/**
 * Comisión de Bold: 6% sobre el subtotal
 */
export const BOLD_COMMISSION_RATE = 0.06;

export function calculateBoldCommission(amount: number): number {
    return amount * BOLD_COMMISSION_RATE;
}

/**
 * Genera el hash de integridad para Bold.co
 * Según documentación: {OrderId}{Amount}{Currency}{SecretKey}
 * https://developers.bold.co/pagos-en-linea/boton-de-pagos/integracion-manual/integracion-manual
 * 
 * IMPORTANTE: Usa la "Llave Secreta" (BOLD_SECRET_KEY) para firmar el hash
 * La "Llave de Identidad" (BOLD_PUBLIC_KEY) solo se usa en el botón de pago del frontend
 */
export function generateBoldHash(
    orderId: string,
    amount: number,
    currency: string = 'COP'
): string {
    const isTestMode = process.env.BOLD_MODE === 'test';

    // CORRECCIÓN: Usar BOLD_SECRET_KEY (la llave secreta) para firmar el hash
    // NO usar BOLD_PUBLIC_KEY (esa es solo para identificarte en el frontend)
    const integritySecret = isTestMode
        ? process.env.BOLD_SECRET_KEY_TEST
        : process.env.BOLD_SECRET_KEY;

    if (!integritySecret) {
        throw new Error(`BOLD_SECRET_KEY${isTestMode ? '_TEST' : ''} not configured`);
    }

    const amountString = Math.round(amount).toString();
    const concatenatedString = `${orderId}${amountString}${currency}${integritySecret}`;

    return crypto
        .createHash('sha256')
        .update(concatenatedString)
        .digest('hex');
}

/**
 * Valida que el hash recibido sea correcto
 */
export function validateBoldHash(
    orderId: string,
    amount: number,
    currency: string,
    receivedHash: string
): boolean {
    const expectedHash = generateBoldHash(orderId, amount, currency);
    return expectedHash === receivedHash;
}

/**
 * Configuración de Bold
 */
const isTestMode = process.env.BOLD_MODE === 'test';

export const boldConfig = {
    publicKey: isTestMode
        ? (process.env.BOLD_PUBLIC_KEY_TEST || '')
        : (process.env.BOLD_PUBLIC_KEY || ''),
    secretKey: isTestMode
        ? (process.env.BOLD_SECRET_KEY_TEST || '')
        : (process.env.BOLD_SECRET_KEY || ''),
    publicKeyClient: isTestMode
        ? (process.env.NEXT_PUBLIC_BOLD_PUBLIC_KEY_TEST || '')
        : (process.env.NEXT_PUBLIC_BOLD_PUBLIC_KEY || ''),
    checkoutUrl: 'https://checkout.bold.co/payment',
    apiUrl: 'https://api.bold.co',
    currency: 'COP',
    isTestMode,
};

// ─── Webhook ──────────────────────────────────────────────────────────────────

/**
 * Verifica que el webhook venga realmente de Bold.
 *
 * Bold firma así (https://developers.bold.co/webhook):
 *   1. convierte el cuerpo recibido a Base64
 *   2. calcula HMAC-SHA256 de ese Base64 con la llave secreta, en hexadecimal
 *   3. lo envía en el header `x-bold-signature`
 *
 * El paso 1 se había omitido: se firmaba el body crudo, así que ninguna firma
 * coincidía nunca y todos los webhooks se rechazaban con 401. En modo pruebas
 * Bold firma con llave vacía.
 */
export function verifyBoldWebhookSignature(
    rawBody: string,
    signatureHeader: string | null | undefined
): boolean {
    if (!signatureHeader) return false;

    const isTestMode = process.env.BOLD_MODE === 'test';
    const secret = isTestMode ? '' : process.env.BOLD_SECRET_KEY;

    if (secret === undefined) {
        console.error('[Bold] BOLD_SECRET_KEY no configurada — se rechaza el webhook');
        return false;
    }

    const bodyEnBase64 = Buffer.from(rawBody, 'utf8').toString('base64');
    const esperada = crypto
        .createHmac('sha256', secret)
        .update(bodyEnBase64)
        .digest('hex');

    const recibida = Buffer.from(signatureHeader, 'hex');
    const calculada = Buffer.from(esperada, 'hex');
    if (recibida.length !== calculada.length) return false;

    return crypto.timingSafeEqual(recibida, calculada);
}

export type BoldEventoEstado = 'APROBADO' | 'RECHAZADO' | 'ANULADO' | 'DESCONOCIDO';

export interface BoldWebhookEvent {
    /** Nuestro código de reserva o pedido. Bold lo devuelve en data.metadata.reference. */
    orderId: string | null;
    estado: BoldEventoEstado;
    transactionId: string | null;
    amount: number | null;
}

/**
 * Normaliza el payload real de Bold. La forma es:
 *   { id, type: "SALE_APPROVED", subject, source, spec_version, time,
 *     data: { payment_id, amount: { total }, metadata: { reference }, ... } }
 *
 * Antes se leían `order_id` y `payment_status` desde la raíz, campos que Bold nunca
 * envía: siempre resultaban undefined y el webhook respondía 400.
 */
export function parseBoldWebhookEvent(body: any): BoldWebhookEvent {
    const data = body?.data ?? {};
    const referencia = data?.metadata?.reference;

    const estadoPorTipo: Record<string, BoldEventoEstado> = {
        SALE_APPROVED: 'APROBADO',
        SALE_REJECTED: 'RECHAZADO',
        VOID_APPROVED: 'ANULADO',
    };

    return {
        orderId: typeof referencia === 'string' && referencia !== '' ? referencia : null,
        estado: estadoPorTipo[body?.type] ?? 'DESCONOCIDO',
        transactionId: typeof data?.payment_id === 'string' ? data.payment_id : null,
        amount: typeof data?.amount?.total === 'number' ? data.amount.total : null,
    };
}

// ─── Consulta activa de transacciones ─────────────────────────────────────────

/**
 * Estados que puede devolver Bold para una transacción.
 * NOT_FOUND y ERROR son nuestros, para no confundir "no sé" con "no aprobado".
 */
export type BoldTransaccionStatus =
    | 'APPROVED'
    | 'REJECTED'
    | 'FAILED'
    | 'VOIDED'
    | 'PROCESSING'
    | 'PENDING'
    | 'NO_TRANSACTION_FOUND'
    | 'NOT_FOUND'
    | 'ERROR';

export interface BoldTransaccion {
    status: BoldTransaccionStatus;
    total: number | null;
    referenceId: string | null;
}

const BOLD_VOUCHER_URL = 'https://payments.api.bold.co/v2/payment-voucher';

/**
 * Consulta el estado real de una transacción en Bold.
 *
 * Se autentica con la LLAVE DE IDENTIDAD (BOLD_PUBLIC_KEY), no con la secreta.
 * Bold solo expone la transacción entre ~10 minutos y 24 horas después del pago,
 * así que sirve para confirmar al vuelta del checkout, no para auditorías viejas.
 *
 * Ante cualquier duda (red caída, 401, 500) devuelve ERROR — nunca APPROVED.
 * Quien llame debe tratar todo lo que no sea APPROVED como "no confirmado".
 */
export async function consultarTransaccionBold(orderId: string): Promise<BoldTransaccion> {
    const llaveIdentidad = boldConfig.publicKey;

    if (!llaveIdentidad) {
        console.error('[Bold] Llave de identidad no configurada — no se puede verificar el pago');
        return { status: 'ERROR', total: null, referenceId: null };
    }

    try {
        const res = await fetch(`${BOLD_VOUCHER_URL}/${encodeURIComponent(orderId)}`, {
            headers: {
                Authorization: `x-api-key ${llaveIdentidad}`,
                'Content-Type': 'application/json',
            },
        });

        if (res.status === 404) {
            return { status: 'NOT_FOUND', total: null, referenceId: null };
        }

        if (!res.ok) {
            console.error(`[Bold] Consulta de ${orderId} respondió ${res.status}`);
            return { status: 'ERROR', total: null, referenceId: null };
        }

        const json: any = await res.json();
        const status = json?.payment_status;

        return {
            status: typeof status === 'string' ? (status as BoldTransaccionStatus) : 'ERROR',
            total: typeof json?.total === 'number' ? json.total : null,
            referenceId: typeof json?.reference_id === 'string' ? json.reference_id : null,
        };
    } catch (error) {
        console.error(`[Bold] Error consultando ${orderId}:`, error);
        return { status: 'ERROR', total: null, referenceId: null };
    }
}

/**
 * Estados de Bold mapeados
 */
export const boldPaymentStatus = {
    APPROVED: 'approved',
    REJECTED: 'rejected',
    PENDING: 'pending',
    FAILED: 'failed',
} as const;

export type BoldPaymentStatus = typeof boldPaymentStatus[keyof typeof boldPaymentStatus];
