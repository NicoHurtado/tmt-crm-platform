import type { DynamicField } from './dynamic-fields'

export interface InfoCompartido {
    titulo?: { es: string; en: string }
    encuentro?: { es: string; en: string }
    salida?: { es: string; en: string }
    nota?: { es: string; en: string }
}

export interface ServicioConfiguracion {
    camposCustom: DynamicField[]
    infoCompartido?: InfoCompartido | null
}

/** Extrae configuracion de un servicio de forma segura. */
export function getConfiguracion(configuracion: unknown): ServicioConfiguracion {
    if (!configuracion || typeof configuracion !== 'object' || Array.isArray(configuracion)) {
        return { camposCustom: [] }
    }
    const c = configuracion as Record<string, unknown>
    return {
        camposCustom: Array.isArray(c.camposCustom) ? (c.camposCustom as DynamicField[]) : [],
        infoCompartido: (c.infoCompartido as InfoCompartido) ?? null,
    }
}

/** Construye el objeto configuracion para guardar en DB. */
export function buildConfiguracion(
    camposCustom: DynamicField[],
    infoCompartido?: InfoCompartido | null,
): ServicioConfiguracion {
    return {
        camposCustom: camposCustom ?? [],
        infoCompartido: infoCompartido ?? null,
    }
}
