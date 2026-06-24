import { Servicio, Municipio } from '@prisma/client';
import {
    DynamicField,
    DynamicFieldValues,
    validateDynamicFields,
} from '@/types/dynamic-fields';
import { getConfiguracion, totalPorPersona } from '@/types/servicio-config';
import { MUNICIPALITY_PRICES, isNightSurchargeApplicable } from '@/lib/pricing';

// ============================================
// TYPES
// ============================================

export interface PriceBreakdownItem {
    concepto: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
}

export interface PriceBreakdown {
    precioBase: number;
    camposDinamicos: PriceBreakdownItem[];
    recargoNocturno: number;
    tarifaMunicipio: number;
    descuentoAliado: number;
    comisionAliado: number;
    subtotal: number;
    total: number;
}

export interface AliadoConfig {
    tarifaMunicipio?: number;
    // Precio base del vehículo configurado por el admin para este aliado
    // (PrecioVehiculoAliado.precioBase). Reemplaza a ServicioVehiculo.precio en
    // reservas que vienen por código o link de aliado.
    precioBaseAliado?: number;
    // Comisión calculada para el vehículo seleccionado en PrecioVehiculoAliado
    comisionPorcentaje?: number;
    tipoComision?: 'FIJO' | 'PORCENTAJE';
    // Config alterna para aeropuerto Olaya Herrera (PrecioVehiculoAliado.*Olaya).
    // null/undefined = usa los campos JMC de arriba (fallback).
    precioBaseAliadoOlaya?: number | null;
    comisionPorcentajeOlaya?: number | null;
    tipoComisionOlaya?: 'FIJO' | 'PORCENTAJE' | null;
    sobrescribirRecargoNocturno?: boolean;
    aplicaRecargoNocturno?: boolean;
    recargoNocturnoInicio?: string;
    recargoNocturnoFin?: string;
    montoRecargoNocturno?: number;
}

export type AeropuertoNombreInput = 'JOSE_MARIA_CORDOVA' | 'OLAYA_HERRERA';

// ============================================
// SERVER-SIDE PRICE CALCULATION
// ============================================

/**
 * 🔥 CRITICAL SECURITY FUNCTION
 *
 * Calculates reservation price ENTIRELY from database configuration.
 * Frontend sends ONLY field values, NEVER prices.
 *
 * Flow:
 * 1. Frontend sends: { servicioId, vehiculoId, datosDinamicos: { "almuerzos": 3 } }
 * 2. Backend fetches service from DB
 * 3. Backend reads camposPersonalizados JSON from DB
 * 4. Backend finds "almuerzos" field config, reads precioUnitario from DB
 * 5. Backend calculates: 3 * precioUnitario_from_DB
 * 6. Backend returns calculated total
 *
 * ⚠️ NEVER accept prices from frontend - always recalculate from DB
 */
