/**
 * La comisión del aliado NUNCA se le muestra al cliente final.
 * Para respuestas públicas (tracking, pedido) se suma al precio base —así el desglose
 * sigue cuadrando con el total— y se eliminan los campos que la revelan.
 * Del aliado solo se exponen los datos que necesita la UI pública.
 */
type ConComision = {
    precioBase?: unknown;
    comisionAliado?: unknown;
    aliado?: Record<string, unknown> | null;
    [key: string]: unknown;
};

export function aliadoPublico(aliado: Record<string, unknown> | null | undefined) {
    if (!aliado) return aliado ?? null;
    const { id, nombre, tipo, codigo, imagen, soloPagoTarjeta, soloPagoEfectivo } = aliado;
    return { id, nombre, tipo, codigo, imagen, soloPagoTarjeta, soloPagoEfectivo };
}

export function ocultarComisionAliado<T extends ConComision>(reserva: T): T {
    const comision = Number(reserva.comisionAliado ?? 0);
    const { comisionAliado: _omit, ...resto } = reserva;
    const out: ConComision = {
        ...resto,
        precioBase: Number(reserva.precioBase ?? 0) + (Number.isFinite(comision) ? comision : 0),
    };
    if ('aliado' in reserva) out.aliado = aliadoPublico(reserva.aliado);
    return out as T;
}
