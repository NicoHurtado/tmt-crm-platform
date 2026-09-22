import { comisionPorPersona, type PreciosPorPersona } from '@/types/servicio-config';

/**
 * Precio "Desde $…" que se muestra en el catálogo co-branded de un aliado
 * (`/reservas/[codigoAliado]`), sin que el cliente tenga que llenar el formulario.
 *
 * Replica la lógica de precio del wizard en modo aliado (Step1TripDetails) para la
 * opción más barata disponible de ESE aliado:
 *  - Vehículo: `precioServicio` del aliado (PrecioVehiculoAliado.precioBase, o su
 *    alterno Olaya si es menor) + comisión del aliado (porcentaje o fijo).
 *  - Tour compartido: precio del cupo por 1 persona + comisión.
 *  - Tour POR_PERSONA: tarifa p1 + comisión por persona (override o ±10% por tipo).
 *
 * No incluye cargos condicionales (recargo nocturno, municipio, campos dinámicos).
 * Devuelve null si el aliado no tiene precio configurado para el servicio.
 */

export interface PrecioDesde {
    monto: number;
    unidad: 'persona' | 'hora' | null;
}

interface VehiculoAliado {
    activo?: boolean;
    precioServicio?: number | null;
    tipoComision?: 'PORCENTAJE' | 'FIJO' | null;
    comisionValor?: number | null;
    precioServicioOlaya?: number | null;
    tipoComisionOlaya?: 'PORCENTAJE' | 'FIJO' | null;
    comisionValorOlaya?: number | null;
}

interface ServicioAliadoPrecio {
    esAeropuerto?: boolean;
    esPorHoras?: boolean;
    esCompartido?: boolean;
    tipoTarifa?: string | null;
    preciosPorPersona?: PreciosPorPersona | null;
    comisionPorPersonaAliadoTipo?: 'PORCENTAJE' | 'FIJO' | null;
    comisionPorPersonaAliadoValor?: number | null;
    vehiculos?: VehiculoAliado[];
}

function conComision(precio: number, tipo: string | null | undefined, valor: number | null | undefined): number {
    const v = Number(valor ?? 0);
    if (v <= 0) return precio;
    return precio + (tipo === 'FIJO' ? v : Math.round(precio * (v / 100)));
}

export function calcularPrecioDesdeAliado(sa: ServicioAliadoPrecio, aliadoTipo: string | null | undefined): PrecioDesde | null {
    if (sa.tipoTarifa === 'POR_PERSONA') {
        const p1 = Number(sa.preciosPorPersona?.p1 ?? 0);
        if (p1 <= 0) return null;
        const comision = comisionPorPersona(p1, aliadoTipo, {
            tipo: sa.comisionPorPersonaAliadoTipo ?? null,
            valor: sa.comisionPorPersonaAliadoValor ?? null,
        });
        const monto = p1 + comision;
        return monto > 0 ? { monto, unidad: 'persona' } : null;
    }

    const candidatos: number[] = [];
    for (const v of sa.vehiculos ?? []) {
        if (v.activo === false) continue;
        const precio = Number(v.precioServicio ?? 0);
        if (precio > 0) candidatos.push(conComision(precio, v.tipoComision, v.comisionValor));
        // Aeropuerto Olaya Herrera: precio/comisión alternos (fallback a los de JMC).
        if (sa.esAeropuerto && v.precioServicioOlaya != null && Number(v.precioServicioOlaya) > 0) {
            candidatos.push(conComision(
                Number(v.precioServicioOlaya),
                v.tipoComisionOlaya ?? v.tipoComision,
                v.comisionValorOlaya ?? v.comisionValor,
            ));
        }
    }
    if (candidatos.length === 0) return null;

    return {
        monto: Math.min(...candidatos),
        unidad: sa.esCompartido ? 'persona' : sa.esPorHoras ? 'hora' : null,
    };
}