export async function calculateReservationPrice(
    servicio: Servicio & {
        vehiculosPermitidos: { vehiculoId: string; precio: any; precioOlaya?: any }[];
    },
    vehiculoId: string,
    datosDinamicos: DynamicFieldValues,
    fecha: Date,
    hora: string,
    municipio: Municipio,
    aliadoConfig?: AliadoConfig,
    cantidadHoras?: number,
    aeropuertoNombre?: AeropuertoNombreInput | null,
    numeroPasajeros?: number
): Promise<PriceBreakdown> {
    const pax = Math.max(1, Math.floor(numeroPasajeros || 1));

    // 0. Tour POR PERSONA: total = precio del tramo (1/2/3+) × nº de personas.
    //    Sin vehículo, sin municipio, sin recargos ni adicionales (mismo modelo que el
    //    flujo web y recalcularPrecioWebDirecto). Se resuelve antes de tocar vehículos.
    const cfg = getConfiguracion((servicio as any).configuracion);
    if (cfg.tipoTarifa === 'POR_PERSONA') {
        const precioBasePP = totalPorPersona(cfg.preciosPorPersona, pax);
        if (!Number.isFinite(precioBasePP) || precioBasePP <= 0) {
            throw new Error('El servicio es por persona pero no tiene precios por persona configurados');
        }
        return {
            precioBase: precioBasePP,
            camposDinamicos: [],
            recargoNocturno: 0,
            tarifaMunicipio: 0,
            descuentoAliado: 0,
            comisionAliado: 0,
            subtotal: precioBasePP,
            total: precioBasePP,
        };
    }

    // 1. Get base price.
    //    - Cliente independiente (sin aliadoConfig): usa ServicioVehiculo.precio (precio público).
    //    - Cliente bajo aliado (con aliadoConfig.precioBaseAliado): usa el precio base configurado
    //      por el admin en PrecioVehiculoAliado.precioBase para ese (aliado, servicio, vehículo).
    //    Las dos rutas son independientes — cambiar una NO afecta a la otra.
    const vehiculoConfig = servicio.vehiculosPermitidos.find(
        (v) => v.vehiculoId === vehiculoId
    );
    if (!vehiculoConfig) {
        throw new Error('Vehículo no disponible para este servicio');
    }
    // Para aeropuerto Olaya Herrera se usa el precio alterno si está configurado
    // (con fallback al precio José María Córdova / por defecto).
    const esOlaya = !!servicio.esAeropuerto && aeropuertoNombre === 'OLAYA_HERRERA';
    let precioBase: number;
    if (aliadoConfig && aliadoConfig.precioBaseAliado !== undefined) {
        const baseOlaya = aliadoConfig.precioBaseAliadoOlaya;
        precioBase = esOlaya && baseOlaya != null && Number(baseOlaya) > 0
            ? Number(baseOlaya)
            : Number(aliadoConfig.precioBaseAliado);
        if (!Number.isFinite(precioBase) || precioBase <= 0) {
            throw new Error('Este aliado no tiene precio configurado para el vehículo seleccionado');
        }
    } else {
        const precioOlaya = (vehiculoConfig as any).precioOlaya;
        precioBase = esOlaya && precioOlaya != null && Number(precioOlaya) > 0
            ? Number(precioOlaya)
            : Number(vehiculoConfig.precio);
        if (!Number.isFinite(precioBase) || precioBase <= 0) {
            throw new Error('Este servicio no tiene precio configurado para el vehículo seleccionado');
        }
    }

    // 1b. If service has esPorHoras module, multiply base price by hours
    if (servicio.esPorHoras && cantidadHoras && cantidadHoras > 0) {
        precioBase = precioBase * cantidadHoras;
    }

    // 1c. Compartido: el precio del cupo es POR PERSONA → precio del cupo × nº de pasajeros,
    //     sin adicionales/recargo/municipio (mismo modelo que el wizard web y
    //     recalcularPrecioWebDirecto). Se resuelve aquí para no aplicar recargos indebidos.
    if (servicio.esCompartido) {
        const precioBaseCompartido = precioBase * pax;
        return {
            precioBase: precioBaseCompartido,
            camposDinamicos: [],
            recargoNocturno: 0,
            tarifaMunicipio: 0,
            descuentoAliado: 0,
            comisionAliado: 0,
            subtotal: precioBaseCompartido,
            total: precioBaseCompartido,
        };
    }

    // 2. Validate and parse dynamic fields configuration from DB
    const camposConfig = validateDynamicFields(getConfiguracion((servicio as any).configuracion).camposCustom);

    // 3. Calculate dynamic field prices
    const camposDinamicos: PriceBreakdownItem[] = [];

    for (const campo of camposConfig) {
        if (!campo.tienePrecio || !campo.precioUnitario) continue;

        const valorUsuario = datosDinamicos[campo.clave];
        if (valorUsuario === undefined || valorUsuario === null) continue;

        let cantidad = 0;
        let precioUnitario = campo.precioUnitario;

        switch (campo.tipo) {
            case 'COUNTER':
                // User selected a quantity
                cantidad = Number(valorUsuario);
                if (isNaN(cantidad) || cantidad < 0) {
                    throw new Error(`Valor inválido para campo ${campo.clave}`);
                }
                break;

            case 'SWITCH':
                // Boolean field - if true, charge once
                cantidad = valorUsuario === true ? 1 : 0;
                break;

            case 'SELECT':
                // Find the selected option's price
                if (campo.tipo === 'SELECT' && 'opciones' in campo) {
                    const opcionSeleccionada = campo.opciones.find(
                        (opt) => opt.valor === valorUsuario
                    );
                    if (opcionSeleccionada?.precio) {
                        cantidad = 1;
                        precioUnitario = opcionSeleccionada.precio;
                    }
                }
                break;
        }

        if (cantidad > 0) {
            camposDinamicos.push({
                concepto: campo.etiqueta.es, // Use Spanish label for breakdown
                cantidad,
                precioUnitario,
                total: cantidad * precioUnitario,
            });
        }
    }

    // 4. Calculate night surcharge
    // Priority: aliadoConfig override > service default
    let recargoNocturno = 0;

    // Determine which configuration to use
    let aplicaRecargo = servicio.aplicaRecargoNocturno;
    let montoRecargo = servicio.montoRecargoNocturno;
    let horaInicioRecargo = servicio.recargoNocturnoInicio;
    let horaFinRecargo = servicio.recargoNocturnoFin;

    // If ally has override configuration, use it instead
    if (aliadoConfig?.sobrescribirRecargoNocturno) {
        aplicaRecargo = aliadoConfig.aplicaRecargoNocturno ?? false;
        montoRecargo = aliadoConfig.montoRecargoNocturno
            ? { toString: () => aliadoConfig.montoRecargoNocturno!.toString() } as any
            : null;
        horaInicioRecargo = aliadoConfig.recargoNocturnoInicio ?? null;
        horaFinRecargo = aliadoConfig.recargoNocturnoFin ?? null;
    }

    if (aplicaRecargo && montoRecargo) {
        const horaReserva = hora.split(':').map(Number);
        const horaInicio = horaInicioRecargo?.split(':').map(Number);
        const horaFin = horaFinRecargo?.split(':').map(Number);

        if (horaInicio && horaFin) {
            const minutosReserva = horaReserva[0] * 60 + horaReserva[1];
            const minutosInicio = horaInicio[0] * 60 + horaInicio[1];
            const minutosFin = horaFin[0] * 60 + horaFin[1];

            // Handle overnight ranges (e.g., 22:00 to 06:00)
            const enRango =
                minutosInicio <= minutosFin
                    ? minutosReserva >= minutosInicio && minutosReserva <= minutosFin
                    : minutosReserva >= minutosInicio || minutosReserva <= minutosFin;

            if (enRango) {
                recargoNocturno = Number(montoRecargo);
            }
        }
    }

    // 5. Municipality surcharge
    // Priority: aliado override > standard MUNICIPALITY_PRICES
    let tarifaMunicipio = 0;
    if (aliadoConfig?.tarifaMunicipio !== undefined) {
        tarifaMunicipio = aliadoConfig.tarifaMunicipio;
    } else {
        tarifaMunicipio = MUNICIPALITY_PRICES[municipio] ?? 0;
    }

    // 6. Calculate subtotal
    const subtotalCampos = camposDinamicos.reduce(
        (sum, item) => sum + item.total,
        0
    );
    const subtotal =
        precioBase + subtotalCampos + recargoNocturno + tarifaMunicipio;

    // 7. Apply ally discount/commission
    let descuentoAliado = 0;
    let comisionAliado = 0;

    if (aliadoConfig) {
        // Comisión: para Olaya usa la config alterna si existe (fallback a JMC).
        const comisionValor = esOlaya && aliadoConfig.comisionPorcentajeOlaya != null
            ? aliadoConfig.comisionPorcentajeOlaya
            : aliadoConfig.comisionPorcentaje;
        const tipoComision = esOlaya && aliadoConfig.tipoComisionOlaya != null
            ? aliadoConfig.tipoComisionOlaya
            : aliadoConfig.tipoComision;
        if (comisionValor) {
            if (tipoComision === 'FIJO') {
                comisionAliado = comisionValor; // fixed COP amount
            } else {
                // PORCENTAJE (default)
                comisionAliado = subtotal * (comisionValor / 100);
            }
        }
    }

    // 8. Final total: commission is ADDED (client pays it)
    const total = subtotal + comisionAliado - descuentoAliado;

    return {
        precioBase,
        camposDinamicos,
        recargoNocturno,
        tarifaMunicipio,
        descuentoAliado,
        comisionAliado,
        subtotal,
        total,
    };
}

