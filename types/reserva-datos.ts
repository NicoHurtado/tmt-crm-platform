/**
 * Tipo para el campo datos de Reserva.
 * Unifica todos los datos específicos por tipo de servicio + campos dinámicos del admin.
 */
export interface DatosReserva {
    // Aeropuerto
    aeropuertoTipo?: 'DESDE' | 'HACIA'
    aeropuertoNombre?: 'JOSE_MARIA_CORDOVA' | 'OLAYA_HERRERA'
    numeroVuelo?: string

    // Común a varios tipos
    lugarRecogida?: string
    trasladoTipo?: 'DESDE_UBICACION' | 'DESDE_MUNICIPIO'
    trasladoDestino?: string

    // Tours
    guiaCertificado?: boolean
    vueltaBote?: boolean
    cantidadAlmuerzos?: number
    cantidadMotos?: number
    cantidadParticipantes?: number

    // Por horas
    cantidadHoras?: number

    // Campos dinámicos del admin (camposPersonalizados)
    [key: string]: unknown
}

/** Extrae y castea datos de una reserva de forma segura. */
export function getDatos(datos: unknown): DatosReserva {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return {}
    return datos as DatosReserva
}

/** Construye el objeto datos a partir de los campos del body de la request. */
export function buildDatosFromBody(body: Record<string, any>): DatosReserva {
    const datos: DatosReserva = {}

    if (body.aeropuertoTipo) datos.aeropuertoTipo = body.aeropuertoTipo
    if (body.aeropuertoNombre) datos.aeropuertoNombre = body.aeropuertoNombre
    if (body.numeroVuelo) datos.numeroVuelo = body.numeroVuelo
    if (body.lugarRecogida) datos.lugarRecogida = body.lugarRecogida
    if (body.trasladoTipo) datos.trasladoTipo = body.trasladoTipo
    if (body.trasladoDestino) datos.trasladoDestino = body.trasladoDestino
    if (body.guiaCertificado !== undefined) datos.guiaCertificado = body.guiaCertificado
    if (body.vueltaBote !== undefined) datos.vueltaBote = body.vueltaBote
    if (body.cantidadAlmuerzos) datos.cantidadAlmuerzos = parseInt(body.cantidadAlmuerzos)
    if (body.cantidadMotos) datos.cantidadMotos = parseInt(body.cantidadMotos)
    if (body.cantidadParticipantes) datos.cantidadParticipantes = parseInt(body.cantidadParticipantes)
    if (body.cantidadHoras) datos.cantidadHoras = parseInt(body.cantidadHoras)

    // Campos dinámicos del admin
    if (body.datosDinamicos && typeof body.datosDinamicos === 'object') {
        Object.assign(datos, body.datosDinamicos)
    }

    return datos
}
