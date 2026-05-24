import { Servicio, Municipio } from '@prisma/client';
import {
    DynamicField,
    DynamicFieldValues,
    validateDynamicFields,
} from '@/types/dynamic-fields';
import { getConfiguracion } from '@/types/servicio-config';
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
    // Comisión calculada para el vehículo seleccionado en PrecioVehiculoAliado
    comisionPorcentaje?: number;
    tipoComision?: 'FIJO' | 'PORCENTAJE';
    sobrescribirRecargoNocturno?: boolean;
    aplicaRecargoNocturno?: boolean;
    recargoNocturnoInicio?: string;
    recargoNocturnoFin?: string;
    montoRecargoNocturno?: number;
}

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
        vehiculosPermitidos: { vehiculoId: string; precio: any }[];
    },
    vehiculoId: string,
    datosDinamicos: DynamicFieldValues,
    fecha: Date,
    hora: string,
    municipio: Municipio,
    aliadoConfig?: AliadoConfig,
    cantidadHoras?: number
): Promise<PriceBreakdown> {
    // 1. Get base price from ServicioVehiculo.precio (única fuente)
    const vehiculoConfig = servicio.vehiculosPermitidos.find(
        (v) => v.vehiculoId === vehiculoId
    );
    if (!vehiculoConfig) {
        throw new Error('Vehículo no disponible para este servicio');
    }
    let precioBase = Number(vehiculoConfig.precio);
    if (!Number.isFinite(precioBase) || precioBase <= 0) {
        throw new Error('Este servicio no tiene precio configurado para el vehículo seleccionado');
    }

    // 1b. If service has esPorHoras module, multiply base price by hours
    if (servicio.esPorHoras && cantidadHoras && cantidadHoras > 0) {
        precioBase = precioBase * cantidadHoras;
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
        if (aliadoConfig.comisionPorcentaje) {
            if (aliadoConfig.tipoComision === 'FIJO') {
                comisionAliado = aliadoConfig.comisionPorcentaje; // fixed COP amount
            } else {
                // PORCENTAJE (default)
                comisionAliado = subtotal * (aliadoConfig.comisionPorcentaje / 100);
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