// ============================================
// FASE 3 — RECÁLCULO AUTORITATIVO (WEB DIRECTO, NO-ALIADO)
// ============================================

export interface WebDirectoVehiculo {
    vehiculoId: string;
    precio: any;
    precioOlaya?: any;
}

export interface WebDirectoServicio {
    esCompartido: boolean;
    esPorHoras: boolean;
    esAeropuerto: boolean;
    aplicaRecargoNocturno: boolean;
    montoRecargoNocturno: any;
    recargoNocturnoInicio: string | null;
    recargoNocturnoFin: string | null;
    configuracion: unknown;
    vehiculosPermitidos: WebDirectoVehiculo[];
}

export interface WebDirectoInput {
    servicio: WebDirectoServicio;
    vehiculoId?: string | null;
    numeroPasajeros: number;
    cantidadHoras?: number | null;
    hora: string;
    datosDinamicos: DynamicFieldValues;
    aeropuertoNombre?: AeropuertoNombreInput | null;
    municipio?: string | null;
    municipioConfigId?: string | null;
    /** Recargo del MunicipioConfig seleccionado (COP). 0 si no aplica. */
    municipioConfigRecargo?: number;
}

export interface WebDirectoComponentes {
    precioBase: number;
    precioAdicionales: number;
    recargoNocturno: number;
    tarifaMunicipio: number;
}

