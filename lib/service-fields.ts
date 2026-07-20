/**
 * Single source of truth for which fields each service type requires.
 *
 * Usage:
 *   const campos = getCamposBuiltin(service)
 *   // → validate, determine which sections to show, generate error messages
 */

export type BuiltinFieldId =
    | 'fecha'
    | 'hora'
    | 'municipio'
    | 'numeroPasajeros'
    | 'vehiculoId'
    | 'lugarRecogida'
    | 'aeropuertoTipo'
    | 'aeropuertoNombre'
    | 'numeroVuelo'
    | 'trasladoTipo'
    | 'trasladoDestino'
    | 'cantidadHoras';

export interface CampoBuiltin {
    id: BuiltinFieldId;
    labelEs: string;
    labelEn: string;
    /** true = siempre requerido; function = requerido condicionalmente según formData */
    required: boolean | ((formData: Record<string, any>) => boolean);
}

export interface ServiceDescriptor {
    esCompartido?: boolean;
    esAeropuerto?: boolean;
    esMunicipal?: boolean;
    esTraslado?: boolean;
    esPorHoras?: boolean;
    /** 'POR_PERSONA' => tour con precio por persona (formulario ágil con dirección de recogida). */
    tipoTarifa?: 'POR_PERSONA' | null;
}

/**
 * Returns the ordered list of built-in field definitions for a given service.
 * Custom admin fields (camposPersonalizados) are handled separately in DynamicFields.
 */
export function getCamposBuiltin(service: ServiceDescriptor): CampoBuiltin[] {
    // Shared tours have a minimal, fixed set of fields.
    // `hora` se auto-rellena desde infoTourCompartido.salida cuando está configurada,
    // pero sigue siendo obligatoria: sin ella el evento de Google Calendar no se crea.
    if (service.esCompartido) {
        return [
            { id: 'fecha', required: true, labelEs: 'Fecha', labelEn: 'Date' },
            { id: 'hora', required: true, labelEs: 'Hora', labelEn: 'Time' },
            { id: 'numeroPasajeros', required: true, labelEs: 'Pasajeros', labelEn: 'Passengers' },
        ];
    }

    // Tours con precio por persona: formulario ágil con dirección de recogida
    if (service.tipoTarifa === 'POR_PERSONA') {
        return [
            { id: 'fecha', required: true, labelEs: 'Fecha', labelEn: 'Date' },
            { id: 'hora', required: true, labelEs: 'Hora', labelEn: 'Time' },
            { id: 'numeroPasajeros', required: true, labelEs: 'Pasajeros', labelEn: 'Passengers' },
            { id: 'lugarRecogida', required: true, labelEs: 'Dirección de recogida', labelEn: 'Pickup address' },
        ];
    }

    const campos: CampoBuiltin[] = [
        { id: 'fecha', required: true, labelEs: 'Fecha', labelEn: 'Date' },
        { id: 'hora', required: true, labelEs: 'Hora', labelEn: 'Time' },
        { id: 'municipio', required: true, labelEs: 'Municipio', labelEn: 'Municipality' },
        { id: 'numeroPasajeros', required: true, labelEs: 'Pasajeros', labelEn: 'Passengers' },
        { id: 'vehiculoId', required: true, labelEs: 'Vehículo', labelEn: 'Vehicle' },
    ];

    if (service.esAeropuerto) {
        campos.push(
            { id: 'aeropuertoTipo', required: true, labelEs: 'Dirección aeropuerto', labelEn: 'Airport direction' },
            { id: 'aeropuertoNombre', required: false, labelEs: 'Aeropuerto', labelEn: 'Airport' },
            { id: 'lugarRecogida', required: true, labelEs: 'Lugar de recogida / destino', labelEn: 'Pickup / drop-off location' },
            {
                id: 'numeroVuelo',
                // Required only when travelling FROM the airport (arrival flight)
                required: (f) => f.aeropuertoTipo === 'DESDE',
                labelEs: 'Número de vuelo',
                labelEn: 'Flight number',
            },
        );
    } else if (service.esMunicipal || service.esTraslado) {
        campos.push(
            { id: 'trasladoTipo', required: true, labelEs: 'Dirección del traslado', labelEn: 'Transfer direction' },
            { id: 'lugarRecogida', required: true, labelEs: 'Origen', labelEn: 'Origin' },
            {
                id: 'trasladoDestino',
                // Required only when travelling FROM the municipality
                required: (f) => f.trasladoTipo === 'DESDE_MUNICIPIO',
                labelEs: 'Destino',
                labelEn: 'Destination',
            },
        );
    } else {
        campos.push(
            { id: 'lugarRecogida', required: true, labelEs: 'Lugar de recogida', labelEn: 'Pickup location' },
        );
    }

    if (service.esPorHoras) {
        campos.push(
            { id: 'cantidadHoras', required: true, labelEs: 'Cantidad de horas', labelEn: 'Number of hours' },
        );
    }

    return campos;
}

/**
 * Evaluates whether a single campo is required given current form state.
 */
export function isBuiltinRequired(campo: CampoBuiltin, formData: Record<string, any>): boolean {
    if (typeof campo.required === 'function') return campo.required(formData);
    return campo.required;
}

/**
 * Returns the list of required field IDs that are missing from formData.
 * Useful for step validation.
 */
export function getMissingBuiltinFields(
    service: ServiceDescriptor,
    formData: Record<string, any>,
): CampoBuiltin[] {
    return getCamposBuiltin(service).filter((campo) => {
        if (!isBuiltinRequired(campo, formData)) return false;
        const val = formData[campo.id];
        return val === undefined || val === null || val === '' || val === 0;
    });
}
