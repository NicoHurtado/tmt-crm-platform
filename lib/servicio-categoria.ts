import { getConfiguracion } from '@/types/servicio-config'

/**
 * Categorización canónica de servicios.
 *
 * Reproduce EXACTAMENTE la cascada que hoy está duplicada en:
 *   - app/admin/dashboard/servicios/page.tsx  (categorizar)
 *   - app/reservas/page.tsx                    (serviciosAeropuerto/Tours/...)
 *
 * Objetivo: una sola fuente de verdad para listar/filtrar/agrupar, sin cambiar
 * el comportamiento visible. `categoria` refleja el bucket actual; `modeloPrecio`
 * describe cómo se calcula el precio (usado por priceCalculator).
 *
 * Importante: los flags booleanos siguen siendo la fuente de verdad del wizard.
 * Estas funciones NO modifican nada, solo derivan un valor a partir de los flags.
 */

export type Categoria =
  | 'AEROPUERTO'
  | 'TOUR_PERSONA'
  | 'COMPARTIDO'
  | 'TRASLADO'
  | 'MUNICIPAL'
  | 'OTRO'

export type ModeloPrecio =
  | 'POR_VEHICULO'
  | 'POR_HORAS'
  | 'POR_PERSONA_TRAMOS'
  | 'COMPARTIDO_POR_PERSONA'

/**
 * Entrada flexible: acepta tanto un `Servicio` de Prisma (que trae `configuracion`
 * JSON y NO trae `tipoTarifa` plano) como el shape de la API/cliente (que sí trae
 * `tipoTarifa` ya extraído). La función resuelve `tipoTarifa` de donde exista.
 */
export interface ServicioCategorizable {
  esAeropuerto?: boolean | null
  esCompartido?: boolean | null
  esMunicipal?: boolean | null
  esTraslado?: boolean | null
  esPorHoras?: boolean | null
  /** Cuando viene del cliente/API ya extraído. */
  tipoTarifa?: 'POR_PERSONA' | null
  /** Cuando viene crudo de Prisma. */
  configuracion?: unknown
}

/** Resuelve tipoTarifa desde el campo plano o desde el JSON `configuracion`. */
function resolveTipoTarifa(s: ServicioCategorizable): 'POR_PERSONA' | null {
  if (s.tipoTarifa === 'POR_PERSONA') return 'POR_PERSONA'
  if (s.tipoTarifa === null) return null
  if (s.configuracion !== undefined) {
    return getConfiguracion(s.configuracion).tipoTarifa === 'POR_PERSONA' ? 'POR_PERSONA' : null
  }
  return null
}

/**
 * Devuelve la categoría visible del servicio.
 *
 * Precedencia (idéntica a la UI actual):
 *   1. esMunicipal            → MUNICIPAL  (tab/flujo propio)
 *   2. esAeropuerto           → AEROPUERTO
 *   3. tipoTarifa POR_PERSONA → TOUR_PERSONA
 *   4. esCompartido           → COMPARTIDO
 *   5. esTraslado             → TRASLADO
 *   6. (resto, incl. por horas) → OTRO
 *
 * Nota: "por horas" cae en OTRO igual que hoy. El modelo de precio por horas se
 * captura aparte en `modeloPrecioDeServicio`.
 */
export function categoriaDeServicio(s: ServicioCategorizable): Categoria {
  if (s.esMunicipal) return 'MUNICIPAL'
  if (s.esAeropuerto) return 'AEROPUERTO'
  if (resolveTipoTarifa(s) === 'POR_PERSONA') return 'TOUR_PERSONA'
  if (s.esCompartido) return 'COMPARTIDO'
  if (s.esTraslado) return 'TRASLADO'
  return 'OTRO'
}

/**
 * Devuelve el modelo de precio del servicio.
 *
 * Precedencia (alineada con lib/priceCalculator.ts y el wizard):
 *   1. tipoTarifa POR_PERSONA → POR_PERSONA_TRAMOS  (precio por tramos 1/2/3+ × personas)
 *   2. esCompartido           → COMPARTIDO_POR_PERSONA (precio del cupo × pasajeros)
 *   3. esPorHoras             → POR_HORAS  (precio del vehículo × horas)
 *   4. (resto)                → POR_VEHICULO (incl. aeropuerto dual, traslado, municipal)
 */
export function modeloPrecioDeServicio(s: ServicioCategorizable): ModeloPrecio {
  if (resolveTipoTarifa(s) === 'POR_PERSONA') return 'POR_PERSONA_TRAMOS'
  if (s.esCompartido) return 'COMPARTIDO_POR_PERSONA'
  if (s.esPorHoras) return 'POR_HORAS'
  return 'POR_VEHICULO'
}

export type TipoServicioEstructural =
  | 'TRANSPORTE_AEROPUERTO'
  | 'TRANSPORTE_MUNICIPAL'
  | 'TOUR_COMPARTIDO'
  | 'TRANSPORTE_POR_HORAS'

/**
 * Deriva el valor del enum legacy `TipoServicio` SOLO cuando los flags lo determinan
 * de forma inequívoca (servicios estructurales). Devuelve `null` para traslados, tours
 * por persona y tours genéricos, donde el tipo concreto (CITY_TOUR, TOUR_GUATAPE, …) no
 * se puede reconstruir desde flags y debe dejarse como esté (OTRO o lo curado a mano).
 *
 * Uso seguro: aplicar solo cuando el valor actual sea OTRO, o en create (default OTRO).
 * Los tours específicos nunca llevan estos flags, así que no hay riesgo de pisarlos.
 */
export function tipoServicioEstructural(s: ServicioCategorizable): TipoServicioEstructural | null {
  if (s.esAeropuerto) return 'TRANSPORTE_AEROPUERTO'
  if (s.esMunicipal) return 'TRANSPORTE_MUNICIPAL'
  if (s.esCompartido) return 'TOUR_COMPARTIDO'
  if (s.esPorHoras) return 'TRANSPORTE_POR_HORAS'
  return null
}