/**
 * 🔒 FASE 3 — Recalcula server-side, desde la BD, los 4 componentes de precio que hoy la
 * ruta web confía al frontend, para el camino web directo (cliente final, sin aliado).
 *
 * Espeja EXACTAMENTE la lógica del wizard (components/reservas/wizard/Step1TripDetails.tsx):
 *  - Compartido: precio del cupo × pasajeros; adicionales/recargo/municipio = 0.
 *  - Por horas:  precio del vehículo × horas.
 *  - Aeropuerto: usa precioOlaya cuando el destino es Olaya Herrera (fallback a precio).
 *  - Municipio "OTRO" sin config dinámica: todo a 0 (cotización manual), igual que el wizard.
 *  - Tarifa de municipio: SOLO desde MunicipioConfig (el mapa estático MUNICIPALITY_PRICES
 *    no participa en el flujo web — el wizard pasa Municipio.OTRO y su fee es 0).
 *
 * NO cubre el camino de aliado (precio base y comisión de aliado se resuelven aparte en la
 * ruta). El precio por persona (POR_PERSONA_TRAMOS) tampoco: ese ya se recalcula server-side.
 */
export function recalcularPrecioWebDirecto(input: WebDirectoInput): WebDirectoComponentes {
    const { servicio } = input;
    const cero: WebDirectoComponentes = { precioBase: 0, precioAdicionales: 0, recargoNocturno: 0, tarifaMunicipio: 0 };

    // Municipio desconocido sin config dinámica → cotización manual (precio 0), igual que el wizard.
    if (input.municipio === 'OTRO' && !input.municipioConfigId) {
        return cero;
    }

    // ── Precio base del vehículo ──
    const vehiculoConfig = servicio.vehiculosPermitidos.find((v) => v.vehiculoId === input.vehiculoId);
    const esOlaya = !!servicio.esAeropuerto && input.aeropuertoNombre === 'OLAYA_HERRERA';
    const precioOlaya = vehiculoConfig ? (vehiculoConfig as any).precioOlaya : null;
    const precioVehiculo = vehiculoConfig
        ? (esOlaya && precioOlaya != null && Number(precioOlaya) > 0
            ? Number(precioOlaya)
            : Number(vehiculoConfig.precio))
        : 0;

    // ── Compartido: precio del cupo × pasajeros, sin adicionales/recargo/municipio ──
    if (servicio.esCompartido) {
        return {
            precioBase: (Number.isFinite(precioVehiculo) ? precioVehiculo : 0) * (input.numeroPasajeros || 0),
            precioAdicionales: 0,
            recargoNocturno: 0,
            tarifaMunicipio: 0,
        };
    }

    let precioBase = Number.isFinite(precioVehiculo) ? precioVehiculo : 0;
    if (servicio.esPorHoras && input.cantidadHoras && input.cantidadHoras > 0) {
        precioBase = precioBase * input.cantidadHoras;
    }

    // ── Campos dinámicos (adicionales) ──
    let precioAdicionales = 0;
    const camposConfig = validateDynamicFields(getConfiguracion(servicio.configuracion).camposCustom);
    for (const campo of camposConfig) {
        if (!campo.tienePrecio || !campo.precioUnitario) continue;
        const valor = input.datosDinamicos?.[campo.clave];
        if (valor === undefined || valor === null) continue;
        if (campo.tipo === 'COUNTER') {
            const n = Number(valor);
            if (Number.isFinite(n) && n > 0) precioAdicionales += n * campo.precioUnitario;
        } else if (campo.tipo === 'SWITCH') {
            if (valor === true) precioAdicionales += campo.precioUnitario;
        } else if (campo.tipo === 'SELECT' && 'opciones' in campo) {
            const opcion = campo.opciones.find((o) => o.valor === valor);
            if (opcion?.precio) precioAdicionales += opcion.precio;
        }
    }

    // ── Recargo nocturno (config del servicio) ──
    let recargoNocturno = 0;
    if (servicio.aplicaRecargoNocturno && servicio.montoRecargoNocturno != null &&
        isNightSurchargeApplicable(input.hora, servicio.recargoNocturnoInicio, servicio.recargoNocturnoFin)) {
        recargoNocturno = Number(servicio.montoRecargoNocturno) || 0;
    }

    // ── Tarifa de municipio (solo MunicipioConfig) ──
    const tarifaMunicipio = Number(input.municipioConfigRecargo) || 0;

    return { precioBase, precioAdicionales, recargoNocturno, tarifaMunicipio };
}

