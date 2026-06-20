import type { DynamicField } from './dynamic-fields'

export interface InfoCompartido {
    titulo?: { es: string; en: string }
    encuentro?: { es: string; en: string }
    salida?: { es: string; en: string }
    nota?: { es: string; en: string }
}

/**
 * Precios por persona para tours con tarifa POR_PERSONA.
 * - p1: precio por persona cuando va 1 persona
 * - p2: precio por persona cuando van 2 personas
 * - p3: precio por persona cuando van 3 o más personas
 * El total = precioDelTramo * nº personas.
 */
export interface PreciosPorPersona {
    p1: number
    p2: number
    p3: number
}

export type TipoTarifa = 'POR_PERSONA' | null

export interface ServicioConfiguracion {
    camposCustom: DynamicField[]
    infoCompartido?: InfoCompartido | null
    /** Categoría de tarifa. POR_PERSONA => precio por persona en tramos (1/2/3+). */
    tipoTarifa?: TipoTarifa
    /** Precios por persona (solo cuando tipoTarifa === 'POR_PERSONA'). */
    preciosPorPersona?: PreciosPorPersona | null
}

function normalizePreciosPorPersona(value: unknown): PreciosPorPersona | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const v = value as Record<string, unknown>
    const num = (x: unknown) => {
        const n = Number(x)
        return Number.isFinite(n) && n >= 0 ? n : 0
    }
    return { p1: num(v.p1), p2: num(v.p2), p3: num(v.p3) }
}

/** Extrae configuracion de un servicio de forma segura. */
export function getConfiguracion(configuracion: unknown): ServicioConfiguracion {
    if (!configuracion || typeof configuracion !== 'object' || Array.isArray(configuracion)) {
        return { camposCustom: [], tipoTarifa: null, preciosPorPersona: null }
    }
    const c = configuracion as Record<string, unknown>
    const tipoTarifa: TipoTarifa = c.tipoTarifa === 'POR_PERSONA' ? 'POR_PERSONA' : null
    return {
        camposCustom: Array.isArray(c.camposCustom) ? (c.camposCustom as DynamicField[]) : [],
        infoCompartido: (c.infoCompartido as InfoCompartido) ?? null,
        tipoTarifa,
        preciosPorPersona: tipoTarifa === 'POR_PERSONA' ? normalizePreciosPorPersona(c.preciosPorPersona) : null,
    }
}

/** Construye el objeto configuracion para guardar en DB. */
export function buildConfiguracion(
    camposCustom: DynamicField[],
    infoCompartido?: InfoCompartido | null,
    opts?: { tipoTarifa?: TipoTarifa; preciosPorPersona?: PreciosPorPersona | null },
): ServicioConfiguracion {
    const tipoTarifa: TipoTarifa = opts?.tipoTarifa === 'POR_PERSONA' ? 'POR_PERSONA' : null
    return {
        camposCustom: camposCustom ?? [],
        infoCompartido: infoCompartido ?? null,
        tipoTarifa,
        preciosPorPersona: tipoTarifa === 'POR_PERSONA' ? normalizePreciosPorPersona(opts?.preciosPorPersona) : null,
    }
}

/**
 * Devuelve el precio por persona aplicable según el nº de pasajeros.
 * 1 => p1, 2 => p2, 3 o más => p3.
 */
export function precioTramoPorPersona(precios: PreciosPorPersona | null | undefined, pasajeros: number): number {
    if (!precios) return 0
    const n = Math.max(1, Math.floor(pasajeros || 1))
    if (n <= 1) return Number(precios.p1) || 0
    if (n === 2) return Number(precios.p2) || 0
    return Number(precios.p3) || 0
}

/**
 * Total de un tour POR_PERSONA = precio del tramo * nº personas.
 */
export function totalPorPersona(precios: PreciosPorPersona | null | undefined, pasajeros: number): number {
    const n = Math.max(1, Math.floor(pasajeros || 1))
    return precioTramoPorPersona(precios, n) * n
}
