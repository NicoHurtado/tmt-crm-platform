// lib/anticipo.ts
//
// Pago con anticipo del 30 % para las cotizaciones del agente de WhatsApp.
//
// La reserva conserva su precio total. El anticipo se cobra en Bold con un orderId
// propio (`{codigo}-A30`) para no chocar con el orderId del pago total (`{codigo}`).
// Bold cobra la comisión de tarjeta (6 %) solo sobre lo que se paga con tarjeta; el
// saldo se paga al llegar (efectivo en pesos o dólares, o tarjeta).
import { calculateBoldCommission } from '@/lib/bold';

export const PORCENTAJE_ANTICIPO = 0.3;
export const SUFIJO_ANTICIPO = '-A30';

export interface InfoAnticipo {
    /** 30 % del valor del servicio (sin comisión de tarjeta). */
    anticipoBase: number;
    /** Lo que se cobra en Bold por el anticipo: base + comisión de tarjeta. */
    anticipoCobro: number;
    /** Lo que queda por pagar al llegar (sin comisión de tarjeta). */
    saldo: number;
    /** Valor del servicio sin comisión de tarjeta. */
    subtotal: number;
}

/** Calcula el anticipo a partir del total con tarjeta y su comisión. Montos enteros en COP. */
export function calcularAnticipo(precioTotal: number, comisionBold: number): InfoAnticipo {
    const subtotal = Math.max(0, Math.round(Number(precioTotal) - Number(comisionBold || 0)));
    const anticipoBase = Math.round(subtotal * PORCENTAJE_ANTICIPO);
    const anticipoCobro = anticipoBase + Math.round(calculateBoldCommission(anticipoBase));
    return { anticipoBase, anticipoCobro, saldo: subtotal - anticipoBase, subtotal };
}

/** Separa el orderId de Bold en código de reserva y modalidad. */
export function parseOrderId(orderId: string): { codigo: string; esAnticipo: boolean } {
    const id = String(orderId || '');
    if (id.endsWith(SUFIJO_ANTICIPO)) {
        return { codigo: id.slice(0, -SUFIJO_ANTICIPO.length), esAnticipo: true };
    }
    return { codigo: id, esAnticipo: false };
}

export function orderIdAnticipo(codigo: string): string {
    return `${codigo}${SUFIJO_ANTICIPO}`;
}

function cop(n: number): string {
    return '$' + Math.round(n).toLocaleString('es-CO');
}

/**
 * Cambios que se aplican a la reserva cuando Bold aprueba el anticipo:
 * - `datos.pago` deja constancia estructurada (la lee n8n para el mensaje de confirmación).
 * - `notas` agrega una línea visible en el backoffice para que el equipo cobre el saldo.
 */
export function cambiosPorAnticipo(reserva: { precioTotal: unknown; comisionBold: unknown; datos: unknown; notas: string | null }, montoPagado?: number | null) {
    const info = calcularAnticipo(Number(reserva.precioTotal), Number(reserva.comisionBold ?? 0));
    const pagado = montoPagado && montoPagado > 0 ? Math.round(montoPagado) : info.anticipoCobro;
    const datos = (reserva.datos && typeof reserva.datos === 'object' && !Array.isArray(reserva.datos))
        ? { ...(reserva.datos as Record<string, unknown>) }
        : {};
    datos.pago = {
        modalidad: 'ANTICIPO_30',
        montoPagado: pagado,
        anticipoBase: info.anticipoBase,
        saldoPorCobrar: info.saldo,
        fecha: new Date().toISOString(),
    };
    const linea = `💳 Anticipo 30 % pagado con Bold: ${cop(pagado)}. SALDO por cobrar al llegar: ${cop(info.saldo)} (efectivo en pesos o dólares, o tarjeta + 6 %).`;
    const notas = reserva.notas && reserva.notas.includes('Anticipo 30 %') ? reserva.notas : [reserva.notas, linea].filter(Boolean).join('\n');
    return { datos, notas, info: { ...info, montoPagado: pagado } };
}

/** Marca un pago total con la misma estructura, para que n8n distinga la modalidad. */
export function datosPagoTotal(reservaDatos: unknown, montoPagado?: number | null) {
    const datos = (reservaDatos && typeof reservaDatos === 'object' && !Array.isArray(reservaDatos))
        ? { ...(reservaDatos as Record<string, unknown>) }
        : {};
    if (!datos.pago) {
        datos.pago = { modalidad: 'TOTAL', montoPagado: montoPagado ?? null, saldoPorCobrar: 0, fecha: new Date().toISOString() };
    }
    return datos;
}