// ============================================
// CLIENT-SIDE PRICE CALCULATION (FOR DISPLAY)
// ============================================

/**
 * Frontend helper for real-time price display
 * Still calculates from service config, but runs client-side for UX
 *
 * ⚠️ This is ONLY for display purposes. Server always recalculates.
 */
export function calculatePriceClientSide(
    camposPersonalizados: unknown,
    precioVehiculo: number,
    datosDinamicos: Record<string, any>,
    aplicaRecargoNocturno: boolean,
    montoRecargoNocturno: number,
    tarifaMunicipio: number,
    hora?: string,
    recargoNocturnoInicio?: string | null,
    recargoNocturnoFin?: string | null
): number {
    try {
        const campos = validateDynamicFields(camposPersonalizados);

        let total = precioVehiculo;

        // Add dynamic field prices
        for (const campo of campos) {
            if (!campo.tienePrecio || !campo.precioUnitario) continue;

            const valor = datosDinamicos[campo.clave];
            if (valor === undefined || valor === null) continue;

            if (campo.tipo === 'COUNTER') {
                total += Number(valor) * campo.precioUnitario;
            } else if (campo.tipo === 'SWITCH' && valor === true) {
                total += campo.precioUnitario;
            } else if (campo.tipo === 'SELECT' && 'opciones' in campo) {
                const opcion = campo.opciones.find((opt) => opt.valor === valor);
                if (opcion?.precio) {
                    total += opcion.precio;
                }
            }
        }

        // Add night surcharge with proper time range check
        if (aplicaRecargoNocturno && hora && isNightSurchargeApplicable(hora, recargoNocturnoInicio ?? null, recargoNocturnoFin ?? null)) {
            total += montoRecargoNocturno;
        }

        // Add municipality surcharge
        total += tarifaMunicipio;

        return total;
    } catch (error) {
        console.error('Error calculating price:', error);
        return precioVehiculo; // Fallback to base price
    }
}

/**
 * Get detailed price breakdown for display
 */
export function getPriceBreakdownClientSide(
    camposPersonalizados: unknown,
    precioVehiculo: number,
    datosDinamicos: Record<string, any>,
    aplicaRecargoNocturno: boolean,
    montoRecargoNocturno: number,
    tarifaMunicipio: number
): {
    base: number;
    items: { label: string; amount: number }[];
    total: number;
} {
    const items: { label: string; amount: number }[] = [];
    let total = precioVehiculo;

    try {
        const campos = validateDynamicFields(camposPersonalizados);

        // Add dynamic field prices
        for (const campo of campos) {
            if (!campo.tienePrecio || !campo.precioUnitario) continue;

            const valor = datosDinamicos[campo.clave];
            if (valor === undefined || valor === null) continue;

            let amount = 0;

            if (campo.tipo === 'COUNTER') {
                amount = Number(valor) * campo.precioUnitario;
                items.push({
                    label: `${campo.etiqueta.es} (${valor})`,
                    amount,
                });
            } else if (campo.tipo === 'SWITCH' && valor === true) {
                amount = campo.precioUnitario;
                items.push({
                    label: campo.etiqueta.es,
                    amount,
                });
            } else if (campo.tipo === 'SELECT' && 'opciones' in campo) {
                const opcion = campo.opciones.find((opt) => opt.valor === valor);
                if (opcion?.precio) {
                    amount = opcion.precio;
                    items.push({
                        label: `${campo.etiqueta.es}: ${opcion.etiqueta.es}`,
                        amount,
                    });
                }
            }

            total += amount;
        }

        // Add surcharges
        if (aplicaRecargoNocturno && montoRecargoNocturno > 0) {
            items.push({
                label: 'Recargo nocturno',
                amount: montoRecargoNocturno,
            });
            total += montoRecargoNocturno;
        }

        if (tarifaMunicipio > 0) {
            items.push({
                label: 'Tarifa municipal',
                amount: tarifaMunicipio,
            });
            total += tarifaMunicipio;
        }
    } catch (error) {
        console.error('Error getting price breakdown:', error);
    }

    return {
        base: precioVehiculo,
        items,
        total,
    };
}
